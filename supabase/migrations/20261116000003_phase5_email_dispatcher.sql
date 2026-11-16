-- =============================================================================
-- MANILA AUTO PROS — PHASE 5.2 EMAIL DISPATCHER
--
-- Delivery remains disabled after this migration. A database-owner-controlled
-- activation cutoff must be set explicitly in a separately approved operation.
-- Historical events before that cutoff can never be claimed for delivery.
-- =============================================================================

CREATE TABLE public.email_dispatch_control (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  activation_cutoff_at TIMESTAMPTZ,
  max_attempts INTEGER NOT NULL DEFAULT 8 CHECK (max_attempts BETWEEN 1 AND 20),
  last_changed_by TEXT NOT NULL DEFAULT 'migration'
    CHECK (char_length(btrim(last_changed_by)) BETWEEN 3 AND 200),
  last_change_reason TEXT NOT NULL DEFAULT 'Initial disabled dispatcher state.'
    CHECK (char_length(btrim(last_change_reason)) BETWEEN 10 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chk_email_dispatch_activation CHECK (
    (NOT enabled) OR activation_cutoff_at IS NOT NULL
  )
);

INSERT INTO public.email_dispatch_control(singleton, enabled)
VALUES (TRUE, FALSE);

ALTER TABLE public.email_dispatch_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_dispatch_control
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.email_dispatch_audit_logs (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN (
    'DISPATCHER_ACTIVATED',
    'ACTIVATION_CUTOFF_CHANGED',
    'DISPATCHER_DEACTIVATED',
    'HISTORICAL_REPLAY_AUTHORIZED'
  )),
  actor TEXT NOT NULL CHECK (char_length(btrim(actor)) BETWEEN 3 AND 200),
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 1000),
  previous_enabled BOOLEAN,
  new_enabled BOOLEAN,
  previous_cutoff_at TIMESTAMPTZ,
  new_cutoff_at TIMESTAMPTZ,
  replay_from_at TIMESTAMPTZ,
  replay_to_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (pg_catalog.jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chk_email_dispatch_replay_window CHECK (
    (action = 'HISTORICAL_REPLAY_AUTHORIZED'
      AND replay_from_at IS NOT NULL AND replay_to_at IS NOT NULL
      AND replay_from_at < replay_to_at) OR
    (action <> 'HISTORICAL_REPLAY_AUTHORIZED'
      AND replay_from_at IS NULL AND replay_to_at IS NULL)
  )
);

ALTER TABLE public.email_dispatch_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_dispatch_audit_logs
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.audit_email_dispatch_control_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_action TEXT;
BEGIN
  IF NEW.enabled IS NOT DISTINCT FROM OLD.enabled
     AND NEW.activation_cutoff_at IS NOT DISTINCT FROM OLD.activation_cutoff_at THEN
    RETURN NEW;
  END IF;
  IF NEW.last_change_reason IS NOT DISTINCT FROM OLD.last_change_reason THEN
    RAISE EXCEPTION 'Dispatcher control changes require a new reason.'
      USING ERRCODE = '22023';
  END IF;
  v_action := CASE
    WHEN NOT OLD.enabled AND NEW.enabled THEN 'DISPATCHER_ACTIVATED'
    WHEN OLD.enabled AND NOT NEW.enabled THEN 'DISPATCHER_DEACTIVATED'
    ELSE 'ACTIVATION_CUTOFF_CHANGED'
  END;
  NEW.updated_at := pg_catalog.clock_timestamp();
  INSERT INTO public.email_dispatch_audit_logs(
    action, actor, reason, previous_enabled, new_enabled,
    previous_cutoff_at, new_cutoff_at
  ) VALUES (
    v_action, NEW.last_changed_by, NEW.last_change_reason, OLD.enabled,
    NEW.enabled, OLD.activation_cutoff_at, NEW.activation_cutoff_at
  );
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.audit_email_dispatch_control_change() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.audit_email_dispatch_control_change()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_email_dispatch_control_audit
  BEFORE UPDATE OF enabled, activation_cutoff_at ON public.email_dispatch_control
  FOR EACH ROW EXECUTE FUNCTION public.audit_email_dispatch_control_change();

