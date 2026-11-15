import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Phase 4 server boundaries", () => {
  it("reauthorizes every admin mutation", () => {
    const actions = read("src/app/admin/actions.ts");
    expect(actions.match(/await requireAdmin\(\)/g)).toHaveLength(2);
    expect(actions).not.toMatch(/\.from\("bookings"\)\.update/);
    expect(actions).toContain('.rpc("admin_transition_booking_atomic"');
  });

  it("requires a constant-time server secret for the expiration endpoint", () => {
    const route = read("src/app/api/jobs/expire-pending/route.ts");
    expect(route).toContain("ADMIN_CRON_SECRET");
    expect(route).toContain("constantTimeEqual");
    expect(route).toContain('.rpc("expire_pending_bookings_atomic")');
    expect(route).not.toContain("NEXT_PUBLIC_ADMIN_CRON_SECRET");
  });

  it("uses verified Supabase users plus active membership", () => {
    const auth = read("src/lib/admin/auth.ts");
    expect(auth).toContain('import { connection } from "next/server"');
    expect(auth.indexOf("await connection()"))
      .toBeLessThan(auth.indexOf("auth.auth.getUser()"));
    expect(auth).toContain("auth.getUser()");
    expect(auth).toContain('.from("admin_memberships")');
    expect(auth).toContain('.eq("is_active", true)');
  });
});
