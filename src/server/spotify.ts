import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { one, run, transaction } from "./db";
import { assert } from "./errors";
import { friends, hash, rateLimit, requireVerified } from "./shared";
import type { User } from "@/lib/types";
export const spotifyEnabled = () =>
  !!process.env.SPOTIFY_CLIENT_ID && !!process.env.SPOTIFY_CLIENT_SECRET;
const origin = () =>
  new URL(
    process.env.APP_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      "http://127.0.0.1:3000",
  ).origin;
export const redirectUri = () => origin() + "/api/spotify/callback";
// Only what is needed to name a track; playback control is never requested.
const scope = "user-read-currently-playing";
const cacheMs = 45000;
const staleMs = 300000;

// Tokens are usable secrets, so they are encrypted at rest with a key derived
// from the client secret rather than stored in the clear beside the database.
function key() {
  return scryptSync(process.env.SPOTIFY_CLIENT_SECRET!, "deskhop-spotify", 32);
}
function seal(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    body.toString("base64"),
  ].join(".");
}
function open(value: string) {
  // An empty body is legitimate: it is how a missing refresh token is stored.
  const parts = value.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1])
    throw new Error("Unreadable token");
  const [iv, tag, body] = parts;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

interface Account {
  user_id: string;
  spotify_id: string;
  display_name: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  share: number;
}
const account = (userId: string) =>
  one<Account>("SELECT * FROM spotify_accounts WHERE user_id=?", userId);

export function connection(userId: string) {
  const row = account(userId);
  return row
    ? { connected: true, name: row.display_name, share: !!row.share }
    : { connected: false, name: "", share: false };
}

export function startConnect(user: User, nextPath: string) {
  requireVerified(user);
  assert(
    spotifyEnabled(),
    "SPOTIFY_UNAVAILABLE",
    "Spotify is not connected to this DeskHop yet.",
    503,
  );
  rateLimit(`spotify-connect:${user.id}`, 10, 3600000);
  const state = randomBytes(24).toString("hex");
  transaction(() => {
    run("DELETE FROM oauth_states WHERE expires_at<?", Date.now());
    run(
      "INSERT INTO oauth_states(state_hash,nonce,verifier,next_path,link_user_id,expires_at) VALUES(?,?,?,?,?,?)",
      hash(state),
      "spotify",
      "",
      nextPath.startsWith("/") && !nextPath.startsWith("//")
        ? nextPath
        : "/profile",
      user.id,
      Date.now() + 600000,
    );
  });
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope,
    state,
    show_dialog: "true",
  });
  return { url: "https://accounts.spotify.com/authorize?" + params };
}

async function tokenRequest(body: Record<string, string>) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
        ).toString("base64"),
    },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10000),
  });
  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  assert(
    response.ok && data.access_token,
    "SPOTIFY_REJECTED",
    "Spotify would not complete the connection. Try linking again.",
    502,
  );
  return data;
}

/** Exchanges the callback code. Returns where to send the person next. */
export async function completeConnect(code: string, state: string) {
  const pending = one<{ link_user_id: string; next_path: string }>(
    "SELECT link_user_id,next_path FROM oauth_states WHERE state_hash=? AND nonce='spotify' AND expires_at>?",
    hash(state),
    Date.now(),
  );
  assert(
    pending?.link_user_id,
    "STATE_INVALID",
    "That Spotify link expired. Start again from your profile.",
    400,
  );
  run("DELETE FROM oauth_states WHERE state_hash=?", hash(state));
  const token = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
  });
  const me = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: "Bearer " + token.access_token },
    signal: AbortSignal.timeout(10000),
  });
  const profile = (await me.json().catch(() => ({}))) as {
    id?: string;
    display_name?: string;
  };
  assert(
    me.ok && profile.id,
    "SPOTIFY_REJECTED",
    "Spotify would not share the account. Try linking again.",
    502,
  );
  run(
    `INSERT INTO spotify_accounts(user_id,spotify_id,display_name,access_token,refresh_token,expires_at,share,connected_at)
     VALUES(?,?,?,?,?,?,1,?)
     ON CONFLICT(user_id) DO UPDATE SET spotify_id=excluded.spotify_id,display_name=excluded.display_name,access_token=excluded.access_token,refresh_token=excluded.refresh_token,expires_at=excluded.expires_at`,
    pending.link_user_id,
    profile.id,
    String(profile.display_name || "").slice(0, 60),
    seal(token.access_token!),
    seal(token.refresh_token || ""),
    Date.now() + (token.expires_in || 3600) * 1000,
    Date.now(),
  );
  return { next: pending.next_path };
}

