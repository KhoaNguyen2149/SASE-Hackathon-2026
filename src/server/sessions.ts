import { all, one, run } from "./db";
import { assert } from "./errors";
import { command, event, id, rateLimit, requireVerified } from "./shared";
import { getSpot } from "./catalog";
import { elapsed } from "@/lib/time";
import type { Availability, StudySession, User, Visibility } from "@/lib/types";
export function clearBoundAvailability(userId: string) {
  run(
    "UPDATE availability SET mode=NULL,session_id=NULL,expires_at=NULL,revision=revision+1 WHERE user_id=? AND mode='open_to_join'",
    userId,
  );
}
export function normalizeUser(userId: string, now = Date.now()) {
  run(
    "UPDATE hops SET state='expired',ended_at=?,revision=revision+1 WHERE user_id=? AND state='on_way' AND expires_at<=?",
    now,
    userId,
    now,
  );
  run(
    "UPDATE availability SET mode=NULL,session_id=NULL,expires_at=NULL,revision=revision+1 WHERE user_id=? AND expires_at<=?",
    userId,
    now,
  );
  const s = one<StudySession>(
    "SELECT * FROM study_sessions WHERE user_id=? AND state IN ('running','paused','awaiting_confirmation')",
    userId,
  );
  if (s) {
    if (now - s.last_heartbeat_at >= 6 * 3600000) {
      run(
        "UPDATE study_sessions SET state='abandoned',focus_seconds=?,segment_started_at=NULL,ended_at=?,revision=revision+1 WHERE id=?",
        elapsed(s, now),
        now,
        s.id,
      );
      clearBoundAvailability(userId);
    } else if (s.state === "running" && elapsed(s, now) >= s.target_seconds) {
      run(
        "UPDATE study_sessions SET state='awaiting_confirmation',focus_seconds=target_seconds,segment_started_at=NULL,revision=revision+1 WHERE id=?",
        s.id,
      );
      clearBoundAvailability(userId);
    } else if (
      s.state !== "running" ||
      s.last_heartbeat_at < now - 600000 ||
      s.visibility !== "friends_status_and_venue"
    )
      clearBoundAvailability(userId);
  } else clearBoundAvailability(userId);
}
export function ownSession(userId: string) {
  return (
    one<StudySession>(
      "SELECT s.*,p.name spot_name FROM study_sessions s LEFT JOIN spots p ON p.id=s.spot_id WHERE s.user_id=? AND s.state IN ('running','paused','awaiting_confirmation')",
      userId,
    ) || null
  );
}
export function history(userId: string) {
  return all<StudySession>(
    "SELECT s.*,p.name spot_name FROM study_sessions s LEFT JOIN spots p ON p.id=s.spot_id WHERE s.user_id=? AND s.state IN ('completed','cancelled','abandoned') ORDER BY s.started_at DESC LIMIT 100",
    userId,
  );
}
export function ownAvailability(userId: string): Availability {
  return (
    one<Availability>("SELECT * FROM availability WHERE user_id=?", userId) || {
      user_id: userId,
      mode: null,
      session_id: null,
      expires_at: null,
      revision: 0,
    }
  );
}
export function startSession(
  user: User,
  input: {
    spot_id: string | null;
    minutes: number;
    visibility: Visibility;
    share_completion: boolean;
  },
  key: string | null,
) {
  requireVerified(user);
  return command(user.id, "session:start", key, input, () => {
    normalizeUser(user.id);
    assert(
      !ownSession(user.id),
      "SESSION_ACTIVE",
      "Finish or cancel your current study session first.",
    );
    assert(
      !one("SELECT 1 FROM hops WHERE user_id=? AND state='on_way'", user.id),
      "HOP_ACTIVE",
      "Mark yourself as arrived or cancel your hop before starting a session.",
    );
    if (input.spot_id) getSpot(input.spot_id);
    assert(
      input.visibility === "private" || user.sharing,
      "SHARING_DISABLED",
      "Enable sharing in Profile before sharing a session.",
      403,
    );
    const sessionId = id(),
      now = Date.now();
    run(
      "INSERT INTO study_sessions(id,user_id,spot_id,state,visibility,target_seconds,started_at,segment_started_at,last_heartbeat_at,share_completion) VALUES(?,?,?,'running',?,?,?,?,?,?)",
      sessionId,
      user.id,
      input.spot_id,
      input.visibility,
      input.minutes * 60,
      now,
      now,
      now,
      Number(input.share_completion),
    );
    run(
      "UPDATE availability SET mode=NULL,session_id=NULL,expires_at=NULL,revision=revision+1 WHERE user_id=? AND mode IN ('available','open_to_join')",
      user.id,
    );
    return ownSession(user.id)!;
  });
}
export function sessionAction(
  user: User,
  sessionId: string,
  input: {
    action: "pause" | "resume" | "finish" | "cancel" | "extend" | "privacy";
    revision: number;
    minutes?: number;
    visibility?: Visibility;
  },
  key: string | null,
) {
  return command(user.id, `session:${sessionId}`, key, input, () => {
    normalizeUser(user.id);
    const s = one<StudySession>(
      "SELECT * FROM study_sessions WHERE id=? AND user_id=?",
      sessionId,
      user.id,
    );
    assert(s, "NOT_FOUND", "Study session not found.", 404);
    assert(
      s.revision === input.revision,
      "REVISION_CONFLICT",
      "Your session changed in another tab. Refresh and try again.",
    );
    assert(
      ["running", "paused", "awaiting_confirmation"].includes(s.state),
      "SESSION_ENDED",
      "This session has already ended.",
    );
    const now = Date.now(),
      focused = elapsed(s, now);
    let state = s.state,
      target = s.target_seconds,
      visibility = s.visibility;
    if (input.action === "pause") {
      assert(
        state === "running",
        "INVALID_TRANSITION",
        "Only a running timer can be paused.",
      );
      state = "paused";
    }
    if (input.action === "resume") {
      assert(
        state === "paused",
        "INVALID_TRANSITION",
        "Only a paused timer can be resumed.",
      );
      state = "running";
    }
    if (input.action === "finish") state = "completed";
    if (input.action === "cancel") state = "cancelled";
    if (input.action === "extend") {
      assert(
        input.minutes && target + input.minutes * 60 <= 10800,
        "DURATION_LIMIT",
        "A session can last up to three hours.",
        400,
      );
      target += input.minutes * 60;
      state = "running";
    }
    if (input.action === "privacy") {
      assert(
        input.visibility,
        "INVALID_INPUT",
        "Choose a privacy setting.",
        400,
      );
      assert(
        input.visibility === "private" || user.sharing,
        "SHARING_DISABLED",
        "Enable sharing in Profile first.",
        403,
      );
      visibility = input.visibility;
    }
    run(
      "UPDATE study_sessions SET state=?,focus_seconds=?,target_seconds=?,visibility=?,segment_started_at=?,last_heartbeat_at=?,ended_at=?,revision=revision+1 WHERE id=?",
      state,
      focused,
      target,
      visibility,
      state === "running" ? now : null,
      now,
      ["completed", "cancelled"].includes(state) ? now : null,
      s.id,
    );
    if (state !== "running" || visibility !== "friends_status_and_venue")
      clearBoundAvailability(user.id);
    if (
      state === "completed" &&
      focused >= 600 &&
      s.share_completion &&
      visibility !== "private" &&
      user.sharing
    )
      event("completion", user.id, s.id);
    return one<StudySession>("SELECT * FROM study_sessions WHERE id=?", s.id)!;
  });
}
export function heartbeat(userId: string) {
  normalizeUser(userId);
  run(
    "UPDATE study_sessions SET last_heartbeat_at=? WHERE user_id=? AND state IN ('running','paused','awaiting_confirmation')",
    Date.now(),
    userId,
  );
  return ownSession(userId);
}
export function setAvailability(
  user: User,
  input: { mode: Availability["mode"]; minutes: number; revision: number },
  key: string | null,
) {
  requireVerified(user);
  return command(user.id, "availability", key, input, () => {
    normalizeUser(user.id);
    rateLimit(`availability:${user.id}`, 10, 60000);
    const current = ownAvailability(user.id);
    assert(
      current.revision === input.revision,
      "REVISION_CONFLICT",
      "Your availability changed. Refresh and try again.",
    );
    assert(
      !input.mode || user.sharing,
      "SHARING_DISABLED",
      "Enable sharing in Profile first.",
      403,
    );
    const session = ownSession(user.id);
    if (input.mode === "available") {
      assert(
        [30, 60, 120].includes(input.minutes),
        "INVALID_INPUT",
        "Choose 30, 60, or 120 minutes.",
        400,
      );
      assert(
        !session,
        "SESSION_ACTIVE",
        "Finish or cancel your study session before sharing that you are available.",
      );
      assert(
        !one("SELECT 1 FROM hops WHERE user_id=? AND state='on_way'", user.id),
        "HOP_ACTIVE",
        "End your hop before sharing that you are available.",
      );
    }
    if (input.mode === "open_to_join")
      assert(
        session &&
          session.state === "running" &&
          session.spot_id &&
          session.visibility === "friends_status_and_venue",
        "SHARED_SESSION_REQUIRED",
        "Start a session that shares your spot before opening it to company.",
      );
    const expires = input.mode
      ? Math.min(
          Date.now() + input.minutes * 60000,
          input.mode === "open_to_join" && session
            ? Date.now() +
                (session.target_seconds - elapsed(session, Date.now())) * 1000
            : Infinity,
        )
      : null;
    run(
      "INSERT INTO availability(user_id,mode,session_id,expires_at,revision) VALUES(?,?,?,?,1) ON CONFLICT(user_id) DO UPDATE SET mode=excluded.mode,session_id=excluded.session_id,expires_at=excluded.expires_at,revision=availability.revision+1",
      user.id,
      input.mode,
      input.mode === "open_to_join" ? session!.id : null,
      expires,
    );
    return ownAvailability(user.id);
  });
}
