import { constantTimeEqual } from "@/lib/security/constant-time";
import { getRequiredSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const configured = process.env.ADMIN_CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = /^Bearer\s+\S+$/i.test(authorization)
    ? authorization.replace(/^Bearer\s+/i, "")
    : "";
  if (!configured || configured.length < 32 || !constantTimeEqual(supplied, configured)) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = getRequiredSupabaseServiceRoleClient();
    const { data, error } = await db.rpc("expire_pending_bookings_atomic");
    if (error) throw error;
    return Response.json({ ok: true, expiredCount: Number(data ?? 0), ranAt: new Date().toISOString() });
  } catch (error) {
    console.error("Pending booking expiration job failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok: false, message: "Expiration job failed" }, { status: 500 });
  }
}
