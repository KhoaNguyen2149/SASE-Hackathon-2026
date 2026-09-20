import { progress } from "./rewards";
import { z } from "zod";
import { all, one, run } from "./db";
import { command, rateLimit, requireVerified } from "./shared";
import { assert } from "./errors";
import { avatarPattern, maxAvatarDataUrl } from "@/lib/avatar";
import {
  themes,
  banners,
  avatars,
  stickerOptions,
  interestOptions,
  defaultDecoration,
  type ProfileDecoration,
} from "@/lib/profile-style";
import type { User } from "@/lib/types";
export const decorationSchema = z.object({
  border: z.enum(["plain", "leaf", "orbit", "laurel"]).default("plain"),
  bio: z.string().trim().max(240),
  theme: z.enum(themes),
  banner: z.enum(banners),
  avatar: z.enum(avatars),
  stickers: z.array(z.enum(stickerOptions)).max(5),
  pinned_spots: z.array(z.string().min(1).max(100)).max(3),
  interests: z.array(z.enum(interestOptions)).max(5),
  leaderboard: z.boolean(),
});
// The picture has its own command: it is uploaded on its own, and its payload
// is far larger than the rest of the decoration.
export type DecorationInput = Omit<ProfileDecoration, "avatar_url">;
export const avatarUrlSchema = z
  .string()
  .max(maxAvatarDataUrl)
  .regex(avatarPattern, "Upload a JPEG, PNG, or WebP image.")
  .or(z.literal(""));
const signatures: Record<string, (bytes: Buffer) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 8).toString("hex") === "89504e470d0a1a0a",
  "image/webp": (b) =>
    b.subarray(0, 4).toString("latin1") === "RIFF" &&
    b.subarray(8, 12).toString("latin1") === "WEBP",
};
export function decoration(userId: string): ProfileDecoration {
  const row = one<{
    border: string;
    bio: string;
    avatar_url: string;
    theme: string;
    banner: string;
    avatar: string;
    stickers: string;
    pinned_spots: string;
    interests: string;
    leaderboard: number;
  }>("SELECT * FROM profiles WHERE user_id=?", userId);
  return row
    ? {
        border: row.border,
        avatar_url: row.avatar_url || "",
        bio: row.bio,
        theme: row.theme,
        banner: row.banner,
        avatar: row.avatar,
        stickers: JSON.parse(row.stickers),
        pinned_spots: JSON.parse(row.pinned_spots),
        interests: JSON.parse(row.interests),
        leaderboard: !!row.leaderboard,
      }
    : { ...defaultDecoration };
}
export function saveDecoration(
  user: User,
  input: DecorationInput,
  key: string | null,
) {
  requireVerified(user);
  return command(user.id, "profile:decorate", key, input, () => {
    const owned = progress(user.id).owned;
    for (const field of ["theme", "banner", "border"] as const)
      assert(
        owned.includes(`${field}:${input[field]}`),
        "DECORATION_LOCKED",
        "Unlock this decoration in the rewards shop first.",
        403,
      );
    const pins = [...new Set(input.pinned_spots)];
    for (const id of pins)
      assert(
        one("SELECT 1 FROM spots WHERE id=? AND published=1", id),
        "SPOT_UNAVAILABLE",
        "Choose a published study spot.",
        400,
      );
    run(
      `INSERT INTO profiles(user_id,bio,theme,banner,avatar,stickers,pinned_spots,interests,leaderboard,updated_at,border) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET bio=excluded.bio,theme=excluded.theme,banner=excluded.banner,avatar=excluded.avatar,stickers=excluded.stickers,pinned_spots=excluded.pinned_spots,interests=excluded.interests,leaderboard=excluded.leaderboard,updated_at=excluded.updated_at,border=excluded.border`,
      user.id,
      input.bio,
      input.theme,
      input.banner,
      input.avatar,
      JSON.stringify([...new Set(input.stickers)]),
      JSON.stringify(pins),
      JSON.stringify([...new Set(input.interests)]),
      Number(input.leaderboard),
      Date.now(),
      input.border,
    );
    return { decoration: decoration(user.id) };
  });
}
export function avatarUrl(userId: string) {
  return (
    one<{ avatar_url: string }>(
      "SELECT avatar_url FROM profiles WHERE user_id=?",
      userId,
    )?.avatar_url || ""
  );
}
export function saveAvatar(
  user: User,
  input: { avatar_url: string },
  key: string | null,
) {
  requireVerified(user);
  return command(user.id, "profile:avatar", key, input, () => {
    if (input.avatar_url) {
      // Trust the declared media type only as far as the bytes agree with it.
      const [header, payload] = input.avatar_url.split(",");
      const bytes = Buffer.from(payload, "base64");
      const [type] = Object.keys(signatures).filter((t) => header.includes(t));
      assert(
        type && signatures[type](bytes),
        "INVALID_IMAGE",
        "That file is not a readable JPEG, PNG, or WebP image.",
        400,
      );
      rateLimit(`avatar:${user.id}`, 20, 3600000);
    }
    run(
      `INSERT INTO profiles(user_id,avatar_url,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET avatar_url=excluded.avatar_url,updated_at=excluded.updated_at`,
      user.id,
      input.avatar_url,
      Date.now(),
    );
    return { decoration: decoration(user.id) };
  });
}
export function pinnedSpots(userId: string) {
  return decoration(userId).pinned_spots.flatMap((id) =>
    all<{ id: string; name: string; category: string; image: string }>(
      "SELECT id,name,category,image FROM spots WHERE id=? AND published=1",
      id,
    ),
  );
}
