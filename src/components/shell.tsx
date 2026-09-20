"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Trophy,
  Crown,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  Heart,
  LogIn,
  MapPin,
  Menu,
  MessageCircle,
  Settings,
  ShieldCheck,
  Timer,
  Users,
  UserRound,
  X,
} from "lucide-react";
import { useApp, useResource } from "./provider";
import { Avatar, Modal } from "./ui";
import type { Friend } from "@/lib/types";
import { elapsed, timeLabel } from "@/lib/time";
const nav = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/study", label: "Study", icon: Timer },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/profile", label: "Profile", icon: UserRound },
];
const collections = [
  { href: "/saved", label: "Saved spots", icon: Heart },
  { href: "/bookings", label: "My bookings", icon: CalendarDays },
  { href: "/feed", label: "Following feed", icon: BookOpen },
];
const community = [
  { href: "/rankings", label: "Rankings", icon: Trophy },
  { href: "/premium", label: "DeskHop Premium", icon: Crown },
];
export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter(),
    pathname = usePathname(),
    { data, now, mutate, busy, error } = useApp();
  const [notifications, setNotifications] = useState(false),
    [menu, setMenu] = useState(false),
    [dismissed, setDismissed] = useState(false),
    [editEta, setEditEta] = useState(false),
    [eta, setEta] = useState(20);
  const social = useResource<{ friends: Friend[] }>(
    data?.user ? "friends" : null,
  );
  const visibleFriends =
    social.data?.friends.filter((f) => f.spot_name && f.expires_at! > now) ||
    [];
  const session = data?.session,
    hop = data?.hop;
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Link className="brand" href="/discover" aria-label="DeskHop home">
          <img src="/brand/deskhop-mark.svg" width="39" height="39" alt="" />
          <span>
            DeskHop<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="campus">
          <span className="campus-symbol">
            <MapPin size={18} />
          </span>
          <span>
            <strong>Colorado</strong>
            <small>Find your study neighborhood</small>
          </span>
        </div>
        <p className="nav-caption">YOUR LITTLE STUDY WORLD</p>
        <nav aria-label="Main navigation">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              className={`nav-link ${pathname.startsWith(href) ? "active" : ""}`}
              href={href}
              key={href}
              aria-current={pathname.startsWith(href) ? "page" : undefined}
            >
              <Icon size={21} />
              {label}
              {href === "/study" && session && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <nav aria-label="Your collections">
          {collections.map(({ href, label, icon: Icon }) => (
            <Link
              className={`nav-link ${pathname === href ? "active" : ""}`}
              href={href}
              key={href}
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Community and membership">
          {community.map(({ href, label, icon: Icon }) => (
            <Link
              className={`nav-link ${pathname === href ? "active" : ""}`}
              href={href}
              key={href}
            >
              <Icon size={20} />
              {href === "/premium" && data?.premium ? "Your Premium" : label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="tiny-spark">✳</span>
            <strong>
              A good place.
              <br />A little progress.
            </strong>
            <p>Your next chapter starts here.</p>
          </div>
          {data?.user ? (
            <Link className="account-link" href="/profile">
              <Avatar name={data.user.name} src={data.avatarUrl} />
              <span>
                <strong>{data.user.name}</strong>
                <small>@{data.user.handle}</small>
              </span>
              <Settings size={17} />
            </Link>
          ) : (
            <Link className="button full" href="/login">
              <LogIn size={17} /> Make yourself at home
            </Link>
          )}
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <Link className="mobile-brand brand" href="/discover">
            <img src="/brand/deskhop-mark.svg" width="30" height="30" alt="" />
            <span>DeskHop.</span>
          </Link>
          <span className="topbar-tagline">
            A place to focus. People to do it with.
          </span>
          <div className="topbar-actions">
            <Link className="text-link desktop-only" href="/about">
              A little about us <ArrowUpRight size={14} />
            </Link>
            {data?.user ? (
              <>
                <button
                  className="notification-button icon-button"
                  aria-label={`Notifications${data.notifications.some((n) => !n.read_at) ? ", unread" : ""}`}
                  onClick={() => {
                    setNotifications(true);
                    void mutate("notifications/read");
                  }}
                >
                  <Bell size={20} />
                  {data.notifications.some((n) => !n.read_at) && (
                    <span className="unread-dot" />
                  )}
                </button>
                <Link href="/profile" aria-label="Your profile">
                  <Avatar
                    name={data.user.name}
                    size="small"
                    src={data.avatarUrl}
                  />
                </Link>
              </>
            ) : (
              <Link className="button small" href="/login">
                Sign in <ChevronRight size={15} />
              </Link>
            )}
          </div>
        </header>
        {data?.demo && (
          <div className="demo-banner">
            <span className="status-dot" /> Campus preview · Fictional spots and
            demo bookings are labeled.
            <Link href="/about">
              About the preview <ArrowUpRight size={12} />
            </Link>
          </div>
        )}
        <main id="main-content" className="main-content">
          {error && (
            <div className="connection-banner" role="status">
              Connection interrupted. Displayed information may be out of date.{" "}
              {error}
            </div>
          )}
          {data?.user && !data.user.verified && (
            <div className="notice-banner">
              <ShieldCheck size={18} />
              <span>
                Verify your email to reserve rooms and join the community.
              </span>
              <Link href="/profile">
                Verify email <ChevronRight size={15} />
              </Link>
            </div>
          )}
          {hop && hop.expires_at > now ? (
            <div className="active-strip travel">
              <span className="strip-icon">
                <MapPin size={21} />
              </span>
              <div>
                <strong>Hopping over to {hop.spot_name}</strong>
                <small>
                  {hop.eta_at
                    ? hop.eta_at < now
                      ? "Arrival estimate passed"
                      : `Your arrival estimate: ${timeLabel(hop.eta_at)}`
                    : "No arrival estimate shared"}{" "}
                  ·{" "}
                  {hop.delivery === "delivered"
                    ? `${hop.target_name} received an in-app update`
                    : hop.delivery === "suppressed"
                      ? "Update could not be delivered"
                      : "Your hop is saved. Update pending."}
                </small>
              </div>
              <button
                className="button small"
                disabled={busy}
                onClick={async () => {
                  const result = await mutate(
                    "hops/" + hop.id,
                    { action: "arrive", revision: hop.revision },
                    "You’ve marked yourself as here. Start a session when you’re ready.",
                  );
                  if (result) router.push("/study?spot=" + hop.spot_id);
                }}
              >
                <Check size={16} /> I’m here
              </button>
              <button className="text-button" onClick={() => setEditEta(true)}>
                Update ETA
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void mutate(
                    "hops/" + hop.id,
                    { action: "cancel", revision: hop.revision },
                    "Hop cancelled.",
                  )
                }
              >
                Cancel hop
              </button>
            </div>
          ) : session && pathname !== "/study" ? (
            <Link className="active-strip" href="/study">
              <span className="strip-icon">
                <Timer size={22} />
              </span>
              <div>
                <strong>
                  {session.state === "paused"
                    ? "Taking a breather"
                    : session.state === "awaiting_confirmation"
                      ? "You reached your focus goal"
                      : "A little focus, in progress"}
                </strong>
                <small>
                  {session.spot_name || "Your own space"} ·{" "}
                  {Math.ceil(
                    Math.max(
                      0,
                      session.target_seconds - elapsed(session, now),
                    ) / 60,
                  )}{" "}
                  minutes remaining
                </small>
              </div>
              <span className="text-link">
                Back to study <ChevronRight size={17} />
              </span>
            </Link>
          ) : !dismissed &&
            visibleFriends.length > 0 &&
            pathname === "/discover" &&
            data?.availability?.mode !== "dnd" ? (
            <div className="active-strip">
              <span className="strip-icon">
                <Users size={20} />
              </span>
              <div>
                <strong>A familiar face, a little closer.</strong>
                <small>
                  {visibleFriends[0].name} is studying at{" "}
                  {visibleFriends[0].spot_name}
                  {visibleFriends.length > 1
                    ? ` · ${visibleFriends.length - 1} more friends sharing a spot`
                    : ""}
                </small>
              </div>
              <Link className="text-link" href="/friends">
                See friends <ChevronRight size={16} />
              </Link>
              <button
                className="icon-button"
                aria-label="Dismiss friend activity"
                onClick={() => setDismissed(true)}
              >
                <X size={17} />
              </button>
            </div>
          ) : null}
          {children}
        </main>
        <footer className="footer">
          <span>Made for your next little breakthrough.</span>
          <div>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/about">About DeskHop</Link>
            {data?.user?.role === "admin" && (
              <Link href="/admin">Administration</Link>
            )}
          </div>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={pathname.startsWith(href) ? "active" : ""}
            aria-current={pathname.startsWith(href) ? "page" : undefined}
          >
            <Icon size={21} />
            <span>{label}</span>
          </Link>
        ))}
        <button
          className={menu ? "active" : ""}
          aria-expanded={menu}
          onClick={() => setMenu(true)}
        >
          <Menu size={21} />
          <span>More</span>
        </button>
      </nav>
      {menu && (
        <Modal title="Everywhere else" onClose={() => setMenu(false)}>
          <div className="menu-sheet" onClick={() => setMenu(false)}>
            {[
              ...collections,
              ...community,
              ...(data?.user?.role === "admin"
                ? [
                    {
                      href: "/admin",
                      label: "Venue administration",
                      icon: ShieldCheck,
                    },
                  ]
                : []),
            ].map(({ href, label, icon: Icon }) => (
              <Link
                className={pathname === href ? "active" : ""}
                href={href}
                key={href}
              >
                <Icon size={20} />
                {href === "/premium" && data?.premium ? "Your Premium" : label}
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>
        </Modal>
      )}
      {editEta && hop && (
        <Modal
          title="Update your arrival estimate"
          onClose={() => setEditEta(false)}
        >
          <p className="muted">
            This updates your self-reported estimate for {hop.target_name}. It
            never marks you as arrived.
          </p>
          <label className="field">
            Time from now
            <select
              value={eta}
              onChange={(e) => setEta(Number(e.target.value))}
            >
              <option value={10}>About 10 minutes</option>
              <option value={20}>About 20 minutes</option>
              <option value={30}>About 30 minutes</option>
              <option value={0}>No estimate</option>
            </select>
          </label>
          <button
            className="button full"
            disabled={busy}
            onClick={async () => {
              const result = await mutate(
                "hops/" + hop.id,
                {
                  action: "update_eta",
                  revision: hop.revision,
                  eta_minutes: eta || null,
                },
                "Arrival estimate updated.",
              );
              if (result) setEditEta(false);
            }}
          >
            Save estimate
          </button>
        </Modal>
      )}
      {notifications && (
        <Modal
          title="Your little updates"
          onClose={() => setNotifications(false)}
        >
          {data?.notifications.length ? (
            <div className="notification-list">
              {data.notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => setNotifications(false)}
                >
                  <span className="strip-icon">
                    <MessageCircle size={19} />
                  </span>
                  <span>{n.message}</span>
                  <ChevronRight size={17} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Bell size={30} />
              <h3>All caught up</h3>
              <p>
                Your reservations and opted-in friend updates will appear here.
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
