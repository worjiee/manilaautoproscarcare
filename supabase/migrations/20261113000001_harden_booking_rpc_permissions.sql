-- =============================================================================
-- MANILA AUTO PROS - RESTRICT PRIVILEGED BOOKING RPC EXECUTION
--
-- SECURITY DEFINER functions run with their owner's privileges and bypass the
-- caller's table-level RLS restrictions. PostgreSQL grants function execution
-- to PUBLIC by default, so these RPCs must be explicitly server-only.
--
-- Prepared for review only. Do not apply until the deployment is ready.
-- =============================================================================

-- Prevent untrusted roles from creating public-schema objects that could be
-- resolved by a SECURITY DEFINER function.
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- Make private customer and booking tables inaccessible even before RLS is
-- considered. Public scheduling configuration remains read-only.
REVOKE ALL ON TABLE
  public.customers,
  public.vehicles,
  public.bookings,
  public.booking_tokens,
  public.booking_audit_logs
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.booking_resources,
  public.services,
  public.business_hours,
  public.blocked_dates
TO anon, authenticated;

-- The secret-key service role remains the trusted administrative role. Booking
-- application writes use the reviewed RPCs; isolated integration setup may
-- manage configuration and test rows directly in a dedicated non-production
-- project. Audit rows are treated separately below.
GRANT ALL ON TABLE
  public.booking_resources,
  public.services,
  public.business_hours,
  public.blocked_dates,
  public.customers,
  public.vehicles,
  public.bookings,
  public.booking_tokens
TO service_role;

REVOKE ALL ON TABLE public.booking_audit_logs FROM service_role;
GRANT SELECT, INSERT ON TABLE public.booking_audit_logs TO service_role;

-- Pin ownership and use an empty search path for every privileged function.
ALTER FUNCTION public.create_booking_atomic(
  TEXT, TEXT, TEXT, public.vehicle_type_enum, TEXT, TEXT, SMALLINT, TEXT,
  DATE, TIME, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) OWNER TO postgres;

ALTER FUNCTION public.cancel_booking_by_token_atomic(
  TEXT, TEXT
) OWNER TO postgres;

ALTER FUNCTION public.reschedule_booking_by_token_atomic(
  TEXT, DATE, TIME, TEXT, TEXT, TIMESTAMPTZ
) OWNER TO postgres;

ALTER FUNCTION public.expire_pending_bookings_atomic() OWNER TO postgres;

ALTER FUNCTION public.create_booking_atomic(
  TEXT, TEXT, TEXT, public.vehicle_type_enum, TEXT, TEXT, SMALLINT, TEXT,
  DATE, TIME, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) SET search_path = '';

ALTER FUNCTION public.cancel_booking_by_token_atomic(
  TEXT, TEXT
) SET search_path = '';

ALTER FUNCTION public.reschedule_booking_by_token_atomic(
  TEXT, DATE, TIME, TEXT, TEXT, TIMESTAMPTZ
) SET search_path = '';

ALTER FUNCTION public.expire_pending_bookings_atomic()
  SET search_path = '';

REVOKE ALL ON FUNCTION public.create_booking_atomic(
  TEXT, TEXT, TEXT, public.vehicle_type_enum, TEXT, TEXT, SMALLINT, TEXT,
  DATE, TIME, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.cancel_booking_by_token_atomic(
  TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.reschedule_booking_by_token_atomic(
  TEXT, DATE, TIME, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.expire_pending_bookings_atomic()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_booking_atomic(
  TEXT, TEXT, TEXT, public.vehicle_type_enum, TEXT, TEXT, SMALLINT, TEXT,
  DATE, TIME, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) TO service_role;

GRANT EXECUTE ON FUNCTION public.cancel_booking_by_token_atomic(
  TEXT, TEXT
) TO service_role;

GRANT EXECUTE ON FUNCTION public.reschedule_booking_by_token_atomic(
  TEXT, DATE, TIME, TEXT, TEXT, TIMESTAMPTZ
) TO service_role;

GRANT EXECUTE ON FUNCTION public.expire_pending_bookings_atomic()
  TO service_role;
