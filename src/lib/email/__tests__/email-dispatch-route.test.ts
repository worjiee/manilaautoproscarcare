import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/app/api/jobs/email-dispatch/route.ts"),
  "utf8"
);

describe("email dispatch job boundary", () => {
  it("exposes POST only and uses constant-time bearer authorization", () => {
    expect(source).toContain("export async function POST");
    expect(source).not.toMatch(/export async function (?:GET|PUT|PATCH|DELETE)/);
    expect(source).toContain("constantTimeEqual(supplied, configured)");
    expect(source).toContain("configured.length < 32");
  });

  it("does not return secrets or provider details", () => {
    expect(source).not.toContain("RESEND_API_KEY");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toMatch(/authorization[^\n]+Response\.json/i);
  });
});
