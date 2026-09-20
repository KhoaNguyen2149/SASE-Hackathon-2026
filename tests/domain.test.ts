import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import type { User, Hop } from "../src/lib/types";
const dir = mkdtempSync(join(tmpdir(), "deskhop-test-"));
process.env.DATABASE_PATH = join(dir, "test.sqlite");
process.env.SEED_DEMO = "true";
process.env.SEED_COLORADO = "false";
const { db, one, run } = await import("../src/server/db");
const { AppError } = await import("../src/server/errors");
const { createBooking, cancelBooking, availability } =
  await import("../src/server/booking");
const {
  startSession,
  sessionAction,
  setAvailability,
  ownAvailability,
  ownSession,
  normalizeUser,
} = await import("../src/server/sessions");
const {
  relationship,
  projectFriend,
  createHop,
  hopAction,
  incomingHops,
  ownHop,
} = await import("../src/server/social");
const { settings, deleteAccount, exportAccount } =
  await import("../src/server/account");
const { processOutbox, notifications, maintenance } =
  await import("../src/server/worker");
const { conditions, getSpot, isOpen } = await import("../src/server/catalog");
const { saveReview, reviewAction, reportConditions } =
  await import("../src/server/community");
const { localParts, localDaySlots } = await import("../src/lib/time");
const { passwordHash, passwordMatches, signIn, currentUser, verify } =
  await import("../src/server/auth");
const { hash } = await import("../src/server/shared");
const key = () => randomUUID();
let tick = Date.parse("2026-09-19T15:00:00Z");
const realNow = Date.now;
Date.now = () => tick;
let a: User, b: User, c: User;
function user(name: string): User {
  const uid = randomUUID();
  run(
    "INSERT INTO users(id,name,handle,email,password_hash,verified,created_at) VALUES(?,?,?,?,?,1,?)",
    uid,
    name,
    name.toLowerCase(),
    name.toLowerCase() + "@example.test",
    "unused",
    tick,
  );
  run("INSERT INTO availability(user_id) VALUES(?)", uid);
  return one<User>("SELECT * FROM users WHERE id=?", uid)!;
}
function code(fn: () => unknown, expected: string) {
  assert.throws(
    fn,
    (e: unknown) => e instanceof AppError && e.code === expected,
  );
}
function friend(x = a, y = b) {
  relationship(x, { action: "request", target: y.id }, key());
  relationship(y, { action: "accept", target: x.id }, key());
}
function share(x = b) {
  const s = startSession(
    x,
    {
      spot_id: "aspen-reading-room",
      minutes: 50,
      visibility: "friends_status_and_venue",
      share_completion: true,
    },
    key(),
  );
  setAvailability(
    x,
    {
      mode: "open_to_join",
      minutes: 60,
      revision: ownAvailability(x.id).revision,
    },
    key(),
  );
  return s;
}
const bookingInput = () => ({
  room_id: "aspen-room-a",
  starts_at: tick + 3600000,
  duration: 60,
  party_size: 2,
});
beforeEach(() => {
  db().exec(
    "DELETE FROM users; DELETE FROM rate_limits; DELETE FROM audit; DELETE FROM closures;",
  );
  tick = Date.parse("2026-09-19T15:00:00Z");
  a = user("Alex");
  b = user("Maya");
  c = user("Sam");
});
after(() => {
  Date.now = realNow;
  db().close();
  rmSync(dir, { recursive: true, force: true });
});

