# Pending booking expiration scheduler

Status: prepared only; not activated.

## Decision

Use Supabase Cron to execute `public.expire_pending_bookings_atomic()` directly
once per minute. This keeps the job next to the data, avoids an HTTP network hop,
and preserves the existing POST-only application endpoint.

Vercel Cron is not configured because it invokes routes with HTTP GET. Changing
the existing endpoint to GET solely for Vercel would broaden its method surface,
and Vercel Hobby scheduling is too infrequent for short pending-booking holds.

## Activation procedure

Activation requires separate owner approval.

1. Reconfirm the target project is `qcjslbakgdofmzthqxuu` and development-only.
2. Confirm all five application migrations remain applied and none are pending.
3. Confirm no existing cron job is named `manila-auto-pros-expire-pending`.
4. Review `supabase/scheduler/expire_pending_bookings.sql`.
5. Execute that file as the trusted database owner through the Supabase SQL
   Editor or another authenticated, supported PostgreSQL connection.
6. Verify the job exists, is active, runs as the trusted owner, and its command
   is exactly `SELECT public.expire_pending_bookings_atomic();`.
7. Observe at least two successful runs before considering activation complete.

The schedule is `* * * * *`. PostgreSQL cron syntax is evaluated in UTC, but an
every-minute schedule is timezone-independent. Expiration itself compares
`TIMESTAMPTZ` values using PostgreSQL's authoritative clock.

## Monitoring

Use the Supabase Cron Jobs dashboard or this read-only query:

```sql
SELECT status, start_time, end_time, return_message
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid
  FROM cron.job
  WHERE jobname = 'manila-auto-pros-expire-pending'
)
ORDER BY start_time DESC
LIMIT 20;
```

Alert operationally if two consecutive minute runs fail or if no successful run
appears for more than five minutes. Supabase Cron records each attempt, but this
configuration does not add an immediate same-run retry. The following scheduled
minute naturally retries the idempotent sweep.

Run-history rows are not removed automatically. Add a separately reviewed
retention policy only if their storage becomes material.

## Manual endpoint

`POST /api/jobs/expire-pending` remains available for a trusted manual or
external invocation. It requires `Authorization: Bearer <ADMIN_CRON_SECRET>`.
Store `ADMIN_CRON_SECRET` only in encrypted server-side environment settings;
it must be at least 32 random characters and must never use a `NEXT_PUBLIC_`
name.
