import { all, one } from "./db";
import { assert } from "./errors";
import { localParts } from "@/lib/time";
import type { Conditions, Review, Room, Spot, SpotSummary } from "@/lib/types";
type Periods = Record<string, number[][]>;
export function getSpot(id: string) {
  const spot = one<Spot>("SELECT * FROM spots WHERE id=? AND published=1", id);
  assert(spot, "NOT_FOUND", "We couldn't find that study spot.", 404);
  return spot;
}
export function isOpen(spot: Spot, start: number, end: number): boolean | null {
  let hours: Periods;
  try {
    hours = JSON.parse(spot.hours);
  } catch {
    return null;
  }
  if (!Object.keys(hours).length) return null;
  for (let t = start; t < end; t = Math.min(t + 60000, end)) {
    const p = localParts(t, spot.timezone);
    if (
      one(
        "SELECT 1 FROM closures WHERE spot_id=? AND local_date=?",
        spot.id,
        p.date,
      )
    )
      return false;
    const today = hours[p.weekday] || [];
    const previous = hours[(p.weekday + 6) % 7] || [];
    const inside =
      today.some(([a, b]) =>
        b > a ? p.minutes >= a && p.minutes < b : p.minutes >= a,
      ) || previous.some(([a, b]) => b <= a && p.minutes < b);
    if (!inside) return false;
  }
  return true;
}
export function conditions(spotId: string, now = Date.now()): Conditions {
  const rows = all<{ crowd: number; noise: number; created_at: number }>(
    "SELECT r.crowd,r.noise,r.created_at FROM reports r JOIN users u ON u.id=r.user_id WHERE r.spot_id=? AND r.created_at>? AND r.hidden=0 AND u.suspended=0 AND u.verified=1",
    spotId,
    now - 45 * 60000,
  );
  const newest = Math.max(...rows.map((r) => r.created_at));
  const weighted = rows.map((r) => ({
    ...r,
    w: 0.5 * Math.pow(2, -(now - r.created_at) / 900000),
  }));
  const sum = weighted.reduce((s, r) => s + r.w, 0);
  if (rows.length < 3 || sum < 1 || newest < now - 15 * 60000)
    return { state: "insufficient_data" };
  function quantile(field: "crowd" | "noise", q: number) {
    let total = 0;
    for (const r of [...weighted].sort((a, b) => a[field] - b[field])) {
      total += r.w;
      if (total >= sum * q) return r[field];
    }
    return 3;
  }
  if (quantile("crowd", 0.75) - quantile("crowd", 0.25) > 2)
    return { state: "conflicting_reports", asOf: newest };
  const effective = (sum * sum) / weighted.reduce((s, r) => s + r.w * r.w, 0);
  return {
    state: "recent_reports",
    level: quantile("crowd", 0.5),
    noise: quantile("noise", 0.5),
    evidence: effective >= 3 ? "moderate" : "limited",
    sampleBucket: rows.length <= 5 ? "3–5" : rows.length <= 10 ? "6–10" : "11+",
    asOf: newest,
    expiresAt: Math.min(now + 60000, newest + 15 * 60000),
  };
}
export function spotSummary(spot: Spot, userId?: string): SpotSummary {
  const rating = one<{ rating: number | null; count: number }>(
    "SELECT AVG(r.rating) rating,COUNT(*) count FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.spot_id=? AND r.hidden=0 AND u.suspended=0",
    spot.id,
  )!;
  return {
    ...spot,
    saved:
      !!userId &&
      !!one(
        "SELECT 1 FROM saved WHERE user_id=? AND spot_id=?",
        userId,
        spot.id,
      ),
    conditions: conditions(spot.id),
    rating: rating.rating,
    review_count: rating.count,
    rooms: one<{ n: number }>(
      "SELECT COUNT(*) n FROM rooms WHERE spot_id=? AND enabled=1",
      spot.id,
    )!.n,
    open: isOpen(spot, Date.now(), Date.now() + 60000),
  };
}
export function listSpots(userId?: string) {
  const activeReports = new Set(
    all<{ spot_id: string }>(
      "SELECT DISTINCT spot_id FROM reports WHERE created_at>?",
      Date.now() - 45 * 60000,
    ).map((r) => r.spot_id),
  );
  return all<SpotSummary>(
    `SELECT s.*,r.rating,COALESCE(r.review_count,0) review_count,COALESCE(rm.rooms,0) rooms,CASE WHEN sv.user_id IS NULL THEN 0 ELSE 1 END saved FROM spots s LEFT JOIN (SELECT r.spot_id,AVG(r.rating) rating,COUNT(*) review_count FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.hidden=0 AND u.suspended=0 GROUP BY r.spot_id) r ON r.spot_id=s.id LEFT JOIN (SELECT spot_id,COUNT(*) rooms FROM rooms WHERE enabled=1 GROUP BY spot_id) rm ON rm.spot_id=s.id LEFT JOIN saved sv ON sv.spot_id=s.id AND sv.user_id=? WHERE s.published=1 ORDER BY s.demo DESC,s.name`,
    userId || "",
  ).map((s) => ({
    ...s,
    saved: !!s.saved,
    conditions: activeReports.has(s.id)
      ? conditions(s.id)
      : { state: "insufficient_data" as const },
    open: isOpen(s, Date.now(), Date.now() + 60000),
  }));
}
export function reviews(spotId: string, userId?: string) {
  return all<Review>(
    `SELECT r.*,u.name,u.handle,(SELECT COUNT(*) FROM review_likes l WHERE l.review_id=r.id) likes,(SELECT COUNT(*) FROM review_likes l WHERE l.review_id=r.id AND l.user_id=?) liked FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.spot_id=? AND r.hidden=0 AND u.suspended=0 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=r.user_id) OR (b.target_id=? AND b.user_id=r.user_id)) ORDER BY r.updated_at DESC LIMIT 100`,
    userId || "",
    spotId,
    userId || "",
    userId || "",
  );
}
export function detail(spotId: string, userId?: string) {
  return {
    spot: spotSummary(getSpot(spotId), userId),
    rooms: all<Room>(
      "SELECT * FROM rooms WHERE spot_id=? AND enabled=1",
      spotId,
    ),
    reviews: reviews(spotId, userId),
  };
}

export function directorySpot(
  s: SpotSummary,
  start: number,
  end: number,
): import("@/lib/types").DirectorySpot {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    description: s.imported_at
      ? "Community map listing. Confirm access and study amenities before visiting."
      : s.description,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    power: s.power,
    wifi: s.wifi,
    coffee: s.coffee,
    noise: s.noise,
    access: s.access,
    image: s.image,
    demo: s.demo,
    verified_at: s.verified_at,
    group_size: s.group_size,
    mapped: s.mapped,
    city: s.city || undefined,
    photo_url: s.photo_url || undefined,
    photo_credit: s.photo_credit || undefined,
    photo_source: s.photo_source || undefined,
    saved: s.saved,
    conditions: s.conditions,
    rating: s.rating,
    review_count: s.review_count,
    rooms: s.rooms,
    open: isOpen(s, start, end),
  };
}
