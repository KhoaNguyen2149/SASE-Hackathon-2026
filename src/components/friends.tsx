"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronRight,
  MapPin,
  Plus,
  Send,
  Shield,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useApp, useResource } from "./provider";
import {
  AuthGate,
  Avatar,
  Badge,
  Empty,
  ErrorState,
  Loading,
  Modal,
  PageTitle,
} from "./ui";
import type { AvailabilityMode, Friend } from "@/lib/types";
import { timeLabel } from "@/lib/time";
type FriendData = {
  friends: Friend[];
  requests: Friend[];
  blocked: { id: string; name: string; handle: string }[];
  incoming: {
    id: string;
    name: string;
    spot_name: string;
    eta_at: number | null;
    expires_at: number;
  }[];
};
export function Friends() {
  return (
    <>
      <PageTitle
        eyebrow="BETTER, TOGETHER"
        title="A familiar face makes a good day."
        description="A little company when you want it. Your own space when you don’t."
      />
      <AuthGate>
        <FriendContent />
      </AuthGate>
    </>
  );
}
function FriendContent() {
  const { data: app, now, mutate, busy } = useApp();
  const { data, error } = useResource<FriendData>("friends");
  const [add, setAdd] = useState(false),
    [handle, setHandle] = useState(""),
    [status, setStatus] = useState(false),
    [mode, setMode] = useState<AvailabilityMode>("available"),
    [minutes, setMinutes] = useState(60),
    [tab, setTab] = useState("all"),
    [hop, setHop] = useState<Friend | null>(null),
    [eta, setEta] = useState<10 | 20 | 30 | null>(null),
    [manage, setManage] = useState<Friend | null>(null);
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;
  const visible = data.friends
    .map((f) =>
      f.expires_at && f.expires_at <= now
        ? {
            ...f,
            status: "No shared status",
            can_hop: false,
            spot_name: undefined,
            spot_id: undefined,
          }
        : f,
    )
    .filter((f) => tab !== "available" || f.status === "Available now");
  const ownMode =
    app?.availability?.expires_at && app.availability.expires_at > now
      ? app.availability.mode
      : null;
  const label =
    ownMode === "available"
      ? "Available now"
      : ownMode === "open_to_join"
        ? "Open to company"
        : ownMode === "busy"
          ? "Busy"
          : ownMode === "dnd"
            ? "Do not disturb"
            : "Not sharing availability";
  const incoming = data.requests.filter((r) => r.sender_id !== app?.user?.id),
    outgoing = data.requests.filter((r) => r.sender_id === app?.user?.id);
  return (
    <>
      <div className="availability-card">
        <Avatar name={app!.user!.name} />
        <div>
          <span className="eyebrow">YOUR LITTLE SIGNAL</span>
          <h3>{label}</h3>
          <p>
            {ownMode
              ? `You chose this status · until ${timeLabel(app!.availability!.expires_at!)}`
              : "Share when you’re open to an invitation. No guessing, no online indicators."}
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => {
            setMode(ownMode || "available");
            setStatus(true);
          }}
        >
          Set availability
        </button>
      </div>
      {data.incoming
        .filter((h) => h.expires_at > now)
        .map((h) => (
          <div className="active-strip travel" key={h.id}>
            <span className="strip-icon">
              <MapPin />
            </span>
            <div>
              <strong>
                {h.name} is hopping over to {h.spot_name}
              </strong>
              <small>
                {h.eta_at
                  ? h.eta_at < now
                    ? "Their arrival estimate has passed"
                    : `Their estimate: about ${timeLabel(h.eta_at)}`
                  : "No arrival estimate shared"}
                . An arrival update, not a reserved seat.
              </small>
            </div>
          </div>
        ))}
      {incoming.length > 0 && (
        <section className="list-section">
          <h2>
            A little hello{" "}
            <span className="count-badge">{incoming.length}</span>
          </h2>
          {incoming.map((r) => (
            <div className="request-row card" key={r.id}>
              <Avatar name={r.name} />
              <div>
                <Link href={"/u/" + r.handle}>
                  <strong>{r.name}</strong>
                </Link>
                <p>@{r.handle} would like to be friends</p>
              </div>
              <button
                className="button small"
                disabled={busy}
                onClick={() =>
                  void mutate(
                    "friends",
                    { action: "accept", target: r.id },
                    "A new friend, a little closer.",
                  )
                }
              >
                <Check size={16} />
                Accept
              </button>
              <button
                className="icon-button"
                disabled={busy}
                aria-label={`Decline ${r.name}'s request`}
                onClick={() =>
                  void mutate("friends", { action: "remove", target: r.id })
                }
              >
                <X size={17} />
              </button>
            </div>
          ))}
        </section>
      )}
      <div className="results-heading">
        <div className="segmented">
          <button
            className={tab === "all" ? "active" : ""}
            onClick={() => setTab("all")}
          >
            All friends <span>{data.friends.length}</span>
          </button>
          <button
            className={tab === "available" ? "active" : ""}
            onClick={() => setTab("available")}
          >
            Available now
          </button>
        </div>
        <button className="button" onClick={() => setAdd(true)}>
          <UserPlus size={17} />
          Add a friend
        </button>
      </div>
      {visible.length ? (
        <div className="friends-grid">
          {visible.map((f) => (
            <article className="friend-card card" key={f.id}>
              <div className="friend-top">
                <Link href={"/u/" + f.handle} className="friend-identity">
                  <Avatar name={f.name} />
                  <div>
                    <h3>{f.name}</h3>
                    <small>@{f.handle}</small>
                  </div>
                </Link>
                <button
                  className="icon-button"
                  aria-label={`Manage friendship with ${f.name}`}
                  onClick={() => setManage(f)}
                >
                  •••
                </button>
              </div>
              <Badge
                tone={
                  f.status === "Available now" || f.status === "Open to company"
                    ? "sage"
                    : "neutral"
                }
              >
                <span className="status-dot" />
                {f.status}
              </Badge>
              {f.expires_at && (
                <p className="small-text muted">
                  Shared until {timeLabel(f.expires_at)}
                </p>
              )}
              {f.spot_name && (
                <Link className="friend-spot" href={"/spots/" + f.spot_id}>
                  <MapPin size={16} />
                  {f.spot_name}
                  <ChevronRight size={16} />
                </Link>
              )}
              {f.can_hop ? (
                <button
                  className="button secondary full"
                  onClick={() => {
                    setEta(null);
                    setHop(f);
                  }}
                >
                  Hop over <ArrowRight size={16} />
                </button>
              ) : (
                <p className="friend-footnote">
                  {f.status === "Available now"
                    ? "They’re open to an invitation, without a shared destination."
                    : f.status === "No shared status"
                      ? "Their time, their choice."
                      : "A little space to do their thing."}
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={<Users size={28} />}
          title={
            tab === "available"
              ? "No shared availability right now"
              : "Your study circle starts with a hello"
          }
          action={
            tab === "all" ? (
              <button className="button" onClick={() => setAdd(true)}>
                <Plus size={17} />
                Find a friend
              </button>
            ) : undefined
          }
        >
          {tab === "available"
            ? "Availability is something friends choose to share. We never guess from their activity."
            : "Add a friend by their exact handle. Once they accept, you’ll see only what they choose to share."}
        </Empty>
      )}
      {outgoing.length > 0 && (
        <section className="list-section">
          <h3>Your hellos, on their way</h3>
          {outgoing.map((r) => (
            <div className="request-row" key={r.id}>
              <Avatar name={r.name} />
              <div>
                <strong>{r.name}</strong>
                <p>Friend request pending</p>
              </div>
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void mutate(
                    "friends",
                    { action: "remove", target: r.id },
                    "Request withdrawn.",
                  )
                }
              >
                Withdraw request
              </button>
            </div>
          ))}
        </section>
      )}
      {data.blocked.length > 0 && (
        <details className="blocked-list">
          <summary>Blocked accounts ({data.blocked.length})</summary>
          {data.blocked.map((u) => (
            <div className="request-row" key={u.id}>
              <span>@{u.handle}</span>
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void mutate(
                    "friends",
                    { action: "unblock", target: u.id },
                    "Account unblocked. Friendship was not restored.",
                  )
                }
              >
                Unblock
              </button>
            </div>
          ))}
        </details>
      )}
      <div className="privacy-note">
        <Shield size={19} />
        <p>
          Friendship is mutual. Following a reviewer never grants access to
          their study sessions or location. You’re always in control.
        </p>
      </div>
      {add && (
        <Modal title="Say a little hello" onClose={() => setAdd(false)}>
          <p className="muted">
            Find a friend with their exact DeskHop handle. Yours is{" "}
            <strong>@{app?.user?.handle}</strong>.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate(
                  "friends",
                  {
                    action: "request",
                    target: handle.replace(/^@/, "").trim().toLowerCase(),
                  },
                  "Your friend request is saved. If they already sent one, accept it below.",
                )
              ) {
                setAdd(false);
                setHandle("");
              }
            }}
          >
            <label className="field">
              Their handle
              <input
                autoComplete="off"
                placeholder="e.g. alex_studies"
                required
                pattern="@?[A-Za-z0-9_]{3,24}"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
            </label>
            <button className="button full" disabled={busy}>
              <Send size={17} />
              Send friend request
            </button>
          </form>
        </Modal>
      )}
      {status && (
        <Modal
          title="What’s your little signal?"
          onClose={() => setStatus(false)}
        >
          <p className="muted">
            Only accepted friends see this. It expires automatically.
          </p>
          <label className="field">
            My availability
            <select
              value={mode || ""}
              onChange={(e) =>
                setMode((e.target.value || null) as AvailabilityMode)
              }
            >
              <option value="available">
                Available now · open to an invitation
              </option>
              <option value="open_to_join">Studying and open to company</option>
              <option value="busy">Busy · a little occupied</option>
              <option value="dnd">Do not disturb · quiet time</option>
              <option value="">Not sharing availability</option>
            </select>
          </label>
          {mode && (
            <label className="field">
              For how long?
              <select
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              >
                {(mode === "busy" || mode === "dnd"
                  ? [30, 60, 120, 240, 480]
                  : [30, 60, 120]
                ).map((n) => (
                  <option key={n} value={n}>
                    {n < 60
                      ? `${n} minutes`
                      : `${n / 60} ${n === 60 ? "hour" : "hours"}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === "open_to_join" && (
            <div className="notice-banner">
              You need a running session that shares your spot. Friends can then
              tell you they’re coming.
            </div>
          )}
          {mode === null && (
            <p className="fine-print">
              This clears availability only. Your session’s privacy setting
              still controls your shared study activity.
            </p>
          )}
          <button
            className="button full"
            disabled={busy}
            onClick={async () => {
              if (
                await mutate(
                  "availability",
                  { mode, minutes, revision: app?.availability?.revision || 0 },
                  "Your availability is updated.",
                )
              )
                setStatus(false);
            }}
          >
            Save my availability
          </button>
        </Modal>
      )}
      {hop && (
        <Modal
          title={`A little company for ${hop.name}`}
          onClose={() => setHop(null)}
        >
          <Badge tone="sage">They’re open to company</Badge>
          <h3>{hop.spot_name}</h3>
          <p>
            Only <strong>{hop.name}</strong> will see this arrival update.
            Sending it doesn’t reserve a seat or start a study session.
          </p>
          <label className="field">
            Your arrival estimate
            <select
              value={eta || ""}
              onChange={(e) =>
                setEta(
                  e.target.value
                    ? (Number(e.target.value) as 10 | 20 | 30)
                    : null,
                )
              }
            >
              <option value="">No estimate</option>
              {[10, 20, 30].map((n) => (
                <option key={n} value={n}>
                  About {n} minutes
                </option>
              ))}
            </select>
          </label>
          <p className="fine-print">
            This is your own estimate. DeskHop doesn’t track your route or
            automatically mark you as arrived.
          </p>
          <button
            className="button full"
            disabled={busy}
            onClick={async () => {
              if (
                await mutate(
                  "hops",
                  {
                    target_user_id: hop.id,
                    target_session_id: hop.session_id,
                    eta_minutes: eta,
                  },
                  "Your hop is saved. You can mark arrival or cancel any time.",
                )
              )
                setHop(null);
            }}
          >
            Tell {hop.name.split(" ")[0]} I’m on my way <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {manage && (
        <Modal
          title={`Your friendship with ${manage.name}`}
          onClose={() => setManage(null)}
        >
          <p>
            Removing a friend ends access to each other’s private activity.
            Blocking also prevents new interactions between your accounts.
          </p>
          <div className="stack-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                if (
                  await mutate(
                    "friends",
                    { action: "remove", target: manage.id },
                    "Friend removed.",
                  )
                )
                  setManage(null);
              }}
            >
              Remove friend
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                if (
                  await mutate(
                    "friends",
                    { action: "block", target: manage.id },
                    "Account blocked.",
                  )
                )
                  setManage(null);
              }}
            >
              Block account
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
