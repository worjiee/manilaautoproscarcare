-- =============================================================================
-- MANILA AUTO PROS — PHASE 5.1 TRANSACTIONAL EMAIL FOUNDATION
--
-- This migration is intentionally delivery-dormant. It creates the durable
-- outbox and encrypted management-link storage, and atomically derives email
-- events from the booking audit records already written by the verified
-- booking RPCs. It does not install a dispatcher, scheduler, or seed data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DURABLE DOMAIN EVENTS
-- -----------------------------------------------------------------------------
CREATE TABLE public.email_outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  source_audit_log_id UUID NOT NULL
    REFERENCES public.booking_audit_logs(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'booking.request_received',
    'booking.confirmed',
    'booking.rejected',
    'booking.cancelled',
    'booking.rescheduled',
    'booking.pending_expired',
    'admin.new_pending_booking'
  )),
  recipient_kind TEXT NOT NULL CHECK (recipient_kind IN ('customer', 'admin')),
  template_key TEXT NOT NULL CHECK (template_key ~ '^[a-z0-9._-]{3,100}$'),
  template_version INTEGER NOT NULL DEFAULT 1 CHECK (template_version > 0),
  booking_status public.booking_status_enum NOT NULL,
  appointment_date DATE NOT NULL,
  start_time_local TIME NOT NULL,
  end_time_local TIME NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'materialized', 'completed', 'dead_letter')),
  materialized_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_email_outbox_event_dedupe
    UNIQUE (source_audit_log_id, event_type, recipient_kind),
  CONSTRAINT chk_email_outbox_state_timestamps CHECK (
    (state = 'pending' AND materialized_at IS NULL AND completed_at IS NULL) OR
    (state = 'materialized' AND materialized_at IS NOT NULL AND completed_at IS NULL) OR
    (state IN ('completed', 'dead_letter') AND completed_at IS NOT NULL)
  )
);

CREATE INDEX idx_email_outbox_events_pending
  ON public.email_outbox_events(created_at, id)
  WHERE state = 'pending';
CREATE INDEX idx_email_outbox_events_booking
  ON public.email_outbox_events(booking_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. RECIPIENT-SPECIFIC DELIVERIES
-- -----------------------------------------------------------------------------
CREATE TABLE public.email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_event_id UUID NOT NULL
    REFERENCES public.email_outbox_events(id) ON DELETE RESTRICT,
  recipient_email TEXT NOT NULL CHECK (
    char_length(recipient_email) BETWEEN 3 AND 254 AND
    recipient_email = lower(btrim(recipient_email)) AND
    recipient_email !~ '[[:space:][:cntrl:]]' AND
    recipient_email ~ '^[^@]+@[^@]+\.[^@]+$'
  ),
  idempotency_key TEXT NOT NULL UNIQUE
    CHECK (char_length(idempotency_key) BETWEEN 1 AND 256),
  template_key TEXT NOT NULL CHECK (template_key ~ '^[a-z0-9._-]{3,100}$'),
  template_version INTEGER NOT NULL CHECK (template_version > 0),
  content_sha256 TEXT CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN (
    'pending',
    'leased',
    'accepted',
    'delivered',
    'retry',
    'delivery_delayed',
    'bounced',
    'suppressed',
    'complained',
    'failed',
    'dead_letter'
  )),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 20),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  provider_message_id TEXT UNIQUE,
  provider_accepted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  terminal_at TIMESTAMPTZ,
  last_error_code TEXT CHECK (
    last_error_code IS NULL OR last_error_code ~ '^[A-Z0-9_:-]{1,100}$'
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_email_delivery_recipient
    UNIQUE (outbox_event_id, recipient_email),
  CONSTRAINT chk_email_delivery_lease CHECK (
    (state = 'leased' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL) OR
    (state <> 'leased' AND lease_token IS NULL AND lease_expires_at IS NULL)
  ),
  CONSTRAINT chk_email_delivery_provider_acceptance CHECK (
    provider_accepted_at IS NULL OR provider_message_id IS NOT NULL
  ),
  CONSTRAINT chk_email_delivery_terminal_timestamp CHECK (
    (state IN ('delivered', 'bounced', 'suppressed', 'complained', 'failed', 'dead_letter')
      AND terminal_at IS NOT NULL) OR
    (state NOT IN ('delivered', 'bounced', 'suppressed', 'complained', 'failed', 'dead_letter')
      AND terminal_at IS NULL)
  )
);

