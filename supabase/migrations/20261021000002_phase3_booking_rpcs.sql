-- ==============================================================================
-- MANILA AUTO PROS — PHASE 3 ATOMIC RESERVATION & TOKEN RPC FUNCTIONS
-- Migration: 20261021000002_phase3_booking_rpcs.sql
-- Implements database-level concurrency control using transaction advisory locks
-- (`pg_advisory_xact_lock`) and `FOR UPDATE` row locks on `booking_resources`.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ATOMIC BOOKING CREATION (`create_booking_atomic`)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_booking_atomic(
  p_idempotency_key TEXT,
  p_reference_code TEXT,
  p_option_slug TEXT,
  p_vehicle_type vehicle_type_enum,
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
  p_token_expires_at TIMESTAMPTZ,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_booking bookings%ROWTYPE;
  v_service services%ROWTYPE;
  v_resource booking_resources%ROWTYPE;
  v_hours business_hours%ROWTYPE;
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
  v_status booking_status_enum;
  v_pending_expires_at TIMESTAMPTZ;
BEGIN
  -- 1. Idempotency check: if a booking with this idempotency_key already exists, return it
  SELECT * INTO v_existing_booking
  FROM bookings
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;

  IF FOUND THEN
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
  FROM services
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
  FROM business_hours
  WHERE day_of_week = v_dow
  LIMIT 1;

  IF NOT FOUND OR v_hours.is_closed THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'DAY_CLOSED', 'message', 'Studio is closed on the selected day.');
  END IF;

  v_effective_minutes := v_service.duration_minutes + v_service.buffer_minutes;
  v_end_time_local := p_start_time_local + make_interval(mins => v_service.duration_minutes);

  IF p_start_time_local < v_hours.open_time OR v_end_time_local > v_hours.close_time OR (p_start_time_local + make_interval(mins => v_service.duration_minutes) < p_start_time_local) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'OUTSIDE_OPERATING_HOURS', 'message', 'Requested appointment exceeds operating hours.');
  END IF;

  -- Construct TIMESTAMPTZ instants in Asia/Manila
  v_start_at := (p_appointment_date::text || ' ' || p_start_time_local::text) :: TIMESTAMP AT TIME ZONE 'Asia/Manila';
  v_end_at := v_start_at + make_interval(mins => v_service.duration_minutes);
  v_effective_end_at := v_start_at + make_interval(mins => v_effective_minutes);

  -- 4. Check minimum notice and maximum advance window
  IF v_start_at < (p_now + make_interval(hours => v_service.min_notice_hours)) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'MIN_NOTICE_VIOLATION', 'message', 'Appointment does not meet minimum advance notice.');
  END IF;

  IF p_appointment_date > ((p_now AT TIME ZONE 'Asia/Manila')::date + v_service.max_advance_days) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'MAX_ADVANCE_VIOLATION', 'message', 'Appointment is beyond the maximum advance booking window.');
  END IF;

  -- 5. Acquire Resource Pool with FOR UPDATE lock + Transaction Advisory Lock
  SELECT * INTO v_resource
  FROM booking_resources
  WHERE resource_type = v_service.required_resource_type
    AND is_active = TRUE
  ORDER BY code ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'RESOURCE_UNAVAILABLE', 'message', 'Studio bay resource pool is unavailable.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_resource.id::text || ':' || p_appointment_date::text));

  -- 6. Check Blocked Dates (full day or overlapping time window)
  SELECT reason INTO v_blocked_reason
  FROM blocked_dates
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

  -- 7. Concurrency-Safe Capacity Verification inside locked transaction
  SELECT COALESCE(SUM(b.allocated_units), 0) INTO v_allocated_overlapping
  FROM bookings b
  WHERE b.resource_id = v_resource.id
    AND b.appointment_date = p_appointment_date
    AND (
      b.status = 'confirmed' OR
      (b.status = 'pending' AND (b.pending_expires_at IS NULL OR b.pending_expires_at > p_now))
    )
    AND b.start_at < v_effective_end_at
    AND (b.end_at + make_interval(mins => b.buffer_minutes)) > v_start_at;

  IF (v_allocated_overlapping + v_service.required_units) > v_resource.total_capacity THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error_code', 'SLOT_CAPACITY_EXHAUSTED',
      'message', 'The selected time slot no longer has sufficient bay capacity.'
    );
  END IF;

  -- 8. Insert Customer & Vehicle records
  INSERT INTO customers (full_name, email, email_normalized, phone, phone_normalized)
  VALUES (
    btrim(p_customer_name),
    btrim(p_customer_email),
    lower(btrim(p_customer_email)),
    btrim(p_customer_phone),
    regexp_replace(p_customer_phone, '\D', '', 'g')
  )
  RETURNING id INTO v_customer_id;

  INSERT INTO vehicles (customer_id, vehicle_type, manufacturer, model, model_year, notes)
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
    v_pending_expires_at := p_now + make_interval(mins => v_service.pending_hold_minutes);
  END IF;

  -- 10. Insert Booking
  INSERT INTO bookings (
    reference_code,
    idempotency_key,
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
  INSERT INTO booking_tokens (booking_id, purpose, token_hash, expires_at)
  VALUES
    (v_booking_id, 'cancel', p_cancel_token_hash, p_token_expires_at),
    (v_booking_id, 'reschedule', p_reschedule_token_hash, p_token_expires_at);

  -- 12. Write Audit Log
  INSERT INTO booking_audit_logs (booking_id, actor_type, action, previous_status, new_status, metadata)
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
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. ATOMIC CANCELLATION BY TOKEN (`cancel_booking_by_token_atomic`)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cancel_booking_by_token_atomic(
  p_token_hash TEXT,
  p_reason TEXT DEFAULT 'Cancelled by customer via secure token',
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token booking_tokens%ROWTYPE;
  v_booking bookings%ROWTYPE;
  v_prev_status booking_status_enum;
BEGIN
  SELECT * INTO v_token
  FROM booking_tokens
  WHERE token_hash = p_token_hash
    AND purpose = 'cancel'
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'INVALID_TOKEN', 'message', 'Cancellation token is invalid.');
  END IF;

  IF v_token.used_at IS NOT NULL OR v_token.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'TOKEN_ALREADY_USED', 'message', 'This cancellation link has already been used or revoked.');
  END IF;

  IF v_token.expires_at <= p_now THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'TOKEN_EXPIRED', 'message', 'This cancellation link has expired.');
  END IF;

  SELECT * INTO v_booking
  FROM bookings
  WHERE id = v_token.booking_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'Booking record could not be located.');
  END IF;

  IF v_booking.status IN ('cancelled', 'rejected', 'completed') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'INVALID_BOOKING_STATE', 'message', 'Appointment cannot be cancelled in its current status.');
  END IF;

  v_prev_status := v_booking.status;

  -- Mark booking cancelled (atomically releasing allocated capacity)
  UPDATE bookings
  SET status = 'cancelled',
      cancellation_reason = btrim(COALESCE(p_reason, 'Cancelled by customer')),
      cancelled_at = p_now
  WHERE id = v_booking.id;

  -- Invalidate cancel token and revoke any unused reschedule tokens for this booking
  UPDATE booking_tokens
  SET used_at = p_now
  WHERE id = v_token.id;

  UPDATE booking_tokens
  SET revoked_at = p_now
  WHERE booking_id = v_booking.id
    AND id <> v_token.id
    AND used_at IS NULL
    AND revoked_at IS NULL;

  INSERT INTO booking_audit_logs (booking_id, actor_type, action, previous_status, new_status, metadata)
  VALUES (
    v_booking.id,
    'customer',
    'BOOKING_CANCELLED_BY_TOKEN',
    v_prev_status,
    'cancelled',
    jsonb_build_object('reason', btrim(COALESCE(p_reason, 'Cancelled by customer')))
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

-- ------------------------------------------------------------------------------
-- 3. ATOMIC RESCHEDULING BY TOKEN (`reschedule_booking_by_token_atomic`)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reschedule_booking_by_token_atomic(
  p_token_hash TEXT,
  p_new_appointment_date DATE,
  p_new_start_time_local TIME,
  p_new_cancel_token_hash TEXT,
  p_new_reschedule_token_hash TEXT,
  p_new_token_expires_at TIMESTAMPTZ,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token booking_tokens%ROWTYPE;
  v_booking bookings%ROWTYPE;
  v_service services%ROWTYPE;
  v_resource booking_resources%ROWTYPE;
  v_hours business_hours%ROWTYPE;
  v_dow SMALLINT;
  v_effective_minutes INTEGER;
  v_new_end_time_local TIME;
  v_new_start_at TIMESTAMPTZ;
  v_new_end_at TIMESTAMPTZ;
  v_new_effective_end_at TIMESTAMPTZ;
  v_blocked_reason TEXT;
  v_allocated_overlapping INTEGER;
  v_prev_status booking_status_enum;
BEGIN
  SELECT * INTO v_token
  FROM booking_tokens
  WHERE token_hash = p_token_hash
    AND purpose = 'reschedule'
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'INVALID_TOKEN', 'message', 'Reschedule token is invalid.');
  END IF;

  IF v_token.used_at IS NOT NULL OR v_token.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'TOKEN_ALREADY_USED', 'message', 'This reschedule token has already been used or revoked.');
  END IF;

  IF v_token.expires_at <= p_now THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'TOKEN_EXPIRED', 'message', 'This reschedule token has expired.');
  END IF;

  SELECT * INTO v_booking
  FROM bookings
  WHERE id = v_token.booking_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'Booking record could not be located.');
  END IF;

  IF v_booking.status NOT IN ('pending', 'confirmed') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'INVALID_BOOKING_STATE', 'message', 'Only pending or confirmed bookings can be rescheduled.');
  END IF;

  SELECT * INTO v_service
  FROM services
  WHERE id = v_booking.service_id
  LIMIT 1;

  v_dow := EXTRACT(DOW FROM p_new_appointment_date)::SMALLINT;
  IF v_dow = 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'SUNDAY_CLOSED', 'message', 'Manila Auto Pros is closed on Sundays.');
  END IF;

  SELECT * INTO v_hours
  FROM business_hours
  WHERE day_of_week = v_dow
  LIMIT 1;

  IF NOT FOUND OR v_hours.is_closed THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'DAY_CLOSED', 'message', 'Studio is closed on the selected day.');
  END IF;

  v_effective_minutes := v_service.duration_minutes + v_service.buffer_minutes;
  v_new_end_time_local := p_new_start_time_local + make_interval(mins => v_service.duration_minutes);

  IF p_new_start_time_local < v_hours.open_time OR v_new_end_time_local > v_hours.close_time THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'OUTSIDE_OPERATING_HOURS', 'message', 'Requested appointment exceeds operating hours.');
  END IF;

  v_new_start_at := (p_new_appointment_date::text || ' ' || p_new_start_time_local::text) :: TIMESTAMP AT TIME ZONE 'Asia/Manila';
  v_new_end_at := v_new_start_at + make_interval(mins => v_service.duration_minutes);
  v_new_effective_end_at := v_new_start_at + make_interval(mins => v_effective_minutes);

  IF v_new_start_at < (p_now + make_interval(hours => v_service.min_notice_hours)) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'MIN_NOTICE_VIOLATION', 'message', 'New appointment does not meet minimum advance notice.');
  END IF;

  SELECT * INTO v_resource
  FROM booking_resources
  WHERE id = v_booking.resource_id
  FOR UPDATE;

  PERFORM pg_advisory_xact_lock(hashtext(v_resource.id::text || ':' || p_new_appointment_date::text));

  SELECT reason INTO v_blocked_reason
  FROM blocked_dates
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
  SELECT COALESCE(SUM(b.allocated_units), 0) INTO v_allocated_overlapping
  FROM bookings b
  WHERE b.resource_id = v_resource.id
    AND b.id <> v_booking.id
    AND b.appointment_date = p_new_appointment_date
    AND (
      b.status = 'confirmed' OR
      (b.status = 'pending' AND (b.pending_expires_at IS NULL OR b.pending_expires_at > p_now))
    )
    AND b.start_at < v_new_effective_end_at
    AND (b.end_at + make_interval(mins => b.buffer_minutes)) > v_new_start_at;

  IF (v_allocated_overlapping + v_booking.allocated_units) > v_resource.total_capacity THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'SLOT_CAPACITY_EXHAUSTED', 'message', 'The new time slot does not have sufficient bay capacity.');
  END IF;

  v_prev_status := v_booking.status;

  UPDATE bookings
  SET appointment_date = p_new_appointment_date,
      start_time_local = p_new_start_time_local,
      end_time_local = v_new_end_time_local,
      start_at = v_new_start_at,
      end_at = v_new_end_at,
      rescheduled_count = rescheduled_count + 1
  WHERE id = v_booking.id;

  -- Invalidate used reschedule token & rotate tokens
  UPDATE booking_tokens
  SET used_at = p_now
  WHERE id = v_token.id;

  UPDATE booking_tokens
  SET revoked_at = p_now
  WHERE booking_id = v_booking.id
    AND id <> v_token.id
    AND used_at IS NULL
    AND revoked_at IS NULL;

  INSERT INTO booking_tokens (booking_id, purpose, token_hash, expires_at)
  VALUES
    (v_booking.id, 'cancel', p_new_cancel_token_hash, p_new_token_expires_at),
    (v_booking.id, 'reschedule', p_new_reschedule_token_hash, p_new_token_expires_at);

  INSERT INTO booking_audit_logs (booking_id, actor_type, action, previous_status, new_status, metadata)
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
