-- MANILA AUTO PROS — PRIVATE STAGING DEMO ACTIVATION
--
-- Activates only the four reviewed demo rows after verifying the complete
-- prepared schedule. This statement must not be executed without separate
-- owner approval. It does not update bookings, email configuration, or pg_cron.

DO $demo_activate$
DECLARE
  v_rows INTEGER;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Demo activation requires the postgres database-owner role.';
  END IF;

  LOCK TABLE public.services, public.booking_resources, public.business_hours,
    public.blocked_dates, public.bookings IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (
    SELECT 1 FROM public.services
    WHERE is_active
      AND id NOT IN (
        '76550a6d-c351-41e6-a5e4-476ac4f3a868'::uuid,
        'd5ca4aa6-4c6c-43b7-9cf4-2cc8ff5a1669'::uuid
      )
  ) OR EXISTS (
    SELECT 1 FROM public.booking_resources
    WHERE is_active
      AND id NOT IN (
        '858885fd-22f4-4cad-b166-c3b82a3a69a5'::uuid,
        '3f942c78-6e21-440d-9d2c-134deaea9fa8'::uuid
      )
  ) THEN
    RAISE EXCEPTION 'Unrelated active booking configuration detected.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.blocked_dates WHERE is_active) THEN
    RAISE EXCEPTION 'Active blocked dates detected; activation requires separate review.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE service_id IN (
      '76550a6d-c351-41e6-a5e4-476ac4f3a868'::uuid,
      'd5ca4aa6-4c6c-43b7-9cf4-2cc8ff5a1669'::uuid
    ) OR resource_id IN (
      '858885fd-22f4-4cad-b166-c3b82a3a69a5'::uuid,
      '3f942c78-6e21-440d-9d2c-134deaea9fa8'::uuid
    )
  ) THEN
    RAISE EXCEPTION 'Demo bookings already exist before initial activation.';
  END IF;

  IF (SELECT pg_catalog.count(*) FROM public.business_hours WHERE
        timezone = 'Asia/Manila'
        AND open_time = '09:00'::time
        AND close_time = '17:00'::time
        AND slot_interval_minutes = 60
        AND is_dev_default
        AND ((day_of_week = 0 AND is_closed)
          OR (day_of_week BETWEEN 1 AND 6 AND NOT is_closed))) <> 7
     OR (SELECT pg_catalog.count(*) FROM public.business_hours) <> 7 THEN
    RAISE EXCEPTION 'The reviewed seven-day demo schedule is missing or changed.';
  END IF;

  IF (SELECT pg_catalog.count(*) FROM public.services WHERE
        (id = '76550a6d-c351-41e6-a5e4-476ac4f3a868'::uuid
         AND option_slug = 'demo-car-care-request-staging-v1'
         AND required_resource_type = 'demo_car_care_staging_v1'
         AND vehicle_type = 'Car'::public.vehicle_type_enum
         AND duration_minutes = 90 AND buffer_minutes = 30
         AND required_units = 1
         AND confirmation_mode = 'manual'::public.confirmation_mode_enum
         AND pending_hold_minutes = 60 AND NOT is_active)
        OR
        (id = 'd5ca4aa6-4c6c-43b7-9cf4-2cc8ff5a1669'::uuid
         AND option_slug = 'demo-motorcycle-express-staging-v1'
         AND required_resource_type = 'demo_motorcycle_express_staging_v1'
         AND vehicle_type = 'Motorcycle'::public.vehicle_type_enum
         AND duration_minutes = 60 AND buffer_minutes = 30
         AND required_units = 1
         AND confirmation_mode = 'auto'::public.confirmation_mode_enum
         AND pending_hold_minutes = 60 AND NOT is_active)) <> 2 THEN
    RAISE EXCEPTION 'The reviewed inactive demo services are missing or changed.';
  END IF;

  IF (SELECT pg_catalog.count(*) FROM public.booking_resources WHERE
        (id = '858885fd-22f4-4cad-b166-c3b82a3a69a5'::uuid
         AND code = 'DEMO-CAR-STAGING-V1'
         AND resource_type = 'demo_car_care_staging_v1'
         AND vehicle_type = 'Car'::public.vehicle_type_enum
         AND total_capacity = 2 AND NOT is_active)
        OR
        (id = '3f942c78-6e21-440d-9d2c-134deaea9fa8'::uuid
         AND code = 'DEMO-MOTO-STAGING-V1'
         AND resource_type = 'demo_motorcycle_express_staging_v1'
         AND vehicle_type = 'Motorcycle'::public.vehicle_type_enum
         AND total_capacity = 2 AND NOT is_active)) <> 2 THEN
    RAISE EXCEPTION 'The reviewed inactive demo resources are missing or changed.';
  END IF;

  UPDATE public.booking_resources
  SET is_active = TRUE
  WHERE id IN (
    '858885fd-22f4-4cad-b166-c3b82a3a69a5'::uuid,
    '3f942c78-6e21-440d-9d2c-134deaea9fa8'::uuid
  ) AND NOT is_active;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 2 THEN
    RAISE EXCEPTION 'Expected to activate two demo resources, updated %.', v_rows;
  END IF;

  UPDATE public.services
  SET is_active = TRUE
  WHERE id IN (
    '76550a6d-c351-41e6-a5e4-476ac4f3a868'::uuid,
    'd5ca4aa6-4c6c-43b7-9cf4-2cc8ff5a1669'::uuid
  ) AND NOT is_active;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 2 THEN
    RAISE EXCEPTION 'Expected to activate two demo services, updated %.', v_rows;
  END IF;
END
$demo_activate$ LANGUAGE plpgsql;
