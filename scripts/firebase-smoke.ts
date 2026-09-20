import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";

// Explicit live-service check. Only its randomly named test account is changed;
// local application data stays in a temporary database. No email is sent.
for (const name of [
  "FIREBASE_API_KEY",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
])
  assert.ok(process.env[name], `${name} must be configured`);
const directory = mkdtempSync(join(tmpdir(), "deskhop-firebase-"));
process.env.DATABASE_PATH = join(directory, "smoke.sqlite");
process.env.SEED_DEMO = "false";
process.env.SEED_REAL = "false";
process.env.SEED_COLORADO = "false";
const { managedAuth, firebaseSession, verifyManagedSession } =
  await import("../src/server/firebase");
const { currentUser, signOut } = await import("../src/server/auth");
const { db, one, run } = await import("../src/server/db");
const auth = managedAuth();
const suffix = randomBytes(8).toString("hex");
const uid = "deskhop-smoke-" + suffix;
const email = uid + "@example.test";
const password = randomBytes(24).toString("base64url");
const handle = "smoke_" + suffix;
let created = false;
async function api(action: string, body: Record<string, unknown>) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${process.env.FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    },
  );
  const result = await response.json();
  // Never log SDK error objects, tokens, recovery links, or passwords.
  assert.ok(response.ok, `Firebase ${action} failed (${response.status})`);
  return result;
}
try {
  await auth.createUser({
    uid,
    email,
    password,
    displayName: "Disposable Smoke Test",
  });
  created = true;
  const signed = await api("signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });
  const session = await firebaseSession(signed.idToken, null, handle);
  const user = currentUser(session.token)!;
  assert.ok(user);
  assert.equal(user.handle, handle);
  assert.equal(user.verified, 0);
  assert.ok(await verifyManagedSession(session.token, user));
  assert.equal(
    one<{ password_enabled: number }>(
      "SELECT password_enabled FROM users WHERE id=?",
      user.id,
    )!.password_enabled,
    0,
  );
  console.log(
    "PASS: live email/password login, chosen handle, server session, unverified state.",
  );

  const verification = new URL(await auth.generateEmailVerificationLink(email));
  await api("update", { oobCode: verification.searchParams.get("oobCode") });
  const verified = await api("signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });
  const verifiedSession = await firebaseSession(
    verified.idToken,
    user,
    "ignored_handle",
  );
  assert.equal(currentUser(verifiedSession.token)!.verified, 1);
  assert.equal(currentUser(verifiedSession.token)!.handle, handle);
  console.log("PASS: verification action code and verified session refresh.");

  run("UPDATE users SET suspended=1 WHERE id=?", user.id);
  await assert.rejects(firebaseSession(verified.idToken, null), {
    code: "ACCOUNT_UNAVAILABLE",
  });
  run("UPDATE users SET suspended=0 WHERE id=?", user.id);
  signOut(verifiedSession.token);
  assert.equal(currentUser(verifiedSession.token), null);
  console.log("PASS: suspended account rejection and application logout.");

  const reset = new URL(await auth.generatePasswordResetLink(email));
  const newPassword = randomBytes(24).toString("base64url");
  await api("resetPassword", {
    oobCode: reset.searchParams.get("oobCode"),
    newPassword,
  });
  const recovered = await api("signInWithPassword", {
    email,
    password: newPassword,
    returnSecureToken: true,
  });
  const recoveredSession = await firebaseSession(recovered.idToken, null);
  assert.equal(currentUser(recoveredSession.token)!.id, user.id);
  // Disabled Firebase identities must invalidate otherwise valid app cookies.
  await auth.updateUser(uid, { disabled: true });
  assert.equal(await verifyManagedSession(recoveredSession.token, user), null);
  console.log(
    "PASS: recovery action code, recovered login, disabled identity rejection.",
  );
} catch (error) {
  console.error(
    "Firebase smoke failed:",
    error instanceof assert.AssertionError
      ? error.message
      : (error as { code?: string }).code || "unexpected failure",
  );
  process.exitCode = 1;
} finally {
  if (created) {
    await auth.deleteUser(uid);
    console.log("Disposable Firebase account removed.");
  }
  db().close();
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
  rmSync(directory, { recursive: true, force: true });
}
