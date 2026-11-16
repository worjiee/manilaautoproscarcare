import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261116000001_phase5_email_outbox.sql"
);
const sql = readFileSync(migrationPath, "utf8");

const schedulingPrivilegesMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261115000001_harden_public_scheduling_table_permissions.sql"
);
const schedulingPrivilegesSql = readFileSync(
  schedulingPrivilegesMigrationPath,
  "utf8"
);

const digestCompatibilityMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261116000002_fix_email_digest_schema.sql"
);
const digestCompatibilitySql = readFileSync(
  digestCompatibilityMigrationPath,
  "utf8"
);

describe("Phase 5.1 outbox migration security", () => {
  it("creates and RLS-protects every email infrastructure table", () => {
    for (const table of [
      "email_outbox_events",
      "email_deliveries",
      "email_delivery_attempts",
      "email_webhook_events",
      "booking_delivery_secrets",
    ]) {
      expect(sql).toContain(`CREATE TABLE public.${table}`);
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
    expect(sql).toMatch(
      /FROM PUBLIC, anon, authenticated, service_role;/
    );
  });

  it("maps every required lifecycle event and deduplicates by audit source", () => {
    for (const event of [
      "booking.request_received",
      "booking.confirmed",
      "booking.rejected",
      "booking.cancelled",
      "booking.rescheduled",
      "booking.pending_expired",
      "admin.new_pending_booking",
    ]) {
      expect(sql).toContain(`'${event}'`);
    }
    expect(sql).toContain(
      "UNIQUE (source_audit_log_id, event_type, recipient_kind)"
    );
    expect(sql).toContain("AFTER INSERT ON public.booking_audit_logs");
  });

  it("uses hardened definer functions without exposing worker execution", () => {
    expect(sql.match(/SECURITY DEFINER/g)?.length).toBeGreaterThanOrEqual(4);
    expect(sql.match(/SET search_path = ''/g)?.length).toBeGreaterThanOrEqual(5);
    expect(sql).toContain(
      "FROM PUBLIC, anon, authenticated, service_role"
    );
    expect(sql).not.toMatch(/GRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE).*email_/i);
  });

  it("pins every new function owner to postgres before privileges are assigned", () => {
    for (const ownerStatement of [
      "ALTER FUNCTION public.set_email_delivery_updated_at() OWNER TO postgres;",
      "ALTER FUNCTION public.enqueue_booking_email_events_from_audit()\n  OWNER TO postgres;",
      `ALTER FUNCTION public.store_booking_delivery_secret_internal(
  UUID, TEXT, TEXT, JSONB
) OWNER TO postgres;`,
      `ALTER FUNCTION public.create_booking_with_email_atomic(
  TEXT, TEXT, TEXT, public.vehicle_type_enum, TEXT, TEXT, SMALLINT, TEXT,
  DATE, TIME, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB
) OWNER TO postgres;`,
      `ALTER FUNCTION public.reschedule_booking_with_email_atomic(
  TEXT, DATE, TIME, TEXT, TEXT, TIMESTAMPTZ, JSONB
) OWNER TO postgres;`,
    ]) {
      expect(sql).toContain(ownerStatement);
    }

    expect(sql.indexOf("OWNER TO postgres")).toBeLessThan(
      sql.indexOf("REVOKE ALL ON FUNCTION public.set_email_delivery_updated_at")
    );
  });

  it("stores ciphertext metadata but defines no plaintext token columns", () => {
    expect(sql).toContain("ciphertext_base64url TEXT NOT NULL");
    expect(sql).toContain("auth_tag_base64url TEXT NOT NULL");
    expect(sql).not.toMatch(/\bp_(?:cancel|reschedule)_token\s+TEXT\b/);
    expect(sql).not.toMatch(/\braw_(?:cancel|reschedule)?_?token\b/i);
  });

  it("does not replace or reschedule the active expiration RPC", () => {
    expect(sql).not.toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.expire_pending_bookings_atomic/i
    );
    expect(sql).not.toMatch(/cron\.schedule\s*\(/i);
  });
});

describe("public scheduling table privilege hardening", () => {
  it("runs before the Phase 5 email migration", () => {
    expect(
      schedulingPrivilegesMigrationPath.localeCompare(migrationPath)
    ).toBeLessThan(0);
  });

  it("removes inherited access and restores SELECT only", () => {
    for (const table of [
      "public.blocked_dates",
      "public.booking_resources",
      "public.business_hours",
      "public.services",
    ]) {
      expect(schedulingPrivilegesSql).toContain(table);
    }

    expect(schedulingPrivilegesSql).toContain(
      "FROM PUBLIC, anon, authenticated;"
    );
    expect(schedulingPrivilegesSql).toContain("TO anon, authenticated;");
    expect(schedulingPrivilegesSql).toContain(
      "'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'"
    );
    expect(schedulingPrivilegesSql).not.toMatch(/CREATE\s+POLICY/i);
    expect(schedulingPrivilegesSql).not.toMatch(/ALTER\s+TABLE.*ROW\s+LEVEL/i);
  });
});

describe("pgcrypto digest schema compatibility", () => {
  it("replaces only the internal envelope function with the Supabase digest schema", () => {
    expect(digestCompatibilitySql).toContain(
      "CREATE OR REPLACE FUNCTION public.store_booking_delivery_secret_internal("
    );
    expect(digestCompatibilitySql).toContain("extensions.digest(");
    expect(digestCompatibilitySql).toContain("'sha256'::TEXT");
    expect(digestCompatibilitySql).not.toContain("public.digest(");
    expect(digestCompatibilitySql).not.toContain("CREATE OR REPLACE FUNCTION public.create_booking_");
    expect(digestCompatibilitySql).not.toContain("CREATE OR REPLACE FUNCTION public.reschedule_booking_");
  });

  it("preserves the internal function security boundary", () => {
    expect(digestCompatibilitySql).toContain("SECURITY DEFINER");
    expect(digestCompatibilitySql).toContain("SET search_path = ''");
    expect(digestCompatibilitySql).toContain(
      `ALTER FUNCTION public.store_booking_delivery_secret_internal(
  UUID, TEXT, TEXT, JSONB
) OWNER TO postgres;`
    );
    expect(digestCompatibilitySql).toContain(
      `REVOKE ALL ON FUNCTION public.store_booking_delivery_secret_internal(
  UUID, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated, service_role;`
    );
    expect(digestCompatibilitySql).not.toMatch(/GRANT\s+EXECUTE/i);
    expect(digestCompatibilitySql).not.toMatch(/\bEXECUTE\s+(?:FORMAT|IMMEDIATE)/i);
  });
});

