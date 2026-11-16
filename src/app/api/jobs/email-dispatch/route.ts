import { constantTimeEqual } from "@/lib/security/constant-time";
import { dispatchEmailBatch } from "@/lib/email/dispatcher";

export async function POST(request: Request) {
  const configured = process.env.EMAIL_DISPATCH_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = /^Bearer\s+\S+$/i.test(authorization)
    ? authorization.replace(/^Bearer\s+/i, "")
    : "";
  if (!configured || configured.length < 32 || !constantTimeEqual(supplied, configured)) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await dispatchEmailBatch();
    if (!result.enabled) {
      return Response.json({ ok: false, message: "Email delivery is disabled" }, { status: 503 });
    }
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("Email dispatch job failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok: false, message: "Email dispatch failed" }, { status: 500 });
  }
}
