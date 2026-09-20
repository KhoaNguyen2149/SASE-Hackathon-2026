import type { DatabaseSync } from "node:sqlite";
import snapshot from "@/data/colorado.json";
export function seedColorado(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE version=4").get()) {
    seedPhotos(db);
    return;
  }
  const insert = db.prepare(
    `INSERT OR IGNORE INTO spots(id,name,category,description,address,lat,lng,timezone,power,wifi,coffee,noise,access,access_note,hours,website,accessibility,image,demo,published,source,mapped,city,imported_at) VALUES(?,?,?,?,?,?,?,'America/Denver','unknown',?,?,0,?,?,'{}',?,?,?,0,1,?,1,?,?)`,
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const v of snapshot.venues) {
      const label =
        v.category === "outdoor"
          ? "park"
          : v.category === "other"
            ? "community space"
            : v.category === "coworking"
              ? "coworking space"
              : v.category;
      insert.run(
        v.id,
        v.name,
        v.category,
        `${v.name} is mapped as a ${label}${v.city ? " in " + v.city : " in Colorado"}. This community-sourced listing is a place to explore; seating, study suitability, current access, and opening hours need confirmation.`,
        v.address,
        v.lat,
        v.lng,
        v.wifi,
        v.category === "cafe" ? "sold_on_site" : "unknown",
        v.access,
        v.access === "purchase_expected"
          ? "A purchase is normally expected at a cafe. Ask about laptop use and length of stay."
          : v.access === "membership"
            ? "Ask the venue about membership, day passes, and workspace availability."
            : "Confirm public access and any restrictions before visiting. A map listing is not permission to enter.",
        v.website,
        v.wheelchair === "yes"
          ? "OpenStreetMap contributors tag wheelchair access; confirm your specific needs."
          : v.wheelchair === "no"
            ? "OpenStreetMap contributors tag this as not wheelchair accessible."
            : "Not yet verified",
        v.category === "cafe"
          ? "cafe"
          : v.category === "outdoor"
            ? "outdoor"
            : v.category === "coworking"
              ? "studio"
              : "library",
        `OpenStreetMap contributors, ODbL 1.0. https://www.openstreetmap.org/${v.osm_type}/${v.osm_id} · Snapshot ${snapshot.snapshot.slice(0, 10)}. Community map point, not an inspected entrance.${v.hours_text ? " Reported hours (not independently verified): " + v.hours_text : ""}`,
        v.city,
        Date.parse(snapshot.snapshot),
      );
    }
    db.exec(
      "INSERT OR IGNORE INTO schema_migrations VALUES(4,unixepoch()*1000);COMMIT",
    );
    seedPhotos(db);
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

function seedPhotos(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE version=6").get())
    return;
  const update = db.prepare(
    "UPDATE spots SET photo_url=?,photo_credit=?,photo_source=? WHERE id=?",
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const venue of snapshot.venues) {
      if ("photo" in venue && venue.photo) {
        const p = venue.photo;
        update.run(p.url, p.credit, p.source, venue.id);
      }
    }
    db.exec("INSERT INTO schema_migrations VALUES(6,unixepoch()*1000);COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
