import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { randomBytes } from "node:crypto";
import { one, run, transaction } from "./db";
import { hash, id } from "./shared";
import { assert } from "./errors";
import type { User } from "@/lib/types";
export function firebaseConfig() {
  return process.env.FIREBASE_API_KEY &&
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? {
        apiKey: process.env.FIREBASE_API_KEY,
        projectId: process.env.FIREBASE_PROJECT_ID,
        authDomain:
          process.env.FIREBASE_AUTH_DOMAIN ||
          `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
        appId: process.env.FIREBASE_APP_ID || "",
      }
    : null;
}
export function managedAuth() {
  assert(
    firebaseConfig(),
    "AUTH_UNAVAILABLE",
    "Managed authentication is not configured.",
    503,
  );
  const app =
    getApps().find((a) => a.name === "deskhop-auth") ||
    initializeApp(
      {
        credential: cert(
          JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!),
        ),
      },
      "deskhop-auth",
    );
  return getAuth(app);
}
export async function firebaseSession(
  idToken: string,
  current: User | null,
  requestedHandle?: string,
) {
  const decoded = await managedAuth().verifyIdToken(idToken, true);
  assert(
    decoded.email,
    "EMAIL_REQUIRED",
    "Use a Google or email account with an email address.",
    400,
  );
  assert(
    Date.now() / 1000 - decoded.auth_time < 300,
    "REAUTH_REQUIRED",
    "Sign in again to start a secure session.",
    401,
  );
  const email = decoded.email.toLowerCase();
  let user = one<{
    id: string;
    suspended: number;
    firebase_uid: string | null;
  }>(
    "SELECT id,suspended,firebase_uid FROM users WHERE firebase_uid=?",
    decoded.uid,
  );
  assert(
    !user?.suspended,
    "ACCOUNT_UNAVAILABLE",
    "This account is unavailable.",
    403,
  );
  if (!user) {
    const existing = one<{ id: string; verified: number; suspended: number }>(
      "SELECT id,verified,suspended FROM users WHERE email=?",
      email,
    );
    if (existing) {
      assert(
        !existing.suspended &&
          current?.id === existing.id &&
          existing.verified &&
          decoded.email_verified,
        "ACCOUNT_EXISTS",
        "This email already has a DeskHop account. Sign in with the existing account to connect managed login.",
        409,
      );
      run(
        "UPDATE users SET firebase_uid=?,password_enabled=0 WHERE id=?",
        decoded.uid,
        existing.id,
      );
      user = { id: existing.id, suspended: 0, firebase_uid: decoded.uid };
    } else {
      const uid = id();
      transaction(() => {
        assert(
          !requestedHandle ||
            !one("SELECT 1 FROM users WHERE handle=?", requestedHandle),
          "HANDLE_TAKEN",
          "That handle is already in use. Sign in to finish with an automatically assigned handle.",
          409,
        );
        run(
          "INSERT INTO users(id,name,handle,email,password_hash,verified,created_at,password_enabled,firebase_uid) VALUES(?,?,?,?,?,?,?,0,?)",
          uid,
          String(decoded.name || "Colorado Explorer").slice(0, 60),
          requestedHandle || "explorer_" + randomBytes(6).toString("hex"),
          email,
          "managed-auth",
          Number(!!decoded.email_verified),
          Date.now(),
          decoded.uid,
        );
        run("INSERT INTO availability(user_id) VALUES(?)", uid);
      });
      user = { id: uid, suspended: 0, firebase_uid: decoded.uid };
    }
  }
  run(
    "UPDATE users SET verified=? WHERE id=?",
    Number(!!decoded.email_verified),
    user.id,
  );
  const token = await managedAuth().createSessionCookie(idToken, {
    expiresIn: 5 * 86400000,
  });
  run(
    "INSERT OR REPLACE INTO auth_sessions(token_hash,user_id,expires_at,google_authenticated_at) VALUES(?,?,?,?)",
    hash(token),
    user.id,
    Date.now() + 5 * 86400000,
    decoded.auth_time * 1000,
  );
  return { token };
}
export async function verifyManagedSession(token: string, user: User) {
  const row = one<{ firebase_uid: string | null }>(
    "SELECT firebase_uid FROM users WHERE id=?",
    user.id,
  );
  if (!row?.firebase_uid) return user;
  try {
    const decoded = await managedAuth().verifySessionCookie(token, true);
    if (decoded.uid !== row.firebase_uid) return null;
    return user;
  } catch {
    return null;
  }
}
export async function deleteManagedAccount(user: User, token?: string) {
  const row = one<{ firebase_uid: string | null }>(
    "SELECT firebase_uid FROM users WHERE id=?",
    user.id,
  );
  if (!row?.firebase_uid) return;
  assert(
    token,
    "REAUTH_REQUIRED",
    "Sign in again before deleting your account.",
    401,
  );
  const decoded = await managedAuth().verifySessionCookie(token, true);
  assert(
    decoded.uid === row.firebase_uid &&
      Date.now() / 1000 - decoded.auth_time < 300,
    "REAUTH_REQUIRED",
    "Sign in again, then delete your account within five minutes.",
    403,
  );
  await managedAuth().deleteUser(row.firebase_uid);
}
