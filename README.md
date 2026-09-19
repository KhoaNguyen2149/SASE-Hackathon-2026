# DeskHop

A responsive web application for finding study spaces around Golden, Colorado, keeping focus sessions, reserving supported rooms, and sharing optional activity with friends.

**Status:** runnable local preview, with persistent accounts and working product flows. Public hosting and production email are not connected yet. The default directory contains four real venues with attributed facts; a separate sample campus demonstrates reservations. **Sample reservations never book real rooms.**

## Run locally

Requires Node.js **24.13 or newer** and npm. SQLite is included with Node; no separate database account is needed.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open **http://127.0.0.1:3000**. Do not overwrite an existing `.env.local`. The development server binds to loopback. Accounts, bookings, reviews, and sessions persist in `data/deskhop.sqlite`.

Register using your own email and a new password. Without SMTP, development mode displays a clearly marked verification link so the local account flow can be exercised. **Production mode never exposes verification or reset tokens.** Production registration stays unavailable until SMTP is configured.

To try reservations, choose **Discover → Sample campus → Aspen Reading Room → Find a time**. To try friend sharing, use two verified accounts in separate browser profiles. Sessions start private; sharing a venue and enabling “Open to company” makes the one-recipient hop flow available to an accepted friend.

## What works

- List/map discovery, keyword search, amenity and whole-visit opening-hours filters, source details, saved spots, optional browser-local distance calculation, external directions, and venue correction reports.
- Registration, verification, sign-in/out, password recovery, preferences, account export, and password-confirmed account deletion.
- Durable room reservations with timezone-aware slots, capacity/access rules, cancellation, overlap protection, and retry-safe commands.
- Durable study timers with pause, resume, extension, completion confirmation, history, and explicit per-session privacy.
- Accepted friendships, requests, blocking, public follows/review feed, expiring availability, single-recipient arrival updates, editable ETA, and in-app notifications.
- Reviews, likes, recent condition reports with evidence thresholds, reporting, and an administrator interface for catalog, room, closure, and moderation operations.
- Responsive desktop/mobile layouts, keyboard-accessible dialogs, local fonts, original illustrations, and an installable web manifest.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development on port 3000 |
| `npm run check` | TypeScript, lint, domain tests, production build |
| `npm run test:e2e` | Chromium product flows and accessibility checks |
| `npm run test:production` | Standalone production and backup smoke test after building |
| `npx playwright install chromium` | Install test browser on a new machine |
| `npm run build` / `npm start` | Build and run production mode |
| `npm run db:admin -- you@example.com` | Grant a registered, verified account administrator access |
| `npm run db:backup` | Consistent SQLite backup under `data/backups` |
| `npm run worker` | Optional maintenance process; maintenance also runs inside the app |
| `npm run format` | Format source, scripts, and tests |

The database CLI commands load `.env.local`. Administrator grants are audit logged. Never grant the role to an account whose owner you have not verified.

## Deployment

This release runs as **one persistent Node server with one local SQLite database**. It is not compatible with ephemeral serverless storage or multiple independent instances. `Dockerfile`, `compose.yaml`, and `render.yaml` are provided. The Render configuration incurs charges and has **not** been deployed.

Read [deployment and recovery](docs/OPERATIONS.md) before hosting. Set the canonical HTTPS `APP_URL`, configure SMTP, persist `/app/data`, test mail delivery, and take an off-host backup. Do not put account credentials or SMTP secrets in source control. The dedicated automation account password is not stored in this repository.

## Product boundaries

- Real listings are sourced directory entries, not venue partnerships. Amenities, coordinates, and hours that have not been verified remain unknown. Native real-world room inventory requires venue authorization; currently all native rooms are fictional.
- The free search helper maps supported keywords to filters. There is no model API, seat prediction, payment, subscription, Spotify integration, push notification, or external reservation-provider integration.
- A booking, a focus timer, a hop, and an observation are separate records. No feature proves physical presence or guarantees an open seat.
- The manifest supports installation; there is no offline booking or offline data synchronization.
- Privacy and terms pages describe this build. Operator identity, a monitored support contact, final deployment disclosures, and appropriate terms remain public-launch requirements.
- This is an initial single-instance implementation, not a claim of a completed independent security audit, large-scale load test, or full accessibility certification.

See [architecture](docs/ARCHITECTURE.md), [catalog provenance](docs/CATALOG.md), [launch status](docs/LAUNCH-STATUS.md), and [third-party notices](docs/THIRD-PARTY-NOTICES.md). Original design inputs remain under [docs/brand](docs/brand/README.md).
