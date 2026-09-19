# DeskHop implementation

## Shape

Next.js App Router renders a responsive React application. Route handlers under `src/app/api/[...path]/route.ts` validate JSON with Zod, enforce origin and account requirements, and delegate to domain services. Client components never import the database or auth implementation. CSS uses the supplied DeskHop tokens, local Manrope fonts, and original vector illustrations.

The executable architecture intentionally starts with one Node process and built-in SQLite rather than the blueprint’s proposed managed database stack. It can run immediately without cloud credentials or a paid database. Moving to a managed relational service is a separate migration: transaction semantics, conflict constraints, data export/import, background work, and race tests must move together. Replacing the connection string alone is insufficient.

## Domain services

| Module | Responsibility |
| --- | --- |
| `auth` | Salted scrypt passwords; opaque random session/token generation; verification/reset mail |
| `booking` | Room policy, venue hours, timezone slots, transactional commit/cancellation |
| `sessions` | Focus-state machine, elapsed time, privacy, heartbeat freshness, availability |
| `social` | Accepted friendships, blocks/follows, viewer-specific status, hops and ETA |
| `catalog` | Sourced facts, opening intervals, reviews and recent-observation aggregation |
| `community` | Reviews, likes, reports, public profiles/feed |
| `account` | Settings, privacy revocation, export and account deletion |
| `admin` | Validated venue management and moderation |
| `worker` | Event delivery with eligibility rechecks, expiration, retention |
| `shared` | Idempotent transactional commands, authorization helpers, rate limits |

## Correctness boundaries

All important mutations use `BEGIN IMMEDIATE` and commit their event records atomically. Idempotency keys belong to a user and operation; the request digest prevents reusing a key for different intent. Database triggers prohibit active room/user reservation overlaps, multiple incompatible live states, and session/hop conflicts even if an application check races. Half-open booking intervals allow back-to-back reservations. Cross-process tests exercise conflicts against the same database.

Focus time derives from stored timestamps and accumulated active seconds, not a browser interval. Refreshing or closing the tab does not fabricate completion. Reaching the target awaits explicit confirmation; stale sharing and very old sessions expire. Availability and hops have independent revisions and deadlines. Arriving does not start a timer or create a booking.

Session sharing starts private. Accepted friendship is necessary but not sufficient for venue visibility: the owner must select venue sharing. Following grants access to public reviews only. Hops select one eligible recipient at one shared venue. Blocking, DND, sharing revocation, and expired state are rechecked when information is read and when queued notifications are delivered.

Recent condition reports are distinct from reviews, timers, and bookings. At least three recent verified contributors and sufficient recency weight are required. Conflicting or sparse evidence returns an explicit uncertain state. No synthetic reports, reviews, crowd counts, or attendance claims are seeded.

## Security and privacy

Auth cookies are HTTP-only, same-site, and secure on HTTPS production origins. Only hashed session and one-use email tokens are stored. Password reset revokes existing sign-in sessions. Same-origin checks, JSON content validation, role enforcement, verified-account restrictions, reauthentication for deletion, and rate limits are implemented server-side. UI hiding is not authorization.

Geolocation remains in browser memory for distance calculations. Map tiles come from OpenStreetMap only in map view; direction links open an external map provider. Fonts and artwork are local. There are no analytics trackers, client-side secrets, background GPS collection, or paid model calls.

## Validation

The domain suite covers overlap/race protection, idempotency, limits, DST, state transitions, projection privacy, delivery revocation, retention, reporting, authentication, deletion, and catalog administration. Browser tests exercise real UI flows using isolated test accounts and a separate SQLite file. Axe checks cover selected pages and serious/critical automated findings; responsive tests check 320 and 390 px layouts.

These checks do not establish full WCAG conformance, production email deliverability, venue authorization, Docker/host compatibility, high-volume capacity, or an independent security review. Those require their own evidence.
