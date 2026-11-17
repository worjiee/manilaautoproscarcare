import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SERVICE_CATEGORIES,
  STAGING_DEMO_SERVICE_CATEGORIES,
} from "@/lib/constants/site-data";

const root = process.cwd();
const readSql = (name: string) =>
  readFileSync(resolve(root, "supabase", "staging", name), "utf8");

describe("staging demo booking preparation", () => {
  it("keeps demo choices out of the normal business catalog", () => {
    const normalIds = SERVICE_CATEGORIES.flatMap((category) =>
      category.items.map((item) => item.id)
    );
    expect(normalIds).not.toContain("demo-car-care-request-staging-v1");
    expect(normalIds).not.toContain("demo-motorcycle-express-staging-v1");
  });

  it("defines exactly the two reviewed demo booking choices", () => {
    expect(
      STAGING_DEMO_SERVICE_CATEGORIES.flatMap((category) =>
        category.items.map((item) => item.id)
      )
    ).toEqual([
      "demo-car-care-request-staging-v1",
      "demo-motorcycle-express-staging-v1",
    ]);
  });

  it("prepares hours without activating services or resources", () => {
    const sql = readSql("prepare_demo_business_hours.sql");
    const executable = sql.replace(/^--.*$/gm, "");
    expect(sql).toContain("current_user <> 'postgres'");
    expect(sql).toContain("Expected seven demo business-hours rows");
    expect(sql).not.toMatch(/UPDATE public\.(services|booking_resources)/i);
    expect(executable).not.toMatch(/(?:INSERT INTO|UPDATE|DELETE FROM)\s+cron\./i);
  });

  it("limits activation writes to the four reviewed UUIDs", () => {
    const sql = readSql("activate_demo_booking_configuration.sql");
    const executable = sql.replace(/^--.*$/gm, "");
    expect(sql).toContain("Unrelated active booking configuration detected");
    expect(sql).toContain("Expected to activate two demo resources");
    expect(sql).toContain("Expected to activate two demo services");
    expect(sql).not.toMatch(/UPDATE public\.(bookings|business_hours|blocked_dates)/i);
    expect(sql).not.toMatch(/\b(?:DELETE|TRUNCATE)\b/i);
    expect(executable).not.toMatch(/(?:INSERT INTO|UPDATE|DELETE FROM)\s+cron\./i);
  });
});
