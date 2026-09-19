"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Coffee,
  Flag,
  Heart,
  Info,
  MapPin,
  Navigation,
  Pencil,
  ShieldCheck,
  Star,
  ThumbsUp,
  Timer,
  Trash2,
  Users,
  Volume1,
  Wifi,
  Zap,
} from "lucide-react";
import { useApp, useResource } from "./provider";
import {
  Avatar,
  Badge,
  crowdLabels,
  Empty,
  ErrorState,
  Loading,
  Modal,
  noiseLabels,
  ScoreSelect,
} from "./ui";
import { categoryNames } from "./spot-card";
import type { Review, Room, SpotSummary } from "@/lib/types";
import { dateLabel, relativeTime } from "@/lib/time";
import { BookingForm } from "./bookings";
export function SpotDetail({
  id,
  showRooms = false,
}: {
  id: string;
  showRooms?: boolean;
}) {
  const { data: app, mutate, requireAuth, busy } = useApp();
  const { data, error } = useResource<{
    spot: SpotSummary;
    rooms: Room[];
    reviews: Review[];
  }>(`spots/${id}`);
  const [modal, setModal] = useState<
      "review" | "conditions" | "correction" | "flag" | null
    >(null),
    [flagId, setFlagId] = useState(""),
    [notes, setNotes] = useState(""),
    [rating, setRating] = useState(5),
    [noise, setNoise] = useState(2),
    [crowd, setCrowd] = useState(2),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [reason, setReason] = useState(""),
    [deleteReview, setDeleteReview] = useState<string | null>(null);
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;
  const { spot, rooms, reviews } = data;
  const own = reviews.find((r) => r.user_id === app?.user?.id);
  function openReview() {
    if (!requireAuth()) return;
    setNotes(own?.notes || "");
    setRating(own?.rating || 5);
    setNoise(own?.noise || 2);
    setCrowd(own?.crowd || 2);
    setDate(own?.visit_date || new Date().toISOString().slice(0, 10));
    setModal("review");
  }
  return (
    <>
      <Link className="back-link" href="/discover">
        <ArrowLeft size={16} />
        Back to discovering
      </Link>
      <div className="spot-detail-heading">
        <div className="title-row">
          <Badge>{categoryNames[spot.category]}</Badge>
          {spot.demo === 1 && <Badge tone="apricot">Sample spot</Badge>}
        </div>
        <div className="page-title">
          <div>
            <h1>{spot.name}</h1>
            <p className="address-line">
              <MapPin size={16} />
              {spot.address}
            </p>
          </div>
          <button
            className={`button secondary ${spot.saved ? "selected" : ""}`}
            disabled={busy}
            onClick={() => {
              if (requireAuth())
                void mutate(`spots/${id}/save`, { saved: !spot.saved });
            }}
          >
            <Heart size={17} fill={spot.saved ? "currentColor" : "none"} />
            {spot.saved ? "Saved for later" : "Save this spot"}
          </button>
        </div>
      </div>
      <div className="detail-hero-image">
        <img
          src={`/illustrations/${spot.image}.svg`}
          alt={`Illustration of a ${categoryNames[spot.category].toLowerCase()} study setting; not a photograph of the venue.`}
        />
        <span className="image-caption">An illustrated little preview</span>
      </div>
      <div className="detail-layout">
        <div className="detail-main">
          <section className="detail-section">
            <p className="eyebrow">MAKE YOURSELF AT HOME</p>
            <h2>A little room for your next big idea.</h2>
            <p className="description-large">{spot.description}</p>
            <div className="fact-grid">
              <div>
                <Zap />
                <strong>
                  {spot.power === "unknown"
                    ? "Outlets not verified"
                    : spot.power === "none"
                      ? "No known outlets"
                      : spot.power === "many"
                        ? "Plenty of outlets"
                        : "Some outlets"}
                </strong>
                <small>Bring your own charger</small>
              </div>
              <div>
                <Volume1 />
                <strong>
                  {spot.noise
                    ? noiseLabels[spot.noise - 1] + " setting"
                    : "Noise policy unknown"}
                </strong>
                <small>
                  {spot.demo ? "Sample venue setting" : "Venue noise policy"}
                </small>
              </div>
              <div>
                <Coffee />
                <strong>
                  {spot.coffee === "sold_on_site"
                    ? "Coffee for purchase"
                    : spot.coffee === "free_on_site"
                      ? "Coffee included"
                      : spot.coffee === "none"
                        ? "No on-site coffee"
                        : "Coffee not verified"}
                </strong>
                <small>
                  {spot.coffee.includes("on_site")
                    ? "Service hours may vary"
                    : "A separate venue amenity"}
                </small>
              </div>
              <div>
                <Wifi />
                <strong>
                  {spot.wifi === "yes"
                    ? "Wi-Fi available"
                    : spot.wifi === "no"
                      ? "No known Wi-Fi"
                      : "Wi-Fi not verified"}
                </strong>
                <small>Speed is not guaranteed</small>
              </div>
            </div>
          </section>
          <section className="detail-section">
            <div className="section-title">
              <h2>How’s it feeling right now?</h2>
              <button
                className="text-link"
                onClick={() => {
                  if (requireAuth()) setModal("conditions");
                }}
              >
                Share a quick update <ArrowUpRight size={15} />
              </button>
            </div>
            <div className="condition-panel">
              <span className="condition-icon">
                <Users size={25} />
              </span>
              <div>
                <h3>
                  {spot.conditions.state === "recent_reports"
                    ? crowdLabels[spot.conditions.level! - 1]
                    : spot.conditions.state === "conflicting_reports"
                      ? "Recent reports tell different stories"
                      : "A fresh perspective would help."}
                </h3>
                <p>
                  {spot.conditions.state === "recent_reports"
                    ? `${spot.conditions.sampleBucket} recent reports · ${spot.conditions.evidence} evidence · latest ${relativeTime(spot.conditions.asOf!)}.`
                    : "There aren’t enough consistent, recent reports to describe the crowd here."}
                </p>
                <small>
                  Community observations, not a live occupancy count or a
                  guaranteed seat.
                </small>
              </div>
            </div>
          </section>
          <section className="detail-section" id="rooms">
            <div className="section-title">
              <h2>A room for your plans</h2>
              {rooms.length > 0 && (
                <Badge>
                  {rooms.length} {rooms.length === 1 ? "room" : "rooms"}
                </Badge>
              )}
            </div>
            {rooms.length ? (
              <BookingForm
                spot={spot}
                rooms={rooms}
                initiallyExpanded={showRooms}
              />
            ) : spot.booking_url ? (
              <div className="card padded">
                <p>Reservations for this spot are handled by the venue.</p>
                <a
                  href={spot.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button secondary"
                >
                  Reserve on venue website <ArrowUpRight size={17} />
                </a>
                <p className="fine-print">
                  Opening the venue website does not create a DeskHop
                  reservation.
                </p>
              </div>
            ) : (
              <div className="soft-panel">
                <Info size={19} />
                <p>
                  This is a walk-in spot. Find a seat when you arrive; DeskHop
                  doesn’t reserve tables here.
                </p>
              </div>
            )}
          </section>
          <section className="detail-section">
            <div className="section-title">
              <div>
                <h2>A few words from the community</h2>
                <p className="muted small-text">
                  Thoughts on past visits, separate from current conditions.
                </p>
              </div>
              <button className="button secondary small" onClick={openReview}>
                <Pencil size={15} />
                {own ? "Edit your review" : "Leave a review"}
              </button>
            </div>
            {reviews.length ? (
              <div className="review-list">
                {reviews.map((review) => (
                  <article className="review" key={review.id}>
                    <div className="review-header">
                      <Link
                        className="review-author"
                        href={"/u/" + review.handle}
                      >
                        <Avatar name={review.name!} />
                        <span>
                          <strong>{review.name}</strong>
                          <small>
                            Visited {review.visit_date} ·{" "}
                            {relativeTime(review.updated_at)}
                          </small>
                        </span>
                      </Link>
                      <span className="rating">
                        <Star size={15} fill="currentColor" />
                        {review.rating}
                      </span>
                    </div>
                    <p>
                      {review.notes ||
                        "A little feedback, shared through ratings."}
                    </p>
                    <div className="review-meta">
                      <span>
                        {noiseLabels[review.noise - 1]} ·{" "}
                        {crowdLabels[review.crowd - 1]}
                      </span>
                      <div>
                        {review.user_id === app?.user?.id ? (
                          <>
                            <button
                              className="icon-button"
                              aria-label="Edit your review"
                              onClick={openReview}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label="Delete your review"
                              onClick={() => setDeleteReview(review.id)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className={`text-button ${review.liked ? "selected" : ""}`}
                              disabled={busy}
                              aria-pressed={!!review.liked}
                              onClick={() => {
                                if (requireAuth())
                                  void mutate(`reviews/${review.id}`, {
                                    action: review.liked ? "unlike" : "like",
                                  });
                              }}
                            >
                              <ThumbsUp size={14} />
                              Helpful{review.likes ? ` (${review.likes})` : ""}
                            </button>
                            <button
                              className="icon-button"
                              aria-label="Report review"
                              onClick={() => {
                                if (requireAuth()) {
                                  setFlagId(review.id);
                                  setReason("");
                                  setModal("flag");
                                }
                              }}
                            >
                              <Flag size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                icon={<Pencil size={25} />}
                title="Be the first to leave a little insight"
              >
                A thoughtful review helps someone else find their kind of place.
              </Empty>
            )}
          </section>
        </div>
        <aside className="detail-sidebar">
          <div className="card padded sticky-card">
            <h3>Your next study session</h3>
            <p className="muted">
              Found your place? Make a little time for what matters.
            </p>
            <Link className="button full" href={"/study?spot=" + id}>
              <Timer size={17} />
              Start studying
            </Link>
            {rooms.length > 0 && (
              <a className="button secondary full" href="#rooms">
                <CalendarDays size={17} />
                Reserve a room
              </a>
            )}
            {!spot.demo && (
              <a
                className="button secondary full"
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(spot.address)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Navigation size={17} />
                Get directions
              </a>
            )}
            {spot.demo === 1 && (
              <p className="fine-print">
                This spot is fictional. Sample map pins aren’t directions to a
                real venue.
              </p>
            )}
            <div className="sidebar-divider" />
            <div className="info-block">
              <h4>
                <CalendarDays size={16} />
                Opening hours
              </h4>
              <p className="small-text">
                Times in {spot.timezone.replace("_", " ")}.
              </p>
              {Object.keys(JSON.parse(spot.hours)).length ? (
                <div className="hours-list">
                  {[
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ].map((day, i) => {
                    const periods = (
                      JSON.parse(spot.hours) as Record<string, number[][]>
                    )[i];
                    return (
                      <div key={day}>
                        <span>{day}</span>
                        <span>
                          {periods?.length
                            ? periods
                                .map(
                                  ([a, b]) =>
                                    `${minuteTime(a)}–${minuteTime(b)}`,
                                )
                                .join(", ")
                            : "Closed"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p>Hours not verified.</p>
              )}
            </div>
            <div className="info-block">
              <h4>
                <ShieldCheck size={16} />
                Before you settle in
              </h4>
              <p>{spot.access_note}</p>
              <p>
                <strong>Accessibility:</strong> {spot.accessibility}
              </p>
              {spot.group_size && (
                <p>
                  Tables for up to {spot.group_size}; adjacent seat availability
                  is unknown.
                </p>
              )}
            </div>
            <div className="info-block">
              <h4>Where our info comes from</h4>
              <p>{spot.source}</p>
              <small>
                {spot.verified_at
                  ? `Last checked ${dateLabel(spot.verified_at)}`
                  : "Not independently verified"}
              </small>
              {spot.website && (
                <a
                  className="text-link"
                  href={spot.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Official website <ArrowUpRight size={14} />
                </a>
              )}
            </div>
            <button
              className="text-link"
              onClick={() => {
                if (requireAuth()) {
                  setReason("");
                  setModal("correction");
                }
              }}
            >
              Suggest a correction <Pencil size={14} />
            </button>
          </div>
        </aside>
      </div>
      {modal && (
        <Modal
          title={
            modal === "review"
              ? "A little insight goes a long way"
              : modal === "conditions"
                ? "How does it feel right now?"
                : modal === "correction"
                  ? "Help us get it right"
                  : "Report this review"
          }
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const path =
                modal === "review"
                  ? `spots/${id}/reviews`
                  : modal === "conditions"
                    ? `spots/${id}/conditions`
                    : modal === "correction"
                      ? `spots/${id}/corrections`
                      : `reviews/${flagId}`;
              const payload =
                modal === "review"
                  ? { rating, noise, crowd, notes, visit_date: date }
                  : modal === "conditions"
                    ? { crowd, noise }
                    : modal === "correction"
                      ? { reason }
                      : { action: "flag", reason };
              const result = await mutate(
                path,
                payload,
                modal === "review"
                  ? "Your review is saved. Thanks for sharing."
                  : modal === "conditions"
                    ? "Thanks for a fresh perspective."
                    : "Your report is in the moderation queue.",
              );
              if (result) setModal(null);
            }}
          >
            {modal === "review" || modal === "conditions" ? (
              <>
                {modal === "review" ? (
                  <>
                    <p className="muted">
                      Your review and display name will be public. Don’t include
                      personal details about others.
                    </p>
                    <ScoreSelect
                      label="Overall, how was the fit?"
                      value={rating}
                      onChange={setRating}
                      kind="rating"
                    />
                    <label className="field">
                      Date of your visit
                      <input
                        type="date"
                        value={date}
                        max={new Date().toISOString().slice(0, 10)}
                        required
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </label>
                  </>
                ) : (
                  <p className="muted">
                    Share only what you’re observing here now. Reports expire
                    after 45 minutes; your identity won’t appear in the crowd
                    summary.
                  </p>
                )}
                <div className="form-grid">
                  <ScoreSelect
                    label="Noise"
                    value={noise}
                    onChange={setNoise}
                  />
                  <ScoreSelect
                    label="Seats"
                    value={crowd}
                    onChange={setCrowd}
                    kind="crowd"
                  />
                </div>
                {modal === "review" && (
                  <label className="field">
                    Anything worth sharing?
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={2000}
                      rows={4}
                      placeholder="What made this spot work for you?"
                    />
                  </label>
                )}
              </>
            ) : (
              <label className="field">
                What should we look into?
                <textarea
                  required
                  minLength={5}
                  maxLength={1000}
                  rows={5}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
            <button className="button full" disabled={busy}>
              {busy
                ? "Saving…"
                : modal === "review"
                  ? "Publish review"
                  : modal === "conditions"
                    ? "Share current conditions"
                    : "Send for review"}
            </button>
          </form>
        </Modal>
      )}
      {deleteReview && (
        <Modal
          title="Delete your review?"
          onClose={() => setDeleteReview(null)}
        >
          <p>
            Your review will be removed from this spot and from the public feed.
          </p>
          <div className="button-row">
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                if (
                  await mutate(
                    "reviews/" + deleteReview,
                    { action: "delete" },
                    "Review deleted.",
                  )
                )
                  setDeleteReview(null);
              }}
            >
              Delete review
            </button>
            <button
              className="button secondary"
              onClick={() => setDeleteReview(null)}
            >
              Keep review
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function minuteTime(minutes: number) {
  const hour = Math.floor(minutes / 60) % 24;
  return `${hour % 12 || 12}${minutes % 60 ? ":" + String(minutes % 60).padStart(2, "0") : ""}${hour < 12 ? "am" : "pm"}`;
}
