import { backup } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "../src/server/db";
const dir = resolve("data/backups");
mkdirSync(dir, { recursive: true });
const destination = resolve(
  dir,
  `deskhop-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
);
await backup(db(), destination);
console.log(`Consistent SQLite backup saved: ${destination}`);
