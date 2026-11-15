-- MANILA AUTO PROS PHASE 4.5 ADMIN TABLE PRIVILEGE CORRECTION
-- Prepared after post-deployment verification. Do not apply without approval.

-- Supabase default privileges granted service_role broader access when the
-- Phase 4 tables were created. Reset the effective table grants explicitly.
REVOKE ALL ON TABLE public.admin_memberships FROM service_role;
GRANT SELECT ON TABLE public.admin_memberships TO service_role;

REVOKE ALL ON TABLE public.admin_activity_logs FROM service_role;
GRANT SELECT ON TABLE public.admin_activity_logs TO service_role;

