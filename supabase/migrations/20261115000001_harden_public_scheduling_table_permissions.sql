-- =============================================================================
-- MANILA AUTO PROS — HARDEN PUBLIC SCHEDULING TABLE PERMISSIONS
--
-- Supabase's default table privileges left anon and authenticated with direct
-- write grants on public scheduling configuration. RLS currently denies those
-- writes, but least privilege requires the table grants to be read-only too.
-- =============================================================================

REVOKE ALL ON TABLE
  public.blocked_dates,
  public.booking_resources,
  public.business_hours,
  public.services
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.blocked_dates,
  public.booking_resources,
  public.business_hours,
  public.services
TO anon, authenticated;

-- Fail the migration atomically if direct or inherited privileges do not
-- resolve to exactly the intended read-only access.
DO $$
DECLARE
  v_role NAME;
  v_table REGCLASS;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon'::NAME, 'authenticated'::NAME]
  LOOP
    FOREACH v_table IN ARRAY ARRAY[
      'public.blocked_dates'::REGCLASS,
      'public.booking_resources'::REGCLASS,
      'public.business_hours'::REGCLASS,
      'public.services'::REGCLASS
    ]
    LOOP
      IF NOT pg_catalog.has_table_privilege(v_role, v_table, 'SELECT')
         OR pg_catalog.has_table_privilege(
           v_role,
           v_table,
           'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
         )
      THEN
        RAISE EXCEPTION
          'Scheduling table privileges are not read-only for role % on table %.',
          v_role,
          v_table
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
