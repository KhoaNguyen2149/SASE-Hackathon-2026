import type { DatabaseSync } from "node:sqlite";
const checked = Date.parse("2026-09-19T12:00:00Z");
const weekly = (open: number, close: number) =>
  JSON.stringify(
    Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => [i, [[open, close]]]),
    ),
  );
// Manually sourced from the venue's own website. Unverified amenities remain unknown.
// Coordinate placeholders are never displayed: mapped=0 excludes these records from maps/distances.
const venues = [
  {
    id: "golden-public-library",
    name: "Golden Library",
    category: "library",
    description:
      "A public library alongside Clear Creek with a quiet reading area and study rooms. Check the library’s own site for room reservations and holiday closures.",
    address: "1019 10th St, Golden, CO 80401",
    coffee: "unknown",
    wifi: "unknown",
    hours: JSON.stringify({
      "0": [[720, 1020]],
      "1": [[540, 1200]],
      "2": [[540, 1200]],
      "3": [[540, 1200]],
      "4": [[540, 1200]],
      "5": [[540, 1020]],
      "6": [[540, 1020]],
    }),
    website: "https://jeffcolibrary.org/locations/gn/",
    booking_url: "https://jeffcolibrary.org/locations/gn/",
    image: "library",
    access: "public",
    access_note:
      "Public library. Study and meeting room reservations follow JCPL’s own rules and are handled on its website. DeskHop has no authority over its inventory.",
    accessibility:
      "The library lists ADA-compliant public walkways, computer desks, and parking; confirm specific needs with the library.",
    source:
      "Official Golden Library page: https://jeffcolibrary.org/locations/gn/ — address, regular hours, quiet reading area, and external room booking information checked September 19, 2026. DeskHop has not inspected this venue. Outlet distribution, table capacity, and map coordinates are not verified.",
  },
  {
    id: "windy-saddle-cafe",
    name: "Windy Saddle Cafe",
    category: "cafe",
    description:
      "A downtown Golden cafe serving coffee, pastries, and meals. A possible coffee-and-reading stop; current noise, outlets, and seating availability have not been verified.",
    address: "1110 Washington Ave, Golden, CO 80403",
    coffee: "sold_on_site",
    wifi: "unknown",
    hours: JSON.stringify({
      "0": [[420, 1020]],
      "1": [[420, 960]],
      "2": [[420, 960]],
      "3": [[420, 960]],
      "4": [[420, 960]],
      "5": [[420, 1020]],
      "6": [[420, 1020]],
    }),
    website: "https://www.windysaddle.com/",
    booking_url: "",
    image: "cafe",
    access: "purchase_expected",
    access_note:
      "Commercial cafe; purchase expected. Confirm laptop and extended-stay policies with staff. Kitchen closes one hour before the cafe.",
    accessibility: "Not yet verified",
    source:
      "Official Windy Saddle Cafe website: https://www.windysaddle.com/ — address, posted hours, coffee service, and kitchen closing time checked September 19, 2026. Noise policy, Wi-Fi, outlets, seating arrangements, and map coordinates are not verified.",
  },
  {
    id: "humble-house-cafe",
    name: "Humble House Cafe",
    category: "cafe",
    description:
      "A Washington Avenue coffee shop with morning and afternoon opening hours. Visit the cafe’s own website for the menu and current details before settling in.",
    address: "1208 Washington Ave, Golden, CO 80401",
    coffee: "sold_on_site",
    wifi: "unknown",
    hours: weekly(420, 960),
    website: "https://humblehousecafe.com/contact",
    booking_url: "",
    image: "bookshop",
    access: "purchase_expected",
    access_note:
      "Commercial cafe; purchase expected. Ask staff about laptop use and extended stays. Posted kitchen hours end at 2 pm.",
    accessibility: "Not yet verified",
    source:
      "Official Humble House contact page: https://humblehousecafe.com/contact — address, daily 7 am–4 pm opening hours and 2 pm kitchen closure checked September 19, 2026. Wi-Fi, outlets, noise, seating capacity, accessibility, and coordinates are not verified.",
  },
  {
    id: "higher-grounds-golden",
    name: "Higher Grounds Cafe",
    category: "cafe",
    description:
      "A downtown cafe at 14th and Washington whose website welcomes focused study and small gatherings. Coffee, snacks, and an outdoor deck offer different ways to take a break.",
    address: "803 14th St, Golden, CO 80401",
    coffee: "sold_on_site",
    wifi: "unknown",
    hours: "{}",
    website: "https://highergroundsgolden.com/",
    booking_url: "",
    image: "cafe",
    access: "purchase_expected",
    access_note:
      "Commercial cafe; purchase expected. Published websites disagree on Sunday opening time, so confirm current hours directly. DeskHop does not infer a complete opening interval.",
    accessibility: "Not yet verified",
    source:
      "Official Higher Grounds site: https://highergroundsgolden.com/ — address, coffee, deck, and study-friendly description checked September 19, 2026. Another branded site, https://highergroundscafegolden.com/, lists a different Sunday start; hours are intentionally unknown until reconciled. Outlets, current noise, and coordinates are unverified.",
  },
];
export function seedRealCatalog(db: DatabaseSync) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const addClosures = !db
      .prepare("SELECT 1 FROM spots WHERE id=?")
      .get("golden-public-library");
    for (const venue of venues) {
      const row = {
        ...venue,
        lat: 0,
        lng: 0,
        mapped: 0,
        timezone: "America/Denver",
        power: "unknown",
        noise: 0,
        demo: 0,
        published: 1,
        verified_at: checked,
        group_size: null,
      };
      const keys = Object.keys(row);
      db.prepare(
        `INSERT OR IGNORE INTO spots(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
      ).run(...Object.values(row));
    }
    if (addClosures)
      for (const day of [
        "2026-10-05",
        "2026-11-11",
        "2026-11-26",
        "2026-11-27",
        "2026-12-24",
        "2026-12-25",
      ])
        db.prepare("INSERT OR IGNORE INTO closures VALUES(?,?,?)").run(
          "golden-public-library",
          day,
          "Closure listed on the official Golden Library location page.",
        );
    // The source lists an early closing on Dec 31. Until split-day exceptions are modeled,
    // conservatively treat that date as unavailable for the full-visit filter.
    if (addClosures)
      db.prepare("INSERT OR IGNORE INTO closures VALUES(?,?,?)").run(
        "golden-public-library",
        "2026-12-31",
        "Modified holiday hours: official site lists 5 pm closing. Check the venue website; automatic open-for-visit matching is withheld.",
      );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
