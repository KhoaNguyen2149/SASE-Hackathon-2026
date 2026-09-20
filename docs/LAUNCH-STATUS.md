# Launch status

Updated September 20, 2026.

## Implemented locally

DeskHop includes statewide discovery (5,073 OpenStreetMap listings plus four curated venues), saved spots, study timers, sample reservations, reviews, reports, social sharing and hops, moderation, exports and account deletion. Real venues do not have fictional bookable inventory.

New modules include Denver-calendar daily/weekly/monthly rankings, decorated public profiles, earned XP/Leaves, achievement badges and cosmetic unlocks. Premium is priced at $7.99/month. Server-side Stripe entitlements and a quota-limited Gemini search assistant are implemented but neither external service is activated. Checkout and AI calls remain unavailable until configured; no charges have been made.

Firebase project `deskhop-9a29f` is on the free Spark plan. Google and Email/Password providers are enabled. The server credential is configured in ignored `.env.local`, and its Admin API connection was verified. `npm run test:firebase` passed real password sign-in, unverified/verified session exchange, chosen-handle persistence, verification and recovery action codes, suspended-account rejection, logout, and disabled-identity rejection. The script sends no email and removes its disposable Firebase account and temporary local database. Inbox delivery is not verified by this check.

Use `http://localhost:3000` for local Google sign-in. The console authorizes `localhost`, `deskhop-9a29f.firebaseapp.com`, and `deskhop-9a29f.web.app`; `127.0.0.1` currently returns `auth/unauthorized-domain`. Add the final deployment hostname before production Google login. Browser tests explicitly isolate Firebase, billing and AI settings from live local credentials.

## Venue photos and performance

36 listings have Wikimedia Commons location photos, matched through source metadata, with source/license credits. This is partial coverage, not 5,077 photographed venues. Photos can be older than the catalog; current conditions and study suitability are not verified. Missing or failed images use labeled placeholders. The directory includes a location-photo filter.

Map hover updates marker styling without rebuilding the statewide layer. Maps use canvas markers; cards render 48 at a time and photos load lazily. The directory has a two-minute per-user memory cache, deduplicates in-flight requests and clears on mutations/authentication refresh. The study selector limits matches to 60 plus the selected venue.

A local standalone benchmark reduced the uncompressed directory from 5,811,198 to 2,634,373 bytes (55%). Five-request median fell from 257 to 128 ms on this machine. This is not a concurrent-user or public-network benchmark; server pagination would be appropriate at larger scale.

## Verification and outstanding launch work

TypeScript, lint, production build, all 42 domain tests and nine Chromium product flows pass locally, along with standalone backup/restore smoke checks. The ninth browser flow was run separately after the full eight-flow suite. The browser suite includes actual-photo URL/attribution, map selection and Google/Apple direction links, plus authentication, bookings, timers, friends, privacy, mobile overflow and selected automated accessibility checks. A real library photo was visually inspected in the preview. Dependency audit currently reports zero known production vulnerabilities.

September 20 verification: TypeScript, lint, all 42 domain tests, all nine Chromium flows together, production build, live Firebase smoke and standalone backup/restore smoke passed. The five-request directory benchmark was 2,633,865 bytes and 127.3 ms median locally; this is not a load test.

Render is not deployed. Its GitHub connection now sees the private repository. The service form is prepared with Docker, Oregon, $7/month compute, a 1 GB disk at $0.25/month mounted at `/app/data`, `/api/health`, and manual deploys. The Docker health command now honors Render's `PORT`; it passed checks on the running app and an alternate port. The blueprint uses managed Firebase configuration, disables fictional sample seeding, retains the persistent SQLite disk, and leaves AI off.

Pending owner decisions: keep the original $25 total limit and hold paid deployment, or authorize a recurring monthly budget; separately authorize transferring the existing Firebase credential into Render's private environment configuration. No paid service has been activated. Stripe merchant onboarding and payment webhooks, AI provider credentials/limits, inbox delivery, public-host smoke tests, operator disclosures, off-host backups and monitoring still need completion. Do not describe the product as publicly launched or all external integrations as tested.
