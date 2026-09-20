import { z } from "zod";
import { all, one, run, transaction } from "./db";
import { assert } from "./errors";
import { premiumFor } from "./billing";
import { requireVerified, rateLimit } from "./shared";
import type { User } from "@/lib/types";
export const assistantPlanSchema = z.object({
  city: z.string().max(80),
  query: z.string().max(80),
  category: z.enum(["all", "library", "cafe", "outdoor", "coworking"]),
  needs_room: z.boolean(),
  needs_power: z.boolean(),
  quiet: z.boolean(),
  nearby: z.boolean(),
});
export const aiEnabled = () =>
  !!process.env.AI_API_KEY &&
  !!process.env.AI_MODEL &&
  /^[a-zA-Z0-9.-]+$/.test(process.env.AI_MODEL) &&
  Number(process.env.AI_DAILY_CALL_LIMIT) > 0;
export function reserveAiCall(user: User) {
  requireVerified(user);
  assert(
    premiumFor(user.id),
    "PREMIUM_REQUIRED",
    "The AI concierge is a Premium feature.",
    403,
  );
  assert(
    aiEnabled(),
    "AI_UNAVAILABLE",
    "The AI concierge is not connected yet. The free search filters remain available.",
    503,
  );
  transaction(() => {
    const day = new Date().toISOString().slice(0, 10),
      limit = Math.min(
        100,
        Math.floor(Number(process.env.AI_DAILY_CALL_LIMIT)),
      );
    const used = one<{ n: number }>(
      "SELECT COALESCE(SUM(calls),0) n FROM ai_usage WHERE day=?",
      day,
    )!.n;
    const mine =
      one<{ calls: number }>(
        "SELECT calls FROM ai_usage WHERE user_id=? AND day=?",
        user.id,
        day,
      )?.calls || 0;
    assert(
      used < limit && mine < 10,
      "AI_LIMIT",
      "The daily AI allowance has been reached. Try the free search filters or return tomorrow.",
      429,
    );
    run(
      "INSERT INTO ai_usage VALUES(?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET calls=calls+1",
      user.id,
      day,
    );
  });
}
export async function assist(user: User, prompt: string) {
  reserveAiCall(user);
  rateLimit("ai:" + user.id, 3, 60000);
  const model = process.env.AI_MODEL!;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.AI_API_KEY!,
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "Translate the study-space request into supported search preferences. Return only the JSON fields. Do not invent a venue, location, availability, transaction, or action. Unknown city and query must be empty strings. Set needs_room for room booking requests. Set nearby for nearest requests. Never claim a booking occurred.",
            },
          ],
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(assistantPlanSchema),
          maxOutputTokens: 400,
          temperature: 0.1,
        },
      }),
    },
  );
  assert(
    response.ok,
    "AI_PROVIDER",
    "The concierge could not respond. Use the free search while it recovers.",
    503,
  );
  const body = await response.json();
  const text = body.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text || "")
    .join("");
  let value: unknown;
  try {
    value = JSON.parse(text || "");
  } catch {
    assert(
      false,
      "AI_RESPONSE",
      "The assistant returned an invalid plan. Please use the search filters.",
      502,
    );
  }
  const plan = assistantPlanSchema.parse(value);
  const where = ["s.published=1", "s.demo=0"],
    values: string[] = [];
  if (plan.city) {
    where.push("s.city LIKE ?");
    values.push("%" + plan.city + "%");
  }
  if (plan.query) {
    where.push("s.name LIKE ?");
    values.push("%" + plan.query + "%");
  }
  if (plan.category !== "all") {
    where.push("s.category=?");
    values.push(plan.category);
  }
  if (plan.needs_power) where.push("s.power IN ('some','many')");
  if (plan.quiet) where.push("s.noise BETWEEN 1 AND 2");
  if (plan.needs_room)
    where.push(
      "(EXISTS(SELECT 1 FROM rooms r WHERE r.spot_id=s.id AND r.enabled=1) OR s.booking_url!='')",
    );
  const spots = all<{
    id: string;
    name: string;
    address: string;
    booking_url: string;
  }>(
    `SELECT s.id,s.name,s.address,s.booking_url FROM spots s WHERE ${where.join(" AND ")} ORDER BY s.name LIMIT 8`,
    ...values,
  );
  return {
    plan,
    spots,
    message: plan.needs_room
      ? "Here are places with a booking option. Choose a venue to check its rules and availability, then review and confirm your reservation. Nothing has been booked."
      : plan.nearby
        ? "Use the location button on Discover to calculate distances privately in your browser. I have not accessed your location."
        : "These results match the interpreted preferences in the current catalog. Confirm venue details before visiting.",
  };
}
