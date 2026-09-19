"use client";
import Link from "next/link";
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
    following: boolean;
    reviews: Review[];
  }>(`profiles/${handle}`);
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;
  const own = app?.user?.id === data.user.id;
  return (
    <>
      <div className="public-profile-header">
        <Avatar name={data.user.name} size="large" />
        <div>
          <p className="eyebrow">A LITTLE COMMUNITY KNOWLEDGE</p>
          <h1>{data.user.name}</h1>
          <p>
            @{data.user.handle} · {data.reviews.length} public{" "}
            {data.reviews.length === 1 ? "review" : "reviews"}
          </p>
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
