# Private Vercel staging plan

This document describes a private, development-only booking demonstration. It
does not represent approved Manila Auto Pros operating settings.

## Isolation model

- Deploy a non-production Vercel Preview protected by Vercel Authentication.
- Point only to Supabase project `qcjslbakgdofmzthqxuu` and set an independent
  `STAGING_SUPABASE_PROJECT_REF` marker to the same value.
- Enable booking only when `STAGING_DEMO_MODE=true`,
  `PUBLIC_BOOKING_ENABLED=true`, `EMAIL_DELIVERY_MODE=disabled`, the URL and
  marker match, Vercel is not production, and an explicit demo-service allowlist
  is present.
- Scope public booking actions, token management, admin lists, calendar data,
  audit reads, and admin transitions to the allowed demo service slugs.
- Reject real-looking customer details. Reviewers must use a name beginning
  with `Demo `, an `@example.test` address, and `09000000000`.
- Keep the settings console read-only in demo mode. Demo configuration is an
  owner-controlled database preparation step, not a reviewer capability.

## Proposed demo configuration (not applied)

These values are illustrative and require owner approval:

| Item | Proposed demo value |
| --- | --- |
| Operating days | Monday–Saturday |
| Hours | 09:00–17:00 Asia/Manila; Sunday closed |
| Slot interval | 60 minutes |
| Car demo service | `[DEMO] Car Care Request`, 90 minutes + 30-minute buffer, manual confirmation |
| Motorcycle demo service | `[DEMO] Motorcycle Express`, 60 minutes + 30-minute buffer, automatic confirmation |
| Car resource | `[DEMO] Car Care Bay`, capacity 2 |
| Motorcycle resource | `[DEMO] Motorcycle Care Bay`, capacity 2 |
| Pending hold | 60 minutes for manual approval |

The database currently uses global business-hours rows and globally unique
service slugs. Before preparing any activation SQL, perform a read-only check
for existing slugs, active non-demo services/resources, retained bookings, and
hours conflicts. If existing service slugs are reused, the operation must stop;
it must not overwrite those records. Newly prepared demo services/resources
must remain inactive until separately approved. The Vercel allowlist must match
their final slugs exactly.

## Vercel environment

Preview-only values:

```text
STAGING_DEMO_MODE=true
PUBLIC_BOOKING_ENABLED=true
STAGING_SUPABASE_PROJECT_REF=qcjslbakgdofmzthqxuu
STAGING_DEMO_SERVICE_SLUGS=<reviewed comma-separated slugs>
NEXT_PUBLIC_SUPABASE_URL=https://qcjslbakgdofmzthqxuu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<development publishable key>
SUPABASE_SERVICE_ROLE_KEY=<development secret key>
NEXT_PUBLIC_SITE_URL=<stable protected staging URL>
NEXT_PUBLIC_SHOW_DEV_NOTICES=true
EMAIL_DELIVERY_MODE=disabled
RUN_SUPABASE_INTEGRATION_TESTS=false
SUPABASE_INTEGRATION_ALLOW_WRITES=false
```

Only `NEXT_PUBLIC_*` values may enter browser bundles. The service-role key and
all email/cron secrets remain server-only Vercel encrypted environment values.

## Deployment sequence

1. Complete a read-only Supabase conflict check and approve exact demo records.
2. Prepare a new, reviewed migration or owner-run transaction that creates the
   demo records inactive. Do not edit applied migrations or seed data.
3. Review hashes and apply only after explicit approval.
4. Configure Vercel Preview environment variables; leave integration write
   gates false.
5. Enable Vercel Authentication for Preview deployments and invite only named
   reviewers. Do not add a public protection bypass.
6. Build a preview from a dedicated staging branch and verify an unauthenticated
   request is redirected by Vercel before application code or assets load.
7. After a separate activation approval, activate only the reviewed demo
   service/resource records and global demo hours after re-running conflict
   checks.
8. Execute an isolated smoke test: create one synthetic pending booking,
   approve/reject through the enrolled development admin, test token-based
   cancel/reschedule, verify capacity, calendar visibility, and audit events.
9. Verify email outbox delivery remains disabled, no dispatcher schedule exists,
   expiration Cron job 1 is unchanged, and all active public configuration is
   still demo-scoped.
10. Deactivate demo services/resources when client review ends. Retain immutable
    booking and audit history according to the development-data policy.
