-- MANILA AUTO PROS — PRIVATE STAGING DEMO HOURS (PREPARATION ONLY)
--
-- Inserts the complete Asia/Manila weekly schedule required by the protected
-- client demo. It does not activate services or resources and does not modify
-- bookings, blocked dates, email delivery, or pg_cron.

DO $demo_hours$
DECLARE
  v_rows INTEGER;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Demo-hours preparation requires the postgres database-owner role.';
  END IF;

  LOCK TABLE public.services, public.booking_resources, public.business_hours
    IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (SELECT 1 FROM public.services WHERE is_active)
     OR EXISTS (SELECT 1 FROM public.booking_resources WHERE is_active) THEN
    RAISE EXCEPTION 'Active service or resource detected; refusing demo-hours preparation.';
  END IF;

  IF (SELECT pg_catalog.count(*) FROM public.business_hours) <> 0 THEN
    RAISE EXCEPTION 'Business-hours rows already exist; refusing to overwrite global configuration.';
  END IF;

  IF (SELECT pg_catalog.count(*) FROM public.services WHERE
        (id = '76550a6d-c351-41e6-a5e4-476ac4f3a868'::uuid
         AND option_slug = 'demo-car-care-request-staging-v1'
         AND duration_minutes = 90 AND buffer_minutes = 30
         AND confirmation_mode = 'manual'::public.confirmation_mode_enum
         AND pending_hold_minutes = 60 AND NOT is_active)
        OR
        (id = 'd5ca4aa6-4c6c-43b7-9cf4-2cc8ff5a1669'::uuid
         AND option_slug = 'demo-motorcycle-express-staging-v1'
         AND duration_minutes = 60 AND buffer_minutes = 30
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

  INSERT INTO public.business_hours (
    day_of_week, day_name, open_time, close_time, slot_interval_minutes,
    is_closed, timezone, is_dev_default
  ) VALUES
    (0, '[DEMO] Sunday',    '09:00'::time, '17:00'::time, 60, TRUE,  'Asia/Manila', TRUE),
    (1, '[DEMO] Monday',    '09:00'::time, '17:00'::time, 60, FALSE, 'Asia/Manila', TRUE),
    (2, '[DEMO] Tuesday',   '09:00'::time, '17:00'::time, 60, FALSE, 'Asia/Manila', TRUE),
    (3, '[DEMO] Wednesday', '09:00'::time, '17:00'::time, 60, FALSE, 'Asia/Manila', TRUE),
    (4, '[DEMO] Thursday',  '09:00'::time, '17:00'::time, 60, FALSE, 'Asia/Manila', TRUE),
    (5, '[DEMO] Friday',    '09:00'::time, '17:00'::time, 60, FALSE, 'Asia/Manila', TRUE),
    (6, '[DEMO] Saturday',  '09:00'::time, '17:00'::time, 60, FALSE, 'Asia/Manila', TRUE);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 7 THEN
    RAISE EXCEPTION 'Expected seven demo business-hours rows, inserted %.', v_rows;
  END IF;
END
$demo_hours$ LANGUAGE plpgsql;