CREATE OR REPLACE FUNCTION public.authorize_email_historical_replay_owner(
  p_replay_from_at TIMESTAMPTZ,
  p_replay_to_at TIMESTAMPTZ,
  p_actor TEXT,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id UUID;
BEGIN
  IF p_replay_from_at IS NULL OR p_replay_to_at IS NULL
     OR p_replay_from_at >= p_replay_to_at
     OR char_length(btrim(COALESCE(p_actor, ''))) NOT BETWEEN 3 AND 200
     OR char_length(btrim(COALESCE(p_reason, ''))) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'Invalid historical replay authorization.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.email_dispatch_audit_logs(
    action, actor, reason, replay_from_at, replay_to_at
  ) VALUES (
    'HISTORICAL_REPLAY_AUTHORIZED', btrim(p_actor), btrim(p_reason),
    p_replay_from_at, p_replay_to_at
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

ALTER FUNCTION public.authorize_email_historical_replay_owner(
  TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT
) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.authorize_email_historical_replay_owner(
  TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.protect_email_dispatch_audit_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Email dispatcher audit records are immutable.'
    USING ERRCODE = '42501';
END;
$$;

ALTER FUNCTION public.protect_email_dispatch_audit_immutability() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.protect_email_dispatch_audit_immutability()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER trg_email_dispatch_audit_immutable_rows
  BEFORE UPDATE OR DELETE ON public.email_dispatch_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.protect_email_dispatch_audit_immutability();
CREATE TRIGGER trg_email_dispatch_audit_no_truncate
  BEFORE TRUNCATE ON public.email_dispatch_audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION public.protect_email_dispatch_audit_immutability();

ALTER TABLE public.email_outbox_events
  ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 20),
  ADD COLUMN next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  ADD COLUMN lease_token UUID,
  ADD COLUMN lease_started_at TIMESTAMPTZ,
  ADD COLUMN lease_expires_at TIMESTAMPTZ,
  ADD COLUMN last_error_code TEXT CHECK (
    last_error_code IS NULL OR last_error_code ~ '^[A-Z0-9_:-]{1,100}$'
  );

ALTER TABLE public.email_outbox_events DROP CONSTRAINT chk_email_outbox_state_timestamps;
ALTER TABLE public.email_outbox_events DROP CONSTRAINT email_outbox_events_state_check;
ALTER TABLE public.email_outbox_events
  ADD CONSTRAINT email_outbox_events_state_check CHECK (
    state IN ('pending', 'leased', 'materialized', 'completed', 'dead_letter')
  ),
  ADD CONSTRAINT chk_email_outbox_state_timestamps CHECK (
    (state = 'pending' AND materialized_at IS NULL AND completed_at IS NULL) OR
    (state = 'leased' AND materialized_at IS NULL AND completed_at IS NULL) OR
    (state = 'materialized' AND materialized_at IS NOT NULL AND completed_at IS NULL) OR
    (state IN ('completed', 'dead_letter') AND completed_at IS NOT NULL)
  ),
  ADD CONSTRAINT chk_email_outbox_lease CHECK (
    (state = 'leased' AND lease_token IS NOT NULL AND lease_started_at IS NOT NULL
      AND lease_expires_at IS NOT NULL AND lease_expires_at > lease_started_at) OR
    (state <> 'leased' AND lease_token IS NULL AND lease_started_at IS NULL
      AND lease_expires_at IS NULL)
  );

DROP INDEX public.idx_email_outbox_events_pending;
CREATE INDEX idx_email_outbox_events_due
  ON public.email_outbox_events(next_attempt_at, created_at, id)
  WHERE state = 'pending';
CREATE INDEX idx_email_outbox_events_expired_leases
  ON public.email_outbox_events(lease_expires_at, id)
  WHERE state = 'leased';

ALTER TABLE public.email_deliveries
  ADD COLUMN lease_started_at TIMESTAMPTZ,
  ADD COLUMN payload_algorithm TEXT NOT NULL DEFAULT 'aes-256-gcm'
    CHECK (payload_algorithm = 'aes-256-gcm'),
  ADD COLUMN payload_key_version TEXT NOT NULL
    CHECK (payload_key_version ~ '^[A-Za-z0-9._-]{1,64}$'),
  ADD COLUMN payload_nonce_base64url TEXT NOT NULL
    CHECK (payload_nonce_base64url ~ '^[A-Za-z0-9_-]{16}$'),
  ADD COLUMN payload_ciphertext_base64url TEXT NOT NULL
    CHECK (char_length(payload_ciphertext_base64url) BETWEEN 64 AND 2000000
      AND payload_ciphertext_base64url ~ '^[A-Za-z0-9_-]+$'),
  ADD COLUMN payload_auth_tag_base64url TEXT NOT NULL
    CHECK (payload_auth_tag_base64url ~ '^[A-Za-z0-9_-]{22}$'),
  ADD COLUMN payload_aad_sha256 TEXT NOT NULL
    CHECK (payload_aad_sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE public.email_deliveries
  ALTER COLUMN payload_algorithm DROP DEFAULT,
  ALTER COLUMN content_sha256 SET NOT NULL;
ALTER TABLE public.email_deliveries DROP CONSTRAINT chk_email_delivery_lease;
ALTER TABLE public.email_deliveries
  ADD CONSTRAINT chk_email_delivery_lease CHECK (
    (state = 'leased' AND lease_token IS NOT NULL AND lease_started_at IS NOT NULL
      AND lease_expires_at IS NOT NULL AND lease_expires_at > lease_started_at) OR
    (state <> 'leased' AND lease_token IS NULL AND lease_started_at IS NULL
      AND lease_expires_at IS NULL)
  );

CREATE OR REPLACE FUNCTION public.claim_email_outbox_events_atomic(
  p_limit INTEGER DEFAULT 10,
  p_lease_seconds INTEGER DEFAULT 120
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_cutoff TIMESTAMPTZ;
  v_max_attempts INTEGER;
  v_result JSONB;
BEGIN
  IF p_limit NOT BETWEEN 1 AND 50 OR p_lease_seconds NOT BETWEEN 30 AND 900 THEN
    RAISE EXCEPTION 'Invalid email lease request.' USING ERRCODE = '22023';
  END IF;

  SELECT activation_cutoff_at, max_attempts
  INTO v_cutoff, v_max_attempts
  FROM public.email_dispatch_control
  WHERE singleton = TRUE AND enabled = TRUE;

  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  UPDATE public.email_deliveries d
  SET state = 'dead_letter', terminal_at = v_now,
      last_error_code = 'ACTIVATION_CUTOFF', lease_token = NULL,
      lease_started_at = NULL, lease_expires_at = NULL
  FROM public.email_outbox_events e
  WHERE d.outbox_event_id = e.id AND e.created_at < v_cutoff
    AND d.state IN ('pending', 'leased', 'retry');

  UPDATE public.email_outbox_events
  SET state = 'dead_letter', completed_at = v_now,
      last_error_code = 'ACTIVATION_CUTOFF', lease_token = NULL,
      lease_started_at = NULL, lease_expires_at = NULL
  WHERE state IN ('pending', 'leased', 'materialized') AND created_at < v_cutoff;

  UPDATE public.email_outbox_events
  SET state = CASE WHEN attempt_count >= v_max_attempts THEN 'dead_letter' ELSE 'pending' END,
      completed_at = CASE WHEN attempt_count >= v_max_attempts THEN v_now ELSE NULL END,
      next_attempt_at = CASE WHEN attempt_count >= v_max_attempts THEN next_attempt_at ELSE v_now END,
      last_error_code = 'LEASE_EXPIRED', lease_token = NULL,
      lease_started_at = NULL, lease_expires_at = NULL
  WHERE state = 'leased' AND lease_expires_at <= v_now;

  WITH candidates AS (
    SELECT e.id
    FROM public.email_outbox_events e
    WHERE e.state = 'pending' AND e.created_at >= v_cutoff
      AND e.next_attempt_at <= v_now AND e.attempt_count < v_max_attempts
    ORDER BY e.next_attempt_at, e.created_at, e.id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ), claimed AS (
    UPDATE public.email_outbox_events e
    SET state = 'leased', attempt_count = e.attempt_count + 1,
        lease_token = extensions.gen_random_uuid(), lease_started_at = v_now,
        lease_expires_at = v_now + pg_catalog.make_interval(secs => p_lease_seconds),
        last_error_code = NULL
    FROM candidates c WHERE e.id = c.id
    RETURNING e.*
  )
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'eventId', c.id, 'leaseToken', c.lease_token, 'eventType', c.event_type,
    'recipientKind', c.recipient_kind, 'templateKey', c.template_key,
    'templateVersion', c.template_version, 'bookingStatus', c.booking_status,
    'appointmentDate', c.appointment_date, 'startTimeLocal', c.start_time_local,
    'endTimeLocal', c.end_time_local, 'bookingId', b.id,
    'bookingReference', b.reference_code, 'customerName', cu.full_name,
    'customerEmail', cu.email_normalized, 'serviceName', s.name,
    'vehicleSummary', pg_catalog.concat_ws(' ', v.model_year::text, v.manufacturer, v.model),
    'deliverySecret', CASE WHEN ds.id IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
      'version', 1, 'algorithm', ds.algorithm, 'keyVersion', ds.key_version,
      'tokenVersion', ds.token_version, 'nonce', ds.nonce_base64url,
      'ciphertext', ds.ciphertext_base64url, 'authTag', ds.auth_tag_base64url,
      'aadSha256', ds.aad_sha256, 'expiresAt', ds.token_expires_at,
      'cancelTokenHash', ds.cancel_token_hash,
      'rescheduleTokenHash', ds.reschedule_token_hash
    ) END
  ) ORDER BY c.created_at, c.id), '[]'::jsonb)
  INTO v_result
  FROM claimed c
  JOIN public.bookings b ON b.id = c.booking_id
  JOIN public.customers cu ON cu.id = b.customer_id
  JOIN public.vehicles v ON v.id = b.vehicle_id
  JOIN public.services s ON s.id = b.service_id
  LEFT JOIN LATERAL (
    SELECT secret.* FROM public.booking_delivery_secrets secret
    WHERE secret.booking_id = b.id AND secret.revoked_at IS NULL
      AND secret.redacted_at IS NULL AND secret.token_expires_at > v_now
      AND EXISTS (SELECT 1 FROM public.booking_tokens bt
        WHERE bt.booking_id = b.id AND bt.purpose = 'cancel'
          AND bt.token_hash = secret.cancel_token_hash AND bt.used_at IS NULL
          AND bt.revoked_at IS NULL AND bt.expires_at > v_now)
      AND EXISTS (SELECT 1 FROM public.booking_tokens bt
        WHERE bt.booking_id = b.id AND bt.purpose = 'reschedule'
          AND bt.token_hash = secret.reschedule_token_hash AND bt.used_at IS NULL
          AND bt.revoked_at IS NULL AND bt.expires_at > v_now)
    ORDER BY secret.token_version DESC LIMIT 1
  ) ds ON TRUE;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.materialize_email_outbox_event_atomic(
  p_event_id UUID,
  p_lease_token UUID,
  p_deliveries JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event public.email_outbox_events%ROWTYPE;
  v_requested INTEGER;
  v_actual INTEGER;
BEGIN
  IF pg_catalog.jsonb_typeof(p_deliveries) <> 'array'
     OR pg_catalog.jsonb_array_length(p_deliveries) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Invalid email delivery materialization.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO STRICT v_event FROM public.email_outbox_events
  WHERE id = p_event_id FOR UPDATE;
  IF v_event.state <> 'leased' OR v_event.lease_token <> p_lease_token
     OR v_event.lease_expires_at <= pg_catalog.clock_timestamp() THEN
    RAISE EXCEPTION 'Email outbox lease is invalid or expired.' USING ERRCODE = '55000';
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_requested
  FROM pg_catalog.jsonb_to_recordset(p_deliveries) AS d(
    recipient_email TEXT, idempotency_key TEXT, template_key TEXT,
    template_version INTEGER, content_sha256 TEXT, payload_envelope JSONB
  )
  WHERE recipient_email = pg_catalog.lower(pg_catalog.btrim(recipient_email))
    AND recipient_email ~ '^[^@[:space:][:cntrl:]]+@[^@[:space:][:cntrl:]]+\.[^@[:space:][:cntrl:]]+$'
    AND pg_catalog.char_length(idempotency_key) BETWEEN 1 AND 256
    AND template_key = v_event.template_key
    AND template_version = v_event.template_version
    AND content_sha256 ~ '^[0-9a-f]{64}$'
    AND pg_catalog.jsonb_typeof(payload_envelope) = 'object'
    AND payload_envelope ?& ARRAY[
      'version','algorithm','keyVersion','nonce','ciphertext','authTag','aadSha256'
    ]
    AND (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(payload_envelope)) = 7
    AND payload_envelope->>'version' = '1'
    AND payload_envelope->>'algorithm' = 'aes-256-gcm'
    AND payload_envelope->>'keyVersion' ~ '^[A-Za-z0-9._-]{1,64}$'
    AND payload_envelope->>'nonce' ~ '^[A-Za-z0-9_-]{16}$'
    AND char_length(payload_envelope->>'ciphertext') BETWEEN 64 AND 2000000
    AND payload_envelope->>'ciphertext' ~ '^[A-Za-z0-9_-]+$'
    AND payload_envelope->>'authTag' ~ '^[A-Za-z0-9_-]{22}$'
    AND payload_envelope->>'aadSha256' = pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          'manila-auto-pros:email-payload:v1:' || p_event_id::TEXT || ':' ||
          recipient_email || ':' || idempotency_key || ':' || template_key || ':' ||
          template_version::TEXT || ':' || content_sha256,
          'UTF8'
        ),
        'sha256'::TEXT
      ),
      'hex'
    );
  IF v_requested <> pg_catalog.jsonb_array_length(p_deliveries) THEN
    RAISE EXCEPTION 'Invalid email delivery metadata.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.email_deliveries(
    outbox_event_id, recipient_email, idempotency_key, template_key,
    template_version, content_sha256, payload_algorithm, payload_key_version,
    payload_nonce_base64url, payload_ciphertext_base64url,
    payload_auth_tag_base64url, payload_aad_sha256
  )
  SELECT p_event_id, d.recipient_email, d.idempotency_key, d.template_key,
         d.template_version, d.content_sha256, d.payload_envelope->>'algorithm',
         d.payload_envelope->>'keyVersion', d.payload_envelope->>'nonce',
         d.payload_envelope->>'ciphertext', d.payload_envelope->>'authTag',
         d.payload_envelope->>'aadSha256'
  FROM pg_catalog.jsonb_to_recordset(p_deliveries) AS d(
    recipient_email TEXT, idempotency_key TEXT, template_key TEXT,
    template_version INTEGER, content_sha256 TEXT, payload_envelope JSONB
  )
  ON CONFLICT (outbox_event_id, recipient_email) DO NOTHING;

  SELECT pg_catalog.count(*)::integer INTO v_actual
  FROM public.email_deliveries d WHERE d.outbox_event_id = p_event_id
    AND EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_to_recordset(p_deliveries) x(
        recipient_email TEXT, idempotency_key TEXT, template_key TEXT,
        template_version INTEGER, content_sha256 TEXT, payload_envelope JSONB
      ) WHERE x.recipient_email = d.recipient_email
        AND x.idempotency_key = d.idempotency_key
        AND x.template_key = d.template_key
        AND x.template_version = d.template_version
        AND x.content_sha256 = d.content_sha256
        AND x.payload_envelope->>'algorithm' = d.payload_algorithm
        AND x.payload_envelope->>'keyVersion' = d.payload_key_version
        AND x.payload_envelope->>'nonce' = d.payload_nonce_base64url
        AND x.payload_envelope->>'ciphertext' = d.payload_ciphertext_base64url
        AND x.payload_envelope->>'authTag' = d.payload_auth_tag_base64url
        AND x.payload_envelope->>'aadSha256' = d.payload_aad_sha256
    );
  IF v_actual <> v_requested THEN
    RAISE EXCEPTION 'Conflicting email delivery materialization.' USING ERRCODE = '23505';
  END IF;

  UPDATE public.email_outbox_events SET state = 'materialized',
    materialized_at = pg_catalog.clock_timestamp(), lease_token = NULL,
    lease_started_at = NULL, lease_expires_at = NULL
  WHERE id = p_event_id;
  RETURN v_actual;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_email_outbox_event_atomic(
  p_event_id UUID,
  p_lease_token UUID,
  p_error_code TEXT,
  p_retry_after_seconds INTEGER DEFAULT 60
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_state TEXT; v_max INTEGER; v_attempts INTEGER;
BEGIN
  IF p_error_code !~ '^[A-Z0-9_:-]{1,100}$'
     OR p_retry_after_seconds NOT BETWEEN 10 AND 86400 THEN
    RAISE EXCEPTION 'Invalid email release metadata.' USING ERRCODE = '22023';
  END IF;
  SELECT e.attempt_count, c.max_attempts INTO STRICT v_attempts, v_max
  FROM public.email_outbox_events e CROSS JOIN public.email_dispatch_control c
  WHERE e.id = p_event_id AND e.state = 'leased' AND e.lease_token = p_lease_token
    AND c.singleton = TRUE FOR UPDATE OF e;
  v_state := CASE WHEN v_attempts >= v_max THEN 'dead_letter' ELSE 'pending' END;
  UPDATE public.email_outbox_events SET state = v_state,
    completed_at = CASE WHEN v_state = 'dead_letter' THEN pg_catalog.clock_timestamp() ELSE NULL END,
    next_attempt_at = pg_catalog.clock_timestamp() + pg_catalog.make_interval(secs => p_retry_after_seconds),
    last_error_code = p_error_code, lease_token = NULL, lease_started_at = NULL,
    lease_expires_at = NULL WHERE id = p_event_id;
  RETURN v_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_email_deliveries_atomic(
  p_limit INTEGER DEFAULT 10,
  p_lease_seconds INTEGER DEFAULT 120
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_now TIMESTAMPTZ := pg_catalog.clock_timestamp(); v_cutoff TIMESTAMPTZ; v_max INTEGER; v_result JSONB;
BEGIN
  IF p_limit NOT BETWEEN 1 AND 50 OR p_lease_seconds NOT BETWEEN 30 AND 900 THEN
    RAISE EXCEPTION 'Invalid email delivery lease request.' USING ERRCODE = '22023';
  END IF;
  SELECT activation_cutoff_at, max_attempts INTO v_cutoff, v_max FROM public.email_dispatch_control
  WHERE singleton = TRUE AND enabled = TRUE;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  UPDATE public.email_deliveries d
  SET state = 'dead_letter', terminal_at = v_now,
      last_error_code = 'ACTIVATION_CUTOFF', lease_token = NULL,
      lease_started_at = NULL, lease_expires_at = NULL
  FROM public.email_outbox_events e
  WHERE d.outbox_event_id = e.id AND e.created_at < v_cutoff
    AND d.state IN ('pending', 'leased', 'retry');
  UPDATE public.email_outbox_events
  SET state = 'dead_letter', completed_at = v_now,
      last_error_code = 'ACTIVATION_CUTOFF', lease_token = NULL,
      lease_started_at = NULL, lease_expires_at = NULL
  WHERE state IN ('pending', 'leased', 'materialized') AND created_at < v_cutoff;

  UPDATE public.email_deliveries SET
    state = CASE WHEN attempt_count >= v_max THEN 'dead_letter' ELSE 'retry' END,
    terminal_at = CASE WHEN attempt_count >= v_max THEN v_now ELSE NULL END,
    next_attempt_at = CASE WHEN attempt_count >= v_max THEN next_attempt_at ELSE v_now END,
    last_error_code = 'LEASE_EXPIRED', lease_token = NULL,
    lease_started_at = NULL, lease_expires_at = NULL
  WHERE state = 'leased' AND lease_expires_at <= v_now;

  UPDATE public.email_outbox_events e SET state = 'dead_letter', completed_at = v_now
  WHERE e.state = 'materialized'
    AND EXISTS (SELECT 1 FROM public.email_deliveries d
      WHERE d.outbox_event_id = e.id AND d.state = 'dead_letter')
    AND NOT EXISTS (SELECT 1 FROM public.email_deliveries d
      WHERE d.outbox_event_id = e.id AND d.state IN ('pending','leased','retry'));

  WITH candidates AS (
    SELECT d.id FROM public.email_deliveries d
    JOIN public.email_outbox_events e ON e.id = d.outbox_event_id
    WHERE d.state IN ('pending', 'retry') AND d.next_attempt_at <= v_now
      AND e.state = 'materialized' AND e.created_at >= v_cutoff
      AND d.attempt_count < v_max
    ORDER BY d.next_attempt_at, d.created_at, d.id FOR UPDATE SKIP LOCKED LIMIT p_limit
  ), claimed AS (
    UPDATE public.email_deliveries d SET state = 'leased',
      attempt_count = d.attempt_count + 1, lease_token = extensions.gen_random_uuid(),
      lease_started_at = v_now,
      lease_expires_at = v_now + pg_catalog.make_interval(secs => p_lease_seconds),
      last_error_code = NULL
    FROM candidates c WHERE d.id = c.id RETURNING d.*
  )
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'deliveryId', c.id, 'leaseToken', c.lease_token,
    'attemptNumber', c.attempt_count, 'recipientEmail', c.recipient_email,
    'idempotencyKey', c.idempotency_key, 'contentSha256', c.content_sha256,
    'eventId', e.id, 'eventType', e.event_type, 'recipientKind', e.recipient_kind,
    'templateKey', c.template_key, 'templateVersion', c.template_version,
    'payloadEnvelope', pg_catalog.jsonb_build_object(
      'version', 1, 'algorithm', c.payload_algorithm,
      'keyVersion', c.payload_key_version, 'nonce', c.payload_nonce_base64url,
      'ciphertext', c.payload_ciphertext_base64url,
      'authTag', c.payload_auth_tag_base64url, 'aadSha256', c.payload_aad_sha256
    )
  ) ORDER BY c.created_at, c.id), '[]'::jsonb) INTO v_result
  FROM claimed c JOIN public.email_outbox_events e ON e.id = c.outbox_event_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_email_delivery_result_atomic(
  p_delivery_id UUID, p_lease_token UUID, p_outcome TEXT,
  p_provider_message_id TEXT DEFAULT NULL, p_response_code INTEGER DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL, p_retry_after_seconds INTEGER DEFAULT 60
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_delivery public.email_deliveries%ROWTYPE; v_max INTEGER; v_state TEXT; v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
BEGIN
  IF p_outcome NOT IN ('accepted','retryable_failure','permanent_failure','ambiguous')
     OR (p_response_code IS NOT NULL AND p_response_code NOT BETWEEN 100 AND 599)
     OR (p_error_code IS NOT NULL AND p_error_code !~ '^[A-Z0-9_:-]{1,100}$')
     OR p_retry_after_seconds NOT BETWEEN 10 AND 86400 THEN
    RAISE EXCEPTION 'Invalid email delivery result.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO STRICT v_delivery FROM public.email_deliveries
  WHERE id = p_delivery_id AND state = 'leased' AND lease_token = p_lease_token FOR UPDATE;
  SELECT max_attempts INTO STRICT v_max FROM public.email_dispatch_control WHERE singleton = TRUE;

  v_state := CASE
    WHEN p_outcome = 'accepted' THEN 'accepted'
    WHEN p_outcome = 'permanent_failure' THEN 'failed'
    WHEN v_delivery.attempt_count >= v_max THEN 'dead_letter'
    ELSE 'retry' END;
  IF p_outcome = 'accepted' AND NULLIF(pg_catalog.btrim(p_provider_message_id), '') IS NULL THEN
    RAISE EXCEPTION 'Accepted email requires a provider message id.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.email_delivery_attempts(
    delivery_id, attempt_number, outcome, provider_message_id, response_code,
    error_code, started_at, finished_at
  ) VALUES (v_delivery.id, v_delivery.attempt_count, p_outcome,
    p_provider_message_id, p_response_code, p_error_code, v_delivery.lease_started_at, v_now);

  UPDATE public.email_deliveries SET state = v_state,
    provider_message_id = CASE WHEN p_outcome = 'accepted' THEN p_provider_message_id ELSE provider_message_id END,
    provider_accepted_at = CASE WHEN p_outcome = 'accepted' THEN v_now ELSE provider_accepted_at END,
    terminal_at = CASE WHEN v_state IN ('failed','dead_letter') THEN v_now ELSE NULL END,
    next_attempt_at = CASE WHEN v_state = 'retry' THEN v_now + pg_catalog.make_interval(secs => p_retry_after_seconds) ELSE next_attempt_at END,
    last_error_code = p_error_code, lease_token = NULL, lease_started_at = NULL,
    lease_expires_at = NULL WHERE id = v_delivery.id;

  UPDATE public.email_outbox_events e SET
    state = CASE WHEN EXISTS (SELECT 1 FROM public.email_deliveries d
      WHERE d.outbox_event_id = e.id AND d.state IN ('failed','dead_letter')) THEN 'dead_letter' ELSE 'completed' END,
    completed_at = v_now
  WHERE e.id = v_delivery.outbox_event_id AND e.state = 'materialized'
    AND NOT EXISTS (SELECT 1 FROM public.email_deliveries d
      WHERE d.outbox_event_id = e.id AND d.state IN ('pending','leased','retry'));
  RETURN v_state;
