import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function migration(name: string): string {
  return readFileSync(resolve(process.cwd(), "supabase", "migrations", name), "utf8");
}

const schema = migration("20261021000001_phase3_booking_schema.sql");
const rpcs = migration("20261021000002_phase3_booking_rpcs.sql");
const hardening = migration("20261113000001_harden_booking_rpc_permissions.sql");
const seed = readFileSync(resolve(process.cwd(), "supabase", "seed.sql"), "utf8");

describe("booking migration static security contract", () => {
  it("pins every SECURITY DEFINER function to an empty search path", () => {
    const definitions = rpcs.match(
      /CREATE OR REPLACE FUNCTION[\s\S]*?(?=CREATE OR REPLACE FUNCTION|$)/g
    );
    expect(definitions).not.toBeNull();
    for (const definition of definitions ?? []) {
      if (definition.includes("SECURITY DEFINER")) {
        expect(definition).toContain("SET search_path = ''");
      }
    }
    expect(rpcs).not.toMatch(/SET search_path\s*=\s*public/i);
  });

  it("revokes public RPC execution in the creation migration and grants only service_role", () => {
    for (const functionName of [
      "create_booking_atomic",
      "cancel_booking_by_token_atomic",
      "reschedule_booking_by_token_atomic",
      "expire_pending_bookings_atomic",
    ]) {
      const revokePattern = new RegExp(
        `REVOKE ALL ON FUNCTION public\\.${functionName}\\([\\s\\S]*?FROM PUBLIC, anon, authenticated;`
      );
      const grantPattern = new RegExp(
        `GRANT EXECUTE ON FUNCTION public\\.${functionName}\\([\\s\\S]*?TO service_role;`
      );
      expect(rpcs).toMatch(revokePattern);
      expect(rpcs).toMatch(grantPattern);
    }
    expect(rpcs).not.toMatch(/GRANT EXECUTE[\s\S]*?TO (?:PUBLIC|anon|authenticated)/);
    expect(rpcs).toContain("ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC");
  });

  it("uses authoritative database time and protects retry semantics", () => {
    expect(rpcs).not.toMatch(/\bp_now\b/);
    expect(rpcs).toContain("pg_catalog.clock_timestamp()");
    expect(rpcs).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(rpcs).toContain("request_fingerprint");
    expect(rpcs).toContain("IDEMPOTENCY_KEY_REUSED");
    expect(rpcs).toContain("WHEN unique_violation");
  });

  it("contains lifecycle, integrity, token, and schedule constraints", () => {
    expect(schema).toContain("'expired'");
    expect(schema).toContain("chk_booking_pending_expiration");
    expect(schema).toContain("chk_booking_cancellation_state");
    expect(schema).toContain("chk_booking_manila_schedule_snapshot");
    expect(schema).toContain("request_fingerprint ~ '^[0-9a-f]{64}$'");
    expect(schema).toContain("token_hash ~ '^[0-9a-f]{64}$'");
    expect(schema).toContain("uq_booking_tokens_one_active_purpose");
    expect(schema).toContain("fk_booking_vehicle_customer");
    expect(schema).toContain("guard_booking_integrity");
    expect(schema).toContain("guard_vehicle_model_year");
  });

  it("keeps audit records immutable to the service role", () => {
    expect(schema).toMatch(
      /CREATE TABLE IF NOT EXISTS booking_audit_logs[\s\S]*?booking_id UUID NOT NULL REFERENCES bookings\(id\) ON DELETE RESTRICT/
    );
    expect(hardening).toContain(
      "REVOKE ALL ON TABLE public.booking_audit_logs FROM service_role"
    );
    expect(hardening).toContain(
      "GRANT SELECT, INSERT ON TABLE public.booking_audit_logs TO service_role"
    );
    expect(hardening).not.toMatch(/GRANT (?:UPDATE|DELETE|TRUNCATE)[\s\S]*booking_audit_logs/);
  });

  it("keeps development capacity internally consistent and inactive", () => {
    expect(seed).toContain("Total capacity: 6");
    expect(seed).not.toMatch(/'BAY-[^\n]+, TRUE, TRUE/);
    expect(schema).toMatch(/booking_resources[\s\S]*?is_active BOOLEAN NOT NULL DEFAULT FALSE/);
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS services[\s\S]*?is_active BOOLEAN NOT NULL DEFAULT FALSE/);
  });
});
