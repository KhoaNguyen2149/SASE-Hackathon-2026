"use client";
import Link from "next/link";
import { VenuePhoto, PhotoCredit } from "./venue-photo";
import {
  ArrowUpRight,
  Coffee,
  Heart,
  MapPin,
  Star,
  Volume1,
  Wifi,
  Zap,
} from "lucide-react";
import type { DirectorySpot } from "@/lib/types";
import { useApp } from "./provider";
import { noiseLabels, crowdLabels } from "./ui";
export const categoryNames: Record<string, string> = {
  library: "Library",
  cafe: "Coffee shop",
  campus_space: "Campus space",
  outdoor: "Outdoors",
  coworking: "Workspace",
  other: "Study spot",
};
export function SpotCard({
  spot,
  compact = false,
  onHover,
}: {
  spot: DirectorySpot;
  compact?: boolean;
  onHover?: (id: string) => void;
}) {
  const { mutate, requireAuth, busy } = useApp();
  return (
    <article
      className={`spot-card ${compact ? "compact" : ""}`}
      onMouseEnter={() => onHover?.(spot.id)}
      onFocus={() => onHover?.(spot.id)}
    >
      <Link
        href={"/spots/" + spot.id}
        className="spot-image"
        tabIndex={-1}
        aria-hidden="true"
      >
        <VenuePhoto spot={spot} />
        <span className="image-category">{categoryNames[spot.category]}</span>
      </Link>
      <button
        className={`save-button ${spot.saved ? "saved" : ""}`}
        aria-label={`${spot.saved ? "Unsave" : "Save"} ${spot.name}`}
        aria-pressed={spot.saved}
        disabled={busy}
        onClick={() => {
          if (requireAuth())
            void mutate(
              `spots/${spot.id}/save`,
              { saved: !spot.saved },
              spot.saved
                ? "Removed from saved spots."
                : "A good spot, saved for later.",
            );
        }}
      >
        <Heart size={18} fill={spot.saved ? "currentColor" : "none"} />
      </button>
      <PhotoCredit spot={spot} />
      <div className="spot-card-content">
        <div className="spot-meta">
          <span className={`open-label ${spot.open === false ? "closed" : ""}`}>
            <span className="status-dot" />
            {spot.open === null
              ? "Hours unknown"
              : spot.open
                ? "Open for your visit"
                : "Closed for this visit"}
          </span>
          {spot.rating !== null ? (
            <span className="rating">
              <Star size={13} fill="currentColor" />
              {spot.rating.toFixed(1)} <small>({spot.review_count})</small>
            </span>
          ) : (
            <span className="muted tiny">New to DeskHop</span>
          )}
        </div>
        <Link className="spot-name" href={"/spots/" + spot.id}>
          <h3>{spot.name}</h3>
          <ArrowUpRight size={18} />
        </Link>
        <p className="spot-address">
          <MapPin size={13} />
          {spot.distance !== undefined
            ? `${spot.distance.toFixed(1)} km away · `
            : ""}
          {spot.address}
        </p>
        <p className="spot-description">{spot.description}</p>
        <div className="amenity-tags">
          <span>
            <Volume1 size={14} />
            {spot.noise
              ? `${noiseLabels[spot.noise - 1]} ${spot.demo ? "setting" : "policy"}`
              : "Noise not verified"}
          </span>
          {["many", "some"].includes(spot.power) && (
            <span>
              <Zap size={13} />
              Outlets
            </span>
          )}
          {spot.coffee.includes("on_site") ? (
            <span>
              <Coffee size={14} />
              Coffee
            </span>
          ) : spot.wifi === "yes" ? (
            <span>
              <Wifi size={14} />
              Wi-Fi
            </span>
          ) : null}
        </div>
        <div className="spot-card-bottom">
          <span className="conditions-label">
            <span
              className={`status-dot ${spot.conditions.state !== "recent_reports" ? "neutral" : ""}`}
            />
            {spot.conditions.state === "recent_reports"
              ? crowdLabels[spot.conditions.level! - 1]
              : spot.conditions.state === "conflicting_reports"
                ? "Mixed recent reports"
                : "No recent crowd reports"}
          </span>
          {spot.rooms > 0 && (
            <span className="room-label">
              {spot.demo ? "Demo rooms" : "Bookable rooms"}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