test("booking persists and an identical idempotent retry produces one row", () => {
  const k = key(),
    input = bookingInput();
  const first = createBooking(a, input, k);
  assert.deepEqual(
    createBooking(a, input, k),
    JSON.parse(JSON.stringify(first)),
  );
  assert.equal(one<{ n: number }>("SELECT COUNT(*) n FROM bookings")!.n, 1);
  assert.equal(one<{ n: number }>("SELECT COUNT(*) n FROM outbox")!.n, 1);
});
test("idempotency key cannot be reused for a different booking payload", () => {
  const k = key();
  createBooking(a, bookingInput(), k);
  code(
    () => createBooking(a, { ...bookingInput(), party_size: 3 }, k),
    "IDEMPOTENCY_CONFLICT",
  );
});
test("room overlap is rejected but back-to-back intervals are allowed", () => {
  createBooking(a, bookingInput(), key());
  code(() => createBooking(b, bookingInput(), key()), "BOOKING_CONFLICT");
  assert.ok(
    createBooking(b, { ...bookingInput(), starts_at: tick + 7200000 }, key()),
  );
});
test("one account cannot book overlapping rooms and database triggers enforce it too", () => {
  createBooking(a, bookingInput(), key());
  code(
    () =>
      createBooking(a, { ...bookingInput(), room_id: "study-room-a" }, key()),
    "BOOKING_CONFLICT",
  );
  assert.throws(
    () =>
      run(
        "INSERT INTO bookings VALUES(?,?,?,?,?,1,'confirmed',1,?)",
        key(),
        b.id,
        "aspen-room-a",
        tick + 3600000,
        tick + 7200000,
        tick,
      ),
    /BOOKING_CONFLICT/,
  );
});
test("booking requires verification, capacity, open hours, and advance window", () => {
  code(
    () => createBooking({ ...a, verified: 0 }, bookingInput(), key()),
    "VERIFY_EMAIL",
  );
  code(
    () => createBooking(a, { ...bookingInput(), party_size: 9 }, key()),
    "CAPACITY",
  );
  code(
    () =>
      createBooking(
        a,
        { ...bookingInput(), starts_at: tick + 8 * 86400000 },
        key(),
      ),
    "BOOKING_WINDOW",
  );
  code(
    () =>
      createBooking(
        a,
        { ...bookingInput(), starts_at: tick + 18 * 3600000 },
        key(),
      ),
    "VENUE_CLOSED",
  );
});
test("cancellation is owner-only, releases inventory, and cannot cancel after start", () => {
  const first = createBooking(a, bookingInput(), key());
  code(() => cancelBooking(b, first.id, key()), "NOT_FOUND");
  cancelBooking(a, first.id, key());
  assert.ok(createBooking(b, bookingInput(), key()));
  tick += 7200000;
  const bkg = one<{ id: string }>(
    "SELECT id FROM bookings WHERE user_id=?",
    b.id,
  )!;
  code(() => cancelBooking(b, bkg.id, key()), "CANCELLATION_CLOSED");
});
test("maximum two upcoming bookings and closures are enforced", () => {
  createBooking(a, bookingInput(), key());
  createBooking(a, { ...bookingInput(), starts_at: tick + 7200000 }, key());
  code(
    () =>
      createBooking(
        a,
        { ...bookingInput(), starts_at: tick + 10800000 },
        key(),
      ),
    "BOOKING_LIMIT",
  );
  run(
    "INSERT INTO closures VALUES(?,?,?)",
    "aspen-reading-room",
    localParts(tick).date,
    "Holiday",
  );
  code(
    () =>
      createBooking(
        b,
        { ...bookingInput(), starts_at: tick + 10800000 },
        key(),
      ),
    "VENUE_CLOSED",
  );
});
test("slot lookup gives no available slot for an already committed room", () => {
  createBooking(a, bookingInput(), key());
  const result = availability(
    "aspen-room-a",
    localParts(tick).date,
    60,
    2,
    b.id,
  );
  assert.equal(
    result.slots.find((s) => s.starts_at === tick + 3600000)?.available,
    false,
  );
});
test("DST day enumeration preserves spring and fall clock boundaries", () => {
  assert.equal(localDaySlots("2026-03-08").length, 46);
  assert.equal(localDaySlots("2026-11-01").length, 50);
  assert.equal(localDaySlots("2026-09-19").length, 48);
});
test("unknown and overnight opening hours are handled without fabricated openness", () => {
  const spot = getSpot("aspen-reading-room");
  assert.equal(isOpen({ ...spot, hours: "{}" }, tick, tick + 1000), null);
  const overnight = { ...spot, hours: JSON.stringify({ "5": [[1320, 120]] }) };
  assert.equal(
    isOpen(
      overnight,
      Date.parse("2026-09-19T07:00:00Z"),
      Date.parse("2026-09-19T07:30:00Z"),
    ),
    true,
  );
  assert.equal(
    isOpen(
      overnight,
      Date.parse("2026-09-19T08:30:00Z"),
      Date.parse("2026-09-19T09:00:00Z"),
    ),
    false,
  );
});
test("private sessions remain private even from accepted friends", () => {
  friend();
  startSession(
    b,
    {
      spot_id: "aspen-reading-room",
      minutes: 25,
      visibility: "private",
      share_completion: false,
    },
    key(),
  );
  const f = projectFriend(a.id, b.id)!;
  assert.equal(f.status, "No shared status");
  assert.equal(f.session_id, undefined);
  assert.equal(f.spot_id, undefined);
});
test("status-only sharing omits every venue field", () => {
  friend();
  startSession(
    b,
    {
      spot_id: "aspen-reading-room",
      minutes: 25,
      visibility: "friends_status",
      share_completion: false,
    },
    key(),
  );
  const f = projectFriend(a.id, b.id)!;
  assert.equal(f.status, "Studying and focused");
  assert.equal(f.spot_id, undefined);
  assert.equal(f.spot_name, undefined);
  assert.equal(f.can_hop, false);
});
test("following does not grant session or availability access", () => {
  relationship(a, { action: "follow", target: b.id }, key());
  share();
  assert.equal(projectFriend(a.id, b.id), null);
});
test("crossing friend requests never automatically accept", () => {
  relationship(a, { action: "request", target: b.id }, key());
  relationship(b, { action: "request", target: a.id }, key());
  assert.equal(projectFriend(a.id, b.id), null);
  code(
    () => relationship(a, { action: "accept", target: b.id }, key()),
    "INVALID_REQUEST",
  );
});
test("session survives reads, pause does not accrue, revision conflicts reject stale writes", () => {
  const s = startSession(
    a,
    {
      spot_id: null,
      minutes: 25,
      visibility: "private",
      share_completion: false,
    },
    key(),
  );
  tick += 600000;
  const paused = sessionAction(
    a,
    s.id,
    { action: "pause", revision: s.revision },
    key(),
  );
  assert.equal(paused.focus_seconds, 600);
  tick += 600000;
  assert.equal(ownSession(a.id)?.focus_seconds, 600);
  code(
    () =>
      sessionAction(a, s.id, { action: "resume", revision: s.revision }, key()),
    "REVISION_CONFLICT",
  );
  const resumed = sessionAction(
    a,
    s.id,
    { action: "resume", revision: paused.revision },
    key(),
  );
  assert.equal(resumed.state, "running");
});
test("reaching target waits for confirmation and never sends a completion automatically", () => {
  friend();
  const s = share();
  tick += 50 * 60000;
  normalizeUser(b.id);
  assert.equal(ownSession(b.id)?.state, "awaiting_confirmation");
  assert.equal(
    one<{ n: number }>("SELECT COUNT(*) n FROM outbox WHERE kind='completion'")!
      .n,
    0,
  );
  assert.equal(ownAvailability(b.id).mode, null);
  assert.equal(projectFriend(a.id, b.id)?.status, "No shared status");
  assert.equal(ownSession(b.id)?.id, s.id);
});
test("session start clears available and available cannot overwrite an open session", () => {
  setAvailability(a, { mode: "available", minutes: 60, revision: 0 }, key());
  startSession(
    a,
    {
      spot_id: null,
      minutes: 25,
      visibility: "private",
      share_completion: false,
    },
    key(),
  );
  assert.equal(ownAvailability(a.id).mode, null);
  code(
    () =>
      setAvailability(
        a,
        {
          mode: "available",
          minutes: 30,
          revision: ownAvailability(a.id).revision,
        },
        key(),
      ),
    "SESSION_ACTIVE",
  );
});
test("availability expiration never infers new availability or online presence", () => {
  friend();
  setAvailability(b, { mode: "available", minutes: 30, revision: 0 }, key());
  assert.equal(projectFriend(a.id, b.id)?.status, "Available now");
  tick += 31 * 60000;
  assert.equal(projectFriend(a.id, b.id)?.status, "No shared status");
});
test("open-to-company needs venue sharing; stale sessions cannot be hopped to", () => {
  friend();
  const s = startSession(
    b,
    {
      spot_id: "aspen-reading-room",
      minutes: 50,
      visibility: "friends_status",
      share_completion: false,
    },
    key(),
  );
  code(
    () =>
      setAvailability(
        b,
        { mode: "open_to_join", minutes: 60, revision: 0 },
        key(),
      ),
    "SHARED_SESSION_REQUIRED",
  );
  sessionAction(
    b,
    s.id,
    {
      action: "privacy",
      revision: s.revision,
      visibility: "friends_status_and_venue",
    },
    key(),
  );
  setAvailability(b, { mode: "open_to_join", minutes: 60, revision: 0 }, key());
  tick += 11 * 60000;
  assert.equal(projectFriend(a.id, b.id)?.can_hop, false);
});
test("hop creates exactly one intent and one recipient notification on retries", () => {
  friend();
  const s = share();
  const k = key(),
    payload = {
      target_user_id: b.id,
      target_session_id: s.id,
      eta_minutes: 20 as const,
    };
  const h = createHop(a, payload, k);
  assert.equal(createHop(a, payload, k).id, h.id);
  processOutbox();
  processOutbox();
  assert.equal(notifications(b.id).length, 1);
  assert.equal(incomingHops(b.id).length, 1);
  assert.equal(incomingHops(c.id).length, 0);
  assert.equal(one<{ n: number }>("SELECT COUNT(*) n FROM bookings")!.n, 0);
});
test("hop blocks session creation and Available, session blocks hop creation", () => {
  friend();
  const s = share();
  createHop(
    a,
    { target_user_id: b.id, target_session_id: s.id, eta_minutes: null },
    key(),
  );
  code(
    () =>
      startSession(
        a,
        {
          spot_id: null,
          minutes: 25,
          visibility: "private",
          share_completion: false,
        },
        key(),
      ),
    "HOP_ACTIVE",
  );
  code(
    () =>
      setAvailability(
        a,
        { mode: "available", minutes: 60, revision: 0 },
        key(),
      ),
    "HOP_ACTIVE",
  );
  friend(c, b);
  startSession(
    c,
    {
      spot_id: null,
      minutes: 25,
      visibility: "private",
      share_completion: false,
    },
    key(),
  );
  code(
    () =>
      createHop(
        c,
        { target_user_id: b.id, target_session_id: s.id, eta_minutes: 10 },
        key(),
      ),
    "SESSION_ACTIVE",
  );
});
test("revocation before delivery suppresses location-bearing notice and incoming projection", () => {
  friend();
  const s = share();
  createHop(
    a,
    { target_user_id: b.id, target_session_id: s.id, eta_minutes: null },
    key(),
  );
  settings(b, { name: b.name, sharing: false, notify: false }, key());
  processOutbox();
  assert.deepEqual(notifications(b.id), []);
  assert.deepEqual(incomingHops(b.id), []);
  assert.ok(ownHop(a.id));
});
test("block after delivery removes previously visible updates", () => {
  friend();
  const s = share();
  createHop(
    a,
    { target_user_id: b.id, target_session_id: s.id, eta_minutes: null },
    key(),
  );
  processOutbox();
  assert.equal(notifications(b.id).length, 1);
  relationship(b, { action: "block", target: a.id }, key());
  assert.deepEqual(notifications(b.id), []);
  assert.equal(ownHop(a.id), null);
  assert.equal(projectFriend(a.id, b.id), null);
});
test("estimate passing never implies arrival; explicit arrival does not start a timer", () => {
  friend();
  const s = share();
  const h = createHop(
    a,
    { target_user_id: b.id, target_session_id: s.id, eta_minutes: 10 },
    key(),
  );
  tick += 11 * 60000;
  assert.equal(ownHop(a.id)?.state, "on_way");
  const arrived = hopAction(
    a,
    h.id,
    { action: "arrive", revision: h.revision },
    key(),
  );
  assert.equal(arrived.state, "arrived");
  assert.equal(ownSession(a.id), null);
  code(
    () => hopAction(a, h.id, { action: "cancel", revision: h.revision }, key()),
    "REVISION_CONFLICT",
  );
});
test("ETA updates preserve original two-hour cap and do not create a second alert", () => {
  friend();
  const s = share();
  let h = createHop(
    a,
    { target_user_id: b.id, target_session_id: s.id, eta_minutes: 30 },
    key(),
  );
  processOutbox();
  for (let i = 0; i < 4; i++) {
    tick += 20 * 60000;
    h = hopAction(
      a,
      h.id,
      { action: "update_eta", revision: h.revision, eta_minutes: 30 },
      key(),
    );
  }
  assert.ok(h.expires_at <= h.created_at + 7200000);
  assert.equal(
    one<{ n: number }>("SELECT COUNT(*) n FROM outbox WHERE kind='hop'")!.n,
    1,
  );
});
test("hop expiry works without worker and cleanup purges destination-bearing response bodies", () => {
  friend();
  const s = share();
  const h = createHop(
    a,
    { target_user_id: b.id, target_session_id: s.id, eta_minutes: 10 },
    key(),
  );
  tick += 41 * 60000;
  assert.equal(ownHop(a.id), null);
  normalizeUser(a.id);
  assert.equal(
    one<Hop>("SELECT * FROM hops WHERE id=?", h.id)?.state,
    "expired",
  );
  tick += 25 * 3600000;
  maintenance();
  assert.equal(one("SELECT 1 FROM hops WHERE id=?", h.id), undefined);
  assert.equal(
    one<{ response: string | null }>(
      "SELECT response FROM idempotency WHERE user_id=? AND operation='hop:create'",
      a.id,
    )?.response,
    null,
  );
});
test("completion notification is opt-in, needs ten minutes, and honors DND at read", () => {
  friend();
  run("UPDATE users SET notify=1 WHERE id=?", a.id);
  const s = share();
  tick += 12 * 60000;
  const done = sessionAction(
    b,
    s.id,
    { action: "finish", revision: s.revision },
    key(),
  );
  assert.equal(done.state, "completed");
  processOutbox();
  assert.equal(notifications(a.id).length, 1);
  setAvailability(a, { mode: "dnd", minutes: 60, revision: 0 }, key());
  assert.equal(notifications(a.id).length, 0);
});
test("sparse reports remain unknown, sufficient fresh agreement produces evidence", () => {
  reportConditions(a, "aspen-reading-room", { crowd: 2, noise: 2 }, key());
  assert.equal(conditions("aspen-reading-room").state, "insufficient_data");
  reportConditions(b, "aspen-reading-room", { crowd: 2, noise: 1 }, key());
  reportConditions(c, "aspen-reading-room", { crowd: 3, noise: 2 }, key());
  assert.equal(conditions("aspen-reading-room").state, "recent_reports");
  assert.equal(conditions("aspen-reading-room").level, 2);
  tick += 1600000;
  assert.equal(conditions("aspen-reading-room").state, "insufficient_data");
});
test("condition cooldown prevents gaming reports and latest report remains one per account", () => {
  reportConditions(a, "aspen-reading-room", { crowd: 2, noise: 2 }, key());
  code(
    () =>
      reportConditions(a, "aspen-reading-room", { crowd: 5, noise: 2 }, key()),
    "REPORT_TOO_SOON",
  );
  tick += 601000;
  reportConditions(a, "aspen-reading-room", { crowd: 3, noise: 2 }, key());
  assert.equal(
    one<{ n: number }>("SELECT COUNT(*) n FROM reports WHERE user_id=?", a.id)!
      .n,
    1,
  );
});
test("reviews are owner-editable, one per venue, reversible likes, no self-likes", () => {
  saveReview(
    a,
    "aspen-reading-room",
    {
      rating: 5,
      noise: 2,
      crowd: 3,
      notes: "Useful spot",
      visit_date: "2026-09-18",
    },
    key(),
  );
  const r = one<{ id: string }>("SELECT id FROM reviews")!;
  code(() => reviewAction(a, r.id, { action: "like" }, key()), "SELF_LIKE");
  reviewAction(b, r.id, { action: "like" }, key());
  reviewAction(b, r.id, { action: "like" }, key());
  assert.equal(one<{ n: number }>("SELECT COUNT(*) n FROM review_likes")!.n, 1);
  code(() => reviewAction(b, r.id, { action: "delete" }, key()), "FORBIDDEN");
  saveReview(
    a,
    "aspen-reading-room",
    {
      rating: 4,
      noise: 2,
      crowd: 3,
      notes: "Updated",
      visit_date: "2026-09-18",
    },
    key(),
  );
  assert.equal(one<{ n: number }>("SELECT COUNT(*) n FROM reviews")!.n, 1);
  reviewAction(a, r.id, { action: "delete" }, key());
  assert.equal(one<{ n: number }>("SELECT COUNT(*) n FROM review_likes")!.n, 0);
});
test("account export never contains authentication secrets and deletion cascades bookings", () => {
  createBooking(a, bookingInput(), key());
  const token = signIn(a.id);
  const projected = currentUser(token)!;
  assert.equal("password_hash" in projected, false);
  const data = exportAccount(projected);
  assert.equal(JSON.stringify(data).includes("password_hash"), false);
  deleteAccount(projected);
  assert.equal(currentUser(token), null);
  assert.equal(one<{ n: number }>("SELECT COUNT(*) n FROM bookings")!.n, 0);
  assert.equal(one<{ n: number }>("SELECT COUNT(*) n FROM idempotency")!.n, 0);
});
test("password hashing is salted and verification tokens are single-use", async () => {
  const p = "correct horse battery";
  const x = await passwordHash(p),
    y = await passwordHash(p);
  assert.notEqual(x, y);
  assert.ok(await passwordMatches(p, x));
  assert.equal(await passwordMatches("incorrect password", x), false);
  run("UPDATE users SET verified=0 WHERE id=?", a.id);
  const t = key();
  run(
    "INSERT INTO auth_tokens VALUES(?,?,'verify',?)",
    hash(t),
    a.id,
    tick + 60000,
  );
  verify(t);
  code(() => verify(t), "TOKEN_INVALID");
});

