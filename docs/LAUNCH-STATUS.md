# Launch status

Updated September 19, 2026.

## Implemented locally

The application includes the directory, source notes, sample booking inventory, persistent accounts, study sessions, social sharing, hops, reviews, reports, moderation, account export/deletion, and responsive UI. A Docker image definition, Render blueprint, backup/admin commands, and GitHub Actions checks are included.

The dedicated Google account successfully reached a Render workspace. No paid service has been activated. Brevo free-account signup is staged pending confirmation of its signup terms. No SMTP credentials are configured and no public application URL has been deployed.

## Required for a usable public pilot

- Owner approval of hosting cost and account/payment setup; deploy persistent storage and confirm recovery through redeployment.
- Configure a transactional email provider and verified sender. Confirm actual verification and recovery delivery to more than one mailbox provider.
- Publish operator identity, monitored support contact, actual processor/hosting disclosures, backup retention, and appropriate terms. Current pages disclose these omissions.
- Assign a verified operator account, exercise moderation, and establish a review routine for user reports and venue facts.
- Schedule encrypted off-host backups, complete a restore drill, and configure uptime/disk/mail-failure alerts.
- Verify coordinates and useful study amenities for the initial real venues. If offering real native bookings, obtain venue authorization and reconcile external inventory first.
- Conduct a public-host smoke test and manual keyboard/screen-reader review. Check platform limits and basic concurrent-user behavior before scaling traffic.

## Deliberately unavailable

Payments, subscriptions, AI provider calls, seat forecasts, push notifications, offline synchronization, Spotify, and external booking APIs are not implemented. Search assistance is deterministic keyword-to-filter matching. The initial database is single-instance SQLite; managed database migration and horizontal scaling remain future engineering work.

## Verification record

Local verification: TypeScript, ESLint, all 36 domain tests, all seven Chromium product flows in a final full run, and the optimized production build pass. The production dependency audit reports zero known vulnerabilities at the time of the check.

The standalone production smoke test passes: startup, static assets, production CSP, safe rejection of registration without SMTP, consistent database backup, backup integrity, and recovered catalog contents. This uses a temporary database and the same standalone entry point as the container image.

Browser checks include account recovery, booking/timer persistence, friend/hop updates and revocation, 320/390 px overflow checks, and selected automated accessibility scans. Docker deployment, public hosting, real email delivery, and off-host recovery remain unverified and must not be marked complete until executed successfully.
