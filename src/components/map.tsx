"use client";
import { useEffect, useRef, useState } from "react";
import type { DirectorySpot } from "@/lib/types";
import "leaflet/dist/leaflet.css";
export default function SpotMap({
  spots,
  selected,
  onSelect,
}: {
  spots: DirectorySpot[];
  selected: string | null;
  onSelect: (id: string) => void;
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
      for (const s of spots) {
        const marker = L.circleMarker([s.lat, s.lng], {
          radius: 6,
          color: "#285547",
          fillColor:
            s.category === "cafe"
              ? "#efb066"
              : s.category === "outdoor"
                ? "#91a47b"
                : "#6e9ba0",
          fillOpacity: 0.9,
          weight: 2,
        });
        markers.current.set(s.id, marker);
        const tooltip = document.createElement("div");
        tooltip.textContent = s.name;
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
  }, [spots, ready]);
  useEffect(() => {
    if (previous.current) markers.current.get(previous.current)?.setRadius(6);
    const marker = selected ? markers.current.get(selected) : undefined;
    marker?.setRadius(10);
    previous.current = selected;
  }, [selected, ready]);
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
      </span>
    </div>
  );
}
