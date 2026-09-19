import type { DatabaseSync } from "node:sqlite";
const venues = [
  [
    "aspen-reading-room",
    "Aspen Reading Room",
    "library",
    "A little room for big ideas.",
    "Tall windows, generous desks, and a dedicated quiet floor. Settle into a window seat and give your next idea some space.",
    "Sample campus · west quad",
    39.7511,
    -105.2233,
    "many",
    "yes",
    "none",
    1,
    "public",
    "Sample public reading room. No real-world access is implied.",
    "library",
    4,
  ],
  [
    "juniper-coffee",
    "Juniper & Co.",
    "cafe",
    "Your coffee, with a side of focus.",
    "A warm neighborhood coffeehouse with long communal tables, tucked-away corners, and a mellow afternoon rhythm.",
    "Sample downtown · Washington Avenue",
    39.7558,
    -105.2212,
    "some",
    "yes",
    "sold_on_site",
    3,
    "purchase_expected",
    "Sample venue. A drink purchase would be expected.",
    "cafe",
    4,
  ],
  [
    "the-study-hall",
    "The Study Hall",
    "campus_space",
    "Better ideas happen together.",
    "Whiteboards, movable seating, and bookable rooms made for the kind of problem you solve together.",
    "Sample campus · central commons",
    39.7503,
    -105.2203,
    "many",
    "yes",
    "none",
    3,
    "public",
    "Demo rooms only. Reservations do not book a real campus room.",
    "study",
    8,
  ],
  [
    "clear-creek-corner",
    "Clear Creek Corner",
    "outdoor",
    "A fresh perspective, outside.",
    "Take your reading outdoors with shady picnic tables and a little room to breathe. Best for a screen-free study session.",
    "Sample riverside · north path",
    39.7571,
    -105.2254,
    "none",
    "no",
    "none",
    2,
    "public",
    "Sample outdoor space. Weather and access are not monitored.",
    "outdoor",
    4,
  ],
  [
    "paper-and-pine",
    "Paper & Pine",
    "cafe",
    "Turn the page. Take a sip.",
    "An intimate bookshop cafe with soft light and small tables. A good fit for reading, writing, and solo afternoons.",
    "Sample downtown · 13th Street",
    39.7532,
    -105.2173,
    "some",
    "yes",
    "sold_on_site",
    2,
    "purchase_expected",
    "Sample venue. A drink purchase would be expected.",
    "bookshop",
    2,
  ],
  [
    "north-light-studio",
    "North Light Studio",
    "coworking",
    "Make room for your next project.",
    "An airy workspace with large worktables and reservable team rooms. Bring a project, a friend, and a fresh notebook.",
    "Sample north campus · innovation walk",
    39.7548,
    -105.2274,
    "many",
    "yes",
    "free_on_site",
    2,
    "public",
    "Demo workspace and inventory; not a real venue.",
    "studio",
    6,
  ],
] as const;
export function seed(db: DatabaseSync) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO spots(id,name,category,description,address,lat,lng,power,wifi,coffee,noise,access,access_note,hours,image,demo,source,group_size) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
  );
  const hours = JSON.stringify(
    Object.fromEntries(
      Array.from({ length: 7 }, (_, day) => [day, [[480, 1260]]]),
    ),
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const [
      id,
      name,
      category,
      ,
      description,
      address,
      lat,
      lng,
      power,
      wifi,
      coffee,
      noise,
      access,
      accessNote,
      image,
      size,
    ] of venues) {
      insert.run(
        id,
        name,
        category,
        description,
        address,
        lat,
        lng,
        power,
        wifi,
        coffee,
        noise,
        access,
        accessNote,
        hours,
        image,
        "DeskHop fictional sample catalog. All facts and map pins are illustrative.",
        size,
      );
    }
    const room = db.prepare(
      "INSERT OR IGNORE INTO rooms(id,spot_id,name,capacity) VALUES(?,?,?,?)",
    );
    room.run("aspen-room-a", "aspen-reading-room", "Window Room", 4);
    room.run("study-room-a", "the-study-hall", "Room for Four", 4);
    room.run("study-room-b", "the-study-hall", "Big Ideas Room", 8);
    room.run("studio-room-a", "north-light-studio", "North Room", 6);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
