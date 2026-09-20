import { progress } from "./rewards";
import { premiumFor } from "./billing";
import { decoration, pinnedSpots } from "./profiles";
import { all, one, run } from "./db";
import { getSpot, reviews } from "./catalog";
import { assert } from "./errors";
import { blocked, command, id, rateLimit, requireVerified } from "./shared";
import type { Review, User } from "@/lib/types";
export function saveReview(
  user: User,
  spotId: string,
  input: {
    rating: number;
    noise: number;
    crowd: number;
    notes: string;
    visit_date: string;
  },
  key: string | null,
) {
  requireVerified(user);
  return command(user.id, `review:${spotId}`, key, input, () => {
    getSpot(spotId);
    rateLimit(`review:${user.id}`, 10, 3600000);
    assert(
      input.visit_date <= new Date().toISOString().slice(0, 10) &&
        input.visit_date >= "2000-01-01" &&
        Number.isFinite(Date.parse(input.visit_date)),
      "INVALID_DATE",
      "Choose a valid visit date that is not in the future.",
      400,
    );
    const now = Date.now();
    run(
      "INSERT OR IGNORE INTO first_reviews VALUES(?,?,?)",
      user.id,
      spotId,
      now,
    );
    run(
      "INSERT INTO reviews(id,user_id,spot_id,rating,noise,crowd,notes,visit_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,spot_id) DO UPDATE SET rating=excluded.rating,noise=excluded.noise,crowd=excluded.crowd,notes=excluded.notes,visit_date=excluded.visit_date,updated_at=excluded.updated_at",
      id(),
      user.id,
      spotId,
      input.rating,
      input.noise,
      input.crowd,
      input.notes,
      input.visit_date,
      now,
      now,
    );
    return { reviews: reviews(spotId, user.id) };
  });
}
export function reportConditions(
  user: User,
  spotId: string,
  input: { crowd: number; noise: number },
  key: string | null,
) {
  requireVerified(user);
  return command(user.id, `condition:${spotId}`, key, input, () => {
    getSpot(spotId);
    const now = Date.now();
    const previous = one<{ created_at: number }>(
      "SELECT created_at FROM reports WHERE user_id=? AND spot_id=?",
      user.id,
      spotId,
    );
    assert(
      !previous || previous.created_at < now - 600000,
      "REPORT_TOO_SOON",
      "You can update this spot's conditions every ten minutes.",
      429,
    );
    rateLimit(`reports:${user.id}`, 12, 86400000);
    run(
      "INSERT INTO reports VALUES(?,?,?,?,?,?,0) ON CONFLICT(user_id,spot_id) DO UPDATE SET crowd=excluded.crowd,noise=excluded.noise,created_at=excluded.created_at",
      id(),
      user.id,
      spotId,
      input.crowd,
      input.noise,
      now,
    );
    return { ok: true };
  });
}
export function reviewAction(
  user: User,
  reviewId: string,
  input: { action: "delete" | "like" | "unlike" | "flag"; reason?: string },
  key: string | null,
) {
  requireVerified(user);
  return command(user.id, `review-action:${reviewId}`, key, input, () => {
    const r = one<Review>("SELECT * FROM reviews WHERE id=?", reviewId);
    assert(
      r && !blocked(user.id, r.user_id),
      "NOT_FOUND",
      "Review not found.",
      404,
    );
    if (input.action === "delete") {
      assert(
        r.user_id === user.id,
        "FORBIDDEN",
        "You can only delete your own reviews.",
        403,
      );
      run("DELETE FROM reviews WHERE id=?", r.id);
    } else {
      assert(!r.hidden, "NOT_FOUND", "Review not found.", 404);
      if (input.action === "like") {
        assert(
          r.user_id !== user.id,
          "SELF_LIKE",
          "You can't mark your own review as helpful.",
          400,
        );
        run("INSERT OR IGNORE INTO review_likes VALUES(?,?)", user.id, r.id);
      }
      if (input.action === "unlike")
        run(
          "DELETE FROM review_likes WHERE user_id=? AND review_id=?",
          user.id,
          r.id,
        );
      if (input.action === "flag") {
        assert(
          input.reason,
          "REASON_REQUIRED",
          "Tell us why this review needs attention.",
          400,
        );
        rateLimit(`flags:${user.id}`, 10, 3600000);
        run(
          "INSERT INTO flags(id,user_id,review_id,reason,created_at) VALUES(?,?,?,?,?)",
          id(),
          user.id,
          r.id,
          input.reason,
          Date.now(),
        );
      }
    }
    return { ok: true };
  });
}
export function feed(userId: string) {
  return all<Review>(
    "SELECT r.*,u.name,u.handle,s.name spot_name FROM reviews r JOIN follows f ON f.target_id=r.user_id JOIN users u ON u.id=r.user_id JOIN spots s ON s.id=r.spot_id WHERE f.user_id=? AND r.hidden=0 AND u.suspended=0 AND s.published=1 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=u.id) OR (b.target_id=? AND b.user_id=u.id)) ORDER BY r.updated_at DESC LIMIT 100",
    userId,
    userId,
    userId,
  );
}
export function publicProfile(handle: string, viewerId?: string) {
  const user = one<{
    id: string;
    name: string;
    handle: string;
    created_at: number;
  }>(
    "SELECT id,name,handle,created_at FROM users WHERE handle=? AND suspended=0",
    handle,
  );
  assert(
    user && (!viewerId || !blocked(viewerId, user.id)),
    "USER_UNAVAILABLE",
    "This profile is not available.",
    404,
  );
  return {
    user,
    decoration: decoration(user.id),
    progress: (({ level, achievements }) => ({ level, achievements }))(
      progress(user.id),
    ),
    premium: premiumFor(user.id),
    pinnedSpots: pinnedSpots(user.id),
    followers: one<{ n: number }>(
      "SELECT COUNT(*) n FROM follows f JOIN users u ON u.id=f.user_id WHERE f.target_id=? AND u.suspended=0",
      user.id,
    )!.n,
    followingCount: one<{ n: number }>(
      "SELECT COUNT(*) n FROM follows f JOIN users u ON u.id=f.target_id WHERE f.user_id=? AND u.suspended=0",
      user.id,
    )!.n,
    following:
      !!viewerId &&
      !!one(
        "SELECT 1 FROM follows WHERE user_id=? AND target_id=?",
        viewerId,
        user.id,
      ),
    reviews: all<Review>(
      "SELECT r.*,s.name spot_name FROM reviews r JOIN spots s ON s.id=r.spot_id WHERE r.user_id=? AND r.hidden=0 AND s.published=1 ORDER BY r.updated_at DESC LIMIT 100",
      user.id,
    ),
  };
}
