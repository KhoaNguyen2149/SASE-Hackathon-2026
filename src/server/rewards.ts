import { all, one, run, transaction } from "./db";
import { requireVerified, command } from "./shared";
import { assert } from "./errors";
import { cosmetics, levelFor, type Progress } from "@/lib/rewards";
import { localParts } from "@/lib/time";
import type { User } from "@/lib/types";
export function syncRewards(user: User) {
  if (!user.verified) return;
  transaction(() => {
    const reviews = all<{ spot_id: string; created_at: number }>(
      `SELECT r.spot_id,fr.created_at FROM reviews r JOIN first_reviews fr ON fr.user_id=r.user_id AND fr.spot_id=r.spot_id JOIN spots s ON s.id=r.spot_id WHERE r.user_id=? AND r.hidden=0 AND s.demo=0 AND s.published=1 ORDER BY fr.created_at`,
      user.id,
    );
    for (const r of reviews) {
      const day = localParts(r.created_at).date;
      if (
        one<{ n: number }>(
          "SELECT COUNT(*) n FROM rewards WHERE user_id=? AND kind='review' AND local_date=?",
          user.id,
          day,
        )!.n >= 3
      )
        continue;
      run(
        "INSERT OR IGNORE INTO rewards VALUES(?,?,?,'review',20,10,?,?,0)",
        user.id,
        "review:" + r.spot_id,
        r.spot_id,
        day,
        r.created_at,
      );
    }
    const sessions = all<{
      id: string;
      focus_seconds: number;
      ended_at: number;
    }>(
      "SELECT id,focus_seconds,ended_at FROM study_sessions WHERE user_id=? AND state='completed' AND focus_seconds>=600 ORDER BY ended_at",
      user.id,
    );
    for (const s of sessions) {
      if (
        one(
          "SELECT 1 FROM rewards WHERE user_id=? AND reward_key=?",
          user.id,
          "study:" + s.id,
        )
      )
        continue;
      const day = localParts(s.ended_at).date;
      const spent = one<{ n: number }>(
        "SELECT COALESCE(SUM(minutes),0) n FROM rewards WHERE user_id=? AND kind='study' AND local_date=?",
        user.id,
        day,
      )!.n;
      const minutes = Math.max(
        0,
        Math.min(120 - spent, Math.floor(s.focus_seconds / 60)),
      );
      run(
        "INSERT INTO rewards VALUES(?,?,?,'study',?,?,?,?,?)",
        user.id,
        "study:" + s.id,
        s.id,
        minutes,
        Math.floor(minutes / 10) * 2,
        day,
        s.ended_at,
        minutes,
      );
    }
  });
}
export function progress(userId: string): Progress {
  const totals = one<{ xp: number; coins: number }>(
    "SELECT COALESCE(SUM(xp),0) xp,COALESCE(SUM(coins),0) coins FROM rewards WHERE user_id=?",
    userId,
  )!;
  const purchased = all<{ cosmetic_id: string; cost: number }>(
    "SELECT cosmetic_id,cost FROM cosmetics_owned WHERE user_id=?",
    userId,
  );
  const level = levelFor(totals.xp);
  const reviews = one<{ n: number }>(
    "SELECT COUNT(*) n FROM rewards WHERE user_id=? AND kind='review'",
    userId,
  )!.n;
  const focus = one<{ n: number }>(
    "SELECT COALESCE(SUM(minutes),0) n FROM rewards WHERE user_id=? AND kind='study'",
    userId,
  )!.n;
  return {
    xp: totals.xp,
    coins: totals.coins - purchased.reduce((sum, p) => sum + p.cost, 0),
    level,
    nextLevelXp: 100 * level * level,
    owned: [
      ...cosmetics.filter((c) => c.cost === 0).map((c) => c.id),
      ...purchased.map((p) => p.cosmetic_id),
    ],
    achievements: [
      {
        id: "first-words",
        name: "First words",
        description: "Contribute your first real-venue review.",
        earned: reviews >= 1,
      },
      {
        id: "local-guide",
        name: "Local guide",
        description: "Contribute to five real venues.",
        earned: reviews >= 5,
      },
      {
        id: "focus-hour",
        name: "Finding focus",
        description: "Earn rewards for 60 focus minutes.",
        earned: focus >= 60,
      },
      {
        id: "steady-progress",
        name: "Steady progress",
        description: "Earn rewards for 600 focus minutes.",
        earned: focus >= 600,
      },
    ],
  };
}
export function buyCosmetic(
  user: User,
  cosmeticId: string,
  key: string | null,
) {
  requireVerified(user);
  syncRewards(user);
  return command(user.id, "cosmetic:buy", key, { cosmeticId }, () => {
    const item = cosmetics.find((c) => c.id === cosmeticId);
    assert(item, "NOT_FOUND", "That decoration is unavailable.", 404);
    const earned = progress(user.id);
    if (earned.owned.includes(item.id)) return { progress: earned };
    assert(
      earned.level >= item.level,
      "LEVEL_REQUIRED",
      `Reach level ${item.level} to unlock this decoration.`,
      400,
    );
    assert(
      earned.coins >= item.cost,
      "COINS_REQUIRED",
      "You need more Leaves for this decoration.",
      400,
    );
    run(
      "INSERT INTO cosmetics_owned VALUES(?,?,?,?)",
      user.id,
      item.id,
      item.cost,
      Date.now(),
    );
    return { progress: progress(user.id) };
  });
}
