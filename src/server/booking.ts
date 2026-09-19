import { all, one, run } from "./db";
import { assert } from "./errors";
import { command, event, id, requireVerified } from "./shared";
import { getSpot, isOpen } from "./catalog";
import { localDaySlots, localParts } from "@/lib/time";
import type { Booking, Room, User } from "@/lib/types";
export function bookings(userId: string) {
  return all<Booking>(
    "SELECT b.*,r.name room_name,s.name spot_name,s.id spot_id,r.demo FROM bookings b JOIN rooms r ON r.id=b.room_id JOIN spots s ON s.id=r.spot_id WHERE b.user_id=? ORDER BY b.starts_at DESC LIMIT 200",
    userId,
  );
}
export function availability(
  roomId: string,
  date: string,
  duration: number,
  partySize: number,
  userId?: string,
) {
  const room = one<Room>(
    "SELECT * FROM rooms WHERE id=? AND enabled=1",
    roomId,
  );
  assert(room, "NOT_FOUND", "This room is not available.", 404);
  const spot = getSpot(room.spot_id);
  assert(
    partySize <= room.capacity,
    "CAPACITY",
    "This room is too small for your group.",
    400,
  );
  const now = Date.now();
  const slots = localDaySlots(date, spot.timezone)
    .filter(
      (t) =>
        t > now &&
        t <= now + 7 * 86400000 &&
        isOpen(spot, t, t + duration * 60000) === true,
    )
    .map((t) => ({
      starts_at: t,
      ends_at: t + duration * 60000,
      available: !one(
        "SELECT 1 FROM bookings WHERE status='confirmed' AND (room_id=? OR user_id=?) AND starts_at<? AND ends_at>?",
        roomId,
        userId || "",
        t + duration * 60000,
        t,
      ),
    }));
  return { room, slots, timezone: spot.timezone };
}
export function createBooking(
  user: User,
  input: {
    room_id: string;
    starts_at: number;
    duration: number;
    party_size: number;
  },
  key: string | null,
) {
  requireVerified(user);
  return command(user.id, "booking:create", key, input, () => {
    const now = Date.now(),
      end = input.starts_at + input.duration * 60000;
    const room = one<Room>(
      "SELECT * FROM rooms WHERE id=? AND enabled=1",
      input.room_id,
    );
    assert(room, "NOT_FOUND", "This room is not available.", 404);
    const spot = getSpot(room.spot_id);
    assert(
      spot.access === "public" || spot.access === "purchase_expected",
      "ACCESS_RESTRICTED",
      "This venue requires authorization that DeskHop cannot verify.",
      403,
    );
    assert(
      input.starts_at > now && input.starts_at <= now + 7 * 86400000,
      "BOOKING_WINDOW",
      "Choose a future time within the next seven days.",
      400,
    );
    const local = localParts(input.starts_at, spot.timezone);
    assert(
      local.minutes % 30 === 0 &&
        local.second === 0 &&
        input.starts_at % 1000 === 0,
      "START_INCREMENT",
      "Choose a start time on the hour or half hour.",
      400,
    );
    assert(
      input.party_size <= room.capacity,
      "CAPACITY",
      `This room has space for up to ${room.capacity} people.`,
      400,
    );
    assert(
      isOpen(spot, input.starts_at, end) === true,
      "VENUE_CLOSED",
      "The venue must be open for your entire reservation.",
    );
    const upcoming = all<Booking>(
      "SELECT * FROM bookings WHERE user_id=? AND status='confirmed' AND ends_at>?",
      user.id,
      now,
    );
    assert(
      upcoming.length < 2,
      "BOOKING_LIMIT",
      "You can hold up to two upcoming reservations. Cancel one before booking again.",
    );
    const onDay = bookings(user.id).filter(
      (b) =>
        b.status === "confirmed" &&
        localParts(b.starts_at, spot.timezone).date === local.date,
    );
    assert(
      onDay.reduce((n, b) => n + (b.ends_at - b.starts_at), 0) +
        input.duration * 60000 <=
        4 * 3600000,
      "DAILY_LIMIT",
      "You can reserve up to four hours in one day.",
    );
    assert(
      !one(
        "SELECT 1 FROM bookings WHERE status='confirmed' AND (room_id=? OR user_id=?) AND starts_at<? AND ends_at>?",
        room.id,
        user.id,
        end,
        input.starts_at,
      ),
      "BOOKING_CONFLICT",
      "That time was just booked, or overlaps one of your reservations. Please choose another time.",
    );
    const bookingId = id();
    run(
      "INSERT INTO bookings VALUES(?,?,?,?,?,?,?,?,?)",
      bookingId,
      user.id,
      room.id,
      input.starts_at,
      end,
      input.party_size,
      "confirmed",
      room.policy_version,
      now,
    );
    event("booking", user.id, bookingId);
    return bookings(user.id).find((b) => b.id === bookingId)!;
  });
}
export function cancelBooking(
  user: User,
  bookingId: string,
  key: string | null,
) {
  return command(user.id, "booking:cancel", key, { bookingId }, () => {
    const b = one<Booking>(
      "SELECT * FROM bookings WHERE id=? AND user_id=?",
      bookingId,
      user.id,
    );
    assert(b, "NOT_FOUND", "Reservation not found.", 404);
    if (b.status === "cancelled") return b;
    assert(
      b.starts_at > Date.now(),
      "CANCELLATION_CLOSED",
      "This reservation has already started. Contact the venue for help.",
    );
    run("UPDATE bookings SET status='cancelled' WHERE id=?", bookingId);
    return { ...b, status: "cancelled" };
  });
}
