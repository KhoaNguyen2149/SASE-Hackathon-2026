"use client";
import { useEffect, useRef, useState } from "react";
import type { DirectorySpot } from "@/lib/types";
import "leaflet/dist/leaflet.css";
export default function SpotMap({
  spots,
  selected,
  onSelect,
  friends = [],
}: {
  spots: DirectorySpot[];
  selected: string | null;
  onSelect: (id: string) => void;
  /** Friends who chose to share the venue of their current session. */
  friends?: { id: string; name: string; spot_id?: string }[];
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<import("leaflet").Map | null>(null),
    layer = useRef<import("leaflet").LayerGroup | null>(null);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const markers = useRef(new Map<string, import("leaflet").CircleMarker>());
  const previous = useRef<string | null>(null);
  const selectRef = useRef(onSelect);
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    let destroyed = false;
    void import("leaflet")
      .then((L) => {
        if (destroyed || !element.current) return;
        const instance = L.map(element.current, {
          scrollWheelZoom: false,
          zoomControl: true,
          preferCanvas: true,
        }).setView([39.0, -105.5], 7);
        map.current = instance;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        })
          .on("tileerror", () => setFailed(true))
          .addTo(instance);
        layer.current = L.layerGroup().addTo(instance);
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      destroyed = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !layer.current || !map.current) return;
      layer.current.clearLayers();
      markers.current.clear();
      const here = new Map<string, string[]>();
      for (const f of friends)
        if (f.spot_id)
          here.set(f.spot_id, [...(here.get(f.spot_id) || []), f.name]);
      for (const s of spots) {
        const names = here.get(s.id);
        const marker = L.circleMarker([s.lat, s.lng], {
          radius: names ? 9 : 6,
          color: names ? "#b5642f" : "#285547",
          fillColor: names
            ? "#efb066"
            : s.category === "cafe"
              ? "#efb066"
              : s.category === "outdoor"
                ? "#91a47b"
                : "#6e9ba0",
          fillOpacity: 0.9,
          weight: names ? 4 : 2,
        });
        markers.current.set(s.id, marker);
        const tooltip = document.createElement("div");
        tooltip.textContent = s.name;
        if (names) {
          const who = document.createElement("small");
          who.textContent =
            names.length > 2
              ? `${names.slice(0, 2).join(", ")} and ${names.length - 2} more here now`
              : `${names.join(" and ")} here now`;
          tooltip.appendChild(document.createElement("br"));
          tooltip.appendChild(who);
        }
        marker
          .bindTooltip(tooltip, { direction: "top", offset: [0, -42] })
          .on("click", () => selectRef.current(s.id))
          .addTo(layer.current!);
      }
      if (spots.length && map.current)
        map.current.fitBounds(
          L.latLngBounds(spots.map((s) => [s.lat, s.lng] as [number, number])),
          { padding: [30, 30], maxZoom: 15, animate: false },
        );
    });
    return () => {
      cancelled = true;
    };
  }, [spots, ready, friends]);
  useEffect(() => {
    const base = (id: string) =>
      friends.some((f) => f.spot_id === id) ? 9 : 6;
    if (previous.current)
      markers.current.get(previous.current)?.setRadius(base(previous.current));
    const marker = selected ? markers.current.get(selected) : undefined;
    marker?.setRadius(12);
    previous.current = selected;
  }, [selected, ready, friends]);
  return (
    <div className="map-container">
      <div
        ref={element}
        className="map-canvas"
        role="region"
        aria-label="Study spot map. The same spots are available in the list."
      />
      {failed && (
        <div className="map-fallback">
          Map tiles are unavailable. All spots are still available in the list.
        </div>
      )}
      <span className="map-label">
        {spots.some((s) => s.demo) ? "Illustrative sample pins" : "Study spots"}{" "}
        · Colorado
        {friends.some((f) => f.spot_id) && (
          <em> · ringed pins have a friend there now</em>
        )}
      </span>
    </div>
  );
}