export function disconnect(user: User) {
  transaction(() => {
    run("DELETE FROM spotify_accounts WHERE user_id=?", user.id);
    run("DELETE FROM spotify_playing WHERE user_id=?", user.id);
  });
  return { ok: true };
}

export function setSharing(user: User, share: boolean) {
  const row = account(user.id);
  assert(row, "SPOTIFY_MISSING", "Connect Spotify first.", 400);
  run(
    "UPDATE spotify_accounts SET share=? WHERE user_id=?",
    Number(share),
    user.id,
  );
  // Stop showing a stale track the moment sharing is turned off.
  if (!share) run("DELETE FROM spotify_playing WHERE user_id=?", user.id);
  return { ok: true };
}

async function accessToken(row: Account) {
  if (row.expires_at > Date.now() + 60000) return open(row.access_token);
  const refresh = open(row.refresh_token);
  if (!refresh) return null;
  const token = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refresh,
  });
  run(
    "UPDATE spotify_accounts SET access_token=?,refresh_token=?,expires_at=? WHERE user_id=?",
    seal(token.access_token!),
    seal(token.refresh_token || refresh),
    Date.now() + (token.expires_in || 3600) * 1000,
    row.user_id,
  );
  return token.access_token!;
}

/**
 * Refreshes one person's own track into the cache. Friends read the cache, so
 * viewing a friend never calls Spotify and a busy page cannot fan out.
 */
export async function syncNowPlaying(userId: string) {
  if (!spotifyEnabled()) return;
  const row = account(userId);
  if (!row || !row.share) return;
  const cached = one<{ fetched_at: number }>(
    "SELECT fetched_at FROM spotify_playing WHERE user_id=?",
    userId,
  );
  if (cached && cached.fetched_at > Date.now() - cacheMs) return;
  try {
    const token = await accessToken(row);
    if (!token) return;
    const response = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: { Authorization: "Bearer " + token },
        signal: AbortSignal.timeout(6000),
      },
    );
    // 204 means nothing is playing; anything else unusual is left alone.
    if (response.status === 204 || response.status === 404) {
      run(
        "INSERT INTO spotify_playing(user_id,track,artist,url,playing,fetched_at) VALUES(?,'','','',0,?) ON CONFLICT(user_id) DO UPDATE SET track='',artist='',url='',playing=0,fetched_at=excluded.fetched_at",
        userId,
        Date.now(),
      );
      return;
    }
    if (!response.ok) return;
    const data = (await response.json()) as {
      is_playing?: boolean;
      item?: {
        name?: string;
        artists?: { name?: string }[];
        external_urls?: { spotify?: string };
      } | null;
    };
    const item = data.item;
    if (!item?.name) return;
    run(
      `INSERT INTO spotify_playing(user_id,track,artist,url,playing,fetched_at) VALUES(?,?,?,?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET track=excluded.track,artist=excluded.artist,url=excluded.url,playing=excluded.playing,fetched_at=excluded.fetched_at`,
      userId,
      String(item.name).slice(0, 200),
      (item.artists || [])
        .map((a) => a.name)
        .filter(Boolean)
        .join(", ")
        .slice(0, 200),
      String(item.external_urls?.spotify || "").slice(0, 500),
      Number(!!data.is_playing),
      Date.now(),
    );
  } catch {
    // A Spotify outage must never take a page down with it.
  }
}

export interface NowPlaying {
  track: string;
  artist: string;
  url: string;
}
/** What a viewer may see of someone else's track, or null. */
export function friendNowPlaying(
  viewerId: string,
  targetId: string,
): NowPlaying | null {
  if (!spotifyEnabled() || viewerId === targetId) return null;
  if (!friends(viewerId, targetId)) return null;
  const sharing = one(
    "SELECT 1 FROM spotify_accounts a JOIN users u ON u.id=a.user_id WHERE a.user_id=? AND a.share=1 AND u.sharing=1",
    targetId,
  );
  if (!sharing) return null;
  const row = one<{
    track: string;
    artist: string;
    url: string;
    playing: number;
    fetched_at: number;
  }>("SELECT * FROM spotify_playing WHERE user_id=?", targetId);
  if (!row?.track || !row.playing || row.fetched_at < Date.now() - staleMs)
    return null;
  return { track: row.track, artist: row.artist, url: row.url };
}
