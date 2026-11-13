-- ==============================================================================
-- MANILA AUTO PROS — PHASE 3 ATOMIC RESERVATION & TOKEN RPC FUNCTIONS
-- Migration: 20261021000002_phase3_booking_rpcs.sql
-- Implements database-level concurrency control using transaction advisory locks
-- (`pg_advisory_xact_lock`) and `FOR UPDATE` row locks on `booking_resources`.
-- ==============================================================================

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Restrict
-- future functions created by this migration role, then grant explicitly below.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 1. ATOMIC BOOKING CREATION (`create_booking_atomic`)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_booking_atomic(
  p_idempotency_key TEXT,
  p_reference_code TEXT,
  p_option_slug TEXT,
  p_vehicle_type public.vehicle_type_enum,
  p_manufacturer TEXT,
  p_model TEXT,
  p_model_year SMALLINT,
  p_vehicle_notes TEXT,
  p_appointment_date DATE,
  p_start_time_local TIME,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_additional_requests TEXT,
  p_cancel_token_hash TEXT,
  p_reschedule_token_hash TEXT,
  p_token_expires_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_booking public.bookings%ROWTYPE;
  v_service public.services%ROWTYPE;
  v_resource public.booking_resources%ROWTYPE;
  v_hours public.business_hours%ROWTYPE;
  v_dow SMALLINT;
  v_effective_minutes INTEGER;
  v_end_time_local TIME;
  v_start_at TIMESTAMPTZ;
  v_end_at TIMESTAMPTZ;
  v_effective_end_at TIMESTAMPTZ;
  v_blocked_reason TEXT;
  v_allocated_overlapping INTEGER;
  v_customer_id UUID;
  v_vehicle_id UUID;
  v_booking_id UUID;
  v_status public.booking_status_enum;
  v_pending_expires_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_request_fingerprint TEXT;
BEGIN
  IF pg_catalog.btrim(p_idempotency_key) = '' THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', FALSE,
      'error_code', 'INVALID_IDEMPOTENCY_KEY',
      'message', 'A non-empty idempotency key is required.'
    );
  END IF;

  IF p_token_expires_at <= v_now THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', FALSE,
      'error_code', 'INVALID_TOKEN_EXPIRY',
      'message', 'Token expiration must be in the future.'
    );
  END IF;

  v_request_fingerprint := pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
        'option_slug', p_option_slug,
        'vehicle_type', p_vehicle_type,
        'manufacturer', pg_catalog.btrim(p_manufacturer),
        'model', pg_catalog.btrim(p_model),
        'model_year', p_model_year,
        'vehicle_notes', pg_catalog.btrim(COALESCE(p_vehicle_notes, '')),
        'appointment_date', p_appointment_date,
        'start_time_local', p_start_time_local,
        'customer_name', pg_catalog.btrim(p_customer_name),
        'customer_email', pg_catalog.lower(pg_catalog.btrim(p_customer_email)),
        'customer_phone', pg_catalog.regexp_replace(p_customer_phone, '\D', '', 'g'),
        'additional_requests', pg_catalog.btrim(COALESCE(p_additional_requests, ''))
        )::TEXT,
        'UTF8'
      )
    ),
    'hex'
  );

  -- Serialize every request sharing an idempotency key before reading it.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key, 0)
  );

  -- 1. Idempotency check under lock.
  SELECT * INTO v_existing_booking
  FROM public.bookings
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_booking.request_fingerprint <> v_request_fingerprint THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', FALSE,
        'error_code', 'IDEMPOTENCY_KEY_REUSED',
        'message', 'Idempotency key was already used for different booking details.'
      );
    END IF;

    RETURN jsonb_build_object(
      'ok', TRUE,
      'idempotent_replay', TRUE,
      'booking_id', v_existing_booking.id,
      'reference_code', v_existing_booking.reference_code,
      'status', v_existing_booking.status,
      'confirmation_mode', v_existing_booking.confirmation_mode,
      'appointment_date', v_existing_booking.appointment_date,
      'start_time_local', to_char(v_existing_booking.start_time_local, 'HH24:MI'),
      'end_time_local', to_char(v_existing_booking.end_time_local, 'HH24:MI'),
      'start_at', v_existing_booking.start_at,
      'end_at', v_existing_booking.end_at,
      'pending_expires_at', v_existing_booking.pending_expires_at
    );
  END IF;

  -- 2. Lookup active service & verify vehicle_type match
  SELECT * INTO v_service
  FROM public.services
  WHERE option_slug = p_option_slug AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'INVALID_SERVICE', 'message', 'Selected service is unavailable.');
  END IF;

  IF v_service.vehicle_type <> p_vehicle_type THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'VEHICLE_TYPE_MISMATCH', 'message', 'Selected service does not match vehicle type.');
  END IF;

  -- 3. Check day of week & operating hours in Asia/Manila
  v_dow := EXTRACT(DOW FROM p_appointment_date)::SMALLINT;
  IF v_dow = 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'SUNDAY_CLOSED', 'message', 'Manila Auto Pros is closed on Sundays.');
  END IF;

  SELECT * INTO v_hours
  FROM public.business_hours
  WHERE day_of_week = v_dow
  LIMIT 1;

  IF NOT FOUND OR v_hours.is_closed THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'DAY_CLOSED', 'message', 'Studio is closed on the selected day.');
  END IF;

  v_effective_minutes := v_service.duration_minutes + v_service.buffer_minutes;
  v_end_time_local := p_start_time_local + pg_catalog.make_interval(mins => v_service.duration_minutes);

  IF p_start_time_local < v_hours.open_time
     OR v_end_time_local > v_hours.close_time
     OR v_end_time_local <= p_start_time_local THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'OUTSIDE_OPERATING_HOURS', 'message', 'Requested appointment exceeds operating hours.');
  END IF;

  -- Construct TIMESTAMPTZ instants in Asia/Manila
  v_start_at := (p_appointment_date::text || ' ' || p_start_time_local::text) :: TIMESTAMP AT TIME ZONE 'Asia/Manila';
  v_end_at := v_start_at + pg_catalog.make_interval(mins => v_service.duration_minutes);
  v_effective_end_at := v_start_at + pg_catalog.make_interval(mins => v_effective_minutes);

  -- 4. Check minimum notice and maximum advance window
  IF v_start_at < (v_now + pg_catalog.make_interval(hours => v_service.min_notice_hours)) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'MIN_NOTICE_VIOLATION', 'message', 'Appointment does not meet minimum advance notice.');
  END IF;

  IF p_appointment_date > ((v_now AT TIME ZONE 'Asia/Manila')::date + v_service.max_advance_days) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'MAX_ADVANCE_VIOLATION', 'message', 'Appointment is beyond the maximum advance booking window.');
  END IF;

  -- 5. Acquire Resource Pool with FOR UPDATE lock + Transaction Advisory Lock
  SELECT * INTO v_resource
  FROM public.booking_resources
  WHERE resource_type = v_service.required_resource_type
    AND vehicle_type = v_service.vehicle_type
    AND is_active = TRUE
  ORDER BY code ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'RESOURCE_UNAVAILABLE', 'message', 'Studio bay resource pool is unavailable.');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_resource.id::text || ':' || p_appointment_date::text, 0)
  );

  -- 6. Check Blocked Dates (full day or overlapping time window)
  SELECT reason INTO v_blocked_reason
  FROM public.blocked_dates
  WHERE blocked_date = p_appointment_date
    AND is_active = TRUE
    AND (resource_id IS NULL OR resource_id = v_resource.id)
    AND (
      (start_time IS NULL AND end_time IS NULL) OR
      (p_start_time_local < end_time AND v_end_time_local > start_time)
    )
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'DATE_BLOCKED', 'message', 'Selected date or time window is blocked: ' || v_blocked_reason);
  END IF;

  -- 7. Concurrency-Safe Peak Capacity Verification inside locked transaction.
  -- Measure active units at every interval start instead of summing sequential
  -- bookings that never overlap one another.
  SELECT COALESCE(MAX(usage.allocated_units), 0)
  INTO v_allocated_overlapping
  FROM (
    SELECT v_start_at AS point_at
    UNION
    SELECT GREATEST(b.start_at, v_start_at)
    FROM public.bookings b
    WHERE b.resource_id = v_resource.id
      AND b.appointment_date = p_appointment_date
      AND (
        b.status = 'confirmed' OR
        (b.status = 'pending' AND b.pending_expires_at > v_now)
      )
      AND b.start_at < v_effective_end_at
      AND (b.end_at + make_interval(mins => b.buffer_minutes)) > v_start_at
  ) points
  CROSS JOIN LATERAL (
    SELECT COALESCE(SUM(b2.allocated_units), 0) AS allocated_units
    FROM public.bookings b2
    WHERE b2.resource_id = v_resource.id
      AND b2.appointment_date = p_appointment_date
      AND (
        b2.status = 'confirmed' OR
        (b2.status = 'pending' AND b2.pending_expires_at > v_now)
      )
      AND b2.start_at <= points.point_at
      AND (b2.end_at + make_interval(mins => b2.buffer_minutes)) > points.point_at
  ) usage;

  IF (v_allocated_overlapping + v_service.required_units) > v_resource.total_capacity THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error_code', 'SLOT_CAPACITY_EXHAUSTED',
      'message', 'The selected time slot no longer has sufficient bay capacity.'
    );
  END IF;

  -- 8. Insert Customer & Vehicle records
  INSERT INTO public.customers (full_name, email, email_normalized, phone, phone_normalized)
  VALUES (
    btrim(p_customer_name),
    btrim(p_customer_email),
    lower(btrim(p_customer_email)),
    btrim(p_customer_phone),
    regexp_replace(p_customer_phone, '\D', '', 'g')
  )
  RETURNING id INTO v_customer_id;

  INSERT INTO public.vehicles (customer_id, vehicle_type, manufacturer, model, model_year, notes)
  VALUES (
    v_customer_id,
    p_vehicle_type,
    btrim(p_manufacturer),
    btrim(p_model),
    p_model_year,
    NULLIF(btrim(COALESCE(p_vehicle_notes, '')), '')
  )
  RETURNING id INTO v_vehicle_id;

  -- 9. Determine Confirmation Mode & Status
  IF v_service.confirmation_mode = 'auto' THEN
    v_status := 'confirmed';
    v_pending_expires_at := NULL;
  ELSE
    v_status := 'pending';
    v_pending_expires_at := v_now + pg_catalog.make_interval(mins => v_service.pending_hold_minutes);
  END IF;

  -- 10. Insert Booking
  INSERT INTO public.bookings (
    reference_code,
    idempotency_key,
    request_fingerprint,
    customer_id,
    vehicle_id,
    service_id,
    resource_id,
    allocated_units,
    appointment_date,
    start_time_local,
    end_time_local,
    start_at,
    end_at,
    duration_minutes,
    buffer_minutes,
    confirmation_mode,
    status,
    pending_expires_at,
    additional_requests
  )
  VALUES (
    p_reference_code,
    p_idempotency_key,
    v_request_fingerprint,
    v_customer_id,
    v_vehicle_id,
    v_service.id,
    v_resource.id,
    v_service.required_units,
    p_appointment_date,
    p_start_time_local,
    v_end_time_local,
    v_start_at,
    v_end_at,
    v_service.duration_minutes,
    v_service.buffer_minutes,
    v_service.confirmation_mode,
    v_status,
    v_pending_expires_at,
    NULLIF(btrim(COALESCE(p_additional_requests, '')), '')
  )
  RETURNING id INTO v_booking_id;

  -- 11. Store Hashed Single-Purpose Tokens
  INSERT INTO public.booking_tokens (booking_id, purpose, token_hash, expires_at)
  VALUES
    (v_booking_id, 'cancel', p_cancel_token_hash, p_token_expires_at),
    (v_booking_id, 'reschedule', p_reschedule_token_hash, p_token_expires_at);

  -- 12. Write Audit Log
  INSERT INTO public.booking_audit_logs (booking_id, actor_type, action, previous_status, new_status, metadata)
  VALUES (
    v_booking_id,
    'customer',
    'BOOKING_CREATED',
    NULL,
    v_status,
    jsonb_build_object(
      'reference_code', p_reference_code,
      'option_slug', p_option_slug,
      'allocated_units', v_service.required_units,
      'confirmation_mode', v_service.confirmation_mode
    )
  );

  RETURN jsonb_build_object(
    'ok', TRUE,
    'idempotent_replay', FALSE,
    'booking_id', v_booking_id,
    'reference_code', p_reference_code,
    'status', v_status,
    'confirmation_mode', v_service.confirmation_mode,
    'appointment_date', p_appointment_date,
    'start_time_local', to_char(p_start_time_local, 'HH24:MI'),
    'end_time_local', to_char(v_end_time_local, 'HH24:MI'),
    'start_at', v_start_at,
    'end_at', v_end_at,
    'pending_expires_at', v_pending_expires_at
  );
