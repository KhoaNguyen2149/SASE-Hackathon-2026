"use client";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Coffee,
  Leaf,
  LockKeyhole,
  Pause,
  Play,
  Plus,
  Users,
  X,
} from "lucide-react";
import { useApp, useResource } from "./provider";
import { AuthGate, Modal, PageTitle } from "./ui";
import type { DirectorySpot, StudySession, Visibility } from "@/lib/types";
import { dateLabel, elapsed } from "@/lib/time";
export function Study() {
  return (
    <>
      <PageTitle
        eyebrow="ONE THING AT A TIME"
        title="Start a study timer."
        description="Pick a spot, choose how long you want to go, and start the clock."
      />
      <AuthGate>
        <StudyContent />
      </AuthGate>
    </>
  );
}
function StudyContent() {
  const { data: app, now, mutate, busy } = useApp();
  const params = useSearchParams();
  const { data: catalog } = useResource<{ spots: DirectorySpot[] }>("spots");
  const { data: history } = useResource<{ sessions: StudySession[] }>(
    "study/history",
  );
  const [spot, setSpot] = useState(params.get("spot") || ""),
    [minutes, setMinutes] = useState(25),
    [spotQuery, setSpotQuery] = useState(""),
    [visibility, setVisibility] = useState<Visibility>("private"),
    [shareCompletion, setShareCompletion] = useState(false),
    [confirmCancel, setConfirmCancel] = useState(false),
    [completed, setCompleted] = useState<StudySession | null>(null);
  const choices = useMemo(() => {
    const all = catalog?.spots || [];
    const matches = all
      .filter((p) =>
        `${p.name} ${p.address}`
          .toLowerCase()
          .includes(spotQuery.toLowerCase()),
      )
      .slice(0, 60);
    const selected = all.find((p) => p.id === spot);
    return selected && !matches.some((p) => p.id === spot)
      ? [selected, ...matches]
      : matches;
  }, [catalog, spotQuery, spot]);
  const s = app?.session;
  const focused = s ? elapsed(s, now) : 0;
  const remaining = s ? Math.max(0, s.target_seconds - focused) : minutes * 60;
  const percentage = s ? focused / s.target_seconds : 0;
  const atTarget =
    s && (remaining === 0 || s.state === "awaiting_confirmation");
  const completedSessions =
    history?.sessions.filter((x) => x.state === "completed") || [];
  const total = completedSessions.reduce((sum, s) => sum + s.focus_seconds, 0);
  async function action(action: string, extra: Record<string, unknown> = {}) {
    if (!s) return;
    const result = await mutate<StudySession>("study/" + s.id, {
      action,
      revision: s.revision,
      ...extra,
    });
    if (result && action === "finish") setCompleted(result);
  }
  return (
    <div className="study-layout">
      <section className="card focus-card">
        <div className="focus-heading">
          <span className="leaf-mark">
            <Leaf size={21} />
          </span>
          <span className="eyebrow">
            {s ? "SESSION IN PROGRESS" : "NOTHING RUNNING YET"}
          </span>
        </div>
        {s ? (
          <>
            <h2>
              {atTarget
                ? "Goal reached."
                : s.state === "paused"
                  ? "Paused."
                  : "Timer’s running."}
            </h2>
            <p className="muted">
              {s.spot_name || "No spot selected"}
              {s.state === "paused" ? " · On a break" : ""}
            </p>
            <div
              className="timer-ring"
              style={
                {
                  "--progress": `${percentage * 360}deg`,
                } as React.CSSProperties
              }
            >
              <div>
                <span
                  className="timer-digits"
                  aria-label={`${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds remaining`}
                >
                  {String(Math.floor(remaining / 60)).padStart(2, "0")}
                  <span>:</span>
                  {String(remaining % 60).padStart(2, "0")}
                </span>
                <span className="timer-caption">
                  {atTarget
                    ? "goal reached · confirm when finished"
                    : s.state === "paused"
                      ? "paused"
                      : "stay with it"}
                </span>
              </div>
            </div>
            <div className="focus-actions">
              {!atTarget && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void action(s.state === "paused" ? "resume" : "pause")
                  }
                >
                  {s.state === "paused" ? (
                    <Play size={18} />
                  ) : (
                    <Pause size={18} />
                  )}{" "}
                  {s.state === "paused" ? "Resume" : "Pause"}
                </button>
              )}
              <button
                className="button"
                disabled={busy}
                onClick={() => void action("finish")}
              >
                <Check size={18} />
                Finish session
              </button>
            </div>
            <div className="focus-secondary">
              <button
                className="text-button"
                disabled={busy || s.target_seconds >= 10800}
                onClick={() =>
                  void action("extend", {
                    minutes: Math.min(15, (10800 - s.target_seconds) / 60),
                  })
                }
              >
                <Plus size={15} />
                Add 15 min
              </button>
              <button
                className="text-button"
                onClick={() => setConfirmCancel(true)}
              >
                <X size={15} />
                Cancel session
              </button>
            </div>
            <div className="session-privacy">
              <LockKeyhole size={16} />
              <label>
                <span className="sr-only">Session sharing</span>
                <select
                  value={s.visibility}
                  disabled={busy}
                  onChange={(e) =>
                    void action("privacy", { visibility: e.target.value })
                  }
                >
                  <option value="private">Private · just for you</option>
                  <option value="friends_status">
                    Friends see status only
                  </option>
                  <option value="friends_status_and_venue">
                    Friends see status & spot
                  </option>
                </select>
              </label>
            </div>
            {s.visibility === "friends_status_and_venue" &&
              s.spot_id &&
              s.state === "running" &&
              !atTarget && (
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={() =>
                    void mutate(
                      "availability",
                      {
                        mode:
                          app?.availability?.mode === "open_to_join"
                            ? null
                            : "open_to_join",
                        minutes: 60,
                        revision: app?.availability?.revision || 0,
                      },
                      app?.availability?.mode === "open_to_join"
                        ? "You’re no longer open to company."
                        : "Your friends can now tell you they’re coming.",
                    )
                  }
                >
                  <Users size={16} />
                  {app?.availability?.mode === "open_to_join"
                    ? "Open to company · stop inviting"
                    : "Open this session to company"}
                </button>
              )}
            <p className="fine-print">
              Your timer is saved automatically. Reaching zero won’t finish your
              session until you confirm.
            </p>
          </>
        ) : (
          <>
            <h2>What are we making time for?</h2>
            <p className="muted">A chapter, a problem set, a fresh idea.</p>
            <div className="duration-presets">
              {[25, 50, 90].map((n) => (
                <button
                  key={n}
                  className={minutes === n ? "selected" : ""}
                  onClick={() => setMinutes(n)}
                >
                  <strong>{n}</strong>
                  <span>minutes</span>
                </button>
              ))}
            </div>
            <div className="focus-start-form">
              <label className="field">
                Search places
                <input
                  value={spotQuery}
                  onChange={(e) => setSpotQuery(e.target.value)}
                  placeholder="Name or city (up to 60 matches)"
                />
              </label>
              <div className="form-grid">
                <label className="field">
                  Your study spot
                  <select
                    value={spot}
                    onChange={(e) => setSpot(e.target.value)}
                  >
                    <option value="">My own space</option>
                    {choices.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Or choose your minutes
                  <input
                    type="number"
                    min={15}
                    max={180}
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                  />
                </label>
              </div>
              <label className="field">
                Who can see this session?
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as Visibility)}
                >
                  <option value="private">Private · just for me</option>
                  <option value="friends_status">
                    Friends see I’m studying
                  </option>
                  <option value="friends_status_and_venue">
                    Friends see I’m studying and where
                  </option>
                </select>
              </label>
              {visibility !== "private" && (
                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={shareCompletion}
                    onChange={(e) => setShareCompletion(e.target.checked)}
                  />
                  Share a completion update with opted-in friends
                </label>
              )}
              <button
                className="button full"
                disabled={busy || minutes < 15 || minutes > 180}
                onClick={() =>
                  void mutate(
                    "study",
                    {
                      spot_id: spot || null,
                      minutes,
                      visibility,
                      share_completion: shareCompletion,
                    },
                    "Timer started.",
                  )
                }
              >
                <Play size={17} />
                Start studying
              </button>
              <p className="fine-print">
                <LockKeyhole size={12} />
                Private by default. Sharing is always your choice.
              </p>
            </div>
          </>
        )}
      </section>
      <aside className="study-aside">
        <div className="card padded">
          <span className="eyebrow">YOUR TOTALS</span>
          <h3>Your focus, so far</h3>
          <div className="study-stats">
            <div>
              <strong>{Math.floor(total / 60)}</strong>
              <span>focused minutes</span>
            </div>
            <div>
              <strong>{completedSessions.length}</strong>
              <span>sessions finished</span>
            </div>
          </div>
          <p className="fine-print">
            From your last 100 sessions. A personal habit record, based on
            timers you confirmed.
          </p>
        </div>
        <div className="focus-tip">
          <Coffee size={26} />
          <h3>Take a real break.</h3>
          <p>
            Put your phone out of reach. Take a sip of water. Start with just
            one thing.
          </p>
          <span>BACK IN FIVE.</span>
        </div>
        <div className="recent-sessions">
          <h3>Recent sessions</h3>
          {completedSessions.length ? (
            completedSessions.slice(0, 5).map((h) => (
              <div className="history-item" key={h.id}>
                <span className="history-icon">
                  <CheckCircle2 size={17} />
                </span>
                <div>
                  <strong>{h.spot_name || "Your own space"}</strong>
                  <small>
                    {dateLabel(h.started_at)} ·{" "}
                    {Math.floor(h.focus_seconds / 60)} min
                  </small>
                </div>
              </div>
            ))
          ) : (
            <p className="muted small-text">
              Your finished sessions will collect here, one small step at a
              time.
            </p>
          )}
        </div>
      </aside>
      {confirmCancel && s && (
        <Modal
          title="Leave this session here?"
          onClose={() => setConfirmCancel(false)}
        >
          <p>
            A cancelled session won’t count toward your completed focus minutes.
            You can also finish now to keep the time you’ve already spent.
          </p>
          <div className="button-row">
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                await action("cancel");
                setConfirmCancel(false);
              }}
            >
              Cancel session
            </button>
            <button
              className="button secondary"
              onClick={() => setConfirmCancel(false)}
            >
              Keep studying
            </button>
          </div>
        </Modal>
      )}
      {completed && (
        <Modal title="Session complete." onClose={() => setCompleted(null)}>
          <div className="success-art">
            <CheckCircle2 size={48} />
          </div>
          <p>
            You made time for{" "}
            <strong>{Math.floor(completed.focus_seconds / 60)} minutes</strong>{" "}
            of focus. That counts.
          </p>
          <div className="stack-actions">
            {completed.spot_id && (
              <Link className="button" href={"/spots/" + completed.spot_id}>
                Share a thought about your spot <ArrowRight size={16} />
              </Link>
            )}
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                if (
                  await mutate(
                    "availability",
                    {
                      mode: "available",
                      minutes: 30,
                      revision: app?.availability?.revision || 0,
                    },
                    "You’ve shared that you’re available for 30 minutes.",
                  )
                )
                  setCompleted(null);
              }}
            >
              Share that I’m available for 30 minutes
            </button>
            <button className="text-button" onClick={() => setCompleted(null)}>
              Keep this moment to myself
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
