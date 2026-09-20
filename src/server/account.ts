import { decoration } from "./profiles";
import { all, one, run, transaction } from "./db";
import { command } from "./shared";
import type { User } from "@/lib/types";
export function settings(
  user: User,
  input: { name: string; sharing: boolean; notify: boolean },
  key: string | null,
) {
  return command(user.id, "settings", key, input, () => {
    run(
      "UPDATE users SET name=?,sharing=?,notify=? WHERE id=?",
      input.name,
      Number(input.sharing),
      Number(input.notify),
      user.id,
    );
    if (!input.sharing) {
      run(
        "UPDATE availability SET mode=NULL,session_id=NULL,expires_at=NULL,revision=revision+1 WHERE user_id=?",
        user.id,
      );
      run(
        "UPDATE study_sessions SET visibility='private',revision=revision+1 WHERE user_id=? AND state IN ('running','paused','awaiting_confirmation')",
        user.id,
      );
      run(
        "UPDATE hops SET state='cancelled',ended_at=?,revision=revision+1 WHERE user_id=? AND state='on_way'",
        Date.now(),
        user.id,
      );
    }
    return { ok: true };
  });
}
export function exportAccount(user: User) {
  return {
    exportedAt: new Date().toISOString(),
    profile: user,
    decoration: decoration(user.id),
    rewards: all("SELECT * FROM rewards WHERE user_id=?", user.id),
    cosmetics: all("SELECT * FROM cosmetics_owned WHERE user_id=?", user.id),
    subscription: one(
      "SELECT status,period_end FROM subscriptions WHERE user_id=?",
      user.id,
    ),
    sessions: all("SELECT * FROM study_sessions WHERE user_id=?", user.id),
    bookings: all("SELECT * FROM bookings WHERE user_id=?", user.id),
    reviews: all("SELECT * FROM reviews WHERE user_id=?", user.id),
    reports: all("SELECT * FROM reports WHERE user_id=?", user.id),
    saved: all("SELECT * FROM saved WHERE user_id=?", user.id),
    availability: one("SELECT * FROM availability WHERE user_id=?", user.id),
    friendships: all(
      "SELECT * FROM friendships WHERE a=? OR b=?",
      user.id,
      user.id,
    ),
    hops: all("SELECT * FROM hops WHERE user_id=?", user.id),
    follows: all("SELECT * FROM follows WHERE user_id=?", user.id),
    blocks: all("SELECT * FROM blocks WHERE user_id=?", user.id),
  };
}
export function deleteAccount(user: User) {
  transaction(() => {
    // Idempotency responses from other users can contain a deleted hop target.
    const related = all<{ user_id: string }>(
      "SELECT DISTINCT user_id FROM hops WHERE target_user_id=?",
      user.id,
    );
    for (const u of related)
      run(
        "UPDATE idempotency SET response=NULL WHERE user_id=? AND operation LIKE 'hop:%'",
        u.user_id,
      );
    run(
      "DELETE FROM outbox WHERE kind='hop' AND entity_id IN(SELECT id FROM hops WHERE target_user_id=?)",
      user.id,
    );
    run(
      "DELETE FROM notifications WHERE kind='hop' AND entity_id IN(SELECT id FROM hops WHERE target_user_id=?)",
      user.id,
    );
    run("DELETE FROM users WHERE id=?", user.id);
  });
  return { deleted: true };
}
