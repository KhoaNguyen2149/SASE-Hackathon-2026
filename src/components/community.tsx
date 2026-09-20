"use client";
import Link from "next/link";
import { DecoratedIdentity } from "./profile-decoration";
import type { ProfileDecoration } from "@/lib/profile-style";
import type { Progress } from "@/lib/rewards";
import { BookOpen, Star, UserPlus } from "lucide-react";
import { useApp, useResource } from "./provider";
import { AuthGate, Avatar, Empty, ErrorState, Loading, PageTitle } from "./ui";
import type { Review } from "@/lib/types";
import { relativeTime } from "@/lib/time";
export function Feed() {
  return (
    <>
      <PageTitle
        eyebrow="A LITTLE LOCAL KNOWLEDGE"
        title="Good words. Good places."
        description="Recent public reviews from people you follow."
      />
      <AuthGate>
        <FeedContent />
      </AuthGate>
    </>
  );
}
function FeedContent() {
  const { data, error } = useResource<{ reviews: Review[] }>("feed");
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;
  return data.reviews.length ? (
    <ReviewFeed reviews={data.reviews} />
  ) : (
    <Empty
      icon={<BookOpen />}
      title="A fresh page for your feed"
      action={
        <Link className="button" href="/discover">
          Explore spots and reviews
        </Link>
      }
    >
      Follow a reviewer from their public profile. Their latest reviews will
      appear here, without sharing private study activity.
    </Empty>
  );
}
export function ReviewFeed({ reviews }: { reviews: Review[] }) {
  return (
    <div className="feed-list">
      {reviews.map((r) => (
        <article className="card" key={r.id}>
          <div className="review-header">
            <Link href={"/u/" + r.handle} className="review-author">
              <Avatar name={r.name || "Student"} />
              <span>
                <strong>{r.name || "You"}</strong>
                <small>
                  {relativeTime(r.updated_at)} · visited {r.visit_date}
                </small>
              </span>
            </Link>
            <span className="rating">
              <Star size={15} fill="currentColor" />
              {r.rating}
            </span>
          </div>
          <Link className="review-spot" href={"/spots/" + r.spot_id}>
            {r.spot_name} ↗
          </Link>
          <p className="review-notes">
            {r.notes || "Shared a few thoughts through ratings."}
          </p>
        </article>
      ))}
    </div>
  );
}
export function PublicProfile({ handle }: { handle: string }) {
  const { data: app, mutate, requireAuth, busy } = useApp();
  const { data, error } = useResource<{
    user: { id: string; name: string; handle: string };
    decoration: ProfileDecoration;
    progress: Pick<Progress, "level" | "achievements">;
    premium: boolean;
    followers: number;
    followingCount: number;
    pinnedSpots: { id: string; name: string }[];
    following: boolean;
    reviews: Review[];
  }>(`profiles/${handle}`);
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;
  const own = app?.user?.id === data.user.id;
  return (
    <>
      <DecoratedIdentity
        name={data.user.name}
        handle={data.user.handle}
        decoration={data.decoration}
        level={data.progress.level}
        premium={data.premium}
      />
      <div className="public-profile-header">
        <div className="public-counts">
          <span>
            <strong>{data.followers}</strong> followers
          </span>
          <span>
            <strong>{data.followingCount}</strong> following
          </span>
          <span>
            <strong>{data.reviews.length}</strong> reviews
          </span>
        </div>
        {!own && (
          <div className="button-row">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                if (requireAuth())
                  void mutate(
                    "friends",
                    {
                      action: data.following ? "unfollow" : "follow",
                      target: data.user.id,
                    },
                    data.following
                      ? "Reviewer unfollowed."
                      : "You’ll see their public reviews in your feed.",
                  );
              }}
            >
              {data.following ? "Following · unfollow" : "Follow reviews"}
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => {
                if (requireAuth())
                  void mutate(
                    "friends",
                    { action: "request", target: data.user.id },
                    "Friend request saved. Check Friends for incoming requests.",
                  );
              }}
            >
              <UserPlus size={17} />
              Add friend
            </button>
          </div>
        )}
      </div>
      {own && (
        <Link className="button secondary" href="/profile">
          Decorate my profile
        </Link>
      )}
      <div className="achievement-grid">
        {data.progress.achievements
          .filter((a) => a.earned)
          .map((a) => (
            <div className="achievement earned" key={a.id}>
              <span>??</span>
              <strong>{a.name}</strong>
              <small>{a.description}</small>
            </div>
          ))}
      </div>
      {data.pinnedSpots.length > 0 && (
        <section className="pinned-spots">
          <h2>A few favorite corners</h2>
          <div className="interest-pills">
            {data.pinnedSpots.map((s) => (
              <Link
                className="button secondary"
                href={"/spots/" + s.id}
                key={s.id}
              >
                ?? {s.name}
              </Link>
            ))}
          </div>
        </section>
      )}
      <p className="privacy-note">
        This is a public review profile. Study sessions and friend availability
        are shared separately.
      </p>
      {data.reviews.length ? (
        <ReviewFeed
          reviews={data.reviews.map((r) => ({
            ...r,
            name: data.user.name,
            handle: data.user.handle,
          }))}
        />
      ) : (
        <Empty title="A little room for a first review">
          There are no public reviews here yet.
        </Empty>
      )}
    </>
  );
}