CREATE INDEX idx_email_deliveries_due
  ON public.email_deliveries(next_attempt_at, id)
  WHERE state IN ('pending', 'retry');
CREATE INDEX idx_email_deliveries_expired_leases
  ON public.email_deliveries(lease_expires_at, id)
  WHERE state = 'leased';
CREATE INDEX idx_email_deliveries_event
  ON public.email_deliveries(outbox_event_id, created_at);

-- -----------------------------------------------------------------------------
-- 3. APPEND-ONLY DELIVERY ATTEMPTS AND VERIFIED WEBHOOK RECEIPTS
-- -----------------------------------------------------------------------------
CREATE TABLE public.email_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.email_deliveries(id) ON DELETE RESTRICT,
  attempt_number INTEGER NOT NULL CHECK (attempt_number BETWEEN 1 AND 20),
  outcome TEXT NOT NULL CHECK (outcome IN (
    'accepted',
    'retryable_failure',
    'permanent_failure',
    'ambiguous'
  )),
  provider_message_id TEXT,
  response_code INTEGER CHECK (response_code IS NULL OR response_code BETWEEN 100 AND 599),
  error_code TEXT CHECK (error_code IS NULL OR error_code ~ '^[A-Z0-9_:-]{1,100}$'),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_email_delivery_attempt UNIQUE (delivery_id, attempt_number),
  CONSTRAINT chk_email_delivery_attempt_interval CHECK (finished_at >= started_at)
);

CREATE INDEX idx_email_delivery_attempts_delivery
  ON public.email_delivery_attempts(delivery_id, attempt_number);

CREATE TABLE public.email_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id TEXT NOT NULL UNIQUE
    CHECK (char_length(provider_event_id) BETWEEN 1 AND 255),
  provider_message_id TEXT NOT NULL
    CHECK (char_length(provider_message_id) BETWEEN 1 AND 255),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'email.sent',
    'email.delivered',
    'email.delivery_delayed',
    'email.bounced',
    'email.suppressed',
    'email.complained',
    'email.failed'
  )),
  payload_sha256 TEXT NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  occurred_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_email_webhook_events_message
  ON public.email_webhook_events(provider_message_id, occurred_at);

-- -----------------------------------------------------------------------------
-- 4. AUTHENTICATED-ENCRYPTION ENVELOPES FOR CUSTOMER MANAGEMENT LINKS
--
-- Only AES-GCM ciphertext is stored. The 256-bit encryption key remains in the
-- application environment. The AAD digest binds the ciphertext to the exact
-- cancel/reschedule token hashes and token version. Raw bearer tokens never
-- enter PostgreSQL.
-- -----------------------------------------------------------------------------
CREATE TABLE public.booking_delivery_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  token_version INTEGER NOT NULL CHECK (token_version > 0),
  cancel_token_hash TEXT NOT NULL CHECK (cancel_token_hash ~ '^[0-9a-f]{64}$'),
  reschedule_token_hash TEXT NOT NULL CHECK (reschedule_token_hash ~ '^[0-9a-f]{64}$'),
  algorithm TEXT NOT NULL DEFAULT 'aes-256-gcm' CHECK (algorithm = 'aes-256-gcm'),
  key_version TEXT NOT NULL CHECK (key_version ~ '^[A-Za-z0-9._-]{1,64}$'),
  nonce_base64url TEXT NOT NULL CHECK (nonce_base64url ~ '^[A-Za-z0-9_-]{16}$'),
  ciphertext_base64url TEXT NOT NULL CHECK (
    char_length(ciphertext_base64url) BETWEEN 32 AND 4096 AND
    ciphertext_base64url ~ '^[A-Za-z0-9_-]+$'
  ),
  auth_tag_base64url TEXT NOT NULL CHECK (auth_tag_base64url ~ '^[A-Za-z0-9_-]{22}$'),
  aad_sha256 TEXT NOT NULL CHECK (aad_sha256 ~ '^[0-9a-f]{64}$'),
  token_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  redacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_booking_delivery_secret_version UNIQUE (booking_id, token_version),
  CONSTRAINT chk_booking_delivery_secret_redaction CHECK (
    redacted_at IS NULL OR revoked_at IS NOT NULL
  )
);

