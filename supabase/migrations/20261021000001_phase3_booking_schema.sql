-- ==============================================================================
-- MANILA AUTO PROS — PHASE 3 DATABASE SCHEMA & ROW LEVEL SECURITY
-- Migration: 20261021000001_phase3_booking_schema.sql
-- Timezone Policy: Appointment instants stored as TIMESTAMPTZ; business schedule
-- evaluated in 'Asia/Manila' (UTC+8).
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. DOMAIN ENUMS
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_type_enum') THEN
    CREATE TYPE vehicle_type_enum AS ENUM ('Car', 'Motorcycle');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'confirmation_mode_enum') THEN
    CREATE TYPE confirmation_mode_enum AS ENUM ('auto', 'manual');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status_enum') THEN
    CREATE TYPE booking_status_enum AS ENUM (
      'pending',
      'confirmed',
      'rejected',
      'expired',
      'cancelled',
      'completed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_token_purpose_enum') THEN
    CREATE TYPE booking_token_purpose_enum AS ENUM ('cancel', 'reschedule');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_actor_type_enum') THEN
    CREATE TYPE audit_actor_type_enum AS ENUM ('customer', 'system', 'admin');
  END IF;
END
$$;

-- ------------------------------------------------------------------------------
-- 2. UPDATED_AT TRIGGER FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_row_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_row_updated_at() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. TABLE: booking_resources
-- Represents configurable studio bays / resource pools. Different services can
-- target distinct resource pools and consume 1 or more units of capacity.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  vehicle_type vehicle_type_enum NOT NULL,
  total_capacity INTEGER NOT NULL CHECK (total_capacity >= 1 AND total_capacity <= 20),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  is_dev_default BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_resources_type_active
  ON booking_resources (resource_type, is_active);

CREATE TRIGGER trg_booking_resources_updated_at
  BEFORE UPDATE ON booking_resources
  FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- ------------------------------------------------------------------------------
-- 4. TABLE: services
-- Normalized service options linked to category_slug + option_slug.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug TEXT NOT NULL,
  category_title TEXT NOT NULL,
  option_slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_description TEXT NOT NULL,
  vehicle_type vehicle_type_enum NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 30 AND duration_minutes <= 1440),
  buffer_minutes INTEGER NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0 AND buffer_minutes <= 240),
  required_resource_type TEXT NOT NULL,
  required_units INTEGER NOT NULL DEFAULT 1 CHECK (required_units >= 1 AND required_units <= 6),
  confirmation_mode confirmation_mode_enum NOT NULL DEFAULT 'manual',
  pending_hold_minutes INTEGER NOT NULL DEFAULT 120 CHECK (pending_hold_minutes >= 15 AND pending_hold_minutes <= 10080),
  min_notice_hours INTEGER NOT NULL DEFAULT 12 CHECK (min_notice_hours >= 0 AND min_notice_hours <= 720),
  max_advance_days INTEGER NOT NULL DEFAULT 60 CHECK (max_advance_days >= 1 AND max_advance_days <= 365),
  cancellation_cutoff_minutes INTEGER NOT NULL DEFAULT 0 CHECK (cancellation_cutoff_minutes >= 0 AND cancellation_cutoff_minutes <= 10080),
  reschedule_cutoff_minutes INTEGER NOT NULL DEFAULT 0 CHECK (reschedule_cutoff_minutes >= 0 AND reschedule_cutoff_minutes <= 10080),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  is_dev_default BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_category_active
  ON services (category_slug, is_active);

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- ------------------------------------------------------------------------------
-- 5. TABLE: business_hours
-- Day of week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday in 'Asia/Manila'.
-- Constraint guarantees Sunday (0) is always closed.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week SMALLINT NOT NULL UNIQUE CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_name TEXT NOT NULL,
  open_time TIME NOT NULL DEFAULT '09:00:00',
  close_time TIME NOT NULL DEFAULT '18:00:00',
  slot_interval_minutes INTEGER NOT NULL DEFAULT 60 CHECK (slot_interval_minutes IN (30, 60, 90, 120)),
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Manila' CHECK (timezone = 'Asia/Manila'),
  is_dev_default BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_sunday_always_closed CHECK (day_of_week <> 0 OR is_closed = TRUE),
  CONSTRAINT chk_open_before_close CHECK (is_closed = TRUE OR open_time < close_time)
);

