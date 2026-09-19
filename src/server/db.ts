import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { schema } from "./schema";
import { seed } from "./seed";
import { migrateSocial } from "./migrations";
import { seedColorado } from "./colorado-catalog";
import { seedRealCatalog } from "./real-catalog";

let instance: DatabaseSync | undefined;
export function db() {
  if (!instance) {
    const filename = process.env.DATABASE_PATH || "./data/deskhop.sqlite";
    if (filename !== ":memory:")
      mkdirSync(dirname(resolve(/* turbopackIgnore: true */ filename)), {
        recursive: true,
      });
    instance = new DatabaseSync(filename);
    instance.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
    instance.exec(schema);
    const columns = instance.prepare("PRAGMA table_info(spots)").all() as {
      name: string;
    }[];
    if (!columns.some((c) => c.name === "mapped"))
      instance.exec(
        "ALTER TABLE spots ADD COLUMN mapped INTEGER NOT NULL DEFAULT 1;",
      );
    instance.exec(
      "INSERT OR IGNORE INTO schema_migrations VALUES(2,unixepoch()*1000);",
    );
    migrateSocial(instance);
    if (process.env.SEED_COLORADO !== "false") seedColorado(instance);
    if (process.env.SEED_DEMO !== "false") seed(instance);
    if (process.env.SEED_REAL !== "false") seedRealCatalog(instance);
  }
  return instance;
}
export function one<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
  return db()
    .prepare(sql)
    .get(...params) as T | undefined;
}
export function all<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return db()
    .prepare(sql)
    .all(...params) as T[];
}
export function run(sql: string, ...params: SQLInputValue[]) {
  return db()
    .prepare(sql)
    .run(...params);
}
export function transaction<T>(fn: () => T): T {
  const conn = db();
  conn.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    conn.exec("COMMIT");
    return result;
  } catch (error) {
    conn.exec("ROLLBACK");
    throw error;
  }
}
