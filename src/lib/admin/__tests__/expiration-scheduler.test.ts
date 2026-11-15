import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");
const rpcMigration = read(
  "supabase/migrations/20261021000002_phase3_booking_rpcs.sql"
);
const permissionMigration = read(
  "supabase/migrations/20261113000001_harden_booking_rpc_permissions.sql"
);
const scheduler = read("supabase/scheduler/expire_pending_bookings.sql");
const integrationSuite = read(
  "src/lib/admin/__tests__/expire-pending.integration.test.ts"
);

const expirationFunction = rpcMigration.match(
  /CREATE OR REPLACE FUNCTION public\.expire_pending_bookings_atomic\(\)[\s\S]*?(?=REVOKE ALL ON FUNCTION public\.expire_pending_bookings_atomic)/
)?.[0];

describe("pending-booking expiration scheduler contract", () => {
  it("expires only elapsed pending holds using authoritative database time", () => {
    expect(expirationFunction).toBeTruthy();
    expect(expirationFunction).toContain("b.status = 'pending'");
    expect(expirationFunction).toContain("b.pending_expires_at <= v_now");
    expect(expirationFunction).toContain("pg_catalog.clock_timestamp()");
    expect(expirationFunction).toContain("SET status = 'expired'");
    expect(expirationFunction).toContain("pending_expires_at = NULL");
  });

  it("serializes concurrent runs and remains idempotent", () => {
    expect(expirationFunction).toContain("FOR UPDATE SKIP LOCKED");
    expect(expirationFunction).toContain("WHERE id = v_booking.id");
  });

  it("revokes active tokens and writes one system audit event per expiration", () => {
    expect(expirationFunction).toContain("UPDATE public.booking_tokens");
    expect(expirationFunction).toContain("used_at IS NULL");
    expect(expirationFunction).toContain("revoked_at IS NULL");
    expect(expirationFunction).toContain("INSERT INTO public.booking_audit_logs");
    expect(expirationFunction).toContain("BOOKING_PENDING_EXPIRED");
  });

  it("keeps the RPC owner-secured with an empty search path", () => {
    expect(expirationFunction).toContain("SECURITY DEFINER");
    expect(expirationFunction).toContain("SET search_path = ''");
    expect(permissionMigration).toContain(
      "ALTER FUNCTION public.expire_pending_bookings_atomic() OWNER TO postgres"
    );
    expect(permissionMigration).toMatch(
      /REVOKE ALL ON FUNCTION public\.expire_pending_bookings_atomic\(\)\s+FROM PUBLIC, anon, authenticated;/
    );
    expect(permissionMigration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.expire_pending_bookings_atomic\(\)\s+TO service_role;/
    );
  });

  it("prepares a direct database schedule without an HTTP or secret dependency", () => {
    expect(scheduler).toContain("manila-auto-pros-expire-pending");
    expect(scheduler).toContain("'* * * * *'");
    expect(scheduler).toContain(
      "SELECT public.expire_pending_bookings_atomic();"
    );
    expect(scheduler).not.toMatch(/net\.http|ADMIN_CRON_SECRET|vault/i);
  });

  it("isolates live fixtures from public configuration and the active Cron job", () => {
    const setup = integrationSuite.match(
      /beforeAll\(async \(\) => \{[\s\S]*?\r?\n  \}\);\r?\n\r?\n  afterAll/
    )?.[0];

    expect(setup).toBeTruthy();
    expect(integrationSuite).toContain("assertConfigurationIsolation");
    expect(integrationSuite).toContain('.from("business_hours").insert');
    expect(integrationSuite).toContain("closeFixtureConfiguration");
    expect(integrationSuite).toContain('.update({ is_active: false })');
    expect(integrationSuite).toMatch(/\.from\("business_hours"\)\s+\.delete\(\)/);
    expect(setup?.indexOf("concurrentSecondId = await insertBooking")).toBeLessThan(
      setup?.indexOf("await closeFixtureConfiguration();") ?? -1
    );
    expect(integrationSuite).toContain("makeTestBookingsEligible");
    expect(integrationSuite).toContain("expirationAuditCount(id)).toBe(1)");
    expect(integrationSuite).not.toContain("expiredCount: 1 }");
  });
});
