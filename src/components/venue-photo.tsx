"use client";
import { useState } from "react";
import type { Spot } from "@/lib/types";
export function VenuePhoto({
  spot,
  detail = false,
}: {
  spot: Pick<
    Spot,
    "name" | "demo" | "photo_url" | "photo_credit" | "photo_source"
  >;
  detail?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const photo = !!spot.photo_url && !failed;
  return (
    <>
      {photo ? (
        <img
          src={spot.photo_url}
          alt={detail ? `${spot.name}: location photograph` : ""}
          loading={detail ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="venue-photo-placeholder">
          <span>
            {spot.demo ? "Sample venue" : "Location photo not available"}
          </span>
          <small>
            {spot.demo
              ? "Fictional demonstration spot"
              : "View the venue website or map for more details"}
          </small>
        </div>
      )}
      {photo && detail && (
        <span className="image-caption">
          Location photograph; may not reflect current conditions
        </span>
      )}
    </>
  );
}
export function PhotoCredit({
  spot,
}: {
  spot: Pick<Spot, "photo_url" | "photo_credit" | "photo_source">;
}) {
  if (!spot.photo_url || !spot.photo_source) return null;
  return (
    <p className="photo-credit">
      <a href={spot.photo_source} target="_blank" rel="noreferrer">
        Photo: {spot.photo_credit}. Source and license
      </a>
    </p>
  );
}
