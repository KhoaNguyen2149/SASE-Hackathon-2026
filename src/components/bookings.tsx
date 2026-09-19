"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Users,
} from "lucide-react";
import type { Booking, Room, SpotSummary } from "@/lib/types";
import { useApp, useResource } from "./provider";
import {
  AuthGate,
  Badge,
  Empty,
  ErrorState,
  Loading,
  Modal,
  PageTitle,
} from "./ui";
import { dateLabel, localParts, timeLabel } from "@/lib/time";
export function BookingForm({
  spot,
  rooms,
  initiallyExpanded = false,
}: {
  spot: SpotSummary;
  rooms: Room[];
  initiallyExpanded?: boolean;
}) {
  const { mutate, requireAuth, busy, now } = useApp();
  const [expanded, setExpanded] = useState(initiallyExpanded),
    [room, setRoom] = useState(rooms[0].id),
    [date, setDate] = useState(() => localParts(now).date),
    [duration, setDuration] = useState(60),
    [party, setParty] = useState(1),
    [selected, setSelected] = useState<number | null>(null),
    [review, setReview] = useState(false),
    [confirmed, setConfirmed] = useState<Booking | null>(null);
  const selectedRoom = rooms.find((r) => r.id === room)!;
  const { data, error, loading } = useResource<{
    slots: { starts_at: number; ends_at: number; available: boolean }[];
  }>(
    expanded
      ? `availability?room=${room}&date=${date}&duration=${duration}&party=${party}`
      : null,
  );
  return (
    <div className="booking-widget card padded">
      {spot.demo === 1 && (
        <div className="demo-note">
          <InfoIcon />
          <span>
            <strong>Demo inventory.</strong> This flow exercises real booking
            safeguards, but doesn’t reserve a real-world room.
          </span>
        </div>
      )}
      {!expanded ? (
        <>
          <div className="room-summary">
            <span className="room-symbol">
              <Users size={28} />
            </span>
            <div>
              <h3>
                {rooms.length === 1
                  ? rooms[0].name
                  : "A little space to work together"}
              </h3>
              <p>
                30–120 minutes · up to{" "}
                {Math.max(...rooms.map((r) => r.capacity))} people
              </p>
            </div>
          </div>
          <button
            className="button secondary full"
            onClick={() => setExpanded(true)}
          >
            Find a time <ArrowRight size={16} />
          </button>
        </>
      ) : (
        <>
          <div className="form-grid">
            <label className="field">
              Room
              <select
                value={room}
                onChange={(e) => {
                  setRoom(e.target.value);
                  setSelected(null);
                  setParty(1);
                }}
              >
                {rooms.map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.name} · {r.capacity} people
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Date
              <input
                type="date"
                required
                value={date}
                min={localParts(now).date}
                max={localParts(now + 7 * 86400000).date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSelected(null);
                }}
              />
            </label>
            <label className="field">
              Time together
              <select
                value={duration}
                onChange={(e) => {
                  setDuration(Number(e.target.value));
                  setSelected(null);
                }}
              >
                {[30, 60, 90, 120].map((n) => (
                  <option key={n} value={n}>
                    {n} minutes
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              People
              <select
                value={party}
                onChange={(e) => {
                  setParty(Number(e.target.value));
                  setSelected(null);
                }}
              >
                {Array.from({ length: selectedRoom.capacity }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1} {i === 0 ? "person" : "people"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="field-label">
            Choose a start time <small>· America/Denver</small>
          </p>
          {error ? (
            <div className="error-box">{error}</div>
          ) : loading ? (
            <Loading />
          ) : !data?.slots.length ? (
            <p className="soft-panel">
              No times are available for this date. Try another day or a shorter
              visit.
            </p>
          ) : (
            <div className="time-slots">
              {data.slots.map((slot) => (
                <button
                  key={slot.starts_at}
                  disabled={!slot.available}
                  className={selected === slot.starts_at ? "selected" : ""}
                  aria-pressed={selected === slot.starts_at}
                  onClick={() => setSelected(slot.starts_at)}
                >
                  {timeLabel(slot.starts_at)}
                  {!slot.available && <span className="sr-only"> booked</span>}
                </button>
              ))}
            </div>
          )}
          <button
            className="button full"
            disabled={!selected || busy}
            onClick={() => {
              if (requireAuth()) setReview(true);
            }}
          >
            Review reservation <ArrowRight size={16} />
          </button>
          <p className="fine-print">
            Free cancellation before the start. A time is yours only after
            confirmation.
          </p>
        </>
      )}
      {review && selected && (
        <Modal
          title="A room for your next little breakthrough"
          onClose={() => setReview(false)}
        >
          <Badge tone={selectedRoom.demo ? "apricot" : "sage"}>
            {selectedRoom.demo ? "Demo reservation" : "Room reservation"}
          </Badge>
          <div className="reservation-review">
            <h3>{selectedRoom.name}</h3>
            <p>{spot.name}</p>
            <div>
              <CalendarDays size={18} />
              {dateLabel(selected)} · {timeLabel(selected)}–
              {timeLabel(selected + duration * 60000)}
            </div>
            <div>
              <Clock3 size={18} />
              {duration} minutes · America/Denver
            </div>
            <div>
              <Users size={18} />
              {party} {party === 1 ? "person" : "people"} · capacity{" "}
              {selectedRoom.capacity}
            </div>
          </div>
          <p>{spot.access_note}</p>
          <p className="fine-print">
            Cancel before the start at no charge. Up to two upcoming
            reservations and four hours per day. Policy version{" "}
            {selectedRoom.policy_version}.
          </p>
          <button
            className="button full"
            disabled={busy}
            onClick={async () => {
              const result = await mutate<Booking>("bookings", {
                room_id: room,
                starts_at: selected,
                duration,
                party_size: party,
              });
              if (result) {
                setConfirmed(result);
                setReview(false);
                setSelected(null);
              }
            }}
          >
            {busy ? "Confirming…" : "Confirm reservation"}
            <CheckCircle2 size={17} />
          </button>
        </Modal>
      )}
      {confirmed && (
        <Modal
          title="Your little corner is confirmed."
          onClose={() => setConfirmed(null)}
        >
          <div className="success-art">
            <CheckCircle2 size={44} />
          </div>
          {confirmed.demo === 1 && (
            <Badge tone="apricot">Demo inventory — no real room booked</Badge>
          )}
          <h3>{confirmed.room_name}</h3>
          <p>
            {dateLabel(confirmed.starts_at)} · {timeLabel(confirmed.starts_at)}–
            {timeLabel(confirmed.ends_at)}
          </p>
          <p className="fine-print">Confirmation: {confirmed.id}</p>
          <Link className="button full" href="/bookings">
            Go to My bookings <ArrowRight size={16} />
          </Link>
        </Modal>
      )}
    </div>
  );
}
export function Bookings() {
  return (
    <>
      <PageTitle
        eyebrow="MAKE ROOM FOR YOUR PLANS"
        title="Your next little get-together."
        description="Your confirmed rooms, all in one place."
      />
      <AuthGate>
        <BookingList />
      </AuthGate>
    </>
  );
}
function BookingList() {
  const { data, error } = useResource<{ bookings: Booking[] }>("bookings");
  const { now, mutate, busy } = useApp();
  const [cancel, setCancel] = useState<Booking | null>(null);
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;
  const upcoming = data.bookings.filter(
      (b) => b.status === "confirmed" && b.ends_at > now,
    ),
    past = data.bookings.filter(
      (b) => b.status !== "confirmed" || b.ends_at <= now,
    );
  return (
    <>
      {!data.bookings.length ? (
        <Empty
          icon={<CalendarDays />}
          title="A little room in your calendar"
          action={
            <Link className="button" href="/discover">
              Find a study spot <ArrowRight size={17} />
            </Link>
          }
        >
          Find your next space and reserve a room. We’ll keep the details here.
        </Empty>
      ) : (
        <>
          {[
            ["Coming up", upcoming],
            ["Past & cancelled", past],
          ].map(
            ([title, items]) =>
              (items as Booking[]).length > 0 && (
                <section className="list-section" key={title as string}>
                  <h2>{title as string}</h2>
                  <div className="booking-list">
                    {(items as Booking[]).map((b) => (
                      <article className="card booking-card" key={b.id}>
                        <div className="date-tile">
                          <span>
                            {new Intl.DateTimeFormat("en-US", {
                              month: "short",
                              timeZone: "America/Denver",
                            }).format(b.starts_at)}
                          </span>
                          <strong>
                            {new Intl.DateTimeFormat("en-US", {
                              day: "numeric",
                              timeZone: "America/Denver",
                            }).format(b.starts_at)}
                          </strong>
                        </div>
                        <div className="booking-description">
                          <div className="title-row">
                            <h3>{b.room_name}</h3>
                            <Badge
                              tone={
                                b.status === "cancelled" ? "neutral" : "sage"
                              }
                            >
                              {b.status === "cancelled"
                                ? "Cancelled"
                                : b.ends_at <= now
                                  ? "Past reservation"
                                  : "Confirmed"}
                            </Badge>
                            {b.demo === 1 && <Badge tone="apricot">Demo</Badge>}
                          </div>
                          <Link href={"/spots/" + b.spot_id}>
                            {b.spot_name}
                          </Link>
                          <p>
                            {timeLabel(b.starts_at)}–{timeLabel(b.ends_at)} ·
                            America/Denver · {b.party_size}{" "}
                            {b.party_size === 1 ? "person" : "people"}
                          </p>
                          <small className="muted">
                            Confirmation {b.id.slice(0, 8).toUpperCase()}
                          </small>
                        </div>
                        {b.status === "confirmed" && b.starts_at > now && (
                          <button
                            className="text-button"
                            onClick={() => setCancel(b)}
                          >
                            Cancel reservation
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ),
          )}
        </>
      )}
      {cancel && (
        <Modal title="Cancel this reservation?" onClose={() => setCancel(null)}>
          <p>
            {cancel.room_name} at {cancel.spot_name},{" "}
            {dateLabel(cancel.starts_at)} at {timeLabel(cancel.starts_at)}.
          </p>
          <p>
            The room will become available to someone else. There’s no
            cancellation fee.
          </p>
          <div className="button-row">
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                if (
                  await mutate(
                    "bookings/" + cancel.id + "/cancel",
                    {},
                    "Reservation cancelled.",
                  )
                )
                  setCancel(null);
              }}
            >
              Cancel reservation
            </button>
            <button
              className="button secondary"
              onClick={() => setCancel(null)}
            >
              Keep my room
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function InfoIcon() {
  return <span className="tiny-spark">i</span>;
}
