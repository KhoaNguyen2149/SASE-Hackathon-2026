import { all, one, run } from "./db";
import { assert } from "./errors";
import {
  blocked,
  command,
  event,
  friendIds,
  friends,
  id,
  rateLimit,
  requireVerified,
} from "./shared";
import { normalizeUser, ownAvailability, ownSession } from "./sessions";
import { friendNowPlaying } from "./spotify";
import type { Friend, Hop, StudySession, User } from "@/lib/types";
export function projectFriend(
  viewerId: string,
  targetId: string,
): Friend | null {
  if (!friends(viewerId, targetId)) return null;
  const user = one<User & { suspended: number }>(
    "SELECT id,name,handle,sharing,suspended FROM users WHERE id=?",
    targetId,
  );
  if (!user || user.suspended) return null;
  const base: Friend = {
    id: user.id,
    name: user.name,
    handle: user.handle,
    relationship: "accepted",
    sender_id: "",
    status: "No shared status",
    expires_at: null,
    can_hop: false,
  };
  if (!user.sharing) return base;
  const now = Date.now();
  const a = ownAvailability(targetId),
    s = ownSession(targetId);
  const mode = a.expires_at && a.expires_at > now ? a.mode : null;
  const valid =
    !!s &&
    s.state === "running" &&
    s.visibility !== "private" &&
    s.last_heartbeat_at > now - 600000 &&
    s.segment_started_at !== null &&
    s.focus_seconds + (now - s.segment_started_at) / 1000 < s.target_seconds;
  if (valid && s) {
    base.status = "Studying and focused";
    base.session_id = s.id;
    base.expires_at = Math.min(
      s.last_heartbeat_at + 600000,
      s.segment_started_at! + (s.target_seconds - s.focus_seconds) * 1000,
    );
    if (s.visibility === "friends_status_and_venue" && s.spot_id) {
      const spot = one<{ name: string }>(
        "SELECT name FROM spots WHERE id=? AND published=1",
        s.spot_id,
      );
      if (spot) {
        base.spot_id = s.spot_id;
        base.spot_name = spot.name;
      }
    }
    if (mode === "open_to_join" && a.session_id === s.id && base.spot_id) {
      base.status = "Open to company";
      base.can_hop = true;
      base.expires_at = Math.min(base.expires_at, a.expires_at!);
    }
  }
  if (mode === "dnd" || mode === "busy") {
    base.status = mode === "dnd" ? "Do not disturb" : "Busy";
    base.can_hop = false;
    base.expires_at = a.expires_at;
  }
  if (
    mode === "available" &&
    !s &&
    !one(
      "SELECT 1 FROM hops WHERE user_id=? AND state='on_way' AND expires_at>?",
      targetId,
      now,
    )
  ) {
    base.status = "Available now";
    base.expires_at = a.expires_at;
  }
  base.listening = friendNowPlaying(viewerId, targetId) || undefined;
  return base;
}
export function friendList(userId: string) {
  const accepted = friendIds(userId)
    .map((target) => projectFriend(userId, target))
    .filter((x): x is Friend => !!x);
  const requests = all<Friend>(
    "SELECT u.id,u.name,u.handle,f.state relationship,f.sender_id FROM friendships f JOIN users u ON u.id=CASE WHEN f.a=? THEN f.b ELSE f.a END WHERE (f.a=? OR f.b=?) AND f.state='pending' AND u.suspended=0",
    userId,
    userId,
    userId,
  ).filter((x) => !blocked(userId, x.id));
  const blockedUsers = all<{ id: string; name: string; handle: string }>(
    "SELECT u.id,u.name,u.handle FROM blocks b JOIN users u ON u.id=b.target_id WHERE b.user_id=?",
    userId,
  );
  return {
    friends: accepted,
    requests,
    blocked: blockedUsers,
    incoming: incomingHops(userId),
  };
}
export function relationship(
  user: User,
  input: {
    action:
      | "request"
      | "accept"
      | "remove"
      | "block"
      | "unblock"
      | "follow"
      | "unfollow";
    target: string;
  },
  key: string | null,
) {
  requireVerified(user);
  return command(user.id, "relationship", key, input, () => {
    const target = one<{ id: string }>(
      "SELECT id FROM users WHERE (id=? OR handle=?) AND suspended=0",
      input.target,
      input.target,
    );
    assert(
      target && target.id !== user.id,
      "USER_UNAVAILABLE",
      "That person is not available.",
      404,
    );
    const [a, b] = [user.id, target.id].sort();
    const action = input.action;
    if (action === "block") {
      run("INSERT OR IGNORE INTO blocks VALUES(?,?)", user.id, target.id);
      run("DELETE FROM friendships WHERE a=? AND b=?", a, b);
      run(
        "DELETE FROM follows WHERE (user_id=? AND target_id=?) OR (user_id=? AND target_id=?)",
        a,
        b,
        b,
        a,
      );
      run(
        "UPDATE hops SET state='cancelled',ended_at=?,revision=revision+1 WHERE state='on_way' AND ((user_id=? AND target_user_id=?) OR (user_id=? AND target_user_id=?))",
        Date.now(),
        a,
        b,
        b,
        a,
      );
      return { ok: true };
    }
    if (action === "unblock") {
      run(
        "DELETE FROM blocks WHERE user_id=? AND target_id=?",
        user.id,
        target.id,
      );
      return { ok: true };
    }
    assert(
      !blocked(user.id, target.id),
      "USER_UNAVAILABLE",
      "That person is not available.",
      404,
    );
    if (action === "request") {
      rateLimit(`request:${user.id}`, 20, 3600000);
      run(
        "INSERT OR IGNORE INTO friendships VALUES(?,?,?,'pending',?)",
        a,
        b,
        user.id,
        Date.now(),
      );
    }
    if (action === "accept") {
      const request = one<{ sender_id: string; state: string }>(
        "SELECT sender_id,state FROM friendships WHERE a=? AND b=?",
        a,
        b,
      );
      assert(
        request && request.sender_id !== user.id && request.state === "pending",
        "INVALID_REQUEST",
        "No incoming friend request is available.",
      );
      run("UPDATE friendships SET state='accepted' WHERE a=? AND b=?", a, b);
    }
    if (action === "remove")
      run("DELETE FROM friendships WHERE a=? AND b=?", a, b);
    if (action === "follow") {
      run(
        "INSERT OR IGNORE INTO first_follows VALUES(?,?,?)",
        user.id,
        target.id,
        Date.now(),
      );
      run(
        "INSERT OR IGNORE INTO follows(user_id,target_id,created_at) VALUES(?,?,?)",
        user.id,
        target.id,
        Date.now(),
      );
    }
    if (action === "unfollow")
      run(
        "DELETE FROM follows WHERE user_id=? AND target_id=?",
        user.id,
        target.id,
      );
    return { ok: true };
  });
}
export function ownHop(userId: string) {
  return (
    one<Hop>(
      "SELECT h.*,s.name spot_name,u.name target_name,(SELECT state FROM outbox WHERE kind='hop' AND entity_id=h.id) delivery FROM hops h JOIN spots s ON s.id=h.spot_id JOIN users u ON u.id=h.target_user_id WHERE h.user_id=? AND h.state='on_way' AND h.expires_at>?",
      userId,
      Date.now(),
    ) || null
  );
}
export function eligibleHop(h: Hop) {
  if (h.state !== "on_way" || h.expires_at <= Date.now()) return false;
  const sender = one<{ sharing: number; suspended: number }>(
    "SELECT sharing,suspended FROM users WHERE id=?",
    h.user_id,
  );
  if (!sender?.sharing || sender.suspended) return false;
  const target = projectFriend(h.user_id, h.target_user_id);
  return (
    !!target?.can_hop &&
    target.session_id === h.target_session_id &&
    target.spot_id === h.spot_id
  );
}
export function incomingHops(userId: string) {
  return all<Hop>(
    "SELECT * FROM hops WHERE target_user_id=? AND state='on_way' AND expires_at>?",
    userId,
    Date.now(),
  )
    .filter(eligibleHop)
    .map((h) => ({
      id: h.id,
      name: one<{ name: string }>(
        "SELECT name FROM users WHERE id=?",
        h.user_id,
      )!.name,
      spot_name: one<{ name: string }>(
        "SELECT name FROM spots WHERE id=?",
        h.spot_id,
      )!.name,
      eta_at: h.eta_at,
      expires_at: h.expires_at,
    }));
}
export function createHop(
  user: User,
  input: {
    target_user_id: string;
    target_session_id: string;
    eta_minutes: 10 | 20 | 30 | null;
  },
  key: string | null,
) {
  requireVerified(user);
  return command(user.id, "hop:create", key, input, () => {
    normalizeUser(user.id);
    normalizeUser(input.target_user_id);
    assert(
      user.sharing,
      "SHARING_DISABLED",
      "Enable sharing in Profile before sending an arrival update.",
      403,
    );
    assert(
      !ownSession(user.id),
      "SESSION_ACTIVE",
      "Finish or cancel your study session before hopping over.",
    );
    assert(
      !ownHop(user.id),
      "HOP_ACTIVE",
      "You already have a hop in progress.",
    );
    const target = projectFriend(user.id, input.target_user_id);
    assert(
      target?.can_hop &&
        target.spot_id &&
        target.session_id === input.target_session_id,
      "RECIPIENT_UNAVAILABLE",
      "Your friend can't receive this arrival update now. Refresh their shared activity.",
    );
    rateLimit(`hops:${user.id}`, 5, 3600000);
    rateLimit(`hops:${user.id}:${target.id}`, 3, 3600000);
    const now = Date.now(),
      hopId = id(),
      eta = input.eta_minutes ? now + input.eta_minutes * 60000 : null,
      expires = eta ? eta + 1800000 : now + 3600000;
    run(
      "INSERT INTO hops(id,user_id,spot_id,target_user_id,target_session_id,state,eta_at,expires_at,created_at) VALUES(?,?,?,?,?,'on_way',?,?,?)",
      hopId,
      user.id,
      target.spot_id,
      target.id,
      target.session_id!,
      eta,
      expires,
      now,
    );
    run(
      "UPDATE availability SET mode=NULL,expires_at=NULL,session_id=NULL,revision=revision+1 WHERE user_id=? AND mode='available'",
      user.id,
    );
    event("hop", user.id, hopId);
    return ownHop(user.id)!;
  });
}
export function hopAction(
  user: User,
  hopId: string,
  input: {
    action: "arrive" | "cancel" | "update_eta";
    revision: number;
    eta_minutes?: 10 | 20 | 30 | null;
  },
  key: string | null,
) {
  return command(user.id, `hop:${hopId}`, key, input, () => {
    normalizeUser(user.id);
    const h = one<Hop>(
      "SELECT * FROM hops WHERE id=? AND user_id=?",
      hopId,
      user.id,
    );
    assert(h, "NOT_FOUND", "Hop not found.", 404);
    assert(
      h.revision === input.revision,
      "REVISION_CONFLICT",
      "This hop changed in another tab. Refresh and try again.",
    );
    assert(h.state === "on_way", "HOP_ENDED", "This arrival update has ended.");
    const now = Date.now();
    if (input.action === "update_eta") {
      rateLimit(`eta:${user.id}`, 10, 60000);
      const eta = input.eta_minutes ? now + input.eta_minutes * 60000 : null;
      run(
        "UPDATE hops SET eta_at=?,expires_at=?,revision=revision+1 WHERE id=?",
        eta,
        Math.min(h.created_at + 7200000, eta ? eta + 1800000 : now + 3600000),
        h.id,
      );
    } else
      run(
        "UPDATE hops SET state=?,ended_at=?,revision=revision+1 WHERE id=?",
        input.action === "arrive" ? "arrived" : "cancelled",
        now,
        h.id,
      );
    return one<Hop>("SELECT * FROM hops WHERE id=?", h.id)!;
  });
}
export function completionEligible(viewerId: string, s: StudySession) {
  const sender = one<{ sharing: number; suspended: number }>(
    "SELECT sharing,suspended FROM users WHERE id=?",
    s.user_id,
  );
  const recipient = one<{ notify: number }>(
    "SELECT notify FROM users WHERE id=?",
    viewerId,
  );
  const a = ownAvailability(viewerId);
  return (
    friends(viewerId, s.user_id) &&
    sender?.sharing &&
    !sender.suspended &&
    recipient?.notify &&
    s.share_completion &&
    s.visibility !== "private" &&
    s.state === "completed" &&
    !(a.mode === "dnd" && a.expires_at! > Date.now())
  );
}
