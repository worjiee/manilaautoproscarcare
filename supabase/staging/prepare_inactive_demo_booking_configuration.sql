-- MANILA AUTO PROS — PRIVATE STAGING DEMO CONFIGURATION (PREPARATION ONLY)
--
-- Creates exactly two inactive demo resources and two inactive demo services.
-- It intentionally does not create business hours, activate public booking
-- configuration, alter bookings, or modify the existing expiration Cron job.
-- Execute only after a separate owner approval against project
-- qcjslbakgdofmzthqxuu using a trusted database-owner connection.

DO $demo_prepare$
DECLARE
  v_rows INTEGER;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Demo preparation requires the postgres database-owner role.';
  END IF;

  LOCK TABLE public.services, public.booking_resources
    IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (SELECT 1 FROM public.services WHERE is_active)
     OR EXISTS (SELECT 1 FROM public.booking_resources WHERE is_active) THEN
    RAISE EXCEPTION 'Active service or resource detected; refusing demo preparation.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.services
    WHERE id IN (
      '76550a6d-c351-41e6-a5e4-476ac4f3a868'::uuid,
      'd5ca4aa6-4c6c-43b7-9cf4-2cc8ff5a1669'::uuid
    )
       OR option_slug IN (
         'demo-car-care-request-staging-v1',
         'demo-motorcycle-express-staging-v1'
       )
       OR required_resource_type IN (
         'demo_car_care_staging_v1',
         'demo_motorcycle_express_staging_v1'
       )
  ) THEN
    RAISE EXCEPTION 'Demo service identifier collision detected.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.booking_resources
    WHERE id IN (
      '858885fd-22f4-4cad-b166-c3b82a3a69a5'::uuid,
      '3f942c78-6e21-440d-9d2c-134deaea9fa8'::uuid
    )
       OR code IN ('DEMO-CAR-STAGING-V1', 'DEMO-MOTO-STAGING-V1')
       OR resource_type IN (
         'demo_car_care_staging_v1',
         'demo_motorcycle_express_staging_v1'
       )
  ) THEN
    RAISE EXCEPTION 'Demo resource identifier collision detected.';
  END IF;

  INSERT INTO public.booking_resources (
    id, code, name, resource_type, vehicle_type, total_capacity,
    is_active, is_dev_default, notes
  ) VALUES
    (
      '858885fd-22f4-4cad-b166-c3b82a3a69a5'::uuid,
      'DEMO-CAR-STAGING-V1',
      '[DEMO] Car Care Bay',
      'demo_car_care_staging_v1',
      'Car'::public.vehicle_type_enum,
      2,
      FALSE,
      TRUE,
      'Private Vercel staging demo only; owner approval required before activation.'
    ),
    (
      '3f942c78-6e21-440d-9d2c-134deaea9fa8'::uuid,
      'DEMO-MOTO-STAGING-V1',
      '[DEMO] Motorcycle Care Bay',
      'demo_motorcycle_express_staging_v1',
      'Motorcycle'::public.vehicle_type_enum,
      2,
      FALSE,
      TRUE,
      'Private Vercel staging demo only; owner approval required before activation.'
    );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 2 THEN
    RAISE EXCEPTION 'Expected two demo resources, inserted %.', v_rows;
  END IF;

  INSERT INTO public.services (
    id, category_slug, category_title, option_slug, name, short_description,
    vehicle_type, duration_minutes, buffer_minutes, required_resource_type,
    required_units, confirmation_mode, pending_hold_minutes, min_notice_hours,
    max_advance_days, cancellation_cutoff_minutes, reschedule_cutoff_minutes,
    is_active, is_dev_default
  ) VALUES
    (
      '76550a6d-c351-41e6-a5e4-476ac4f3a868'::uuid,
      'demo-staging',
      '[DEMO] Staging Services',
      'demo-car-care-request-staging-v1',
      '[DEMO] Car Care Request',
      'Development-only client demonstration service. Not an approved business offering.',
      'Car'::public.vehicle_type_enum,
      90,
      30,
      'demo_car_care_staging_v1',
      1,
      'manual'::public.confirmation_mode_enum,
      60,
      0,
      60,
      0,
      0,
      FALSE,
      TRUE
    ),
    (
      'd5ca4aa6-4c6c-43b7-9cf4-2cc8ff5a1669'::uuid,
      'demo-staging',
      '[DEMO] Staging Services',
      'demo-motorcycle-express-staging-v1',
      '[DEMO] Motorcycle Express',
      'Development-only client demonstration service. Not an approved business offering.',
      'Motorcycle'::public.vehicle_type_enum,
      60,
      30,
      'demo_motorcycle_express_staging_v1',
      1,
      'auto'::public.confirmation_mode_enum,
      60,
      0,
      60,
      0,
      0,
      FALSE,
      TRUE
    );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 2 THEN
    RAISE EXCEPTION 'Expected two demo services, inserted %.', v_rows;
  END IF;
END
$demo_prepare$ LANGUAGE plpgsql;