function concurrent(
  action: string,
  userId: string,
  target?: string,
  session?: string,
): Promise<{ ok: boolean; code?: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "tests/race-worker.ts"],
      {
        env: {
          ...process.env,
          TEST_ACTION: action,
          TEST_USER: userId,
          TEST_NOW: String(tick),
          TEST_TARGET: target,
          TEST_SESSION: session,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (status) => {
      if (status !== 0) reject(new Error(stderr));
      else
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          reject(new Error(stdout + stderr));
        }
    });
  });
}
test("separate processes racing the same room commit exactly one reservation", async () => {
  const results = await Promise.all([
    concurrent("book", a.id),
    concurrent("book", b.id),
  ]);
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(results.find((r) => !r.ok)?.code, "BOOKING_CONFLICT");
  assert.equal(one<{ n: number }>("SELECT COUNT(*) n FROM bookings")!.n, 1);
});
test("separate processes racing session and hop cannot create both active states", async () => {
  friend();
  const target = share();
  const results = await Promise.all([
    concurrent("study", a.id),
    concurrent("hop", a.id, b.id, target.id),
  ]);
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.ok(
    ["HOP_ACTIVE", "SESSION_ACTIVE"].includes(
      results.find((r) => !r.ok)?.code || "",
    ),
  );
  assert.equal(Number(!!ownSession(a.id)) + Number(!!ownHop(a.id)), 1);
});

