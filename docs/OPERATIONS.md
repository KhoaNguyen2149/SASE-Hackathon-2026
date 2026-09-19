# Operating DeskHop

## Runtime and data

Use Node 24.13+ on a single persistent server. The database uses SQLite WAL, foreign keys, a five-second busy timeout, transactional writes, and database triggers for overlapping reservations and incompatible active states. `DATABASE_PATH` must point at persistent local storage. Do not use shared network storage, autoscale independent replicas, or deploy this build with an ephemeral filesystem.

On startup, the app creates missing tables and applies additive schema changes. `schema_migrations` records schema versions. The source catalog and sample data use insert-if-missing seeds, preserving edited existing venue fields. Disabling `SEED_DEMO` or `SEED_REAL` prevents future seeding; it does not delete existing records. Unpublish sample venues and disable their rooms in Administration if removing the demonstration from an existing database.

## Configuration

| Variable | Meaning |
| --- | --- |
| `DATABASE_PATH` | Database file, default `./data/deskhop.sqlite` |
| `APP_URL` | Canonical browser origin including HTTPS; used for email links, origin checks, and secure cookies |
| `RENDER_EXTERNAL_URL` | Render-provided fallback when `APP_URL` is absent |
| `SEED_DEMO` | Set `false` to skip fictional catalog seeding |
| `SEED_REAL` | Set `false` to skip sourced Golden catalog seeding |
| `SMTP_HOST`, `SMTP_PORT` | SMTP endpoint; port 587 by default, implicit TLS on 465 |
| `SMTP_USER`, `SMTP_PASS` | SMTP credentials from the email provider, not the Google sign-in password |
| `SMTP_FROM` | Provider-approved sender, e.g. `DeskHop <hello@your-domain>` |

Environment files are gitignored. Host secrets belong in the hosting provider’s environment-secret controls. Never include live tokens in screenshots, logs, issue reports, or repository files. Registration, verification, and reset messages are transactional only; no marketing subscriptions are created by the application.

## Local production check

```powershell
npm run check
npx playwright install chromium
npm run test:e2e
npm start
```

Stop the development server first if it already uses port 3000. With no SMTP configured, production registration must return `503 EMAIL_UNAVAILABLE`; it must never return a development token. Test successful registration, verification, reset, and expired-link behavior with the actual production mail service before inviting users.

## Docker

Docker is optional and was not installed on the development machine. The image definition uses a non-root runtime user and Next.js standalone output.

```text
docker compose up --build -d
docker compose logs -f deskhop
```

Compose binds to loopback and persists a named volume. A public deployment needs a trusted TLS reverse proxy, correct `APP_URL`, and appropriate firewall rules. The process listens on `PORT` (default 3000); `/api/health` verifies database access. Do not enable a second process cluster to scale this release.

## Render launch procedure

The prepared blueprint uses a Starter web service and a 1 GB disk at `/app/data`, with manual deploys. As checked September 19, 2026, the listed base price is $7/month plus $0.25/GB/month for storage. Taxes, transfer, and other usage can add costs. Confirm current [pricing](https://render.com/pricing) and obtain owner approval before creating the paid service. Free web services cannot retain this SQLite database across deployments.

1. Review and push the application to the owner’s repository. Keep `.env.local`, databases, and test artifacts out of Git.
2. Create the service from `render.yaml`, confirm plan, disk, and spending settings, and set SMTP secrets. Do not enable paid add-ons without separate approval.
3. Deploy one instance. Confirm the persistent mount is writable by runtime user 1001 and `/api/health` succeeds.
4. Set `APP_URL` to the final HTTPS origin if using a custom domain; otherwise use Render’s supplied external URL.
5. Register and verify the operator account, then use the service shell:

   ```text
   node scripts/ops.mjs grant-admin operator@example.com
   node scripts/ops.mjs backup /app/data/backups/initial.sqlite
   ```

6. Confirm HTTPS cookies, registration/recovery delivery, booking persistence through a redeploy, maintenance, and off-host backup restoration. Record actual results rather than assuming deployment configuration proves them.
7. Complete the public-launch items in `LAUNCH-STATUS.md` before inviting users.

Do not upload this development database as production data; it may contain sample accounts or other local testing state. Start with a clean persistent database and verified operator account.

## Backups and restoration

Use `npm run db:backup` locally or `node scripts/ops.mjs backup /absolute/destination.sqlite` in the container. Both use SQLite’s online backup API; copying only the live main `.sqlite` file can lose WAL data. Store a second encrypted copy outside the server. A backup on the same disk is not disaster recovery.

Proposed initial policy: daily backups retained seven days, monthly restore drills, and access restricted to the operator. This policy is **not scheduled or provisioned automatically**. Configure it before public launch and update the privacy notice with actual retention.

To restore: stop the service, preserve the current database and WAL/SHM sidecars in a separate recovery directory, place a tested backup at `DATABASE_PATH`, ensure runtime ownership, and restart. Do not combine old sidecars with a restored database. Check `PRAGMA integrity_check`, migrations, login, and representative bookings before reopening. Retain the prior copy until the restore is confirmed. Rollbacks must account for schema compatibility; restoring an older database discards writes since that backup.

## Maintenance and monitoring

The Node instrumentation hook performs maintenance at startup and every minute. Requests also normalize affected user state and recheck notification eligibility. It expires stale sessions/availability/hops, cleans expired tokens and idempotency records, processes notification events, and purges old hop and notification data. `npm run worker` is an optional explicit process; no separate paid worker is required for the one-instance deployment.

Monitor HTTPS availability, disk usage, database backup age, SMTP delivery failures, and server error rates. Logs deliberately omit credentials and email tokens. `/api/health` proves the app can access its database; it does not prove SMTP delivery, backup freshness, or venue accuracy. An external uptime monitor and alert destination are not provisioned yet.

The application limits auth attempts and mutation rates. At a public reverse proxy, overwrite client-supplied forwarded IP headers and enforce request-size limits. The application enforces same-origin JSON mutations and server-side authorization, but proxy configuration and abuse monitoring remain operator responsibilities.

## Catalog and moderation routine

Review correction reports and flagged reviews in `/admin`. Every catalog update and moderation decision requires recorded evidence or a reason. Check published opening hours and exceptions weekly and after reports of changes. Only enable real native room inventory with documented venue authorization and a process to prevent out-of-band double booking.

Blocking and revoking sharing take effect on subsequent authorized reads and deliveries. A recipient may already have seen a prior notification; software cannot retract what someone has read or captured. Investigate privacy incidents, preserve the minimum necessary audit evidence, and contact affected users through the operator’s reviewed incident process.
