"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Heart,
  LockKeyhole,
  LogOut,
  Mail,
  Shield,
  UserRound,
} from "lucide-react";
import { useApp } from "./provider";
import { AuthGate, Avatar, Badge, Modal, PageTitle } from "./ui";
import { api, post } from "@/lib/client";
export function Profile() {
  return (
    <>
      <PageTitle
        eyebrow="YOUR OWN LITTLE CORNER"
        title="Make DeskHop feel like you."
        description="Your preferences, your privacy, your pace."
      />
      <AuthGate>
        <ProfileContent />
      </AuthGate>
    </>
  );
}
function ProfileContent() {
  const { data, mutate, busy, refresh, toast } = useApp();
  const user = data!.user!;
  const [name, setName] = useState(user.name),
    [sharing, setSharing] = useState(!!user.sharing),
    [notify, setNotify] = useState(!!user.notify),
    [remove, setRemove] = useState(false),
    [password, setPassword] = useState(""),
    [developmentLink, setDevelopmentLink] = useState("");
  const router = useRouter();
  async function exportData() {
    try {
      const result = await api("account/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(result, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "deskhop-my-data.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("Your DeskHop data is ready.");
    } catch (e) {
      toast((e as Error).message);
    }
  }
  return (
    <div className="profile-layout">
      <aside>
        <div className="card profile-identity">
          <Avatar name={user.name} size="large" />
          <h2>{user.name}</h2>
          <p>@{user.handle}</p>
          <Badge tone={user.verified ? "sage" : "apricot"}>
            {user.verified ? (
              <>
                <CheckCircle2 size={13} />
                Email verified
              </>
            ) : (
              "Email not verified yet"
            )}
          </Badge>
          <p className="fine-print">
            Share your handle so friends can find you.
          </p>
        </div>
        <div className="profile-shortcuts">
          <Link href="/bookings">
            <CalendarDays size={19} />
            My bookings <ArrowRight size={16} />
          </Link>
          <Link href="/saved">
            <Heart size={19} />
            Saved spots <ArrowRight size={16} />
          </Link>
          <Link href={"/u/" + user.handle}>
            <UserRound size={19} />
            My public profile <ArrowRight size={16} />
          </Link>
          {user.role === "admin" && (
            <Link href="/admin">
              <Shield size={19} />
              Venue administration <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </aside>
      <div className="profile-settings">
        <section className="card padded">
          <h2>The basics</h2>
          <label className="field">
            Display name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={60}
            />
          </label>
          <label className="field">
            Email address
            <input value={user.email} readOnly />
            <small>Your email is never part of your public profile.</small>
          </label>
          {!user.verified && (
            <>
              <button
                className="button secondary"
                disabled={busy}
                onClick={async () => {
                  const result = await mutate<{ developmentLink?: string }>(
                    "auth/resend",
                    {},
                    "Check your inbox for a verification link.",
                  );
                  if (result?.developmentLink)
                    setDevelopmentLink(result.developmentLink);
                }}
              >
                <Mail size={17} />
                Resend verification
              </button>
              {developmentLink && (
                <div className="development-mail">
                  Local development link:{" "}
                  <Link href={developmentLink}>Verify your email</Link>
                </div>
              )}
            </>
          )}
        </section>
        <section className="card padded">
          <h2>A little control over your privacy</h2>
          <label className="check-card">
            <input
              type="checkbox"
              checked={sharing}
              onChange={(e) => setSharing(e.target.checked)}
            />
            <span>
              <strong>Allow sharing with accepted friends</strong>
              <small>
                Turning this off immediately hides private activity, makes your
                active session private, clears availability, and cancels your
                active hop. Turning it back on does not restore those choices.
              </small>
            </span>
          </label>
          <label className="check-card">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
            />
            <span>
              <strong>Receive friends’ completion updates</strong>
              <small>
                Only for shared sessions they explicitly finish. Do not disturb
                suppresses these updates.
              </small>
            </span>
          </label>
          <p className="fine-print">
            Your individual session privacy settings still decide whether a
            friend sees status or a venue.
          </p>
          <button
            className="button"
            disabled={busy || name.trim().length < 2}
            onClick={() =>
              void mutate(
                "settings",
                { name, sharing, notify },
                "Your preferences are saved.",
              )
            }
          >
            Save my preferences
          </button>
        </section>
        <section className="card padded">
          <h2>Your account, in your hands</h2>
          <div className="account-actions">
            <button
              className="button secondary"
              onClick={() => void exportData()}
            >
              <ArrowDownToLine size={17} />
              Download my data
            </button>
            <Link className="button secondary" href="/forgot-password">
              <LockKeyhole size={17} />
              Reset password
            </Link>
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                try {
                  await post("auth/logout");
                  await refresh();
                  router.push("/discover");
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              <LogOut size={17} />
              Sign out
            </button>
          </div>
          <div className="danger-zone">
            <div>
              <h3>Leave DeskHop</h3>
              <p>
                Delete your account and its associated data, including bookings,
                reviews, friendships, and study history.
              </p>
            </div>
            <button
              className="text-button danger-text"
              onClick={() => setRemove(true)}
            >
              Delete my account
            </button>
          </div>
        </section>
      </div>
      {remove && (
        <Modal
          title="Delete your DeskHop account?"
          onClose={() => setRemove(false)}
        >
          <p>
            This permanently deletes your account and associated data. Your
            reservations will be removed and the rooms released. You can
            download your data first.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate(
                  "account/delete",
                  { password },
                  "Your account has been deleted.",
                )
              ) {
                setRemove(false);
                router.push("/discover");
              }
            }}
          >
            <label className="field">
              Confirm with your password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <div className="button-row">
              <button className="button danger" disabled={busy}>
                Permanently delete account
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => setRemove(false)}
              >
                Keep my account
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
