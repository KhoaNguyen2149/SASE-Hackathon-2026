import { z } from "zod";
import { all, one, run } from "./db";
import { assert } from "./errors";
import { command, id, requireAdmin } from "./shared";
import type { Spot, User } from "@/lib/types";
const url = z.union([
  z.literal(""),
  z.url().refine((v) => v.startsWith("https://"), "Use an HTTPS URL."),
]);
const period = z.tuple([
  z.number().int().min(0).max(1439),
  z.number().int().min(0).max(1440),
]);
export const spotSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,80}$/),
  name: z.string().trim().min(2).max(100),
  category: z.enum([
    "library",
    "cafe",
    "campus_space",
    "coworking",
    "outdoor",
    "other",
  ]),
  description: z.string().trim().min(10).max(2000),
  address: z.string().trim().min(3).max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Use a valid timezone."),
  power: z.enum(["none", "some", "many", "unknown"]),
  wifi: z.enum(["yes", "no", "unknown"]),
  coffee: z.enum(["sold_on_site", "free_on_site", "none", "unknown"]),
  noise: z.number().int().min(0).max(5),
  mapped: z.number().int().min(0).max(1).default(0),
  access: z.enum([
    "public",
    "campus_only",
    "membership",
    "purchase_expected",
    "unknown",
  ]),
  access_note: z.string().max(1000),
  hours: z.string().refine((v) => {
    try {
      return z
        .record(
          z.enum(["0", "1", "2", "3", "4", "5", "6"]),
          z.array(period).max(3),
        )
        .safeParse(JSON.parse(v)).success;
    } catch {
      return false;
    }
  }, "Hours must be JSON mapping days 0–6 to minute intervals."),
  website: url,
  booking_url: url,
  accessibility: z.string().max(1000),
  image: z.enum(["library", "cafe", "study", "outdoor", "bookshop", "studio"]),
  demo: z.number().int().min(0).max(1),
  published: z.number().int().min(0).max(1),
  source: z.string().trim().min(5).max(1500),
  group_size: z.number().int().min(1).max(100).nullable(),
  verified_at: z.number().nullable(),
});
export function adminData(user: User) {
  requireAdmin(user);
  return {
    spots: all<Spot>("SELECT * FROM spots ORDER BY name"),
    rooms: all("SELECT * FROM rooms ORDER BY spot_id,name"),
    flags: all(
      "SELECT f.*,r.notes review_notes,s.name spot_name FROM flags f LEFT JOIN reviews r ON r.id=f.review_id LEFT JOIN spots s ON s.id=f.spot_id WHERE f.state='pending' ORDER BY f.created_at",
    ),
    closures: all("SELECT * FROM closures ORDER BY local_date DESC LIMIT 100"),
    stats: {
      users: one<{ n: number }>("SELECT COUNT(*) n FROM users")!.n,
      bookings: one<{ n: number }>(
        "SELECT COUNT(*) n FROM bookings WHERE status='confirmed' AND starts_at>?",
        Date.now(),
      )!.n,
    },
    audit: all(
      "SELECT action,entity_id,reason,created_at FROM audit ORDER BY created_at DESC LIMIT 30",
    ),
  };
}
export function adminSaveSpot(
  user: User,
  input: z.infer<typeof spotSchema>,
  key: string | null,
) {
  requireAdmin(user);
  return command(user.id, "admin:spot", key, input, () => {
    assert(
      input.demo || input.verified_at,
      "VERIFICATION_REQUIRED",
      "Real catalog entries require a verification date and source.",
      400,
    );
    const fields = Object.keys(input),
      values = Object.values(input);
    run(
      `INSERT INTO spots(${fields.join(",")}) VALUES(${fields.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${fields
        .filter((f) => f !== "id")
        .map((f) => `${f}=excluded.${f}`)
        .join(",")}`,
      ...values,
    );
    run(
      "INSERT INTO audit VALUES(?,?,?,?,?,?)",
      id(),
      user.id,
      "spot:save",
      input.id,
      input.source,
      Date.now(),
    );
    return { ok: true };
  });
}
export function moderate(
  user: User,
  input: { flag_id: string; action: "dismiss" | "hide"; reason: string },
  key: string | null,
) {
  requireAdmin(user);
  return command(user.id, "admin:moderate", key, input, () => {
    const f = one<{ review_id: string | null }>(
      "SELECT review_id FROM flags WHERE id=? AND state='pending'",
      input.flag_id,
    );
    assert(f, "NOT_FOUND", "This report has already been resolved.", 404);
    if (input.action === "hide") {
      assert(
        f.review_id,
        "NO_REVIEW",
        "This is a venue correction; edit the spot before resolving it.",
        400,
      );
      run("UPDATE reviews SET hidden=1 WHERE id=?", f.review_id);
    }
    run("UPDATE flags SET state=? WHERE id=?", input.action, input.flag_id);
    run(
      "INSERT INTO audit VALUES(?,?,?,?,?,?)",
      id(),
      user.id,
      `flag:${input.action}`,
      input.flag_id,
      input.reason,
      Date.now(),
    );
    return { ok: true };
  });
}
