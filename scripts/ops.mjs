import { DatabaseSync, backup } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
const [operation, value] = process.argv.slice(2);
const db = new DatabaseSync(
  process.env.DATABASE_PATH || "./data/deskhop.sqlite",
);
db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
if (operation === "grant-admin" && value) {
  const user = db
    .prepare("SELECT id,verified FROM users WHERE email=?")
    .get(value.toLowerCase());
  if (!user?.verified)
    throw new Error(
      "Register and verify the account before granting administration access.",
    );
  db.exec("BEGIN IMMEDIATE");
  db.prepare("UPDATE users SET role='admin' WHERE id=?").run(user.id);
  db.prepare("INSERT INTO audit VALUES(?,?,?,?,?,?)").run(
    randomUUID(),
    user.id,
    "admin:grant",
    user.id,
    "Granted by server operator through the administration CLI.",
    Date.now(),
  );
  db.exec("COMMIT");
  console.log("Administrator role granted.");
} else if (operation === "backup") {
  const dest = resolve(
    value ||
      `./data/backups/deskhop-${new Date().toISOString().replaceAll(":", "-")}.sqlite`,
  );
  mkdirSync(dirname(dest), { recursive: true });
  await backup(db, dest);
  console.log("Consistent database backup saved to", dest);
} else {
  console.error(
    "Usage: node scripts/ops.mjs grant-admin account@example.com | backup [destination.sqlite]",
  );
  process.exitCode = 1;
}
db.close();
