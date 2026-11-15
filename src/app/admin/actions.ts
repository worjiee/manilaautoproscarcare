"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { getRequiredSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import { checkRateLimit } from "@/lib/security/rate-limiter";

export type AdminActionState = { ok: boolean; message: string };
const initialError = (message: string): AdminActionState => ({ ok: false, message });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const settingFields: Record<string, ReadonlySet<string>> = {
  service: new Set(["duration_minutes", "buffer_minutes", "min_notice_hours", "max_advance_days", "cancellation_cutoff_minutes", "reschedule_cutoff_minutes", "confirmation_mode", "is_active"]),
  resource: new Set(["total_capacity", "is_active"]),
  hours: new Set(["open_time", "close_time", "is_closed"]),
  block: new Set(["blocked_date", "start_time", "end_time", "resource_id", "reason"]),
  block_deactivate: new Set(),
};

async function requestKey(scope: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return `${scope}:${ip}`;
}

export async function loginAdmin(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const limit = checkRateLimit({ key: await requestKey("admin-login"), windowMs: 15 * 60_000, maxRequests: 10 });
  if (!limit.allowed) return initialError(`Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.`);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return initialError("Enter a valid email and password.");

  const auth = await createSupabaseAuthServerClient();
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.user) return initialError("Invalid credentials or administrator access.");

  const service = getRequiredSupabaseServiceRoleClient();
  const { data: membership } = await service.from("admin_memberships").select("user_id").eq("user_id", data.user.id).eq("is_active", true).maybeSingle();
  if (!membership) {
    await auth.auth.signOut();
    return initialError("Invalid credentials or administrator access.");
  }
  redirect("/admin/dashboard");
}

export async function logoutAdmin() {
  const auth = await createSupabaseAuthServerClient();
  await auth.auth.signOut();
  redirect("/admin/login");
}

export async function mutateBookingAction(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const bookingId = String(formData.get("bookingId") || "");
  const operation = String(formData.get("operation") || "");
  const reason = String(formData.get("reason") || "").trim().slice(0, 500);
  const date = String(formData.get("appointmentDate") || "") || null;
  const time = String(formData.get("startTime") || "") || null;
  if (!uuidPattern.test(bookingId) || !["approve", "reject", "cancel", "complete", "reschedule"].includes(operation)) return initialError("Invalid booking action.");
  if (["reject", "cancel"].includes(operation) && reason.length < 3) return initialError("A reason is required.");
  if (operation === "reschedule" && (!date || !time || !datePattern.test(date) || !timePattern.test(time))) return initialError("A valid Manila appointment date and time are required.");

  const db = getRequiredSupabaseServiceRoleClient();
  const { data, error } = await db.rpc("admin_transition_booking_atomic", {
    p_booking_id: bookingId,
    p_operation: operation,
    p_reason: reason || null,
    p_new_appointment_date: date,
    p_new_start_time_local: time,
    p_admin_user_id: admin.userId,
  });
  if (error) return initialError("The secure booking operation could not be completed.");
  const result = data as { ok?: boolean; message?: string } | null;
  if (!result?.ok) return initialError(result?.message || "Booking state did not permit this action.");
  revalidatePath("/admin");
  return { ok: true, message: "Booking updated and audit event recorded." };
}

export async function updateSettingsAction(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const kind = String(formData.get("kind") || "");
  const id = String(formData.get("id") || "");
  if (!settingFields[kind] || (kind !== "block" && !uuidPattern.test(id))) return initialError("Invalid settings request.");
  const entries = Array.from(formData.entries()).filter(([key]) => !["kind", "id"].includes(key));
  if (entries.some(([key, value]) => !settingFields[kind].has(key) || typeof value !== "string" || value.length > 500)) return initialError("One or more settings fields are invalid.");
  const payload = Object.fromEntries(entries.map(([key, value]) => [key, value]));
  const db = getRequiredSupabaseServiceRoleClient();
  const { data, error } = await db.rpc("admin_update_booking_setting_atomic", { p_kind: kind, p_id: id || null, p_payload: payload, p_admin_user_id: admin.userId });
  if (error) return initialError("Settings could not be saved securely.");
  const result = data as { ok?: boolean; message?: string } | null;
  if (!result?.ok) return initialError(result?.message || "Settings conflict with existing bookings.");
  revalidatePath("/admin/settings");
  return { ok: true, message: "Settings saved and audited." };
}
