import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import nodemailer from "nodemailer";
import { one, run, transaction } from "./db";
import { AppError, assert } from "./errors";
import { hash, id, rateLimit, userColumns } from "./shared";
import type { User } from "@/lib/types";
const scrypt = promisify(scryptCallback);
export const cookieName = "deskhop_session";
export const emailEnabled = () => !!process.env.SMTP_HOST;
export const devMailEnabled = () => process.env.NODE_ENV !== "production";
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}
export async function passwordMatches(password: string, stored: string) {
  if(!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored))return false;
  const [salt, encoded] = stored.split(":");
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(encoded, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function currentUser(token?: string): User | null {
  if (!token) return null;
  return (
    one<User>(
      `SELECT ${userColumns
        .split(",")
        .map((x) => `u.${x}`)
        .join(
          ",",
        )} FROM users u JOIN auth_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.suspended=0`,
      hash(token),
      Date.now(),
    ) || null
  );
}
export function signIn(userId: string,googleReauth=false) {
  const token = randomBytes(32).toString("base64url");
  run(
    "INSERT INTO auth_sessions(token_hash,user_id,expires_at,google_authenticated_at) VALUES(?,?,?,?)",
    hash(token),
    userId,
    Date.now() + 30 * 86400000,
    googleReauth?Date.now():0,
  );
  return token;
}
export function signOut(token?: string) {
  if (token) run("DELETE FROM auth_sessions WHERE token_hash=?", hash(token));
}
async function sendToken(user: User, purpose: "verify" | "reset") {
  const token = randomBytes(32).toString("base64url");
  transaction(() => {
    run(
      "DELETE FROM auth_tokens WHERE user_id=? AND purpose=?",
      user.id,
      purpose,
    );
    run(
      "INSERT INTO auth_tokens VALUES(?,?,?,?)",
      hash(token),
      user.id,
      purpose,
      Date.now() + (purpose === "verify" ? 86400000 : 3600000),
    );
  });
  const appUrl =
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "http://localhost:3000";
  const path = purpose === "verify" ? "verify" : "reset-password";
  const url = `${appUrl}/${path}?token=${token}`;
  if (emailEnabled()) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_PORT === "465",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject:
        purpose === "verify"
          ? "Verify your DeskHop email"
          : "Reset your DeskHop password",
      text: `${purpose === "verify" ? "Welcome to DeskHop. Verify your email" : "Reset your DeskHop password"} by opening this link:\n\n${url}\n\nIf you did not request this, you can ignore this message.`,
    });
    return {};
  }
  if (devMailEnabled()) return { developmentLink: `/${path}?token=${token}` };
  throw new AppError(
    503,
    "EMAIL_UNAVAILABLE",
    "Email delivery is not configured. Please contact the site operator.",
  );
}
export async function register(input: {
  name: string;
  handle: string;
  email: string;
  password: string;
}) {
  assert(
    emailEnabled() || devMailEnabled(),
    "EMAIL_UNAVAILABLE",
    "Account registration will open when email delivery is configured.",
    503,
  );
  rateLimit(`register:${hash(input.email)}`, 5, 3600000);
  const pwd = await passwordHash(input.password);
  const user = transaction(() => {
    assert(
      !one(
        "SELECT 1 FROM users WHERE email=? OR handle=?",
        input.email,
        input.handle,
      ),
      "ACCOUNT_EXISTS",
      "That email or handle is already registered. Try signing in or resetting your password.",
    );
    const uid = id();
    run(
      "INSERT INTO users(id,name,handle,email,password_hash,created_at) VALUES(?,?,?,?,?,?)",
      uid,
      input.name,
      input.handle,
      input.email,
      pwd,
      Date.now(),
    );
    run("INSERT INTO availability(user_id) VALUES(?)", uid);
    return one<User>(`SELECT ${userColumns} FROM users WHERE id=?`, uid)!;
  });
  let delivery: { developmentLink?: string; emailError?: string } = {};
  try {
    delivery = await sendToken(user, "verify");
  } catch {
    delivery = {
      emailError:
        "Your account was created, but we couldn't deliver the verification email. You can resend it from Profile.",
    };
  }
  return { user, token: signIn(user.id), ...delivery };
}
const dummyHash = "00000000000000000000000000000000:" + "00".repeat(64);
export async function login(email: string, password: string) {
  rateLimit(`login:${hash(email)}`, 10, 900000);
  const row = one<User & { password_hash: string; suspended: number }>(
    "SELECT * FROM users WHERE email=?",
    email,
  );
  const valid = await passwordMatches(
    password,
    row?.password_hash || dummyHash,
  );
  assert(
    row && valid && !row.suspended,
    "INVALID_CREDENTIALS",
    "The email or password isn't correct.",
    401,
  );
  return { token: signIn(row.id) };
}
export async function requestReset(email: string) {
  rateLimit(`reset:${hash(email)}`, 3, 3600000);
  const user = one<User>(
    `SELECT ${userColumns} FROM users WHERE email=?`,
    email,
  );
  if (user) {
    try {
      return await sendToken(user, "reset");
    } catch {
      /* Response deliberately does not reveal account existence. */
    }
  }
  return {};
}
export async function resendVerification(user: User) {
  rateLimit(`verify:${user.id}`, 3, 3600000);
  if (user.verified) return {};
  return sendToken(user, "verify");
}
export function verify(token: string) {
  return transaction(() => {
    const row = one<{ user_id: string }>(
      "SELECT user_id FROM auth_tokens WHERE token_hash=? AND purpose='verify' AND expires_at>?",
      hash(token),
      Date.now(),
    );
    assert(
      row,
      "TOKEN_INVALID",
      "This verification link has expired or was already used. Request a new one from Profile.",
      400,
    );
    run("UPDATE users SET verified=1 WHERE id=?", row.user_id);
    run("DELETE FROM auth_tokens WHERE token_hash=?", hash(token));
    return { verified: true };
  });
}
export async function resetPassword(token: string, password: string) {
  const pwd = await passwordHash(password);
  return transaction(() => {
    const row = one<{ user_id: string }>(
      "SELECT user_id FROM auth_tokens WHERE token_hash=? AND purpose='reset' AND expires_at>?",
      hash(token),
      Date.now(),
    );
    assert(
      row,
      "TOKEN_INVALID",
      "This password reset link has expired or was already used.",
      400,
    );
    run("UPDATE users SET password_hash=? WHERE id=?", pwd, row.user_id);
    run(
      "DELETE FROM auth_tokens WHERE user_id=? AND purpose='reset'",
      row.user_id,
    );
    run("DELETE FROM auth_sessions WHERE user_id=?", row.user_id);
    return { reset: true };
  });
}
export async function confirmPassword(user: User, password: string,token?:string) {
  if(user.password_enabled===0){
    assert(token&&one("SELECT 1 FROM auth_sessions WHERE token_hash=? AND user_id=? AND google_authenticated_at>?",hash(token),user.id,Date.now()-300000),"REAUTH_REQUIRED","Sign in with Google again, then delete your account within five minutes.",403);return;
  }
  rateLimit(`reauth:${user.id}`, 5, 900000);
  const row = one<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id=?",
    user.id,
  )!;
  assert(
    await passwordMatches(password, row.password_hash),
    "INVALID_CREDENTIALS",
    "Please check your password.",
    401,
  );
}