test("real venues preserve unknown facts and never expose fictional native inventory", () => {
  const library = getSpot("golden-public-library");
  assert.equal(library.demo, 0);
  assert.equal(library.mapped, 0);
  assert.equal(library.wifi, "unknown");
  assert.equal(library.power, "unknown");
  assert.equal(library.noise, 0);
  assert.match(library.source, /jeffcolibrary\.org/);
  assert.equal(
    one<{ n: number }>(
      "SELECT COUNT(*) n FROM rooms WHERE spot_id=?",
      library.id,
    )!.n,
    0,
  );
  assert.equal(
    isOpen(getSpot("higher-grounds-golden"), tick, tick + 3600000),
    null,
  );
});

test("administration rejects a normal verified user and accepts an audited catalog update", async () => {
  const { adminData, adminSaveSpot, spotSchema } =
    await import("../src/server/admin");
  code(() => adminData(a), "FORBIDDEN");
  const admin = { ...a, role: "admin" as const };
  const venue = spotSchema.parse({
    ...getSpot("golden-public-library"),
    id: "test-admin-venue",
    name: "Test Admin Venue",
  });
  adminSaveSpot(admin, venue, key());
  assert.equal(getSpot(venue.id).name, venue.name);
  assert.equal(
    one<{ n: number }>(
      "SELECT COUNT(*) n FROM audit WHERE entity_id=?",
      venue.id,
    )!.n,
    1,
  );
  run("DELETE FROM spots WHERE id=?", venue.id);
});