END;
$$;

ALTER FUNCTION public.claim_email_outbox_events_atomic(INTEGER, INTEGER) OWNER TO postgres;
ALTER FUNCTION public.materialize_email_outbox_event_atomic(UUID, UUID, JSONB) OWNER TO postgres;
ALTER FUNCTION public.release_email_outbox_event_atomic(UUID, UUID, TEXT, INTEGER) OWNER TO postgres;
ALTER FUNCTION public.claim_email_deliveries_atomic(INTEGER, INTEGER) OWNER TO postgres;
ALTER FUNCTION public.record_email_delivery_result_atomic(UUID, UUID, TEXT, TEXT, INTEGER, TEXT, INTEGER) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.claim_email_outbox_events_atomic(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.materialize_email_outbox_event_atomic(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.release_email_outbox_event_atomic(UUID, UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_email_deliveries_atomic(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_email_delivery_result_atomic(UUID, UUID, TEXT, TEXT, INTEGER, TEXT, INTEGER) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.claim_email_outbox_events_atomic(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.materialize_email_outbox_event_atomic(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_email_outbox_event_atomic(UUID, UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_email_deliveries_atomic(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_email_delivery_result_atomic(UUID, UUID, TEXT, TEXT, INTEGER, TEXT, INTEGER) TO service_role;

COMMENT ON TABLE public.email_dispatch_control IS
  'Owner-controlled delivery gate. Disabled by default; cutoff prevents historical event sends.';
