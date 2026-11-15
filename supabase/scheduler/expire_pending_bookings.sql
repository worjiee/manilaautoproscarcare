-- PREPARED CONFIGURATION ONLY. DO NOT EXECUTE WITHOUT OWNER APPROVAL.
-- Target: dedicated Manila Auto Pros development project qcjslbakgdofmzthqxuu.
-- This file intentionally lives outside supabase/migrations so a normal
-- migration push cannot activate the scheduler accidentally.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $preflight$
BEGIN
  IF pg_catalog.to_regprocedure(
    'public.expire_pending_bookings_atomic()'
  ) IS NULL THEN
    RAISE EXCEPTION 'Required expiration function is not installed.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'manila-auto-pros-expire-pending'
  ) THEN
    RAISE EXCEPTION 'Expiration scheduler already exists; inspect it before changing it.';
  END IF;

  IF pg_catalog.has_function_privilege(
    'anon',
    'public.expire_pending_bookings_atomic()',
    'EXECUTE'
  ) OR pg_catalog.has_function_privilege(
    'authenticated',
    'public.expire_pending_bookings_atomic()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Expiration function has unsafe public execution privileges.';
  END IF;
END;
$preflight$;

SELECT cron.schedule(
  'manila-auto-pros-expire-pending',
  '* * * * *',
  $job$SELECT public.expire_pending_bookings_atomic();$job$
);

COMMIT;
