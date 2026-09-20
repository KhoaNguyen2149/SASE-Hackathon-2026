"use client";
import { useState } from "react";
import { Plus, Save, Shield, X } from "lucide-react";
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
import type { Room, Spot } from "@/lib/types";
type AdminData = {
  spots: Spot[];
  rooms: Room[];
  flags: {
    id: string;
    review_id: string | null;
    reason: string;
    review_notes: string | null;
    spot_name: string | null;
    created_at: number;
  }[];
  closures: { spot_id: string; local_date: string; reason: string }[];
  stats: { users: number; bookings: number };
  audit: {
    action: string;
    entity_id: string;
    reason: string;
    created_at: number;
  }[];
};
const newSpot: Spot = {
  id: "",
  mapped: 0,
  name: "",
  category: "library",
  description: "",
  address: "",
  lat: 39.7525,
  lng: -105.2225,
  timezone: "America/Denver",
  power: "unknown",
  wifi: "unknown",
  coffee: "unknown",
  noise: 3,
  access: "unknown",
  access_note: "Access has not been verified.",
  hours: "{}",
  website: "",
  accessibility: "Not yet verified",
  image: "library",
  demo: 1,
  published: 1,
  verified_at: null,
  source: "",
  group_size: null,
  booking_url: "",
};
export function Admin() {
  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRATION"
        title="Venue & community administration."
        description="Keep facts current, inventory authorized, and the community welcoming."
      />
      <AuthGate>
        <AdminContent />
      </AuthGate>
    </>
  );
}
function AdminContent() {
  const { data: app, mutate, busy } = useApp();
  const { data, error } = useResource<AdminData>(
    app?.user?.role === "admin" ? "admin" : null,
  );
  const [tab, setTab] = useState("spots"),
    [edit, setEdit] = useState<Spot | null>(null),
    [review, setReview] = useState<AdminData["flags"][number] | null>(null),
    [reason, setReason] = useState(""),
    [room, setRoom] = useState<(Room & { authorization?: string }) | null>(
      null,
    ),
    [closure, setClosure] = useState(false);
  if (app?.user?.role !== "admin")
    return (
      <Empty icon={<Shield />} title="Admins only">
        This page is reserved for authorized DeskHop administrators.
      </Empty>
    );
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;
  function field<K extends keyof Spot>(key: K, value: Spot[K]) {
    setEdit((e) => (e ? { ...e, [key]: value } : e));
  }
  return (
    <>
      <div className="admin-stats">
        <div className="card">
          <strong>{data.spots.length}</strong>
          <span>Catalog spots</span>
        </div>
        <div className="card">
          <strong>{data.stats.users}</strong>
          <span>Accounts</span>
        </div>
        <div className="card">
          <strong>{data.stats.bookings}</strong>
          <span>Upcoming reservations</span>
        </div>
      </div>
      <div className="admin-tabs">
        {["spots", "rooms", "moderation", "closures", "audit"].map((t) => (
          <button
            key={t}
            className={"button small " + (tab === t ? "" : "secondary")}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
            {t === "moderation" ? ` (${data.flags.length})` : ""}
          </button>
        ))}
      </div>
      {tab === "spots" &&
        (edit ? (
          <form
            className="card padded admin-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await mutate("admin/spots", edit, "Venue saved."))
                setEdit(null);
            }}
          >
            <div className="section-title">
              <h2>{edit.id ? "Edit spot" : "Add a verified spot"}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Close editor"
                onClick={() => setEdit(null)}
              >
                <X />
              </button>
            </div>
            <div className="form-grid">
              <label className="field">
                Stable ID
                <input
                  required
                  pattern="[a-z0-9-]{3,80}"
                  value={edit.id}
                  onChange={(e) => field("id", e.target.value)}
                  readOnly={data.spots.some((s) => s.id === edit.id)}
                />
              </label>
              <label className="field">
                Venue name
                <input
                  required
                  value={edit.name}
                  onChange={(e) => field("name", e.target.value)}
                />
              </label>
              <label className="field">
                Category
                <select
                  value={edit.category}
                  onChange={(e) => field("category", e.target.value)}
                >
                  {[
                    "library",
                    "cafe",
                    "campus_space",
                    "coworking",
                    "outdoor",
                    "other",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Illustration
                <select
                  value={edit.image}
                  onChange={(e) => field("image", e.target.value)}
                >
                  {[
                    "library",
                    "cafe",
                    "study",
                    "outdoor",
                    "bookshop",
                    "studio",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              Description
              <textarea
                required
                minLength={10}
                rows={3}
                value={edit.description}
                onChange={(e) => field("description", e.target.value)}
              />
            </label>
            <label className="field">
              Address
              <input
                required
                value={edit.address}
                onChange={(e) => field("address", e.target.value)}
              />
            </label>
            <div className="form-grid">
              <label className="field">
                Latitude
                <input
                  type="number"
                  required
                  step="any"
                  min={-90}
                  max={90}
                  value={edit.lat}
                  onChange={(e) => field("lat", Number(e.target.value))}
                />
              </label>
              <label className="field">
                Longitude
                <input
                  type="number"
                  required
                  step="any"
                  min={-180}
                  max={180}
                  value={edit.lng}
                  onChange={(e) => field("lng", Number(e.target.value))}
                />
              </label>
              <label className="field">
                Timezone
                <input
                  required
                  value={edit.timezone}
                  onChange={(e) => field("timezone", e.target.value)}
                />
              </label>
              <label className="field">
                Group-table size (unknown if blank)
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={edit.group_size || ""}
                  onChange={(e) =>
                    field(
                      "group_size",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                />
              </label>
              {(
                [
                  ["power", ["none", "some", "many", "unknown"]],
                  ["wifi", ["yes", "no", "unknown"]],
                  [
                    "coffee",
                    ["sold_on_site", "free_on_site", "none", "unknown"],
                  ],
                  [
                    "access",
                    [
                      "public",
                      "campus_only",
                      "membership",
                      "purchase_expected",
                      "unknown",
                    ],
                  ],
                ] as const
              ).map(([key, values]) => (
                <label className="field" key={key}>
                  {key}
                  <select
                    value={edit[key]}
                    onChange={(e) => field(key, e.target.value)}
                  >
                    {values.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="field">
                Noise policy (0 unknown, 1 silent, 5 loud)
                <input
                  type="number"
                  min={0}
                  max={5}
                  required
                  value={edit.noise}
                  onChange={(e) => field("noise", Number(e.target.value))}
                />
              </label>
              <label className="field">
                Last verified (required for real venues)
                <input
                  type="date"
                  value={
                    edit.verified_at
                      ? new Date(edit.verified_at).toISOString().slice(0, 10)
                      : ""
                  }
                  onChange={(e) =>
                    field(
                      "verified_at",
                      e.target.value
                        ? Date.parse(e.target.value + "T12:00:00Z")
                        : null,
                    )
                  }
                />
              </label>
            </div>
            <label className="field">
              Access explanation
              <input
                value={edit.access_note}
                onChange={(e) => field("access_note", e.target.value)}
              />
            </label>
            <label className="field">
              Verified accessibility attributes
              <input
                value={edit.accessibility}
                onChange={(e) => field("accessibility", e.target.value)}
              />
            </label>
            <label className="field">
              Hours JSON (day 0 Sunday → 6 Saturday, minutes after midnight)
              <textarea
                className="code"
                rows={4}
                value={edit.hours}
                onChange={(e) => field("hours", e.target.value)}
              />
              <small>
                Example: {'{"1":[[480,1260]],"2":[[480,1260]]}'}. Unknown:{" "}
                {"{}"}. Closed day: an empty array. Overnight: start &gt; end.
              </small>
            </label>
            <div className="form-grid">
              <label className="field">
                Official website (HTTPS)
                <input
                  type="url"
                  value={edit.website}
                  onChange={(e) => field("website", e.target.value)}
                />
              </label>
              <label className="field">
                Official external booking URL
                <input
                  type="url"
                  value={edit.booking_url}
                  onChange={(e) => field("booking_url", e.target.value)}
                />
              </label>
            </div>
            <label className="field">
              Fact sources and verification notes
              <textarea
                minLength={5}
                required
                value={edit.source}
                onChange={(e) => field("source", e.target.value)}
              />
            </label>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={!!edit.mapped}
                onChange={(e) => field("mapped", Number(e.target.checked))}
              />
              Coordinates verified; allow map pin and distance
            </label>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={!!edit.demo}
                onChange={(e) => field("demo", Number(e.target.checked))}
              />
              Fictional demo venue
            </label>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={!!edit.published}
                onChange={(e) => field("published", Number(e.target.checked))}
              />
              Published in discovery
            </label>
            <button className="button" disabled={busy}>
              <Save size={17} />
              Save spot
            </button>
          </form>
        ) : (
          <>
            <button className="button" onClick={() => setEdit({ ...newSpot })}>
              <Plus size={17} />
              Add spot
            </button>
            <div className="admin-list" style={{ marginTop: 20 }}>
              {data.spots.map((s) => (
                <div className="card admin-row" key={s.id}>
                  <div>
                    <h3>{s.name}</h3>
                    <p>
                      {s.address} · {s.published ? "Published" : "Hidden"}
                    </p>
                  </div>
                  <Badge tone={s.demo ? "apricot" : "sage"}>
                    {s.demo ? "Demo" : "Verified catalog"}
                  </Badge>
                  <button
                    className="button secondary small"
                    onClick={() => setEdit({ ...s })}
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </>
        ))}
      {tab === "rooms" && (
        <>
          <button
            className="button"
            onClick={() =>
              setRoom({
                id: "",
                spot_id: data.spots[0]?.id || "",
                name: "",
                capacity: 4,
                demo: 1,
                enabled: 1,
                policy_version: 1,
              })
            }
          >
            <Plus size={17} />
            Add room
          </button>
          <p className="fine-print">
            Only publish real inventory if you have explicit authority to manage
            its reservations. Changes do not rewrite existing confirmed
            bookings.
          </p>
          <div className="admin-list">
            {data.rooms.map((r) => (
              <div className="card admin-row" key={r.id}>
                <div>
                  <h3>{r.name}</h3>
                  <p>
                    {data.spots.find((s) => s.id === r.spot_id)?.name} ·{" "}
                    {r.capacity} people · {r.enabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <Badge tone={r.demo ? "apricot" : "sage"}>
                  {r.demo ? "Demo" : "Authorized inventory"}
                </Badge>
                <button
                  className="button secondary small"
                  onClick={() => setRoom({ ...r })}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "moderation" &&
        (data.flags.length ? (
          <div className="admin-list">
            {data.flags.map((f) => (
              <div className="card admin-row" key={f.id}>
                <div>
                  <h3>
                    {f.review_id
                      ? "Review report"
                      : `Correction: ${f.spot_name}`}
                  </h3>
                  <p>{f.reason}</p>
                  {f.review_notes && <p>Review: {f.review_notes}</p>}
                </div>
                <button
                  className="button secondary small"
                  onClick={() => {
                    setReview(f);
                    setReason("");
                  }}
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="All caught up">The moderation queue is clear.</Empty>
        ))}
      {tab === "closures" && (
        <>
          <button className="button" onClick={() => setClosure(true)}>
            Add closure or holiday
          </button>
          <p className="fine-print">
            Closures prevent new bookings. Contact holders of existing bookings
            separately; this form never silently cancels their reservations.
          </p>
          <div className="admin-list">
            {data.closures.map((c) => (
              <div className="card admin-row" key={c.spot_id + c.local_date}>
                <div>
                  <h3>
                    {data.spots.find((s) => s.id === c.spot_id)?.name} ·{" "}
                    {c.local_date}
                  </h3>
                  <p>{c.reason}</p>
                </div>
                <button
                  className="button secondary small"
                  disabled={busy}
                  onClick={() =>
                    void mutate(
                      "admin/closures",
                      { ...c, remove: true },
                      "Closure removed.",
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "audit" && (
        <div className="card padded">
          <h2>Recent administration actions</h2>
          {data.audit.map((a, i) => (
            <div className="audit-row" key={i}>
              <strong>
                {a.action} · {a.entity_id}
              </strong>
              <p>{a.reason}</p>
              <small>{new Date(a.created_at).toLocaleString()}</small>
            </div>
          ))}
        </div>
      )}
      {room && (
        <Modal title="Manage room inventory" onClose={() => setRoom(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate(
                  "admin/rooms",
                  { ...room, demo: !!room.demo, enabled: !!room.enabled },
                  "Room saved.",
                )
              )
                setRoom(null);
            }}
          >
            <label className="field">
              Stable room ID
              <input
                required
                value={room.id}
                onChange={(e) => setRoom({ ...room, id: e.target.value })}
                readOnly={data.rooms.some((r) => r.id === room.id)}
              />
            </label>
            <label className="field">
              Venue
              <select
                value={room.spot_id}
                onChange={(e) => setRoom({ ...room, spot_id: e.target.value })}
              >
                {data.spots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Room name
              <input
                required
                value={room.name}
                onChange={(e) => setRoom({ ...room, name: e.target.value })}
              />
            </label>
            <label className="field">
              Capacity
              <input
                type="number"
                min={1}
                max={100}
                required
                value={room.capacity}
                onChange={(e) =>
                  setRoom({ ...room, capacity: Number(e.target.value) })
                }
              />
            </label>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={!!room.demo}
                onChange={(e) =>
                  setRoom({ ...room, demo: Number(e.target.checked) })
                }
              />
              Demo inventory
            </label>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={!!room.enabled}
                onChange={(e) =>
                  setRoom({ ...room, enabled: Number(e.target.checked) })
                }
              />
              Accept new bookings
            </label>
            <label className="field">
              Authorization evidence / change reason
              <textarea
                required
                minLength={10}
                value={room.authorization || ""}
                onChange={(e) =>
                  setRoom({ ...room, authorization: e.target.value })
                }
              />
            </label>
            <button className="button full" disabled={busy}>
              Save room
            </button>
          </form>
        </Modal>
      )}
      {review && (
        <Modal title="Resolve community report" onClose={() => setReview(null)}>
          <p>{review.reason}</p>
          <label className="field">
            Decision reason
            <textarea
              minLength={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="button-row">
            <button
              className="button secondary"
              disabled={busy || reason.trim().length < 5}
              onClick={async () => {
                if (
                  await mutate(
                    "admin/moderate",
                    { flag_id: review.id, action: "dismiss", reason },
                    "Report resolved.",
                  )
                )
                  setReview(null);
              }}
            >
              Resolve / dismiss
            </button>
            {review.review_id && (
              <button
                className="button danger"
                disabled={busy || reason.trim().length < 5}
                onClick={async () => {
                  if (
                    await mutate(
                      "admin/moderate",
                      { flag_id: review.id, action: "hide", reason },
                      "Review hidden and decision recorded.",
                    )
                  )
                    setReview(null);
                }}
              >
                Hide review
              </button>
            )}
          </div>
        </Modal>
      )}
      {closure && (
        <Modal
          title="Add a date-specific closure"
          onClose={() => setClosure(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = Object.fromEntries(new FormData(e.currentTarget));
              if (await mutate("admin/closures", f, "Closure saved."))
                setClosure(false);
            }}
          >
            <label className="field">
              Venue
              <select name="spot_id">
                {data.spots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Local date
              <input type="date" required name="local_date" />
            </label>
            <label className="field">
              Reason
              <input required minLength={3} name="reason" />
            </label>
            <button className="button full" disabled={busy}>
              Save closure
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
