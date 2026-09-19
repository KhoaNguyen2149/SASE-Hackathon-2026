import { all, one, run, transaction } from "./db";
import { completionEligible, eligibleHop } from "./social";
import { friendIds, id } from "./shared";
import { normalizeUser } from "./sessions";
import type { Hop, Notification, StudySession } from "@/lib/types";
export function processOutbox() {
  return transaction(() => {
    const now = Date.now();
    const events = all<{
      id: string;
      kind: string;
      actor_id: string;
      entity_id: string;
      created_at: number;
    }>(
      "SELECT * FROM outbox WHERE state='pending' ORDER BY created_at LIMIT 100",
    );
    for (const e of events) {
      let recipients: string[] = [];
      if (e.kind === "booking") {
        if (
          one(
            "SELECT 1 FROM bookings WHERE id=? AND status='confirmed'",
            e.entity_id,
          )
        )
          recipients = [e.actor_id];
      }
      if (e.kind === "hop") {
        const h = one<Hop>("SELECT * FROM hops WHERE id=?", e.entity_id);
        if (h && eligibleHop(h)) recipients = [h.target_user_id];
      }
      if (e.kind === "completion") {
        const s = one<StudySession>(
          "SELECT * FROM study_sessions WHERE id=?",
          e.entity_id,
        );
        if (s && e.created_at > now - 86400000)
          recipients = friendIds(e.actor_id).filter((uid) =>
            completionEligible(uid, s),
          );
      }
      for (const uid of recipients) {
        if (e.kind !== "booking") {
          const count = one<{ n: number }>(
            "SELECT COUNT(*) n FROM notifications WHERE user_id=? AND actor_id=? AND kind!='booking' AND created_at>?",
            uid,
            e.actor_id,
            now - 86400000,
          )!.n;
          if (count >= 3) continue;
        }
        run(
          "INSERT OR IGNORE INTO notifications VALUES(?,?,?,?,?,NULL,?)",
          id(),
          uid,
          e.actor_id,
          e.kind,
          e.entity_id,
          now,
        );
      }
      const delivered = !!one(
        "SELECT 1 FROM notifications WHERE kind=? AND entity_id=?",
        e.kind,
        e.entity_id,
      );
      run(
        "UPDATE outbox SET state=? WHERE id=?",
        delivered ? "delivered" : "suppressed",
        e.id,
      );
    }
    return { processed: events.length };
  });
}
export function notifications(userId: string): Notification[] {
  const result: Notification[] = [];
  const rows = all<{
    id: string;
    kind: string;
    entity_id: string;
    actor_id: string;
    read_at: number | null;
    created_at: number;
  }>(
    "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50",
    userId,
  );
  for (const n of rows) {
    if (n.kind === "booking") {
      const b = one<{ status: string }>(
        "SELECT status FROM bookings WHERE id=? AND user_id=?",
        n.entity_id,
        userId,
      );
      if (b)
        result.push({
          ...n,
          message:
            b.status === "confirmed"
              ? "Your room reservation is confirmed."
              : "Your room reservation was cancelled.",
          href: "/bookings",
        });
    }
    if (n.kind === "hop") {
      const h = one<Hop>(
        "SELECT * FROM hops WHERE id=? AND target_user_id=?",
        n.entity_id,
        userId,
      );
      if (h && eligibleHop(h)) {
        const actor = one<{ name: string }>(
          "SELECT name FROM users WHERE id=?",
          n.actor_id,
        );
        result.push({
          ...n,
          message: `${actor?.name || "A friend"} is hopping over.`,
          href: "/friends",
        });
      }
    }
    if (n.kind === "completion") {
      const s = one<StudySession>(
        "SELECT * FROM study_sessions WHERE id=?",
        n.entity_id,
      );
      if (s && completionEligible(userId, s)) {
        const actor = one<{ name: string }>(
          "SELECT name FROM users WHERE id=?",
          n.actor_id,
        );
        result.push({
          ...n,
          message: `${actor?.name || "A friend"} finished a study session.`,
          href: "/friends",
        });
      }
    }
  }
  return result;
}
export function maintenance() {
  transaction(() => {
    for (const u of all<{ id: string }>("SELECT id FROM users"))
      normalizeUser(u.id);
    const now = Date.now();
    run("DELETE FROM auth_sessions WHERE expires_at<?", now);
    run("DELETE FROM auth_tokens WHERE expires_at<?", now);
    run("DELETE FROM rate_limits WHERE resets_at<?", now);
    // Remove all destination-bearing derivatives before terminal hop retention ends.
    run(
      "DELETE FROM notifications WHERE kind='hop' AND entity_id IN (SELECT id FROM hops WHERE ended_at<?)",
      now - 86400000,
    );
    run(
      "DELETE FROM outbox WHERE kind='hop' AND entity_id IN (SELECT id FROM hops WHERE ended_at<?)",
      now - 86400000,
    );
    run(
      "UPDATE idempotency SET response=NULL WHERE operation LIKE 'hop:%' AND created_at<?",
      now - 86400000,
    );
    run("DELETE FROM hops WHERE ended_at<?", now - 86400000);
    run("DELETE FROM reports WHERE created_at<?", now - 45 * 60000);
    run("DELETE FROM notifications WHERE created_at<?", now - 30 * 86400000);
    run(
      "DELETE FROM outbox WHERE state!='pending' AND created_at<?",
      now - 30 * 86400000,
    );
    run(
      "DELETE FROM idempotency WHERE operation NOT LIKE 'hop:%' AND created_at<?",
      now - 7 * 86400000,
    );
  });
  return processOutbox();
}
