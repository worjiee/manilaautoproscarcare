import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getRequiredSupabaseServiceRoleClient: vi.fn(),
}));

import { POST } from "@/app/api/jobs/expire-pending/route";
import { getRequiredSupabaseServiceRoleClient } from "@/lib/supabase/server";

const secret = "development-cron-secret-32-characters";
const rpc = vi.fn();
const getClient = vi.mocked(getRequiredSupabaseServiceRoleClient);

function request(authorization?: string) {
  return new Request("http://localhost/api/jobs/expire-pending", {
    method: "POST",
    headers: authorization ? { authorization } : undefined,
  });
}

describe("pending-booking expiration route", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_CRON_SECRET", secret);
    rpc.mockReset();
    getClient.mockReset();
    getClient.mockReturnValue({ rpc } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([undefined, "Bearer wrong", "Basic credentials", "Bearer"])(
    "rejects an unauthorized request without touching Supabase",
    async (authorization) => {
      const response = await POST(request(authorization));

      expect(response.status).toBe(401);
      expect(getClient).not.toHaveBeenCalled();
      expect(await response.json()).toEqual({
        ok: false,
        message: "Unauthorized",
      });
    }
  );

  it("fails closed when the configured secret is missing or too short", async () => {
    vi.stubEnv("ADMIN_CRON_SECRET", "too-short");

    const response = await POST(request("Bearer too-short"));

    expect(response.status).toBe(401);
    expect(getClient).not.toHaveBeenCalled();
  });

  it("invokes only the atomic expiration RPC for a trusted caller", async () => {
    rpc.mockResolvedValue({ data: 3, error: null });

    const response = await POST(request(`Bearer ${secret}`));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledExactlyOnceWith(
      "expire_pending_bookings_atomic"
    );
    expect(await response.json()).toMatchObject({ ok: true, expiredCount: 3 });
  });

  it("is safe to invoke repeatedly", async () => {
    rpc
      .mockResolvedValueOnce({ data: 1, error: null })
      .mockResolvedValueOnce({ data: 0, error: null });

    const first = await POST(request(`Bearer ${secret}`));
    const second = await POST(request(`Bearer ${secret}`));

    expect((await first.json()).expiredCount).toBe(1);
    expect((await second.json()).expiredCount).toBe(0);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("allows concurrent trusted invocations to rely on database locking", async () => {
    rpc
      .mockResolvedValueOnce({ data: 1, error: null })
      .mockResolvedValueOnce({ data: 0, error: null });

    const responses = await Promise.all([
      POST(request(`Bearer ${secret}`)),
      POST(request(`Bearer ${secret}`)),
    ]);
    const counts = await Promise.all(
      responses.map(async (response) => (await response.json()).expiredCount)
    );

    expect(counts.sort()).toEqual([0, 1]);
  });

  it("returns a generic error without leaking database details", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "private database detail" },
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await POST(request(`Bearer ${secret}`));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      message: "Expiration job failed",
    });
    consoleError.mockRestore();
  });
});