const { syncRewards, progress, buyCosmetic } =
  await import("../src/server/rewards");
const { rankWindow, rankings } = await import("../src/server/rankings");
const { saveDecoration, saveAvatar, avatarUrl } =
  await import("../src/server/profiles");
const { defaultDecoration } = await import("../src/lib/profile-style");
const { publicProfile } = await import("../src/server/community");
const { directions } = await import("../src/lib/directions");
test("review rewards are once per real venue and edits do not inflate rankings", () => {
  const spot = one<{ id: string }>(
    "SELECT id FROM spots WHERE demo=0 LIMIT 1",
  )!;
  const review = {
    rating: 5,
    noise: 2,
    crowd: 2,
    notes: "A real venue review",
    visit_date: "2026-09-18",
  };
  saveReview(a, spot.id, review, key());
  syncRewards(a);
  syncRewards(a);
  assert.equal(progress(a.id).xp, 20);
  assert.equal(progress(a.id).coins, 10);
  saveReview(a, spot.id, { ...review, notes: "Updated review" }, key());
  syncRewards(a);
  assert.equal(progress(a.id).xp, 20);
  assert.equal(
    rankings("daily", "users", "reviews").rows.find((r) => r.id === a.id)
      ?.score,
    1,
  );
  tick += 86400000;
  saveReview(a, spot.id, review, key());
  assert.equal(
    rankings("daily", "users", "reviews").rows.some((r) => r.id === a.id),
    false,
  );
});
test("locked decorations reject direct requests and public profiles omit currency balances", () => {
  code(
    () => saveDecoration(a, { ...defaultDecoration, theme: "midnight" }, key()),
    "DECORATION_LOCKED",
  );
  code(() => buyCosmetic(a, "theme:midnight", key()), "LEVEL_REQUIRED");
  saveDecoration(
    a,
    { ...defaultDecoration, bio: "My reading corner", leaderboard: false },
    key(),
  );
  const profile = publicProfile(a.handle);
  assert.equal(profile.decoration.bio, "My reading corner");
  assert.equal("coins" in profile.progress, false);
});
test("rank windows use Denver calendar boundaries across daylight saving time", () => {
  assert.equal(
    rankWindow("daily", Date.parse("2026-03-08T22:00:00Z")).start,
    Date.parse("2026-03-08T07:00:00Z"),
  );
  assert.equal(rankWindow("weekly", tick).day, "2026-09-14");
  assert.equal(rankWindow("monthly", tick).day, "2026-09-01");
});
test("map destinations preserve actual coordinates and encode addresses", () => {
  const mapped = directions({
    name: "Test place",
    mapped: 1,
    lat: 39.75,
    lng: -105.22,
    address: "Golden & Main",
  });
  assert.ok(mapped.google.includes("39.75"));
  assert.ok(mapped.apple.includes("-105.22"));
  const address = directions({
    name: "Test place",
    mapped: 0,
    lat: 0,
    lng: 0,
    address: "Golden & Main",
  });
  assert.ok(
    address.google.includes("Golden%20%26%20Main") ||
      address.google.includes("Golden+%26+Main"),
  );
});

