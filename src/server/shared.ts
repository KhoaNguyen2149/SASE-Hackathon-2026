import { createHash, randomUUID } from "node:crypto";
import { all, one, run, transaction } from "./db";
import { AppError, assert } from "./errors";
import type { User } from "@/lib/types";
export const id = () => randomUUID();
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const userColumns =
  "id,name,handle,email,verified,role,sharing,notify,created_at,password_enabled";
export function requireVerified(user: User) {
  assert(
    user.verified,
    "VERIFY_EMAIL",
    "Verify your email before contributing or making a reservation.",
    403,
  );
}
export function requireAdmin(user: User) {
  assert(
    user.role === "admin",
    "FORBIDDEN",
    "This page is only available to DeskHop administrators.",
    403,
  );
}
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const row = one<{ count: number; resets_at: number }>(
    "SELECT count,resets_at FROM rate_limits WHERE key=?",
    key,
  );
  if (row && row.resets_at > now && row.count >= max)
    throw new AppError(429, "RATE_LIMIT", "Please wait before trying again.", {
      retryAfter: Math.ceil((row.resets_at - now) / 1000),
    });
  run(
    "INSERT INTO rate_limits(key,count,resets_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN resets_at<=? THEN 1 ELSE count+1 END, resets_at=CASE WHEN resets_at<=? THEN excluded.resets_at ELSE resets_at END",
    key,
    now + windowMs,
    now,
    now,
  );
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function command<T>(
  userId: string,
  operation: string,
  key: string | null,
  payload: unknown,
  fn: () => T,
): T {
  assert(
    key && /^[a-zA-Z0-9_-]{8,128}$/.test(key),
    "IDEMPOTENCY_REQUIRED",
    "A valid request identifier is required. Please try again.",
    400,
  );
  return transaction(() => {
    const digest = hash(canonical(payload));
    const prior = one<{ digest: string; response: string | null }>(
      "SELECT digest,response FROM idempotency WHERE user_id=? AND operation=? AND key=?",
      userId,
      operation,
      key,
    );
    if (prior) {
      assert(
        prior.digest === digest,
        "IDEMPOTENCY_CONFLICT",
        "This request identifier has already been used for a different action.",
      );
      assert(
        prior.response,
        "REQUEST_ENDED",
        "This action has ended. Refresh to see your current state.",
      );
      return JSON.parse(prior.response) as T;
    }
    const result = fn();
    run(
      "INSERT INTO idempotency VALUES(?,?,?,?,?,?)",
      userId,
      operation,
      key,
      digest,
      JSON.stringify(result),
      Date.now(),
    );
    return result;
  });
}
export function blocked(a: string, b: string) {
  return !!one(
    "SELECT 1 FROM blocks WHERE (user_id=? AND target_id=?) OR (user_id=? AND target_id=?)",
    a,
    b,
    b,
    a,
  );
}
export function friends(a: string, b: string) {
  const [x, y] = [a, b].sort();
  return (
    !blocked(a, b) &&
    !!one(
      "SELECT 1 FROM friendships WHERE a=? AND b=? AND state='accepted'",
      x,
      y,
    )
  );
}
export function friendIds(userId: string) {
  return all<{ id: string }>(
    "SELECT CASE WHEN a=? THEN b ELSE a END id FROM friendships WHERE (a=? OR b=?) AND state='accepted'",
    userId,
    userId,
    userId,
  )
    .map((x) => x.id)
    .filter((x) => !blocked(userId, x));
}
export function event(kind: string, actorId: string, entityId: string) {
  run(
    "INSERT OR IGNORE INTO outbox VALUES(?,?,?,?,?,?)",
    `${kind}:${entityId}`,
    kind,
    actorId,
    entityId,
    "pending",
    Date.now(),
  );
}
