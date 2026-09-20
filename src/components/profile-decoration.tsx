"use client";
import { useState } from "react";
import Link from "next/link";
import { Palette, Leaf, LockKeyhole } from "lucide-react";
import {
  themes,
  banners,
  avatars,
  stickerOptions,
  interestOptions,
  glyphs,
  type ProfileDecoration,
} from "@/lib/profile-style";
import { cosmetics, type Progress } from "@/lib/rewards";
import { useApp, useResource } from "./provider";
import { Loading, ErrorState } from "./ui";
export function DecoratedIdentity({
  name,
  handle,
  decoration,
  level = 1,
  premium = false,
}: {
  name: string;
  handle: string;
  decoration: ProfileDecoration;
  level?: number;
  premium?: boolean;
}) {
  return (
    <div className={`decorated-profile theme-${decoration.theme}`}>
      <div className={`profile-cover cover-${decoration.banner}`}>
        <div className="profile-stickers" aria-label="Profile stickers">
          {decoration.stickers.map((s) => (
            <span key={s} title={s}>
              {glyphs[s]}
            </span>
          ))}
        </div>
      </div>
      <div className="decorated-body">
        <div
          className={`decorated-avatar border-${decoration.border || "plain"}`}
          aria-label={decoration.avatar + " avatar"}
        >
          {glyphs[decoration.avatar]}
        </div>
        <div>
          <div className="identity-title">
            <h1>{name}</h1>
            {premium && (
              <span className="premium-badge" aria-label="Premium member">
                ✦ Premium
              </span>
            )}
          </div>
          <p>
            @{handle} <span className="level-badge">Level {level}</span>
          </p>
        </div>
        <p className="profile-bio">
          {decoration.bio || "A little space for a new story."}
        </p>
        <div className="interest-pills">
          {decoration.interests.map((i) => (
            <span key={i}>{i}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
export function DecorationEditor() {
  const { data, error } = useResource<{ decoration: ProfileDecoration }>(
    "profile/decoration",
  );
  if (error) return <ErrorState message={error} />;
  return data ? <Editor initial={data.decoration} /> : <Loading />;
}
function Editor({ initial }: { initial: ProfileDecoration }) {
  const { data: app, mutate, busy } = useApp();
  const [draft, setDraft] = useState(initial),
    [search, setSearch] = useState("");
  const { data: catalog } = useResource<{
    spots: { id: string; name: string; demo: number }[];
  }>("spots");
  const p = app?.progress;
  const set = (key: keyof ProfileDecoration, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const toggle = (key: "stickers" | "interests", value: string, max: number) =>
    set(
      key,
      draft[key].includes(value)
        ? draft[key].filter((x) => x !== value)
        : [...draft[key], value].slice(0, max),
    );
  const owned = p?.owned || [
    "theme:forest",
    "banner:mountains",
    "border:plain",
  ];
  return (
    <section className="card padded decoration-editor">
      <h2>
        <Palette size={22} /> Your public corner
      </h2>
      <p className="muted">
        Preview your profile, then save. Your bio, interests, and pinned places
        are public.
      </p>
      <DecoratedIdentity
        name={app?.user?.name || "Your name"}
        handle={app?.user?.handle || "you"}
        decoration={draft}
        level={p?.level}
      />
      <label className="field">
        About you
        <textarea
          maxLength={240}
          rows={3}
          value={draft.bio}
          onChange={(e) => set("bio", e.target.value)}
          placeholder="Usually reading, occasionally finding a new coffee spot…"
        />
        <small>{draft.bio.length}/240 characters</small>
      </label>
      <div className="form-grid">
        {(
          [
            ["theme", themes],
            ["banner", banners],
            ["border", ["plain", "leaf", "orbit", "laurel"]],
            ["avatar", avatars],
          ] as const
        ).map(([key, values]) => (
          <label className="field" key={key}>
            {key[0].toUpperCase() + key.slice(1)}
            <select
              value={draft[key]}
              onChange={(e) => set(key, e.target.value)}
            >
              {values.map((v) => (
                <option
                  value={v}
                  key={v}
                  disabled={key !== "avatar" && !owned.includes(`${key}:${v}`)}
                >
                  {v}
                  {key !== "avatar" && !owned.includes(`${key}:${v}`)
                    ? " · locked"
                    : ""}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <fieldset className="decoration-picker">
        <legend>Stickers · choose up to five</legend>
        {stickerOptions.map((s) => (
          <button
            type="button"
            className={draft.stickers.includes(s) ? "selected" : ""}
            key={s}
            aria-pressed={draft.stickers.includes(s)}
            aria-label={s}
            onClick={() => toggle("stickers", s, 5)}
          >
            {glyphs[s]}
          </button>
        ))}
      </fieldset>
      <fieldset className="decoration-picker interests">
        <legend>Interests · choose up to five</legend>
        {interestOptions.map((s) => (
          <button
            type="button"
            className={draft.interests.includes(s) ? "selected" : ""}
            key={s}
            aria-pressed={draft.interests.includes(s)}
            onClick={() => toggle("interests", s, 5)}
          >
            {s}
          </button>
        ))}
      </fieldset>
      <label className="field">
        Find a place to pin
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by venue name"
        />
      </label>
      {search.length >= 2 && (
        <div className="pin-search">
          {(catalog?.spots || [])
            .filter(
              (s) =>
                !s.demo && s.name.toLowerCase().includes(search.toLowerCase()),
            )
            .slice(0, 8)
            .map((s) => (
              <button
                type="button"
                className="text-button"
                key={s.id}
                disabled={
                  draft.pinned_spots.includes(s.id) ||
                  draft.pinned_spots.length >= 3
                }
                onClick={() => {
                  set("pinned_spots", [...draft.pinned_spots, s.id]);
                  setSearch("");
                }}
              >
                Pin {s.name}
              </button>
            ))}
        </div>
      )}
      <div className="interest-pills">
        {draft.pinned_spots.map((id) => (
          <button
            className="text-button"
            key={id}
            onClick={() =>
              set(
                "pinned_spots",
                draft.pinned_spots.filter((x) => x !== id),
              )
            }
          >
            📍 {catalog?.spots.find((s) => s.id === id)?.name || id} ×
          </button>
        ))}
      </div>
      <p className="fine-print">
        Up to three favorite places. Pins are recommendations; they never
        disclose your current location.
      </p>
      <label className="check-card">
        <input
          type="checkbox"
          checked={draft.leaderboard}
          onChange={(e) => set("leaderboard", e.target.checked)}
        />
        <span>
          Include my public contributions in community rankings
          <small>
            Turning this off removes your profile from rankings. Reviews remain
            public.
          </small>
        </span>
      </label>
      <button
        className="button"
        disabled={busy}
        onClick={() =>
          void mutate(
            "profile/decoration",
            draft,
            "Your public corner is updated.",
          )
        }
      >
        Save profile appearance
      </button>
      {p && <RewardsShop progress={p} />}
    </section>
  );
}
export function RewardsShop({ progress: p }: { progress: Progress }) {
  const { mutate, busy } = useApp();
  return (
    <div className="rewards-shop">
      <div className="section-heading">
        <div>
          <h2>A little progress, made yours.</h2>
          <p className="muted">
            Level {p.level} · {p.xp} XP · next level at {p.nextLevelXp} XP
          </p>
        </div>
        <span className="leaf-balance">
          <Leaf size={19} />
          {p.coins} Leaves
        </span>
      </div>
      <progress
        aria-label="Experience toward next level"
        value={p.xp}
        max={p.nextLevelXp}
      />
      <p className="fine-print">
        Earn 20 XP + 10 Leaves for a new real-place review (up to 3/day).
        Completed focus sessions of at least 10 minutes earn 1 XP/minute and 2
        Leaves per 10 minutes, capped at 120 rewarded minutes/day. Leaves are
        free, have no cash value, and cannot be bought or transferred.
      </p>
      <div className="achievement-grid">
        {p.achievements.map((a) => (
          <div className={`achievement ${a.earned ? "earned" : ""}`} key={a.id}>
            <span>{a.earned ? "🏅" : "○"}</span>
            <strong>{a.name}</strong>
            <small>{a.description}</small>
          </div>
        ))}
      </div>
      <div className="cosmetic-grid">
        {cosmetics
          .filter((c) => c.cost > 0)
          .map((c) => (
            <div className="cosmetic-item" key={c.id}>
              <strong>{c.name}</strong>
              <small>
                {c.type} · Level {c.level} · {c.cost} Leaves
              </small>
              <button
                className="button secondary small"
                disabled={
                  busy ||
                  p.owned.includes(c.id) ||
                  p.level < c.level ||
                  p.coins < c.cost
                }
                onClick={() =>
                  void mutate(
                    "rewards/buy",
                    { cosmeticId: c.id },
                    "Decoration unlocked. Select it above and save your profile.",
                  )
                }
              >
                {p.owned.includes(c.id) ? (
                  "Unlocked"
                ) : p.level < c.level ? (
                  <>
                    <LockKeyhole size={14} />
                    Level {c.level}
                  </>
                ) : (
                  "Unlock"
                )}
              </button>
            </div>
          ))}
      </div>
      <Link className="text-link" href="/study">
        Make time for a little focus →
      </Link>
    </div>
  );
}
