"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Heart,
  LockKeyhole,
  ImagePlus,
  LogOut,
  RefreshCw,
  Mail,
  Trash2,
  Shield,
  UserRound,
} from "lucide-react";
import { useApp } from "./provider";
import { AuthGate, Avatar, Badge, Modal, PageTitle } from "./ui";
import { DecorationEditor } from "./profile-decoration";
import { api, post } from "@/lib/client";
import { handleHint, handlePattern, normalizeHandle } from "@/lib/handle";
import { prepareAvatar } from "@/lib/avatar";
export function Profile() {
  return (
    <>
      <PageTitle
        eyebrow="YOUR OWN LITTLE CORNER"
        title="Make DeskHop feel like you."
        description="Your preferences, your privacy, your pace."
      />
      <div className="button-row">
        <Link className="button secondary" href="/rankings">
          Community rankings
        </Link>
        <Link className="button secondary" href="/premium">
          DeskHop Premium
        </Link>
      </div>
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
    [handle, setHandle] = useState(user.handle),
    [sharing, setSharing] = useState(!!user.sharing),
    [notify, setNotify] = useState(!!user.notify),
    [remove, setRemove] = useState(false),
    [checking, setChecking] = useState(false),
    [password, setPassword] = useState(""),
    [developmentLink, setDevelopmentLink] = useState("");
  const router = useRouter();
  const handleValid = handlePattern.test(handle);
  const saveSettings = (message: string) =>
    mutate("settings", { name, handle, sharing, notify }, message);
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
          {data?.premium && <span className="premium-badge">Premium</span>}
          <Avatar name={user.name} size="large" src={data?.avatarUrl} />
          <ProfilePicture />
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
            Your handle
            <input
              value={handle}
              onChange={(e) => setHandle(normalizeHandle(e.target.value))}
              minLength={3}
              maxLength={24}
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={!handleValid}
            />
            <small>
              {handleValid
                ? `Friends find your public profile at /u/${handle}. Changing it retires the old address.`
                : handleHint}
            </small>
          </label>
          <label className="field">
            Email address
            <input value={user.email} readOnly />
            <small>Your email is never part of your public profile.</small>
          </label>
          <button
            className="button"
            disabled={busy || name.trim().length < 2 || !handleValid}
            onClick={() => void saveSettings("The basics are saved.")}
          >
            Save the basics
          </button>
          {!user.verified && (
            <div className="verify-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={async () => {
                  if (data?.firebase) {
                    try {
                      const { managedVerification } =
                        await import("@/lib/firebase-client");
                      await managedVerification(data.firebase, true);
                      toast("Check your inbox for the verification link.");
                    } catch (e) {
                      toast((e as Error).message);
                    }
                    return;
                  }
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
              {data?.firebase && (
                <>
                  <button
                    className="button secondary"
                    disabled={busy || checking}
                    onClick={async () => {
                      setChecking(true);
                      try {
                        const { managedVerification } =
                          await import("@/lib/firebase-client");
                        await managedVerification(data.firebase!, false);
                        const fresh = await refresh();
                        toast(
                          fresh?.user?.verified
                            ? "Your email is verified. You're all set."
                            : "Not verified yet. Open the link in your inbox, then check again.",
                        );
                      } catch {
                        // The managed session is per browser session, so it is
                        // often gone by the time the emailed link is opened.
                        router.push("/login?next=%2Fprofile");
                      } finally {
                        setChecking(false);
                      }
                    }}
                  >
                    <RefreshCw size={17} />
                    {checking ? "Checking…" : "I've verified my email"}
                  </button>
                  <Link className="text-link" href="/login?next=%2Fprofile">
                    Not working? Sign in again to refresh it.
                  </Link>
                </>
              )}
              {developmentLink && (
                <div className="development-mail">
                  Local development link:{" "}
                  <Link href={developmentLink}>Verify your email</Link>
                </div>
              )}
            </div>
          )}
        </section>
        {user.verified === 1 && <DecorationEditor />}
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
            disabled={busy || name.trim().length < 2 || !handleValid}
            onClick={() => void saveSettings("Your preferences are saved.")}
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
                  if (data?.firebase) {
                    const { managedSignOut } =
                      await import("@/lib/firebase-client");
                    await managedSignOut(data.firebase);
                  }
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
            {user.password_enabled !== 0 ? (
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
            ) : (
              <p className="notice-banner">
                Deletion requires a sign-in within the last five minutes.{" "}
                <Link href="/login?next=%2Fprofile">Sign in again</Link>
              </p>
            )}
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
function ProfilePicture() {
  const { data, mutate, busy, toast } = useApp();
  const picker = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const verified = data?.user?.verified === 1;
  const current = data?.avatarUrl || "";
  if (!verified)
    return (
      <p className="fine-print">Verify your email to add a profile picture.</p>
    );
  return (
    <div className="picture-actions">
      <input
        ref={picker}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="visually-hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setPreparing(true);
          try {
            const avatar_url = await prepareAvatar(file);
            await mutate(
              "profile/avatar",
              { avatar_url },
              "Your profile picture is saved.",
            );
          } catch (error) {
            toast((error as Error).message);
          } finally {
            setPreparing(false);
          }
        }}
      />
      <button
        className="button secondary small"
        disabled={busy || preparing}
        onClick={() => picker.current?.click()}
      >
        <ImagePlus size={16} />
        {current ? "Change picture" : "Add a picture"}
      </button>
      {current && (
        <button
          className="text-button danger-text"
          disabled={busy || preparing}
          onClick={() =>
            void mutate(
              "profile/avatar",
              { avatar_url: "" },
              "Your profile picture is removed.",
            )
          }
        >
          <Trash2 size={15} />
          Remove
        </button>
      )}
    </div>
  );
}