EXCEPTION
  WHEN unique_violation THEN
    -- All statements in the function block are rolled back before this handler.
    SELECT * INTO v_existing_booking
    FROM public.bookings
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      IF v_existing_booking.request_fingerprint <> v_request_fingerprint THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', FALSE,
          'error_code', 'IDEMPOTENCY_KEY_REUSED',
          'message', 'Idempotency key was already used for different booking details.'
        );
      END IF;

      RETURN pg_catalog.jsonb_build_object(
        'ok', TRUE,
        'idempotent_replay', TRUE,
        'booking_id', v_existing_booking.id,
        'reference_code', v_existing_booking.reference_code,
        'status', v_existing_booking.status,
        'confirmation_mode', v_existing_booking.confirmation_mode,
        'appointment_date', v_existing_booking.appointment_date,
        'start_time_local', pg_catalog.to_char(v_existing_booking.start_time_local, 'HH24:MI'),
        'end_time_local', pg_catalog.to_char(v_existing_booking.end_time_local, 'HH24:MI'),
        'start_at', v_existing_booking.start_at,
        'end_at', v_existing_booking.end_at,
        'pending_expires_at', v_existing_booking.pending_expires_at
      );
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'ok', FALSE,
      'error_code', 'UNIQUE_CONFLICT',
      'message', 'A unique booking value conflicted with an existing reservation.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_atomic(
  TEXT, TEXT, TEXT, public.vehicle_type_enum, TEXT, TEXT, SMALLINT, TEXT,
  DATE, TIME, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_booking_atomic(
  TEXT, TEXT, TEXT, public.vehicle_type_enum, TEXT, TEXT, SMALLINT, TEXT,
  DATE, TIME, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) TO service_role;

