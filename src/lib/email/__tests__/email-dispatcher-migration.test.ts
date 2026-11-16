import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20261116000003_phase5_email_dispatcher.sql"), "utf8");

describe("Phase 5.2 dispatcher migration security", () => {
  it("installs a disabled owner-controlled activation cutoff", () => {
    expect(sql).toContain("CREATE TABLE public.email_dispatch_control");
    expect(sql).toContain("enabled BOOLEAN NOT NULL DEFAULT FALSE");
    expect(sql).toContain("activation_cutoff_at TIMESTAMPTZ");
    expect(sql).toContain(
      "WHERE state IN ('pending', 'leased', 'materialized') AND created_at < v_cutoff"
    );
    expect(sql).not.toMatch(/UPDATE public\.email_dispatch_control\s+SET enabled = TRUE/i);
  });

  it("uses skip-locked leases, bounded retries, and immutable attempts", () => {
    expect(sql.match(/FOR UPDATE SKIP LOCKED/g)?.length).toBe(2);
    expect(sql).toContain("attempt_count >= v_max_attempts");
    expect(sql).toContain("INSERT INTO public.email_delivery_attempts");
    expect(sql).toContain("'dead_letter'");
  });

  it("owns all definer RPCs as postgres and grants only service_role", () => {
    const functions = [
      "claim_email_outbox_events_atomic(INTEGER, INTEGER)",
      "materialize_email_outbox_event_atomic(UUID, UUID, JSONB)",
      "release_email_outbox_event_atomic(UUID, UUID, TEXT, INTEGER)",
      "claim_email_deliveries_atomic(INTEGER, INTEGER)",
      "record_email_delivery_result_atomic(UUID, UUID, TEXT, TEXT, INTEGER, TEXT, INTEGER)",
    ];
    for (const fn of functions) {
      expect(sql).toContain(`ALTER FUNCTION public.${fn} OWNER TO postgres;`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role;`);
    }
    expect(sql.match(/SECURITY DEFINER/g)?.length).toBeGreaterThanOrEqual(8);
    expect(sql.match(/SET search_path = ''/g)?.length).toBeGreaterThanOrEqual(8);
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]+TO (?:PUBLIC|anon|authenticated)/i);
  });

  it("never stores plaintext management tokens", () => {
    expect(sql).not.toMatch(/cancel_token[^_h]\w*\s+TEXT/i);
    expect(sql).not.toMatch(/reschedule_token[^_h]\w*\s+TEXT/i);
    expect(sql).not.toMatch(/cron\.schedule/i);
  });

  it("encrypts frozen payloads and makes activation auditing immutable", () => {
    expect(sql).toContain("CREATE TABLE public.email_dispatch_audit_logs");
    expect(sql).toContain("payload_ciphertext_base64url TEXT NOT NULL");
    expect(sql).toContain("payload_auth_tag_base64url TEXT NOT NULL");
    expect(sql).toContain("trg_email_dispatch_control_audit");
    expect(sql).toContain("trg_email_dispatch_audit_immutable_rows");
    expect(sql).toContain("trg_email_dispatch_audit_no_truncate");
    expect(sql).toContain("HISTORICAL_REPLAY_AUTHORIZED");
    expect(sql).toContain("extensions.digest(");
    expect(sql).toContain("'payloadEnvelope', pg_catalog.jsonb_build_object(");
    expect(sql).not.toMatch(/'payloadEnvelope'[\s\S]{0,1500}'customerName'/);
  });
});
