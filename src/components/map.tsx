"use client";
import { useEffect, useRef, useState } from "react";
import type { SpotSummary } from "@/lib/types";
import "leaflet/dist/leaflet.css";
export default function SpotMap({
  spots,
  selected,
  onSelect,
}: {
  spots: SpotSummary[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<import("leaflet").Map | null>(null),
    layer = useRef<import("leaflet").LayerGroup | null>(null);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
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
        }).setView([39.7525, -105.2225], 15);
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
    void import("leaflet").then((L) => {
      layer.current?.clearLayers();
      for (const s of spots) {
        const marker = L.marker([s.lat, s.lng], {
          title: s.name,
          keyboard: true,
          icon: L.divIcon({
            className: "map-pin-wrapper",
            html: `<span class="map-pin ${selected === s.id ? "selected" : ""}">${s.category === "cafe" ? "☕" : s.category === "outdoor" ? "♧" : "⌂"}</span>`,
            iconSize: [42, 48],
            iconAnchor: [21, 48],
          }),
        });
        const tooltip = document.createElement("div");
        tooltip.textContent = s.name;
        marker
          .bindTooltip(tooltip, { direction: "top", offset: [0, -42] })
          .on("click", () => selectRef.current(s.id))
          .addTo(layer.current!);
      }
      if (selected) {
        const s = spots.find((s) => s.id === selected);
        if (s) map.current?.panTo([s.lat, s.lng], { animate: false });
      }
    });
  }, [spots, selected, ready]);
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
        · Golden, CO
      </span>
    </div>
  );
}
