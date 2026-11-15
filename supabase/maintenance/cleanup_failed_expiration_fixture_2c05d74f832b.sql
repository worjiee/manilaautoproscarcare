DO $cleanup$
DECLARE
  v_rows INTEGER;
BEGIN
  IF CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'Cleanup requires the trusted postgres owner role; got %.', CURRENT_USER;
  END IF;

  PERFORM v.id
  FROM public.vehicles AS v
  WHERE v.id = '315c71f6-936a-4ce8-a037-924847704fa3'::uuid
    AND v.customer_id = 'd8ff7d51-1feb-49d2-afa7-65ffb87179e8'::uuid
    AND v.manufacturer = 'Integration'
    AND v.model = 'Expiration Test'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exact failed-run vehicle did not match the approved cleanup scope.';
  END IF;

  PERFORM c.id
  FROM public.customers AS c
  WHERE c.id = 'd8ff7d51-1feb-49d2-afa7-65ffb87179e8'::uuid
    AND c.full_name = 'Expiration Integration Customer'
    AND c.email_normalized = 'expiration-2c05d74f832b@example.invalid'
    AND c.phone_normalized = '09170000000'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exact failed-run customer did not match the approved cleanup scope.';
  END IF;

  PERFORM s.id
  FROM public.services AS s
  WHERE s.id = '949a23f9-7913-4a8a-9b10-cac1606afdc7'::uuid
    AND s.category_slug = 'integration-tests'
    AND s.option_slug = 'expiration-2c05d74f832b'
    AND s.required_resource_type = 'expiration_2c05d74f832b'
    AND s.is_dev_default
    AND NOT s.is_active
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exact failed-run service did not match the approved cleanup scope.';
  END IF;

  PERFORM r.id
  FROM public.booking_resources AS r
  WHERE r.id = '35a79394-41d9-4b89-b521-2945adf7fec4'::uuid
    AND r.code = 'EXP-2c05d74f832b'
    AND r.resource_type = 'expiration_2c05d74f832b'
    AND r.is_dev_default
    AND NOT r.is_active
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exact failed-run resource did not match the approved cleanup scope.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings AS b
    WHERE b.resource_id = '35a79394-41d9-4b89-b521-2945adf7fec4'::uuid
       OR b.service_id = '949a23f9-7913-4a8a-9b10-cac1606afdc7'::uuid
       OR b.customer_id = 'd8ff7d51-1feb-49d2-afa7-65ffb87179e8'::uuid
       OR b.vehicle_id = '315c71f6-936a-4ce8-a037-924847704fa3'::uuid
  ) THEN
    RAISE EXCEPTION 'A booking now depends on an approved cleanup fixture.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.booking_audit_logs AS a
    JOIN public.bookings AS b ON b.id = a.booking_id
    WHERE b.resource_id = '35a79394-41d9-4b89-b521-2945adf7fec4'::uuid
       OR b.service_id = '949a23f9-7913-4a8a-9b10-cac1606afdc7'::uuid
       OR b.customer_id = 'd8ff7d51-1feb-49d2-afa7-65ffb87179e8'::uuid
       OR b.vehicle_id = '315c71f6-936a-4ce8-a037-924847704fa3'::uuid
  ) THEN
    RAISE EXCEPTION 'An audit record now depends on an approved cleanup fixture.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.blocked_dates AS d
    WHERE d.resource_id = '35a79394-41d9-4b89-b521-2945adf7fec4'::uuid
  ) THEN
    RAISE EXCEPTION 'A blocked date now depends on the approved cleanup resource.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.vehicles AS v
    WHERE v.customer_id = 'd8ff7d51-1feb-49d2-afa7-65ffb87179e8'::uuid
      AND v.id <> '315c71f6-936a-4ce8-a037-924847704fa3'::uuid
  ) THEN
    RAISE EXCEPTION 'An unexpected vehicle now depends on the approved cleanup customer.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.admin_activity_logs AS l
    WHERE l.target_id IN (
      '315c71f6-936a-4ce8-a037-924847704fa3'::uuid,
      'd8ff7d51-1feb-49d2-afa7-65ffb87179e8'::uuid,
      '949a23f9-7913-4a8a-9b10-cac1606afdc7'::uuid,
      '35a79394-41d9-4b89-b521-2945adf7fec4'::uuid
    )
  ) THEN
    RAISE EXCEPTION 'An admin audit record now references an approved cleanup fixture.';
  END IF;

  DELETE FROM public.vehicles
  WHERE id = '315c71f6-936a-4ce8-a037-924847704fa3'::uuid;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Vehicle cleanup affected % rows instead of exactly one.', v_rows;
  END IF;

  DELETE FROM public.customers
  WHERE id = 'd8ff7d51-1feb-49d2-afa7-65ffb87179e8'::uuid;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Customer cleanup affected % rows instead of exactly one.', v_rows;
  END IF;

  DELETE FROM public.services
  WHERE id = '949a23f9-7913-4a8a-9b10-cac1606afdc7'::uuid;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Service cleanup affected % rows instead of exactly one.', v_rows;
  END IF;

  DELETE FROM public.booking_resources
  WHERE id = '35a79394-41d9-4b89-b521-2945adf7fec4'::uuid;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Resource cleanup affected % rows instead of exactly one.', v_rows;
  END IF;
END
$cleanup$;