CREATE UNIQUE INDEX uq_booking_delivery_secret_current
  ON public.booking_delivery_secrets(booking_id)
  WHERE revoked_at IS NULL;
CREATE INDEX idx_booking_delivery_secrets_expiry
  ON public.booking_delivery_secrets(token_expires_at)
  WHERE revoked_at IS NULL;

-- -----------------------------------------------------------------------------
-- 5. RLS AND TABLE PRIVILEGES
-- -----------------------------------------------------------------------------
ALTER TABLE public.email_outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_delivery_secrets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.email_outbox_events,
  public.email_deliveries,
  public.email_delivery_attempts,
  public.email_webhook_events,
  public.booking_delivery_secrets
FROM PUBLIC, anon, authenticated, service_role;

-- No RLS policies are created. All access is deny-by-default. A future worker
-- migration must expose narrowly scoped SECURITY DEFINER RPCs instead of table
-- grants; this migration deliberately creates no delivery-capable RPC.

-- -----------------------------------------------------------------------------
-- 6. UPDATED-AT GUARD FOR MUTABLE DELIVERY STATE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_email_delivery_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_email_delivery_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_email_deliveries_updated_at
  BEFORE UPDATE ON public.email_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_email_delivery_updated_at();

-- -----------------------------------------------------------------------------
-- 7. ATOMIC OUTBOX DERIVATION FROM IMMUTABLE BOOKING AUDIT EVENTS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_booking_email_events_from_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_customer_event TEXT;
BEGIN
  SELECT b.*
  INTO STRICT v_booking
  FROM public.bookings AS b
  WHERE b.id = NEW.booking_id;

  v_customer_event := CASE
    WHEN NEW.action = 'BOOKING_CREATED' AND NEW.new_status = 'pending'
      THEN 'booking.request_received'
    WHEN NEW.action = 'BOOKING_CREATED' AND NEW.new_status = 'confirmed'
      THEN 'booking.confirmed'
    WHEN NEW.action = 'BOOKING_ADMIN_APPROVE'
      THEN 'booking.confirmed'
    WHEN NEW.action = 'BOOKING_ADMIN_REJECT'
      THEN 'booking.rejected'
    WHEN NEW.action IN ('BOOKING_CANCELLED_BY_TOKEN', 'BOOKING_ADMIN_CANCEL')
      THEN 'booking.cancelled'
    WHEN NEW.action IN ('BOOKING_RESCHEDULED_BY_TOKEN', 'BOOKING_ADMIN_RESCHEDULE')
      THEN 'booking.rescheduled'
    WHEN NEW.action = 'BOOKING_PENDING_EXPIRED'
      THEN 'booking.pending_expired'
    ELSE NULL
  END;

  IF v_customer_event IS NOT NULL THEN
    INSERT INTO public.email_outbox_events (
      booking_id,
      source_audit_log_id,
      event_type,
      recipient_kind,
      template_key,
      template_version,
      booking_status,
      appointment_date,
      start_time_local,
      end_time_local
    ) VALUES (
      v_booking.id,
      NEW.id,
      v_customer_event,
      'customer',
      v_customer_event,
      1,
      v_booking.status,
      v_booking.appointment_date,
      v_booking.start_time_local,
      v_booking.end_time_local
    )
    ON CONFLICT (source_audit_log_id, event_type, recipient_kind) DO NOTHING;
  END IF;

  IF NEW.action = 'BOOKING_CREATED' AND NEW.new_status = 'pending' THEN
    INSERT INTO public.email_outbox_events (
      booking_id,
      source_audit_log_id,
      event_type,
      recipient_kind,
      template_key,
      template_version,
      booking_status,
      appointment_date,
      start_time_local,
      end_time_local
    ) VALUES (
      v_booking.id,
      NEW.id,
      'admin.new_pending_booking',
      'admin',
      'admin.new_pending_booking',
      1,
      v_booking.status,
      v_booking.appointment_date,
      v_booking.start_time_local,
      v_booking.end_time_local
    )
    ON CONFLICT (source_audit_log_id, event_type, recipient_kind) DO NOTHING;
  END IF;

  IF NEW.new_status IN ('rejected', 'cancelled', 'expired', 'completed') THEN
    UPDATE public.booking_delivery_secrets
    SET revoked_at = COALESCE(revoked_at, pg_catalog.clock_timestamp())
    WHERE booking_id = NEW.booking_id
      AND revoked_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_booking_email_events_from_audit()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_booking_audit_email_outbox
  AFTER INSERT ON public.booking_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_booking_email_events_from_audit();

