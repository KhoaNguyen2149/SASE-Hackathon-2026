import { one } from "../src/server/db";
import { createBooking } from "../src/server/booking";
import { startSession } from "../src/server/sessions";
import { createHop } from "../src/server/social";
import { randomUUID } from "node:crypto";
import type { User } from "../src/lib/types";
Date.now = () => Number(process.env.TEST_NOW);
const user = one<User>(
  "SELECT * FROM users WHERE id=?",
  process.env.TEST_USER!,
)!;
try {
  let value;
  if (process.env.TEST_ACTION === "book")
    value = createBooking(
      user,
      {
        room_id: "aspen-room-a",
        starts_at: Date.now() + 3600000,
        duration: 60,
        party_size: 2,
      },
      randomUUID(),
    );
  if (process.env.TEST_ACTION === "study")
    value = startSession(
      user,
      {
        spot_id: null,
        minutes: 25,
        visibility: "private",
        share_completion: false,
      },
      randomUUID(),
    );
  if (process.env.TEST_ACTION === "hop")
    value = createHop(
      user,
      {
        target_user_id: process.env.TEST_TARGET!,
        target_session_id: process.env.TEST_SESSION!,
        eta_minutes: null,
      },
      randomUUID(),
    );
  console.log(JSON.stringify({ ok: true, value }));
} catch (e) {
  console.log(
    JSON.stringify({ ok: false, code: (e as { code?: string }).code }),
  );
}
