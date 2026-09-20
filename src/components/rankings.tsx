"use client";
import { useState } from "react";
import Link from "next/link";
import { Trophy, TrendingUp, Star } from "lucide-react";
import { useResource } from "./provider";
import { PageTitle, Loading, ErrorState, Empty } from "./ui";
import { glyphs } from "@/lib/profile-style";
type Row = {
  rank: number;
  id: string;
  name: string;
  handle?: string;
  city?: string;
  avatar?: string;
  avatar_url?: string;
  score: number;
  reviews: number;
  followers?: number;
  rating?: number;
  premium?: boolean;
};
export function Rankings() {
  const [period, setPeriod] = useState("weekly"),
    [kind, setKind] = useState("spots"),
    [metric, setMetric] = useState("trending");
  const { data, error } = useResource<{
    rows: Row[];
    explanation: string;
    window: { day: string; timeZone: string };
  }>(`rankings?period=${period}&kind=${kind}&metric=${metric}`);
  return (
    <>
      <PageTitle
        eyebrow="A LITTLE RECOGNITION"
        title="Good places. Great contributors."
        description="Discover what the community is enjoying across Colorado."
      />
      <div className="ranking-controls card">
        <div className="segmented" role="group" aria-label="Ranking type">
          {["spots", "users"].map((k) => (
            <button
              key={k}
              aria-pressed={kind === k}
              className={kind === k ? "active" : ""}
              onClick={() => {
                setKind(k);
                setMetric(k === "spots" ? "trending" : "points");
              }}
            >
              {k === "spots" ? "Study spots" : "Community"}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Ranking period">
          {["daily", "weekly", "monthly"].map((p) => (
            <button
              key={p}
              aria-pressed={period === p}
              className={period === p ? "active" : ""}
              onClick={() => setPeriod(p)}
            >
              {p === "daily"
                ? "Today"
                : p === "weekly"
                  ? "This week"
                  : "This month"}
            </button>
          ))}
        </div>
        <label className="field">
          Rank by
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {(kind === "spots"
              ? [
                  ["trending", "Most reviewed"],
                  ["rating", "Top rated"],
                ]
              : [
                  ["points", "Community points"],
                  ["followers", "New followers"],
                  ["reviews", "Reviews contributed"],
                ]
            ).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <ErrorState message={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <p className="ranking-method">
            <TrendingUp size={18} />
            <span>
              {data.explanation} Period began {data.window.day} in{" "}
              {data.window.timeZone}. Live results can change.
            </span>
          </p>
          {data.rows.length ? (
            <div className="leaderboard">
              {data.rows.map((r) => (
                <Link
                  className="leaderboard-row card"
                  href={kind === "spots" ? "/spots/" + r.id : "/u/" + r.handle}
                  key={r.id}
                >
                  <span className={"rank-number rank-" + r.rank}>
                    {r.rank <= 3 ? <Trophy size={24} /> : r.rank}
                    <small>{r.rank <= 3 ? "#" + r.rank : ""}</small>
                  </span>
                  <span className="rank-avatar" aria-hidden="true">
                    {kind === "users" && r.avatar_url ? (
                      <img src={r.avatar_url} alt="" decoding="async" />
                    ) : kind === "users" ? (
                      glyphs[r.avatar || "seedling"]
                    ) : (
                      "📍"
                    )}
                  </span>
                  <span className="rank-person">
                    <strong>
                      {r.name}
                      {r.premium && (
                        <span className="premium-badge">✦ Premium</span>
                      )}
                    </strong>
                    <small>
                      {kind === "users"
                        ? `@${r.handle} · ${r.reviews} new reviews · ${r.followers} new followers`
                        : `${r.city || "Colorado"} · ${r.reviews} new reviews`}
                    </small>
                  </span>
                  <span className="rank-score">
                    {metric === "rating" && <Star size={16} />}
                    <strong>{r.score}</strong>
                    <small>
                      {metric === "rating"
                        ? "weighted rating"
                        : metric === "points"
                          ? "points"
                          : metric === "followers"
                            ? "followers"
                            : "reviews"}
                    </small>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              icon={<Trophy />}
              title="The next good contribution could be yours"
            >
              No eligible activity in this period yet. Explore a real spot,
              leave an honest review, and help someone find their place.
              Rankings fill from real community activity.
            </Empty>
          )}
        </>
      )}
    </>
  );
}