CREATE TRIGGER trg_business_hours_updated_at
  BEFORE UPDATE ON business_hours
  FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- ------------------------------------------------------------------------------
-- 6. TABLE: blocked_dates
-- Supports full-day shop closures or partial-day resource blackouts in Asia/Manila.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  resource_id UUID REFERENCES booking_resources(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_blocked_time_window CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  )
);

CREATE INDEX IF NOT EXISTS idx_blocked_dates_date_active
  ON blocked_dates (blocked_date, is_active);

CREATE TRIGGER trg_blocked_dates_updated_at
  BEFORE UPDATE ON blocked_dates
  FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- ------------------------------------------------------------------------------
-- 7. TABLE: customers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL CHECK (char_length(btrim(full_name)) >= 2),
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_email_norm
  ON customers (email_normalized);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- ------------------------------------------------------------------------------
-- 8. TABLE: vehicles
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_type vehicle_type_enum NOT NULL,
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  model_year SMALLINT NOT NULL CHECK (model_year >= 1950),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_vehicles_id_customer UNIQUE (id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_customer_id
  ON vehicles (customer_id);

CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- ------------------------------------------------------------------------------
-- 9. TABLE: bookings
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_fingerprint TEXT NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  resource_id UUID NOT NULL REFERENCES booking_resources(id) ON DELETE RESTRICT,
  allocated_units INTEGER NOT NULL DEFAULT 1 CHECK (allocated_units >= 1 AND allocated_units <= 20),
  appointment_date DATE NOT NULL,
  start_time_local TIME NOT NULL,
  end_time_local TIME NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  buffer_minutes INTEGER NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0),
  confirmation_mode confirmation_mode_enum NOT NULL,
  status booking_status_enum NOT NULL,
  pending_expires_at TIMESTAMPTZ,
  additional_requests TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  rescheduled_count INTEGER NOT NULL DEFAULT 0 CHECK (rescheduled_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_booking_vehicle_customer
    FOREIGN KEY (vehicle_id, customer_id)
    REFERENCES vehicles(id, customer_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_booking_interval CHECK (end_at > start_at),
  CONSTRAINT chk_booking_local_interval CHECK (end_time_local > start_time_local),
  CONSTRAINT chk_booking_duration_snapshot CHECK (
    end_at = start_at + make_interval(mins => duration_minutes)
  ),
  CONSTRAINT chk_booking_manila_schedule_snapshot CHECK (
    appointment_date = (start_at AT TIME ZONE 'Asia/Manila')::DATE AND
    start_time_local = (start_at AT TIME ZONE 'Asia/Manila')::TIME AND
    end_time_local = (end_at AT TIME ZONE 'Asia/Manila')::TIME
  ),
  CONSTRAINT chk_booking_pending_expiration CHECK (
    (status = 'pending' AND pending_expires_at IS NOT NULL) OR
    (status <> 'pending' AND pending_expires_at IS NULL)
  ),
  CONSTRAINT chk_booking_cancellation_state CHECK (
    (
      status = 'cancelled' AND
      cancelled_at IS NOT NULL AND
      NULLIF(btrim(cancellation_reason), '') IS NOT NULL
    ) OR
    (
      status <> 'cancelled' AND
      cancelled_at IS NULL AND
      cancellation_reason IS NULL
    )
  ),
  CONSTRAINT chk_booking_not_sunday CHECK (EXTRACT(DOW FROM appointment_date) <> 0)
);

CREATE INDEX IF NOT EXISTS idx_bookings_resource_date_status
  ON bookings (resource_id, appointment_date, status, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_bookings_customer_id
  ON bookings (customer_id);

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- ------------------------------------------------------------------------------
-- 10. TABLE: booking_tokens
-- Stores ONLY SHA-256 hashes of high-entropy single-purpose tokens.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  purpose booking_token_purpose_enum NOT NULL,
  token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_tokens_booking_purpose
  ON booking_tokens (booking_id, purpose);

CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_tokens_one_active_purpose
  ON booking_tokens (booking_id, purpose)
  WHERE used_at IS NULL AND revoked_at IS NULL;

-- ------------------------------------------------------------------------------
-- 11. TABLE: booking_audit_logs
-- Immutable audit log of all reservation lifecycle transitions.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  actor_type audit_actor_type_enum NOT NULL,
  action TEXT NOT NULL,
  previous_status booking_status_enum,
  new_status booking_status_enum,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_audit_logs_booking_id
  ON booking_audit_logs (booking_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 12. BOOKING LIFECYCLE AND RELATIONSHIP GUARDS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_vehicle_model_year()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.model_year > (
    EXTRACT(
      YEAR FROM (pg_catalog.clock_timestamp() AT TIME ZONE 'Asia/Manila')
    )::INTEGER + 1
  ) THEN
    RAISE EXCEPTION 'Vehicle model year cannot be more than one year in the future.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_vehicle_model_year()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_vehicles_model_year
  BEFORE INSERT OR UPDATE OF model_year ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.guard_vehicle_model_year();

CREATE OR REPLACE FUNCTION public.guard_booking_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_vehicle_type public.vehicle_type_enum;
  v_resource_type TEXT;
  v_resource_vehicle_type public.vehicle_type_enum;
  v_service_resource_type TEXT;
  v_service_vehicle_type public.vehicle_type_enum;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'pending'
     AND (OLD.pending_expires_at IS NULL OR OLD.pending_expires_at <= pg_catalog.clock_timestamp())
     AND NEW.status <> 'expired' THEN
    RAISE EXCEPTION 'Expired pending bookings can only transition to expired.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT v.vehicle_type
  INTO v_vehicle_type
  FROM public.vehicles v
  WHERE v.id = NEW.vehicle_id;

  SELECT r.resource_type, r.vehicle_type
  INTO v_resource_type, v_resource_vehicle_type
  FROM public.booking_resources r
  WHERE r.id = NEW.resource_id;

  SELECT s.required_resource_type, s.vehicle_type
  INTO v_service_resource_type, v_service_vehicle_type
  FROM public.services s
  WHERE s.id = NEW.service_id;

  IF v_vehicle_type IS NULL
     OR v_resource_type IS NULL
     OR v_service_resource_type IS NULL
     OR v_vehicle_type <> v_resource_vehicle_type
     OR v_vehicle_type <> v_service_vehicle_type
     OR v_resource_type <> v_service_resource_type THEN
    RAISE EXCEPTION 'Booking vehicle, service, and resource are incompatible.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_booking_integrity() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_bookings_integrity
  BEFORE INSERT OR UPDATE OF status, pending_expires_at, vehicle_id, service_id, resource_id
  ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_booking_integrity();

-- ==============================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- Principle of Least Privilege:
-- - Public/Anon can read active `services`, `business_hours`, `blocked_dates`,
--   and `booking_resources` metadata.
-- - Public/Anon has ZERO direct access to `customers`, `vehicles`, `bookings`,
--   `booking_tokens`, or `booking_audit_logs`. All booking mutations and token
--   lookups run exclusively through server-side actions / RPCs.
-- ==============================================================================

ALTER TABLE booking_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active booking_resources"
  ON booking_resources FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

CREATE POLICY "Public read active services"
  ON services FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

CREATE POLICY "Public read business_hours"
  ON business_hours FOR SELECT
  TO anon, authenticated
  USING (TRUE);

CREATE POLICY "Public read active blocked_dates"
  ON blocked_dates FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

-- Explicitly no anon policies on customers, vehicles, bookings, booking_tokens,
-- or booking_audit_logs (deny by default under RLS).
