import type { Spot } from "./types";
export function directions(
  spot: Pick<Spot, "lat" | "lng" | "mapped" | "address" | "name">,
) {
  const destination = spot.mapped ? `${spot.lat},${spot.lng}` : spot.address;
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`,
    apple: `https://maps.apple.com/?daddr=${encodeURIComponent(destination)}&q=${encodeURIComponent(spot.name)}`,
  };
}