-- -----------------------------------------------------------------------------
-- 8. INTERNAL ENVELOPE VALIDATION/STORAGE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_booking_delivery_secret_internal(
  p_booking_id UUID,
  p_cancel_token_hash TEXT,
  p_reschedule_token_hash TEXT,
  p_envelope JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token_version INTEGER;
  v_expected_version INTEGER;
  v_expected_aad_sha256 TEXT;
  v_token_expires_at TIMESTAMPTZ;
  v_active_token_count INTEGER;
BEGIN
  IF p_envelope IS NULL OR p_envelope = 'null'::jsonb THEN
    RETURN;
  END IF;

  IF pg_catalog.jsonb_typeof(p_envelope) <> 'object'
     OR NOT (p_envelope ?& ARRAY[
       'version', 'algorithm', 'keyVersion', 'tokenVersion', 'nonce',
       'ciphertext', 'authTag', 'aadSha256', 'expiresAt'
     ])
     OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(p_envelope)) <> 9
     OR p_envelope->>'version' <> '1'
     OR p_envelope->>'algorithm' <> 'aes-256-gcm'
     OR COALESCE(p_envelope->>'keyVersion', '') !~ '^[A-Za-z0-9._-]{1,64}$'
     OR COALESCE(p_envelope->>'nonce', '') !~ '^[A-Za-z0-9_-]{16}$'
     OR COALESCE(p_envelope->>'ciphertext', '') !~ '^[A-Za-z0-9_-]{32,4096}$'
     OR COALESCE(p_envelope->>'authTag', '') !~ '^[A-Za-z0-9_-]{22}$'
     OR COALESCE(p_envelope->>'aadSha256', '') !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION 'Invalid management-link encryption envelope.'
      USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_token_version := (p_envelope->>'tokenVersion')::INTEGER;
    v_token_expires_at := (p_envelope->>'expiresAt')::TIMESTAMPTZ;
  EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
    RAISE EXCEPTION 'Invalid management-link envelope version or expiration.'
      USING ERRCODE = '22023';
  END;

  SELECT b.rescheduled_count + 1
  INTO STRICT v_expected_version
  FROM public.bookings AS b
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF v_token_version <> v_expected_version THEN
    RAISE EXCEPTION 'Management-link token version does not match booking state.'
      USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.count(*), pg_catalog.min(t.expires_at)
  INTO v_active_token_count, v_token_expires_at
  FROM public.booking_tokens AS t
  WHERE t.booking_id = p_booking_id
    AND t.used_at IS NULL
    AND t.revoked_at IS NULL
    AND (
      (t.purpose = 'cancel' AND t.token_hash = p_cancel_token_hash) OR
      (t.purpose = 'reschedule' AND t.token_hash = p_reschedule_token_hash)
    );

  IF v_active_token_count <> 2 THEN
    RAISE EXCEPTION 'Management-link envelope does not match active booking tokens.'
      USING ERRCODE = '22023';
  END IF;

  IF v_token_expires_at IS NULL
     OR v_token_expires_at <> (p_envelope->>'expiresAt')::TIMESTAMPTZ
  THEN
    RAISE EXCEPTION 'Management-link expiration does not match active booking tokens.'
      USING ERRCODE = '22023';
  END IF;

  v_expected_aad_sha256 := pg_catalog.encode(
    public.digest(
      pg_catalog.convert_to(
        'manila-auto-pros:booking-links:v1:' ||
        v_token_version::TEXT || ':' ||
        p_cancel_token_hash || ':' ||
        p_reschedule_token_hash,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  IF p_envelope->>'aadSha256' <> v_expected_aad_sha256 THEN
    RAISE EXCEPTION 'Management-link authenticated-data binding is invalid.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.booking_delivery_secrets
  SET revoked_at = COALESCE(revoked_at, pg_catalog.clock_timestamp())
  WHERE booking_id = p_booking_id
    AND revoked_at IS NULL;

  INSERT INTO public.booking_delivery_secrets (
    booking_id,
    token_version,
    cancel_token_hash,
    reschedule_token_hash,
    algorithm,
    key_version,
    nonce_base64url,
    ciphertext_base64url,
    auth_tag_base64url,
    aad_sha256,
    token_expires_at
  ) VALUES (
    p_booking_id,
    v_token_version,
    p_cancel_token_hash,
    p_reschedule_token_hash,
    'aes-256-gcm',
    p_envelope->>'keyVersion',
    p_envelope->>'nonce',
    p_envelope->>'ciphertext',
    p_envelope->>'authTag',
    p_envelope->>'aadSha256',
    v_token_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.store_booking_delivery_secret_internal(
  UUID, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 9. EMAIL-AWARE WRAPPERS AROUND THE VERIFIED PHASE 3 RPCS
--
-- The original RPC signatures remain unchanged for compatibility. These
-- wrappers call them inside the same database transaction, then persist the
-- optional ciphertext envelope. Any envelope validation failure rolls the
-- entire booking operation back.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_booking_with_email_atomic(
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
  p_token_expires_at TIMESTAMPTZ,
  p_management_envelope JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := public.create_booking_atomic(
    p_idempotency_key,
    p_reference_code,
    p_option_slug,
    p_vehicle_type,
    p_manufacturer,
    p_model,
    p_model_year,
    p_vehicle_notes,
    p_appointment_date,
    p_start_time_local,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_additional_requests,
    p_cancel_token_hash,
    p_reschedule_token_hash,
    p_token_expires_at
  );

  IF COALESCE((v_result->>'ok')::BOOLEAN, FALSE)
     AND NOT COALESCE((v_result->>'idempotent_replay')::BOOLEAN, FALSE)
  THEN
    PERFORM public.store_booking_delivery_secret_internal(
      (v_result->>'booking_id')::UUID,
      p_cancel_token_hash,
      p_reschedule_token_hash,
      p_management_envelope
    );
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_with_email_atomic(
  TEXT, TEXT, TEXT, public.vehicle_type_enum, TEXT, TEXT, SMALLINT, TEXT,
  DATE, TIME, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_with_email_atomic(
  TEXT, TEXT, TEXT, public.vehicle_type_enum, TEXT, TEXT, SMALLINT, TEXT,
  DATE, TIME, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB
) TO service_role;

CREATE OR REPLACE FUNCTION public.reschedule_booking_with_email_atomic(
  p_token_hash TEXT,
  p_new_appointment_date DATE,
  p_new_start_time_local TIME,
  p_new_cancel_token_hash TEXT,
  p_new_reschedule_token_hash TEXT,
  p_new_token_expires_at TIMESTAMPTZ,
  p_management_envelope JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := public.reschedule_booking_by_token_atomic(
    p_token_hash,
    p_new_appointment_date,
    p_new_start_time_local,
    p_new_cancel_token_hash,
    p_new_reschedule_token_hash,
    p_new_token_expires_at
  );

  IF COALESCE((v_result->>'ok')::BOOLEAN, FALSE) THEN
    PERFORM public.store_booking_delivery_secret_internal(
      (v_result->>'booking_id')::UUID,
      p_new_cancel_token_hash,
      p_new_reschedule_token_hash,
      p_management_envelope
    );
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_booking_with_email_atomic(
  TEXT, DATE, TIME, TEXT, TEXT, TIMESTAMPTZ, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_booking_with_email_atomic(
  TEXT, DATE, TIME, TEXT, TEXT, TIMESTAMPTZ, JSONB
) TO service_role;

-- Preserve the existing direct pg_cron call. expire_pending_bookings_atomic()
-- is not replaced, renamed, or rescheduled; its existing audit inserts now
-- atomically fan out through trg_booking_audit_email_outbox.

COMMENT ON TABLE public.email_outbox_events IS
  'Durable, provider-neutral email domain events written atomically with booking audits.';
COMMENT ON TABLE public.booking_delivery_secrets IS
  'AES-256-GCM ciphertext for active customer management links; no plaintext bearer tokens.';
