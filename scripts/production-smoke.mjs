import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { DatabaseSync, backup } from "node:sqlite";

// Exercises the same standalone entry point used by the Docker image.
const directory = await mkdtemp(join(tmpdir(), "deskhop-production-"));
const database = join(directory, "production.sqlite");
const destination = join(directory, "backup.sqlite");
const base = "http://127.0.0.1:3200";
await cp("public", ".next/standalone/public", { recursive: true });
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
const server = spawn(
  process.execPath,
  [resolve(".next/standalone/server.js")],
  {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: "3200",
      HOSTNAME: "127.0.0.1",
      APP_URL: base,
      DATABASE_PATH: database,
      SMTP_HOST: "",
      FIREBASE_API_KEY: "",
      FIREBASE_SERVICE_ACCOUNT_JSON: "",
      STRIPE_SECRET_KEY: "",
      AI_API_KEY: "",
      SEED_DEMO: "true",
      SEED_REAL: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
let output = "";
server.stdout.on("data", (data) => {
  output += data;
});
server.stderr.on("data", (data) => {
  output += data;
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${output}`);
    try {
      ready = (await fetch(`${base}/api/health`)).ok;
    } catch {
      /* starting */
    }
    if (ready) break;
    await new Promise((done) => setTimeout(done, 250));
  }
  assert.ok(ready, `Server did not become ready: ${output}`);
  const page = await fetch(`${base}/discover`);
  assert.equal(page.status, 200);
  assert.ok(
    !page.headers.get("content-security-policy").includes("unsafe-eval"),
  );
  const html = await page.text();
  const script = html.match(/src="([^"]+\.js[^\"]*)"/)[1];
  assert.equal((await fetch(new URL(script, base))).status, 200);
  assert.equal((await fetch(`${base}/brand/deskhop-mark.svg`)).status, 200);
  const timings = [];
  let catalogBytes = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const started = performance.now();
    const catalogResponse = await fetch(`${base}/api/spots`);
    assert.equal(catalogResponse.status, 200);
    const text = await catalogResponse.text();
    timings.push(performance.now() - started);
    catalogBytes = Buffer.byteLength(text);
    const catalog = JSON.parse(text).data.spots;
    assert.ok(catalog.length >= 5000);
    assert.ok(catalog.filter((s) => s.photo_url).length >= 30);
  }
  timings.sort((a, b) => a - b);
  console.log(
    `Directory: ${catalogBytes} bytes, median ${timings[2].toFixed(1)}ms over five local production requests (not a load test).`,
  );
  const response = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({
      name: "Production Test",
      handle: "production_test",
      email: "production@example.test",
      password: "test-only-long-passphrase",
    }),
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error.code, "EMAIL_UNAVAILABLE");
  assert.ok(!JSON.stringify(body).includes("developmentLink"));
  const db = new DatabaseSync(database);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM users").get().n, 0);
  await backup(db, destination);
  db.close();
  const restored = new DatabaseSync(destination, { readOnly: true });
  assert.equal(
    restored.prepare("PRAGMA integrity_check").get().integrity_check,
    "ok",
  );
  assert.ok(restored.prepare("SELECT COUNT(*) n FROM spots").get().n >= 5000);
  restored.close();
  console.log(
    "Production smoke passed: standalone boot, assets, CSP, safe registration without SMTP, consistent backup integrity and catalog recovery.",
  );
} finally {
  const stopped = new Promise((done) => {
    if (server.exitCode !== null) done();
    else server.once("exit", done);
  });
  server.kill();
  await stopped;
  // directory comes directly from mkdtemp under the OS temporary directory.
  assert.ok(
    resolve(directory).startsWith(
      resolve(tmpdir()) + (process.platform === "win32" ? "\\" : "/"),
    ),
  );
  await rm(directory, { recursive: true, force: true });
}
