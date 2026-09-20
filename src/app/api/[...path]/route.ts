import { aiEnabled, assist } from "@/server/assistant";
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  firebaseConfig,
  firebaseSession,
  deleteManagedAccount,
} from "@/server/firebase";
import {
  billingEnabled,
  premiumFor,
  checkout,
  billingPortal,
} from "@/server/billing";
import { progress, syncRewards, buyCosmetic } from "@/server/rewards";
import { rankings } from "@/server/rankings";
import {
  decoration,
  decorationSchema,
  saveDecoration,
} from "@/server/profiles";
import * as auth from "@/server/auth";
import * as catalog from "@/server/catalog";
import * as booking from "@/server/booking";
import * as sessions from "@/server/sessions";
import * as social from "@/server/social";
import * as community from "@/server/community";
import * as account from "@/server/account";
import * as admin from "@/server/admin";
import { notifications, processOutbox } from "@/server/worker";
import { one, run, transaction } from "@/server/db";
import { AppError, assert } from "@/server/errors";
import {
  command,
  hash,
  id,
  rateLimit,
  requireAdmin,
  requireVerified,
} from "@/server/shared";
import type { User } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const visibility = z.enum([
  "private",
  "friends_status",
  "friends_status_and_venue",
]);
const password = z.string().min(10, "Use at least 10 characters.").max(128);
const email = z.email().trim().toLowerCase().max(254);
const textId = z.string().min(1).max(128);
const revision = z.number().int().positive();
const score = z.number().int().min(1).max(5);
const eta = z.union([z.literal(10), z.literal(20), z.literal(30), z.null()]);

