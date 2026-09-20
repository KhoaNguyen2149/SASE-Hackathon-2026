"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  BookOpen,
  Check,
  ChevronDown,
  Coffee,
  Compass,
  Heart,
  LayoutGrid,
  LocateFixed,
  Map,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useApp, useResource } from "./provider";
import { Empty, ErrorState, Loading, Modal, PageTitle } from "./ui";
import { SpotCard } from "./spot-card";
import { HeroArt } from "./hero-art";
import type { DirectorySpot, Friend } from "@/lib/types";
const SpotMap = dynamic(() => import("./map"), {
  ssr: false,
  loading: () => <Loading />,
});
type Filters = {
  power: boolean;
  quiet: boolean;
  coffee: boolean;
  open: boolean;
  rooms: boolean;
  free: boolean;
  group: number;
};
const initial: Filters = {
  power: false,
  quiet: false,
  coffee: false,
  open: false,
  rooms: false,
  free: false,
  group: 1,
};
function distance(a: number, b: number, c: number, d: number) {
  const rad = Math.PI / 180;
  const x =
    Math.sin(((c - a) * rad) / 2) ** 2 +
    Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((d - b) * rad) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export function Discover({ saved = false }: { saved?: boolean }) {
  const router = useRouter(),
    params = useSearchParams();
  const catalogMode = params.get("catalog") === "sample" ? "sample" : "real";
  const { data: app, toast, now } = useApp();
  const [query, setQuery] = useState(""),
    [city, setCity] = useState(""),
    [photosOnly, setPhotosOnly] = useState(false),
    [pageLimit, setPageLimit] = useState({ key: "", count: 48 }),
    [category, setCategory] = useState("all"),
    [filters, setFilters] = useState<Filters>(initial),
    [view, setView] = useState("grid"),
    [showFilters, setShowFilters] = useState(false),
    [sort, setSort] = useState("recommended"),
    [duration, setDuration] = useState(60),
    [selected, setSelected] = useState<string | null>(null),
    [location, setLocation] = useState<{ lat: number; lng: number } | null>(
      null,
    ),
    [radius, setRadius] = useState(3),
    [locating, setLocating] = useState(false),
    [smart, setSmart] = useState(false),
    [smartText, setSmartText] = useState(""),
    [smartExplanation, setSmartExplanation] = useState("");
  const { data, error, loading } = useResource<{ spots: DirectorySpot[] }>(
    `spots?duration=${duration}`,
  );
  const spots = useMemo(() => {
    let list = (data?.spots || [])
      .filter(
        (s) =>
          (!saved || s.saved) &&
          (saved || (catalogMode === "sample" ? !!s.demo : !s.demo)) &&
          (category === "all" || category === s.category) &&
          (!city || s.city === city) &&
          (!photosOnly || !!s.photo_url) &&
          (!query ||
            `${s.name} ${s.description} ${s.address} ${s.category}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (!filters.power || ["many", "some"].includes(s.power)) &&
          (!filters.quiet || (s.noise > 0 && s.noise <= 2)) &&
          (!filters.coffee || s.coffee.includes("on_site")) &&
          (!filters.open || s.open === true) &&
          (!filters.rooms || s.rooms > 0) &&
          (!filters.free || s.access === "public") &&
          (filters.group <= 1 ||
            (s.group_size !== null && s.group_size >= filters.group)),
      )
      .map((s) => ({
        ...s,
        distance:
          location && s.mapped
            ? distance(location.lat, location.lng, s.lat, s.lng)
            : undefined,
      }));
    if (location)
      list = list.filter(
        (s) => s.distance !== undefined && s.distance <= radius,
      );
    list.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "quiet"
          ? (a.noise || 6) - (b.noise || 6)
          : sort === "rating"
            ? (b.rating || 0) - (a.rating || 0)
            : location
              ? a.distance! - b.distance!
              : Number(b.open) - Number(a.open) ||
                (a.noise || 6) - (b.noise || 6) ||
                Number(!!b.verified_at) - Number(!!a.verified_at),
    );
    return list;
  }, [
    data,
    saved,
    category,
    query,
    filters,
    sort,
    location,
    radius,
    catalogMode,
    city,
    photosOnly,
  ]);
  const mappedSpots = useMemo(() => spots.filter((s) => s.mapped), [spots]);
  // Friends appear at the venue they chose to share, never at a live position.
  const social = useResource<{ friends: Friend[] }>(
    app?.user && view === "map" ? "friends" : null,
  );
  const friendsHere = useMemo(
    () =>
      (social.data?.friends || []).filter(
        (f) => f.spot_id && f.expires_at! > now,
      ),
    [social.data, now],
  );
  const friendsOffMap = friendsHere.filter(
    (f) => !mappedSpots.some((s) => s.id === f.spot_id),
  );
  const resultKey = JSON.stringify([
    query,
    category,
    filters,
    sort,
    location,
    radius,
    catalogMode,
    city,
    photosOnly,
  ]);
  const shown = pageLimit.key === resultKey ? pageLimit.count : 48;
  const visibleSpots = spots.slice(0, shown);
  const cities = [
    ...new Set(
      (data?.spots || []).filter((s) => !s.demo && s.city).map((s) => s.city!),
    ),
  ].sort();
  const activeCount = Object.entries(filters).filter(([key, value]) =>
    key === "group" ? Number(value) > 1 : !!value,
  ).length;
  // Resetting only helps when something is actually narrowing the results.
  const narrowed =
    activeCount > 0 ||
    category !== "all" ||
    photosOnly ||
    !!query.trim() ||
    !!city ||
    !!location;
  function locate() {
    if (!navigator.geolocation) {
      toast(
        "Your browser does not support location. You can still explore the campus.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast(
          "Showing distance from your location. Your coordinates stay in this browser.",
        );
      },
      () => {
        setLocating(false);
        toast(
          "Location wasn’t available. You can still browse across Colorado.",
        );
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }
  function smartSearch() {
    const q = smartText.toLowerCase();
    const next = {
      ...initial,
      power: /outlet|power|plug|charg/.test(q),
      quiet: /quiet|silent|focus/.test(q),
      coffee: /coffee|cafe|café/.test(q),
      rooms: /room|book|reserv/.test(q),
      open: /open/.test(q),
      free: /free/.test(q),
      group: Math.min(
        8,
        Math.max(1, Number(q.match(/(?:for|group of)\s+(\d+)/)?.[1] || 1)),
      ),
    };
    setFilters(next);
    setCategory("all");
    setQuery("");
    setSmart(false);
    const supported = Object.entries(next)
      .filter(([k, v]) => (k === "group" ? Number(v) > 1 : !!v))
      .map(([k, v]) =>
        k === "group"
          ? `group size ${v}`
          : {
              power: "outlets",
              quiet: "quiet setting",
              coffee: "on-site coffee",
              rooms: "bookable rooms",
              open: "open for your visit",
              free: "free seating",
            }[k],
      );
    setSmartExplanation(
      supported.length
        ? `Applied: ${supported.join(", ")}. Review and adjust these filters. Dates and exact times need to be chosen in the room booking flow.`
        : "No supported preferences found. Try “quiet with coffee and outlets,” or choose filters below.",
    );
  }
  return (
    <>
      {saved ? (
        <PageTitle
          eyebrow="YOUR PERSONAL SHORTLIST"
          title="Good spots, kept close."
          description="A place for the places you want to come back to."
        />
      ) : (
        <section className="discover-hero">
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span className="status-dot" /> A LITTLE FOCUS STARTS HERE
            </div>
            <h1>
              Find your place.
              <br />
              <span>Make a little progress.</span>
            </h1>
            <p>
              A quiet corner, a coffee-fueled afternoon, or a table for your
              whole crew. Your next study spot is closer than you think.
            </p>
            <div className="hero-location">
              <MapPinIcon />
              <span>
                Exploring <strong>Colorado</strong>
              </span>
              <span className="location-divider" />
              <button onClick={locate} disabled={locating}>
                <LocateFixed size={14} />
                {locating
                  ? "Locating…"
                  : location
                    ? "Location on"
                    : "Use my location"}
              </button>
            </div>
          </div>
          <HeroArt />
        </section>
      )}
      {!saved && (
        <div className="catalog-switch">
          <div className="segmented">
            <button
              className={catalogMode === "real" ? "active" : ""}
              onClick={() => {
                router.replace("/discover?catalog=real");
                setFilters(initial);
              }}
            >
              Colorado venues
            </button>
            <button
              className={catalogMode === "sample" ? "active" : ""}
              onClick={() => {
                router.replace("/discover?catalog=sample");
                setFilters(initial);
              }}
            >
              Sample campus
            </button>
          </div>
          <p>
            {catalogMode === "real"
              ? "OpenStreetMap and venue sources. Confirm access and study amenities before visiting."
              : "Fictional spots with demo rooms to try the complete booking flow."}
          </p>
        </div>
      )}
      {!saved && (
        <section className="intent-section" aria-label="Study preferences">
          <span className="intent-label">What’s the plan?</span>
          <button
            className={`intent ${filters.quiet && !filters.coffee ? "selected" : ""}`}
            onClick={() => {
              setFilters({ ...initial, quiet: true, power: true });
              setCategory("all");
            }}
          >
            <BookOpen size={17} />
            Solo focus<span>A little peace & quiet</span>
          </button>
          <button
            className={`intent ${filters.group > 1 ? "selected" : ""}`}
            onClick={() => {
              setFilters({ ...initial, group: 4 });
              setCategory("all");
            }}
          >
            <Users size={18} />
            Group work<span>Better together</span>
          </button>
          <button
            className={`intent ${filters.coffee ? "selected" : ""}`}
            onClick={() => {
              setFilters({ ...initial, coffee: true });
              setCategory("all");
            }}
          >
            <Coffee size={18} />
            Coffee & study<span>Find your favorite corner</span>
          </button>
        </section>
      )}
      {!saved && catalogMode === "real" && (
        <div className="directory-controls">
          <label className="field">
            City or town
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">All Colorado</option>
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="photo-filter">
            <input
              type="checkbox"
              checked={photosOnly}
              onChange={(e) => setPhotosOnly(e.target.checked)}
            />{" "}
            With location photos
          </label>
          <p className="fine-print">
            {(data?.spots || []).filter((s) => !s.demo).length.toLocaleString()}{" "}
            mapped and sourced places. Some records have no city tag; choose All
            Colorado to include them.{" "}
            <a download href="/api/catalog/download">
              Download open map data
            </a>{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              Copyright OpenStreetMap contributors - ODbL
            </a>
          </p>
        </div>
      )}
      <div className="discovery-search">
        <label className="search-box">
          <Search size={20} />
          <input
            aria-label="Search study spots"
            placeholder="A spot, a neighborhood, a little inspiration…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="icon-button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </label>
        <button
          className={`button secondary filter-button ${activeCount ? "selected" : ""}`}
          onClick={() => setShowFilters(true)}
        >
          <SlidersHorizontal size={17} />
          Filters
          {activeCount > 0 && (
            <span className="count-badge">{activeCount}</span>
          )}
        </button>
        <button className="button smart-button" onClick={() => setSmart(true)}>
          <Sparkles size={17} />
          <span>Help me find a spot</span>
        </button>
      </div>
      {smartExplanation && (
        <div className="notice-banner">
          <Sparkles size={18} />
          <span>{smartExplanation}</span>
          <button
            className="icon-button"
            aria-label="Dismiss search explanation"
            onClick={() => setSmartExplanation("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="category-row" role="group" aria-label="Spot category">
        {[
          ["all", "All spots", Compass],
          ["library", "Libraries", BookOpen],
          ["cafe", "Coffee shops", Coffee],
          ["campus_space", "Campus spaces", Users],
          ["outdoor", "Outdoors", Map],
        ].map(([key, label, Icon]) => {
          const C = Icon as typeof Compass;
          return (
            <button
              key={key as string}
              className={`category-tab ${category === key ? "active" : ""}`}
              aria-pressed={category === key}
              onClick={() => setCategory(key as string)}
            >
              <C size={16} />
              {label as string}
            </button>
          );
        })}
      </div>
      {activeCount > 0 && (
        <div className="active-filters">
          {filters.quiet && <span>Quiet setting</span>}
          {filters.power && <span>Outlets</span>}
          {filters.coffee && <span>Coffee on site</span>}
          {filters.open && <span>Open for {duration} min</span>}
          {filters.rooms && <span>Rooms</span>}
          {filters.free && <span>Free seating</span>}
          {filters.group > 1 && (
            <span>Tables for {filters.group} · availability unknown</span>
          )}
          <button className="text-button" onClick={() => setFilters(initial)}>
            Clear filters <X size={12} />
          </button>
        </div>
      )}
      <div className="results-heading">
        <div>
          <h2>
            {saved ? "Your saved spots" : "Somewhere that feels just right"}
            <span>{spots.length}</span>
          </h2>
          <p>
            {location
              ? `Within ${radius} km of your location`
              : "Thoughtful spaces for whatever you’re working on."}
          </p>
        </div>
        <div className="result-controls">
          <label className="sort-label">
            <span className="sr-only">Sort spots</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recommended">
                {location ? "Nearest first" : "Recommended"}
              </option>
              <option value="quiet">Quietest setting</option>
              <option value="rating">Best reviewed</option>
              <option value="name">Name A–Z</option>
            </select>
            <ChevronDown size={14} />
          </label>
          <div className="view-toggle" aria-label="Results view">
            <button
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              className={view === "grid" ? "active" : ""}
              onClick={() => setView("grid")}
            >
              <LayoutGrid size={17} />
            </button>
            <button
              aria-label="Map view"
              aria-pressed={view === "map"}
              className={view === "map" ? "active" : ""}
              onClick={() => setView("map")}
            >
              <Map size={17} />
            </button>
          </div>
        </div>
      </div>
      {error ? (
        <ErrorState message={error} />
      ) : !data && loading ? (
        <Loading />
      ) : saved && !app?.user ? (
        <Empty
          icon={<Heart />}
          title="Keep your favorite places close"
          action={
            <Link className="button" href="/login?next=/saved">
              Sign in to save spots
            </Link>
          }
        >
          Your personal shortlist will be ready whenever you are.
        </Empty>
      ) : spots.length === 0 ? (
        <Empty
          title={
            saved
              ? "Your next favorite is out there"
              : "Let’s open up the possibilities"
          }
          action={
            <div className="button-row">
              {narrowed && (
                <button
                  className="button"
                  onClick={() => {
                    setFilters(initial);
                    setCategory("all");
                    setQuery("");
                    setLocation(null);
                    setCity("");
                    setPhotosOnly(false);
                  }}
                >
                  Reset search
                </button>
              )}
              {location && radius < 25 && (
                <button
                  className="button secondary"
                  onClick={() => setRadius(25)}
                >
                  Search within 25 km
                </button>
              )}
              {saved && (
                <Link
                  className={`button ${narrowed ? "secondary" : ""}`}
                  href="/discover"
                >
                  Explore spots
                </Link>
              )}
            </div>
          }
        >
          {saved
            ? "Tap the heart on a spot to keep it for later."
            : "No spots match all of those preferences. Try fewer filters or a wider area."}
        </Empty>
      ) : view === "grid" ? (
        <div className="spot-grid">
          {visibleSpots.map((s) => (
            <SpotCard key={s.id} spot={s} />
          ))}
        </div>
      ) : (
        <div className="map-results">
          <div className="map-result-list">
            {visibleSpots.map((s) => (
              <SpotCard key={s.id} spot={s} compact onHover={setSelected} />
            ))}
          </div>
          <div className="map-sticky">
            <SpotMap
              spots={mappedSpots}
              selected={selected}
              onSelect={setSelected}
              friends={friendsHere}
            />
            {friendsOffMap.length > 0 && (
              <div className="map-address-note">
                {friendsOffMap.length === 1
                  ? `${friendsOffMap[0].name} is at ${friendsOffMap[0].spot_name}, which your filters exclude.`
                  : `${friendsOffMap.length} friends are at venues your filters exclude.`}
              </div>
            )}
            {spots.some((s) => !s.mapped) && (
              <div className="map-address-note">
                Address-only venues are listed alongside the map. Pins and
                distances are withheld until coordinates are verified.
              </div>
            )}
            {selected && (
              <div className="map-preview">
                <strong>{spots.find((s) => s.id === selected)?.name}</strong>
                <Link href={"/spots/" + selected}>
                  See spot <ChevronDown size={14} />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
      {spots.length > shown && (
        <div className="load-more">
          <p>
            Showing {shown} of {spots.length.toLocaleString()} matching spots.
            The map includes all matches with coordinates.
          </p>
          <button
            className="button secondary"
            onClick={() => setPageLimit({ key: resultKey, count: shown + 48 })}
          >
            Show 48 more
          </button>
        </div>
      )}
      {!saved && (
        <div className="community-callout">
          <div className="callout-icon">
            <Users size={24} />
          </div>
          <div>
            <h3>Good spots are better when we share.</h3>
            <p>
              Your quick condition report helps the next person find their
              place.
            </p>
          </div>
          <span className="callout-doodle">↗</span>
        </div>
      )}
      {showFilters && (
        <Modal
          title="Find your kind of place"
          onClose={() => setShowFilters(false)}
        >
          <p className="muted">A few preferences make all the difference.</p>
          <div className="filter-options">
            {[
              [
                "quiet",
                "A quieter setting",
                "Posted or sample setting, separate from current noise.",
              ],
              [
                "power",
                "Somewhere to plug in",
                "Only spots with known outlets.",
              ],
              ["coffee", "Coffee on site", "A little fuel for your focus."],
              [
                "open",
                "Open for my entire visit",
                "Unknown hours will not match.",
              ],
              [
                "rooms",
                "A room I can reserve",
                "Availability is confirmed at booking.",
              ],
              ["free", "Free seating", "No purchase or membership expected."],
            ].map(([key, label, note]) => (
              <label className="check-card" key={key}>
                <input
                  type="checkbox"
                  checked={filters[key as keyof Filters] as boolean}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, [key]: e.target.checked }))
                  }
                />
                <span>
                  <strong>{label}</strong>
                  <small>{note}</small>
                </span>
              </label>
            ))}
          </div>
          <div className="form-grid">
            <label className="field">
              My visit
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {[30, 60, 90, 120, 180].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Group size
              <select
                value={filters.group}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, group: Number(e.target.value) }))
                }
              >
                {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                  <option value={n} key={n}>
                    {n === 1 ? "Just me" : `${n} people`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="fine-print">
            Group tables describe the furniture; they don’t guarantee adjacent
            seats. Visit starts now. Reserve a room to choose a future time.
          </p>
          <button className="button full" onClick={() => setShowFilters(false)}>
            <Check size={17} />
            Show matching spots
          </button>
        </Modal>
      )}
      {smart && (
        <Modal
          title="What would feel just right?"
          onClose={() => setSmart(false)}
        >
          <p className="muted">
            Tell us a few preferences. This free helper turns supported keywords
            into filters.
          </p>
          <label className="field">
            Your study plan
            <textarea
              rows={4}
              placeholder="Somewhere quiet with coffee and outlets for 2 people…"
              value={smartText}
              onChange={(e) => setSmartText(e.target.value)}
            />
          </label>
          <div className="suggestions">
            {[
              "Quiet with outlets",
              "Coffee for 2 people",
              "Book a group room",
            ].map((t) => (
              <button key={t} onClick={() => setSmartText(t)}>
                {t}
              </button>
            ))}
          </div>
          <p className="fine-print">
            Matches keywords, not an AI conversation. It doesn’t make
            reservations or infer unknown venue facts.
          </p>
          <button
            className="button full"
            disabled={!smartText.trim()}
            onClick={smartSearch}
          >
            <Sparkles size={17} />
            Find my kind of spot
          </button>
        </Modal>
      )}
    </>
  );
}
function MapPinIcon() {
  return (
    <span className="location-icon">
      <Map size={15} />
    </span>
  );
}
