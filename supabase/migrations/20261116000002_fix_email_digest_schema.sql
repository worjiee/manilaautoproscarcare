-- =============================================================================
-- MANILA AUTO PROS — PHASE 5.1.1 PGCRYPTO DIGEST SCHEMA COMPATIBILITY
--
-- Supabase installs pgcrypto in the extensions schema. Replace only the
-- schema-qualified digest call while preserving the deployed envelope
-- validation, transaction behavior, ownership, search path, and privileges.
-- =============================================================================

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
     OR pg_catalog.char_length(COALESCE(p_envelope->>'ciphertext', '')) NOT BETWEEN 32 AND 4096
     OR COALESCE(p_envelope->>'ciphertext', '') !~ '^[A-Za-z0-9_-]+$'
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
    extensions.digest(
      pg_catalog.convert_to(
        'manila-auto-pros:booking-links:v1:' ||
        v_token_version::TEXT || ':' ||
        p_cancel_token_hash || ':' ||
        p_reschedule_token_hash,
        'UTF8'
      ),
      'sha256'::TEXT
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

ALTER FUNCTION public.store_booking_delivery_secret_internal(
  UUID, TEXT, TEXT, JSONB
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.store_booking_delivery_secret_internal(
  UUID, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated, service_role;