async function handler(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const route = path.join("/"),
    method = req.method;
  let cookie: string | undefined,
    clearCookie = false;
  try {
    if (!["GET", "HEAD"].includes(method)) {
      const allowed = new URL(
        process.env.APP_URL ||
          process.env.RENDER_EXTERNAL_URL ||
          "http://localhost:3000",
      ).origin;
      const origin = req.headers.get("origin");
      const localDev =
        process.env.NODE_ENV !== "production" &&
        origin &&
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
      assert(
        origin === allowed || localDev,
        "ORIGIN_REJECTED",
        "This request didn't come from DeskHop. Refresh the page and try again.",
        403,
      );
      assert(
        req.headers.get("content-type")?.startsWith("application/json"),
        "CONTENT_TYPE",
        "Send JSON for this request.",
        415,
      );
    }
    const token = req.cookies.get(auth.cookieName)?.value;
    const user = await auth.authenticatedUser(token);
    const needUser = (): User => {
      assert(user, "UNAUTHENTICATED", "Sign in to continue.", 401);
      return user;
    };
    const key = req.headers.get("idempotency-key");
    let body: unknown = {};
    if (!["GET", "HEAD"].includes(method)) {
      const raw = await req.text();
      assert(
        raw.length <= 32768,
        "BODY_TOO_LARGE",
        "This request is too large.",
        413,
      );
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        throw new AppError(
          400,
          "INVALID_JSON",
          "This request could not be read.",
        );
      }
    }
    if (user) transaction(() => sessions.normalizeUser(user.id));
    let result: unknown;
    if (method === "GET") {
      if (route === "health") {
        one("SELECT 1");
        result = { status: "ok" };
      } else if (route === "bootstrap") {
        if (user) syncRewards(user);
        processOutbox();
        result = {
          user,
          session: user ? sessions.ownSession(user.id) : null,
          hop: user ? social.ownHop(user.id) : null,
          availability: user ? sessions.ownAvailability(user.id) : null,
          notifications: user ? notifications(user.id) : [],
          serverTime: Date.now(),
          demo: !!one("SELECT 1 FROM spots WHERE demo=1 AND published=1"),
          emailEnabled: auth.emailEnabled(),
          premium: user ? premiumFor(user.id) : false,
          billingEnabled: billingEnabled(),
          aiEnabled: aiEnabled(),
          googleEnabled: !!firebaseConfig(),
          firebase: firebaseConfig(),
          progress: user ? progress(user.id) : null,
        };
      } else if (route === "spots") {
        const start = Number(
          req.nextUrl.searchParams.get("start") || Date.now(),
        );
        const duration = Number(req.nextUrl.searchParams.get("duration") || 60);
        assert(
          Number.isFinite(start) &&
            Number.isFinite(duration) &&
            duration >= 15 &&
            duration <= 180,
          "INVALID_INPUT",
          "Choose a valid visit duration.",
          400,
        );
        result = {
          spots: catalog
            .listSpots(user?.id)
            .map((s) =>
              catalog.directorySpot(s, start, start + duration * 60000),
            ),
        };
      } else if (path[0] === "spots" && path.length === 2)
        result = catalog.detail(path[1], user?.id);
      else if (route === "availability") {
        const params = z
          .object({
            room: textId,
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            duration: z.coerce
              .number()
              .refine((v) => [30, 60, 90, 120].includes(v)),
            party: z.coerce.number().int().min(1).max(100),
          })
          .parse(Object.fromEntries(req.nextUrl.searchParams));
        result = booking.availability(
          params.room,
          params.date,
          params.duration,
          params.party,
          user?.id,
        );
      } else if (route === "rankings") {
        const query = z
          .object({
            period: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
            kind: z.enum(["spots", "users"]).default("spots"),
            metric: z
              .enum(["trending", "rating", "points", "reviews", "followers"])
              .default("trending"),
          })
          .parse(Object.fromEntries(req.nextUrl.searchParams));
        result = rankings(query.period, query.kind, query.metric, user?.id);
      } else if (route === "profile/decoration")
        result = { decoration: decoration(needUser().id) };
      else if (route === "bookings")
        result = { bookings: booking.bookings(needUser().id) };
      else if (route === "study/history")
        result = { sessions: sessions.history(needUser().id) };
      else if (route === "friends") result = social.friendList(needUser().id);
      else if (route === "feed")
        result = { reviews: community.feed(needUser().id) };
      else if (path[0] === "profiles" && path.length === 2)
        result = community.publicProfile(path[1], user?.id);
      else if (route === "account/export")
        result = account.exportAccount(needUser());
      else if (route === "admin") result = admin.adminData(needUser());
      else
        throw new AppError(404, "NOT_FOUND", "This page could not be found.");
    } else if (method === "POST") {
      if (path[0] === "auth") {
        assert(
          !firebaseConfig() ||
            ![
              "auth/register",
              "auth/login",
              "auth/forgot",
              "auth/reset",
              "auth/verify",
              "auth/resend",
            ].includes(route),
          "MANAGED_AUTH_REQUIRED",
          "Use the managed sign-in or recovery flow on the sign-in page.",
          400,
        );
        // Do not trust spoofable forwarded addresses for identity or authorization.
        const client =
          req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
        rateLimit(`auth-global:${hash(client)}`, 100, 3600000);
        if (route === "auth/firebase") {
          const input = z
            .object({
              idToken: z.string().min(20).max(20000),
              handle: z
                .string()
                .trim()
                .toLowerCase()
                .regex(/^[a-z0-9_]{3,24}$/)
                .optional(),
            })
            .parse(body);
          const signed = await firebaseSession(
            input.idToken,
            user,
            input.handle,
          );
          cookie = signed.token;
          result = { ok: true };
        } else if (route === "auth/register") {
          const input = z
            .object({
              name: z.string().trim().min(2).max(60),
              handle: z
                .string()
                .trim()
                .toLowerCase()
                .regex(
                  /^[a-z0-9_]{3,24}$/,
                  "Use 3–24 letters, numbers, or underscores.",
                ),
              email,
              password,
            })
            .parse(body);
          const data = await auth.register(input);
          cookie = data.token;
          result = {
            user: data.user,
            developmentLink: data.developmentLink,
            emailError: data.emailError,
          };
        } else if (route === "auth/login") {
          const input = z
            .object({ email, password: z.string().min(1).max(128) })
            .parse(body);
          const data = await auth.login(input.email, input.password);
          cookie = data.token;
          result = { ok: true };
        } else if (route === "auth/logout") {
          auth.signOut(token);
          clearCookie = true;
          result = { ok: true };
        } else if (route === "auth/verify")
          result = auth.verify(z.object({ token: textId }).parse(body).token);
        else if (route === "auth/resend")
          result = await auth.resendVerification(needUser());
        else if (route === "auth/forgot")
          result = await auth.requestReset(
            z.object({ email }).parse(body).email,
          );
        else if (route === "auth/reset") {
          const input = z.object({ token: textId, password }).parse(body);
          result = await auth.resetPassword(input.token, input.password);
          clearCookie = true;
        } else throw new AppError(404, "NOT_FOUND", "Action not found.");
      } else {
        const actor = needUser();
        if (route === "bookings")
          result = booking.createBooking(
            actor,
            z
              .object({
                room_id: textId,
                starts_at: z.number().int().positive(),
                duration: z
                  .number()
                  .refine((n) => [30, 60, 90, 120].includes(n)),
                party_size: z.number().int().min(1).max(100),
              })
              .parse(body),
            key,
          );
        else if (
          path[0] === "bookings" &&
          path[2] === "cancel" &&
          path.length === 3
        )
          result = booking.cancelBooking(actor, path[1], key);
        else if (route === "study")
          result = sessions.startSession(
            actor,
            z
              .object({
                spot_id: textId.nullable(),
                minutes: z.number().int().min(15).max(180),
                visibility,
                share_completion: z.boolean(),
              })
              .parse(body),
            key,
          );
        else if (route === "study/heartbeat")
          result = transaction(() => sessions.heartbeat(actor.id));
        else if (path[0] === "study" && path.length === 2)
          result = sessions.sessionAction(
            actor,
            path[1],
            z
              .object({
                action: z.enum([
                  "pause",
                  "resume",
                  "finish",
                  "cancel",
                  "extend",
                  "privacy",
                ]),
                revision,
                minutes: z.number().int().min(5).max(60).optional(),
                visibility: visibility.optional(),
              })
              .parse(body),
            key,
          );
        else if (route === "availability")
          result = sessions.setAvailability(
            actor,
            z
              .object({
                mode: z
                  .enum(["available", "open_to_join", "busy", "dnd"])
                  .nullable(),
                minutes: z.number().int().min(15).max(480),
                revision: z.number().int().nonnegative(),
              })
              .parse(body),
            key,
          );
        else if (route === "friends")
          result = social.relationship(
            actor,
            z
              .object({
                action: z.enum([
                  "request",
                  "accept",
                  "remove",
                  "block",
                  "unblock",
                  "follow",
                  "unfollow",
                ]),
                target: textId,
              })
              .parse(body),
            key,
          );
        else if (route === "hops")
          result = social.createHop(
            actor,
            z
              .object({
                target_user_id: textId,
                target_session_id: textId,
                eta_minutes: eta,
              })
              .parse(body),
            key,
          );
        else if (path[0] === "hops" && path.length === 2)
          result = social.hopAction(
            actor,
            path[1],
            z
              .object({
                action: z.enum(["arrive", "cancel", "update_eta"]),
                revision,
                eta_minutes: eta.optional(),
              })
              .parse(body),
            key,
          );
        else if (
          path[0] === "spots" &&
          path[2] === "save" &&
          path.length === 3
        ) {
          const input = z.object({ saved: z.boolean() }).parse(body);
          result = command(actor.id, `save:${path[1]}`, key, input, () => {
            catalog.getSpot(path[1]);
            if (input.saved)
              run("INSERT OR IGNORE INTO saved VALUES(?,?)", actor.id, path[1]);
            else
              run(
                "DELETE FROM saved WHERE user_id=? AND spot_id=?",
                actor.id,
                path[1],
              );
            return { saved: input.saved };
          });
        } else if (
          path[0] === "spots" &&
          path[2] === "reviews" &&
          path.length === 3
        )
          result = community.saveReview(
            actor,
            path[1],
            z
              .object({
                rating: score,
                noise: score,
                crowd: score,
                notes: z.string().trim().max(2000),
                visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              })
              .parse(body),
            key,
          );
        else if (
          path[0] === "spots" &&
          path[2] === "conditions" &&
          path.length === 3
        )
          result = community.reportConditions(
            actor,
            path[1],
            z.object({ crowd: score, noise: score }).parse(body),
            key,
          );
        else if (
          path[0] === "spots" &&
          path[2] === "corrections" &&
          path.length === 3
        ) {
          requireVerified(actor);
          const input = z
            .object({ reason: z.string().trim().min(5).max(1000) })
            .parse(body);
          result = command(
            actor.id,
            `correction:${path[1]}`,
            key,
            input,
            () => {
              catalog.getSpot(path[1]);
              rateLimit(`corrections:${actor.id}`, 10, 3600000);
              run(
                "INSERT INTO flags(id,user_id,spot_id,reason,created_at) VALUES(?,?,?,?,?)",
                id(),
                actor.id,
                path[1],
                input.reason,
                Date.now(),
              );
              return { ok: true };
            },
          );
        } else if (path[0] === "reviews" && path.length === 2)
          result = community.reviewAction(
            actor,
            path[1],
            z
              .object({
                action: z.enum(["delete", "like", "unlike", "flag"]),
                reason: z.string().trim().min(3).max(1000).optional(),
              })
              .parse(body),
            key,
          );
        else if (route === "assistant")
          result = await assist(
            actor,
            z.object({ prompt: z.string().trim().min(3).max(1000) }).parse(body)
              .prompt,
          );
        else if (route === "billing/checkout") result = await checkout(actor);
        else if (route === "billing/portal")
          result = await billingPortal(actor);
        else if (route === "rewards/buy")
          result = buyCosmetic(
            actor,
            z.object({ cosmeticId: z.string().max(60) }).parse(body).cosmeticId,
            key,
          );
        else if (route === "profile/decoration")
          result = saveDecoration(actor, decorationSchema.parse(body), key);
        else if (route === "settings")
          result = account.settings(
            actor,
            z
              .object({
                name: z.string().trim().min(2).max(60),
                sharing: z.boolean(),
                notify: z.boolean(),
              })
              .parse(body),
            key,
          );
        else if (route === "account/delete") {
          await auth.confirmPassword(
            actor,
            z.object({ password: z.string().max(128).default("") }).parse(body)
              .password,
            token,
          );
          await deleteManagedAccount(actor, token);
          result = account.deleteAccount(actor);
          clearCookie = true;
        } else if (route === "notifications/read") {
          run(
            "UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL",
            Date.now(),
            actor.id,
          );
          result = { ok: true };
        } else if (route === "admin/spots")
          result = admin.adminSaveSpot(
            actor,
            admin.spotSchema.parse(body),
            key,
          );
        else if (route === "admin/moderate")
          result = admin.moderate(
            actor,
            z
              .object({
                flag_id: textId,
                action: z.enum(["dismiss", "hide"]),
                reason: z.string().trim().min(5).max(1000),
              })
              .parse(body),
            key,
          );
        else if (route === "admin/closures") {
          requireAdmin(actor);
          const input = z
            .object({
              spot_id: textId,
              local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              reason: z.string().trim().min(3).max(500),
              remove: z.boolean().default(false),
            })
            .parse(body);
          result = command(actor.id, "admin:closure", key, input, () => {
            catalog.getSpot(input.spot_id);
            if (input.remove)
              run(
                "DELETE FROM closures WHERE spot_id=? AND local_date=?",
                input.spot_id,
                input.local_date,
              );
            else
              run(
                "INSERT INTO closures VALUES(?,?,?) ON CONFLICT(spot_id,local_date) DO UPDATE SET reason=excluded.reason",
                input.spot_id,
                input.local_date,
                input.reason,
              );
            run(
              "INSERT INTO audit VALUES(?,?,?,?,?,?)",
              id(),
              actor.id,
              "closure:save",
              input.spot_id,
              input.reason,
              Date.now(),
            );
            return { ok: true };
          });
        } else if (route === "admin/rooms") {
          requireAdmin(actor);
          const input = z
            .object({
              id: textId,
              spot_id: textId,
              name: z.string().trim().min(2).max(100),
              capacity: z.number().int().min(1).max(100),
              demo: z.boolean(),
              enabled: z.boolean(),
              authorization: z.string().trim().min(10).max(1000),
            })
            .parse(body);
          result = command(actor.id, "admin:room", key, input, () => {
            catalog.getSpot(input.spot_id);
            assert(
              !one(
                "SELECT 1 FROM rooms WHERE id=? AND spot_id!=?",
                input.id,
                input.spot_id,
              ),
              "ROOM_VENUE",
              "An existing room cannot be moved to a different venue.",
              400,
            );
            run(
              "INSERT INTO rooms VALUES(?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET name=excluded.name,capacity=excluded.capacity,demo=excluded.demo,enabled=excluded.enabled,policy_version=rooms.policy_version+1",
              input.id,
              input.spot_id,
              input.name,
              input.capacity,
              Number(input.demo),
              Number(input.enabled),
            );
            run(
              "INSERT INTO audit VALUES(?,?,?,?,?,?)",
              id(),
              actor.id,
              "room:save",
              input.id,
              input.authorization,
              Date.now(),
            );
            return { ok: true };
          });
        } else throw new AppError(404, "NOT_FOUND", "Action not found.");
      }
    } else
      throw new AppError(
        405,
        "METHOD_NOT_ALLOWED",
        "That action isn't supported.",
      );
    const res = NextResponse.json(
      { data: result, serverTime: Date.now() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
    if (cookie)
      res.cookies.set(auth.cookieName, cookie, {
        httpOnly: true,
        secure: (
          process.env.APP_URL ||
          process.env.RENDER_EXTERNAL_URL ||
          ""
        ).startsWith("https:"),
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 86400,
      });
    if (clearCookie)
      res.cookies.set(auth.cookieName, "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    return res;
  } catch (e) {
    let error: AppError;
    if (e instanceof AppError) error = e;
    else if (e instanceof ZodError)
      error = new AppError(
        400,
        "INVALID_INPUT",
        e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" "),
      );
    else if (e instanceof Error && e.message.includes("BOOKING_CONFLICT"))
      error = new AppError(
        409,
        "BOOKING_CONFLICT",
        "That room or time was just booked. Please choose another time.",
      );
    else {
      console.error("DeskHop request failed", {
        route,
        method,
        errorType: e instanceof Error ? e.name : "unknown",
      });
      error = new AppError(
        500,
        "INTERNAL_ERROR",
        "Something went wrong. Your action may have been saved; refresh before retrying.",
      );
    }
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      {
        status: error.status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
export const GET = handler;
export const POST = handler;
