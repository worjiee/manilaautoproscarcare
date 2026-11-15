# Admin operations

## Required configuration

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` configure the browser-safe Supabase Auth endpoint.
- `SUPABASE_SERVICE_ROLE_KEY` remains server-only and is used only after an administrator has been authenticated and authorized.
- `ADMIN_CRON_SECRET` must be a randomly generated secret of at least 32 characters. Do not prefix it with `NEXT_PUBLIC_`.

## Administrator enrollment

Create the administrator in Supabase Auth, enable MFA in the Supabase project, then insert that Auth user ID into `public.admin_memberships` with `is_active = true`. A valid Supabase account without an active membership is denied and signed out. Membership changes must be performed by a project owner through a reviewed administrative process.

## Pending-booking expiration

Schedule an HTTPS `POST` to `/api/jobs/expire-pending` with `Authorization: Bearer <ADMIN_CRON_SECRET>`. A five-minute schedule is recommended. The endpoint is idempotent because `expire_pending_bookings_atomic` locks and processes only currently expired pending rows. Configure platform alerts for non-2xx responses and retain server error logs.

The endpoint is implemented but must not be described as operational until the deployed URL has been called with the configured secret and both its response and resulting audit entries have been verified.

## Migration boundary

`20261113000002_phase4_admin_security.sql` is intentionally local and unapplied. It adds the explicit membership and admin audit tables plus service-role-only transactional RPCs. Do not apply `seed.sql`, and do not activate development defaults as part of this migration.

## Phase 4 live integration test gate

The Phase 4 suite is discovered by `npm run test:integration`, but remains skipped unless all existing development-write gates are enabled and `SUPABASE_ADMIN_INTEGRATION_USER_ID` identifies a pre-enrolled active test administrator. The suite never creates its own administrator membership. It covers anonymous/authenticated denial, non-member denial, booking lifecycle transitions, expired approvals, concurrent rescheduling, settings conflicts, and audit immutability using uniquely tagged development records.