-- ------------------------------------------------------------------------------
-- 2. ATOMIC CANCELLATION BY TOKEN (`cancel_booking_by_token_atomic`)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_booking_by_token_atomic(
  p_token_hash TEXT,
  p_reason TEXT DEFAULT 'Cancelled by customer via secure token'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token public.booking_tokens%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_service public.services%ROWTYPE;
  v_prev_status public.booking_status_enum;
  v_token_id UUID;
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
BEGIN
  SELECT * INTO v_token
  FROM public.booking_tokens
  WHERE token_hash = p_token_hash
    AND purpose = 'cancel'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'INVALID_TOKEN', 'message', 'Cancellation token is invalid.');
  END IF;

  v_token_id := v_token.id;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = v_token.booking_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'Booking record could not be located.');
  END IF;

  -- Keep the same lock order as the expiration sweeper: booking, then token.
  SELECT * INTO v_token
  FROM public.booking_tokens t
  WHERE t.id = v_token_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'INVALID_TOKEN', 'message', 'Cancellation token is invalid.');
  END IF;

  IF v_token.used_at IS NOT NULL OR v_token.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'TOKEN_ALREADY_USED', 'message', 'This cancellation link has already been used or revoked.');
  END IF;

  IF v_token.expires_at <= v_now THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'TOKEN_EXPIRED', 'message', 'This cancellation link has expired.');
  END IF;

  v_prev_status := v_booking.status;

  IF v_booking.status = 'pending' AND v_booking.pending_expires_at <= v_now THEN
    UPDATE public.bookings
    SET status = 'expired',
        pending_expires_at = NULL
    WHERE id = v_booking.id;

    UPDATE public.booking_tokens
    SET revoked_at = v_now
    WHERE booking_id = v_booking.id
      AND used_at IS NULL
      AND revoked_at IS NULL;

    INSERT INTO public.booking_audit_logs
      (booking_id, actor_type, action, previous_status, new_status, metadata)
    VALUES (
      v_booking.id,
      'system',
      'BOOKING_PENDING_EXPIRED',
      'pending',
      'expired',
      pg_catalog.jsonb_build_object('expired_at', v_now)
    );

    RETURN pg_catalog.jsonb_build_object(
      'ok', FALSE,
      'error_code', 'PENDING_EXPIRED',
      'message', 'The pending booking hold expired and can no longer be cancelled.'
    );
  END IF;

  IF v_booking.status IN ('cancelled', 'rejected', 'expired', 'completed') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'INVALID_BOOKING_STATE', 'message', 'Appointment cannot be cancelled in its current status.');
  END IF;

  SELECT * INTO v_service
  FROM public.services
  WHERE id = v_booking.service_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', FALSE,
      'error_code', 'INVALID_SERVICE',
      'message', 'The booking service could not be located.'
    );
  END IF;

  IF v_now >= (
    v_booking.start_at -
    pg_catalog.make_interval(mins => v_service.cancellation_cutoff_minutes)
  ) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', FALSE,
      'error_code', 'MODIFICATION_CUTOFF_REACHED',
      'message', 'The cancellation cutoff has been reached.'
    );
  END IF;

  -- Mark booking cancelled (atomically releasing allocated capacity)
  UPDATE public.bookings
  SET status = 'cancelled',
      cancellation_reason = COALESCE(
        NULLIF(pg_catalog.btrim(p_reason), ''),
        'Cancelled by customer'
      ),
      cancelled_at = v_now,
      pending_expires_at = NULL
  WHERE id = v_booking.id;

  -- Invalidate cancel token and revoke any unused reschedule tokens for this booking
  UPDATE public.booking_tokens
  SET used_at = v_now
  WHERE id = v_token.id;

  UPDATE public.booking_tokens
  SET revoked_at = v_now
  WHERE booking_id = v_booking.id
    AND id <> v_token.id
    AND used_at IS NULL
    AND revoked_at IS NULL;

  INSERT INTO public.booking_audit_logs (booking_id, actor_type, action, previous_status, new_status, metadata)
  VALUES (
    v_booking.id,
    'customer',
    'BOOKING_CANCELLED_BY_TOKEN',
    v_prev_status,
    'cancelled',
    jsonb_build_object(
      'reason',
      COALESCE(
        NULLIF(pg_catalog.btrim(p_reason), ''),
        'Cancelled by customer'
      )
    )
  );

  RETURN jsonb_build_object(
    'ok', TRUE,
    'booking_id', v_booking.id,
    'reference_code', v_booking.reference_code,
    'previous_status', v_prev_status,
    'status', 'cancelled'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_booking_by_token_atomic(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking_by_token_atomic(TEXT, TEXT)
  TO service_role;

-- ------------------------------------------------------------------------------
-- 3. ATOMIC RESCHEDULING BY TOKEN (`reschedule_booking_by_token_atomic`)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reschedule_booking_by_token_atomic(
  p_token_hash TEXT,
  p_new_appointment_date DATE,
  p_new_start_time_local TIME,
  p_new_cancel_token_hash TEXT,
  p_new_reschedule_token_hash TEXT,
  p_new_token_expires_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token public.booking_tokens%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_service public.services%ROWTYPE;
  v_resource public.booking_resources%ROWTYPE;
  v_hours public.business_hours%ROWTYPE;
  v_dow SMALLINT;
  v_effective_minutes INTEGER;
  v_new_end_time_local TIME;
  v_new_start_at TIMESTAMPTZ;
  v_new_end_at TIMESTAMPTZ;
  v_new_effective_end_at TIMESTAMPTZ;
  v_blocked_reason TEXT;
  v_allocated_overlapping INTEGER;
  v_prev_status public.booking_status_enum;
  v_token_id UUID;
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
BEGIN
  IF p_new_token_expires_at <= v_now THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', FALSE,
      'error_code', 'INVALID_TOKEN_EXPIRY',
      'message', 'Replacement token expiration must be in the future.'
    );
  END IF;

  SELECT * INTO v_token
  FROM public.booking_tokens
  WHERE token_hash = p_token_hash
    AND purpose = 'reschedule'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'INVALID_TOKEN', 'message', 'Reschedule token is invalid.');
  END IF;

  v_token_id := v_token.id;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = v_token.booking_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'Booking record could not be located.');
  END IF;

  -- Keep the same lock order as the expiration sweeper: booking, then token.
  SELECT * INTO v_token
  FROM public.booking_tokens t
  WHERE t.id = v_token_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'INVALID_TOKEN', 'message', 'Reschedule token is invalid.');
  END IF;

  IF v_token.used_at IS NOT NULL OR v_token.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'TOKEN_ALREADY_USED', 'message', 'This reschedule token has already been used or revoked.');
  END IF;

  IF v_token.expires_at <= v_now THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'TOKEN_EXPIRED', 'message', 'This reschedule token has expired.');
  END IF;

  v_prev_status := v_booking.status;

  IF v_booking.status = 'pending' AND v_booking.pending_expires_at <= v_now THEN
    UPDATE public.bookings
    SET status = 'expired',
        pending_expires_at = NULL
    WHERE id = v_booking.id;

    UPDATE public.booking_tokens
    SET revoked_at = v_now
    WHERE booking_id = v_booking.id
      AND used_at IS NULL
      AND revoked_at IS NULL;

    INSERT INTO public.booking_audit_logs
      (booking_id, actor_type, action, previous_status, new_status, metadata)
    VALUES (
      v_booking.id,
      'system',
      'BOOKING_PENDING_EXPIRED',
      'pending',
      'expired',
      pg_catalog.jsonb_build_object('expired_at', v_now)
    );

    RETURN pg_catalog.jsonb_build_object(
      'ok', FALSE,
      'error_code', 'PENDING_EXPIRED',
      'message', 'The pending booking hold expired and can no longer be rescheduled.'
    );
  END IF;

  IF v_booking.status NOT IN ('pending', 'confirmed') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'INVALID_BOOKING_STATE', 'message', 'Only pending or confirmed bookings can be rescheduled.');
  END IF;

  SELECT * INTO v_service
  FROM public.services
  WHERE id = v_booking.service_id
  LIMIT 1;

  IF NOT FOUND OR NOT v_service.is_active THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'INVALID_SERVICE', 'message', 'The booking service is no longer available.');
  END IF;

  IF v_now >= (
    v_booking.start_at -
    pg_catalog.make_interval(mins => v_service.reschedule_cutoff_minutes)
  ) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', FALSE,
      'error_code', 'MODIFICATION_CUTOFF_REACHED',
      'message', 'The rescheduling cutoff has been reached.'
    );
  END IF;

  v_dow := EXTRACT(DOW FROM p_new_appointment_date)::SMALLINT;
  IF v_dow = 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'SUNDAY_CLOSED', 'message', 'Manila Auto Pros is closed on Sundays.');
  END IF;

  SELECT * INTO v_hours
  FROM public.business_hours
  WHERE day_of_week = v_dow
  LIMIT 1;

  IF NOT FOUND OR v_hours.is_closed THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'DAY_CLOSED', 'message', 'Studio is closed on the selected day.');
  END IF;

  -- Preserve the original booking snapshot on every reschedule.
  v_effective_minutes := v_booking.duration_minutes + v_booking.buffer_minutes;
  v_new_end_time_local := p_new_start_time_local + pg_catalog.make_interval(mins => v_booking.duration_minutes);

  IF p_new_start_time_local < v_hours.open_time
     OR v_new_end_time_local > v_hours.close_time
     OR v_new_end_time_local <= p_new_start_time_local THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'OUTSIDE_OPERATING_HOURS', 'message', 'Requested appointment exceeds operating hours.');
  END IF;

  v_new_start_at := (p_new_appointment_date::text || ' ' || p_new_start_time_local::text) :: TIMESTAMP AT TIME ZONE 'Asia/Manila';
  v_new_end_at := v_new_start_at + pg_catalog.make_interval(mins => v_booking.duration_minutes);
  v_new_effective_end_at := v_new_start_at + pg_catalog.make_interval(mins => v_effective_minutes);

  IF v_new_start_at < (v_now + pg_catalog.make_interval(hours => v_service.min_notice_hours)) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'MIN_NOTICE_VIOLATION', 'message', 'New appointment does not meet minimum advance notice.');
  END IF;

  IF p_new_appointment_date > ((v_now AT TIME ZONE 'Asia/Manila')::date + v_service.max_advance_days) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'MAX_ADVANCE_VIOLATION', 'message', 'New appointment is beyond the maximum advance booking window.');
  END IF;

  SELECT * INTO v_resource
  FROM public.booking_resources
  WHERE id = v_booking.resource_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_resource.is_active THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'RESOURCE_UNAVAILABLE', 'message', 'Studio bay resource pool is unavailable.');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_resource.id::text || ':' || p_new_appointment_date::text, 0)
  );

  SELECT reason INTO v_blocked_reason
  FROM public.blocked_dates
  WHERE blocked_date = p_new_appointment_date
    AND is_active = TRUE
    AND (resource_id IS NULL OR resource_id = v_resource.id)
    AND (
      (start_time IS NULL AND end_time IS NULL) OR
      (p_new_start_time_local < end_time AND v_new_end_time_local > start_time)
    )
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'DATE_BLOCKED', 'message', 'Selected date or time window is blocked: ' || v_blocked_reason);
  END IF;

  -- Exclude current booking (`b.id <> v_booking.id`) so its old capacity is released atomically
  SELECT COALESCE(MAX(usage.allocated_units), 0)
  INTO v_allocated_overlapping
  FROM (
    SELECT v_new_start_at AS point_at
    UNION
    SELECT GREATEST(b.start_at, v_new_start_at)
    FROM public.bookings b
    WHERE b.resource_id = v_resource.id
      AND b.id <> v_booking.id
      AND b.appointment_date = p_new_appointment_date
      AND (
        b.status = 'confirmed' OR
        (b.status = 'pending' AND b.pending_expires_at > v_now)
      )
      AND b.start_at < v_new_effective_end_at
      AND (b.end_at + make_interval(mins => b.buffer_minutes)) > v_new_start_at
  ) points
  CROSS JOIN LATERAL (
    SELECT COALESCE(SUM(b2.allocated_units), 0) AS allocated_units
    FROM public.bookings b2
    WHERE b2.resource_id = v_resource.id
      AND b2.id <> v_booking.id
      AND b2.appointment_date = p_new_appointment_date
      AND (
        b2.status = 'confirmed' OR
        (b2.status = 'pending' AND b2.pending_expires_at > v_now)
      )
      AND b2.start_at <= points.point_at
      AND (b2.end_at + make_interval(mins => b2.buffer_minutes)) > points.point_at
  ) usage;

  IF (v_allocated_overlapping + v_booking.allocated_units) > v_resource.total_capacity THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'SLOT_CAPACITY_EXHAUSTED', 'message', 'The new time slot does not have sufficient bay capacity.');
  END IF;

  UPDATE public.bookings
  SET appointment_date = p_new_appointment_date,
      start_time_local = p_new_start_time_local,
      end_time_local = v_new_end_time_local,
      start_at = v_new_start_at,
      end_at = v_new_end_at,
      rescheduled_count = rescheduled_count + 1
  WHERE id = v_booking.id;

  -- Invalidate used reschedule token & rotate tokens
  UPDATE public.booking_tokens
  SET used_at = v_now
  WHERE id = v_token.id;

  UPDATE public.booking_tokens
  SET revoked_at = v_now
  WHERE booking_id = v_booking.id
    AND id <> v_token.id
    AND used_at IS NULL
    AND revoked_at IS NULL;

  INSERT INTO public.booking_tokens (booking_id, purpose, token_hash, expires_at)
  VALUES
    (v_booking.id, 'cancel', p_new_cancel_token_hash, p_new_token_expires_at),
    (v_booking.id, 'reschedule', p_new_reschedule_token_hash, p_new_token_expires_at);

  INSERT INTO public.booking_audit_logs (booking_id, actor_type, action, previous_status, new_status, metadata)
  VALUES (
    v_booking.id,
    'customer',
    'BOOKING_RESCHEDULED_BY_TOKEN',
    v_prev_status,
    v_booking.status,
    jsonb_build_object(
      'old_date', v_booking.appointment_date,
      'old_start_time', to_char(v_booking.start_time_local, 'HH24:MI'),
      'new_date', p_new_appointment_date,
      'new_start_time', to_char(p_new_start_time_local, 'HH24:MI')
    )
  );

  RETURN jsonb_build_object(
    'ok', TRUE,
    'booking_id', v_booking.id,
    'reference_code', v_booking.reference_code,
    'status', v_booking.status,
    'appointment_date', p_new_appointment_date,
    'start_time_local', to_char(p_new_start_time_local, 'HH24:MI'),
    'end_time_local', to_char(v_new_end_time_local, 'HH24:MI'),
    'start_at', v_new_start_at,
    'end_at', v_new_end_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_booking_by_token_atomic(
  TEXT, DATE, TIME, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reschedule_booking_by_token_atomic(
  TEXT, DATE, TIME, TEXT, TEXT, TIMESTAMPTZ
) TO service_role;

-- ------------------------------------------------------------------------------
-- 4. EXPIRE PENDING HOLDS (`expire_pending_bookings_atomic`)
-- Invoke from a trusted server scheduler before administrative approval queues.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_pending_bookings_atomic()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_expired_count INTEGER := 0;
BEGIN
  FOR v_booking IN
    SELECT b.*
    FROM public.bookings b
    WHERE b.status = 'pending'
      AND b.pending_expires_at <= v_now
    ORDER BY b.pending_expires_at, b.id
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.bookings
    SET status = 'expired',
        pending_expires_at = NULL
    WHERE id = v_booking.id;

    UPDATE public.booking_tokens
    SET revoked_at = v_now
    WHERE booking_id = v_booking.id
      AND used_at IS NULL
      AND revoked_at IS NULL;

    INSERT INTO public.booking_audit_logs
      (booking_id, actor_type, action, previous_status, new_status, metadata)
    VALUES (
      v_booking.id,
      'system',
      'BOOKING_PENDING_EXPIRED',
      'pending',
      'expired',
      pg_catalog.jsonb_build_object('expired_at', v_now)
    );

    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN v_expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_pending_bookings_atomic()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_pending_bookings_atomic()
  TO service_role;