const { applySubscription, premiumFor } = await import("../src/server/billing");
const { reserveAiCall } = await import("../src/server/assistant");
test("subscription replay, ownership and expiry cannot grant unauthorized Premium", () => {
  process.env.STRIPE_PRICE_ID = "test-price";
  run(
    "INSERT INTO subscriptions(user_id,customer_id,status,updated_at) VALUES(?,?,'inactive',?)",
    a.id,
    "test-customer",
    tick,
  );
  const event = {
    eventId: key(),
    userId: a.id,
    customerId: "test-customer",
    subscriptionId: "test-sub",
    status: "active",
    periodEnd: tick + 60000,
    priceId: "test-price",
  };
  code(
    () => applySubscription({ ...event, customerId: "wrong" }),
    "BILLING_OWNER",
  );
  applySubscription(event);
  assert.equal(premiumFor(a.id), true);
  applySubscription({ ...event, status: "canceled" });
  assert.equal(premiumFor(a.id), true);
  tick += 60001;
  assert.equal(premiumFor(a.id), false);
  applySubscription({
    ...event,
    eventId: key(),
    priceId: "wrong",
    periodEnd: tick + 60000,
  });
  assert.equal(premiumFor(a.id), false);
  delete process.env.STRIPE_PRICE_ID;
});
test("AI rejects nonmembers before use and enforces the shared owner allowance", () => {
  code(() => reserveAiCall(a), "PREMIUM_REQUIRED");
  process.env.AI_API_KEY = "test-only-not-a-real-key";
  process.env.AI_MODEL = "test-model";
  process.env.AI_DAILY_CALL_LIMIT = "1";
  try {
    run(
      "INSERT INTO subscriptions(user_id,status,period_end,updated_at) VALUES(?,'active',?,?)",
      a.id,
      tick + 60000,
      tick,
    );
    reserveAiCall(a);
    code(() => reserveAiCall(a), "AI_LIMIT");
  } finally {
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    delete process.env.AI_DAILY_CALL_LIMIT;
  }
});
test("a handle can be changed once it is free, well formed, and not someone else's", () => {
  code(
    () =>
      settings(
        a,
        { name: a.name, handle: b.handle, sharing: true, notify: false },
        key(),
      ),
    "HANDLE_TAKEN",
  );
  code(
    () =>
      settings(
        a,
        { name: a.name, handle: "no spaces!", sharing: true, notify: false },
        key(),
      ),
    "INVALID_HANDLE",
  );
  settings(
    a,
    { name: a.name, handle: "Quiet_Corner", sharing: true, notify: false },
    key(),
  );
  const moved = one<User>("SELECT * FROM users WHERE id=?", a.id)!;
  assert.equal(moved.handle, "quiet_corner");
  assert.equal(publicProfile("quiet_corner").user.id, a.id);
  // Keeping your own handle is not a collision with yourself.
  settings(
    moved,
    { name: moved.name, handle: "quiet_corner", sharing: true, notify: false },
    key(),
  );
  assert.equal(
    one<User>("SELECT * FROM users WHERE id=?", a.id)!.handle,
    "quiet_corner",
  );
});
test("a profile picture is stored only when its bytes match a real image", () => {
  const png =
    "data:image/png;base64," +
    Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01,
    ]).toString("base64");
  code(
    () =>
      saveAvatar(
        a,
        {
          avatar_url:
            "data:image/png;base64," +
            Buffer.from("<script>alert(1)</script>").toString("base64"),
        },
        key(),
      ),
    "INVALID_IMAGE",
  );
  assert.equal(avatarUrl(a.id), "");
  saveAvatar(a, { avatar_url: png }, key());
  assert.equal(avatarUrl(a.id), png);
  assert.equal(publicProfile(a.handle).decoration.avatar_url, png);
  // Decorating the rest of the profile leaves the picture alone.
  saveDecoration(a, { ...defaultDecoration, bio: "Still here" }, key());
  assert.equal(avatarUrl(a.id), png);
  saveAvatar(a, { avatar_url: "" }, key());
  assert.equal(avatarUrl(a.id), "");
});
