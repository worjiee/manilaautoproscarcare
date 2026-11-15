import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("supabase/migrations/20261113000002_phase4_admin_security.sql"), "utf8");
const permissionCorrection = readFileSync(resolve("supabase/migrations/20261113000003_harden_admin_table_permissions.sql"), "utf8");

describe("Phase 4 admin security migration", () => {
  it("uses an explicit auth-user membership table with RLS", () => {
    expect(migration).toContain("REFERENCES auth.users(id)");
    expect(migration).toContain("ALTER TABLE public.admin_memberships ENABLE ROW LEVEL SECURITY");
    expect(migration).toMatch(/REVOKE ALL ON public\.admin_memberships[\s\S]*?anon, authenticated/);
  });

  it("keeps privileged admin functions service-role only", () => {
    for (const fn of ["admin_transition_booking_atomic", "admin_update_booking_setting_atomic"]) {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${fn}`);
      expect(migration).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}[\\s\\S]+TO service_role`));
    }
  });

  it("pins SECURITY DEFINER search paths and records audit events", () => {
    expect(migration.match(/SECURITY DEFINER SET search_path\s*=\s*''/g)).toHaveLength(2);
    expect(migration).toContain("RETURNS TRIGGER LANGUAGE plpgsql SET search_path=''");
    expect(migration).toContain("INSERT INTO public.booking_audit_logs");
    expect(migration).toContain("INSERT INTO public.admin_activity_logs");
    expect(migration).toContain("pending_expires_at <= v_now");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("FOR KEY SHARE");
    expect(migration).toContain("min_notice_hours");
    expect(migration).toContain("max_advance_days");
    expect(migration).toContain("conflicts with active bookings");
  });

  it("preserves immutable administrator attribution", () => {
    expect(migration).toContain("actor_user_id UUID NOT NULL");
    expect(migration).not.toContain("ON DELETE SET NULL");
    expect(permissionCorrection).toContain("REVOKE ALL ON TABLE public.admin_memberships FROM service_role");
    expect(permissionCorrection).toContain("GRANT SELECT ON TABLE public.admin_memberships TO service_role");
    expect(permissionCorrection).toContain("REVOKE ALL ON TABLE public.admin_activity_logs FROM service_role");
    expect(permissionCorrection).toContain("GRANT SELECT ON TABLE public.admin_activity_logs TO service_role");
  });
});
