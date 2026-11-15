import { createHash, randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readSupabasePublicConfig } from "@/lib/supabase/config";
import { getRequiredSupabaseServiceRoleClient } from "@/lib/supabase/server";

loadEnvConfig(process.cwd());

const runRequested = process.env.RUN_SUPABASE_INTEGRATION_TESTS === "true";
const writesAuthorized = process.env.SUPABASE_INTEGRATION_ALLOW_WRITES === "true";
const authorizedRef = process.env.SUPABASE_INTEGRATION_PROJECT_REF;
const adminUserId = process.env.SUPABASE_ADMIN_INTEGRATION_USER_ID;
const adminEmail = process.env.SUPABASE_ADMIN_INTEGRATION_EMAIL;
const adminPassword = process.env.SUPABASE_ADMIN_INTEGRATION_PASSWORD;
const approvedDevelopmentRef = "qcjslbakgdofmzthqxuu";
const approvedAdminFingerprint = "68e818e01d9a";

function configuredRef() {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0]; }
  catch { return null; }
}

function identityFingerprint(userId: string | undefined) {
  return userId
    ? createHash("sha256").update(userId).digest("hex").slice(0, 12)
    : null;
}

const enabled = runRequested && writesAuthorized && process.env.VERCEL_ENV !== "production" &&
  Boolean(adminUserId && adminEmail && adminPassword) &&
  authorizedRef === approvedDevelopmentRef && configuredRef() === approvedDevelopmentRef &&
  identityFingerprint(adminUserId) === approvedAdminFingerprint;
const describeLive = enabled ? describe : describe.skip;

function manilaDate(offset: number) {
  for (let add = offset; add < offset + 8; add += 1) {
    const value = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + add * 86_400_000));
    if (new Date(`${value}T12:00:00+08:00`).getUTCDay() !== 0) return value;
  }
  throw new Error("No non-Sunday integration date available.");
}

describeLive("Phase 4 Supabase admin security", () => {
  let db: SupabaseClient;
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const resourceId = randomUUID();
  const serviceId = randomUUID();
  const customerId = randomUUID();
  const vehicleId = randomUUID();
  const createdHourIds: string[] = [];
  const bookingIds: string[] = [];
  let nonMemberUserId = "";
  const dates = { approve: manilaDate(3), reject: manilaDate(5), cancel: manilaDate(7), first: manilaDate(9), second: manilaDate(11), target: manilaDate(13), past: manilaDate(-7) };

  async function insertBooking(date: string, status: "pending" | "confirmed", start = "09:00", expired = false) {
    const id = randomUUID();
    const startAt = new Date(`${date}T${start}:00+08:00`);
    const endAt = new Date(startAt.getTime() + 60 * 60_000);
    const end = `${String(endAt.getUTCHours() + 8).padStart(2, "0")}:00`;
    const { error } = await db.from("bookings").insert({
      id, reference_code: `ADM-${runId}-${bookingIds.length}`, idempotency_key: `admin-integration-${runId}-${bookingIds.length}`,
      request_fingerprint: "a".repeat(64), customer_id: customerId, vehicle_id: vehicleId, service_id: serviceId,
      resource_id: resourceId, allocated_units: 2, appointment_date: date, start_time_local: start,
      end_time_local: end, start_at: startAt.toISOString(), end_at: endAt.toISOString(), duration_minutes: 60,
      buffer_minutes: 0, confirmation_mode: "manual", status,
      pending_expires_at: status === "pending" ? new Date(Date.now() + (expired ? -60_000 : 3_600_000)).toISOString() : null,
    });
    if (error) throw error;
    bookingIds.push(id);
    return id;
  }

  async function transition(id: string, operation: string, extra: Record<string, unknown> = {}) {
    const { data, error } = await db.rpc("admin_transition_booking_atomic", {
      p_booking_id: id, p_operation: operation, p_reason: operation === "reject" || operation === "cancel" ? "Integration test" : null,
      p_new_appointment_date: null, p_new_start_time_local: null, p_admin_user_id: adminUserId, ...extra,
    });
    if (error) throw error;
    return data as { ok: boolean; status?: string; idempotent?: boolean; message?: string };
  }

  beforeAll(async () => {
    if (!adminUserId || !adminEmail || !adminPassword) {
      throw new Error("The designated administrator ID and private test credentials are required.");
    }
    if (configuredRef() !== approvedDevelopmentRef || authorizedRef !== approvedDevelopmentRef) {
      throw new Error("The integration suite is restricted to the approved development project.");
    }
    if (identityFingerprint(adminUserId) !== approvedAdminFingerprint) {
      throw new Error("The configured administrator does not match the approved identity fingerprint.");
    }
    db = getRequiredSupabaseServiceRoleClient();
    const { data: authUser, error: authUserError } = await db.auth.admin.getUserById(adminUserId);
    if (authUserError || !authUser.user || !authUser.user.email_confirmed_at) {
      throw new Error("The integration administrator must be an existing, email-verified Auth user.");
    }
    const { data: membership } = await db.from("admin_memberships").select("user_id").eq("user_id", adminUserId).eq("is_active", true).maybeSingle();
    if (!membership) throw new Error("The integration administrator must be pre-enrolled and active.");

    const requiredDays = [...new Set(Object.values(dates).map((date) => new Date(`${date}T12:00:00+08:00`).getUTCDay()))];
    const { data: existing, error: hoursError } = await db.from("business_hours").select("day_of_week").in("day_of_week", requiredDays);
    if (hoursError) throw hoursError;
    const present = new Set((existing ?? []).map((row) => row.day_of_week));
    for (const day of requiredDays.filter((value) => !present.has(value))) {
      const id = randomUUID();
      const { error } = await db.from("business_hours").insert({ id, day_of_week: day, day_name: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][day], open_time: "08:00", close_time: "18:00", slot_interval_minutes: 60, is_closed: false, is_dev_default: true });
      if (error) throw error;
      createdHourIds.push(id);
    }
    const { error: resourceError } = await db.from("booking_resources").insert({ id: resourceId, code: `ADMIN-${runId}`, name: "Admin Integration Resource", resource_type: `admin_${runId}`, vehicle_type: "Car", total_capacity: 2, is_active: true, is_dev_default: true });
    if (resourceError) throw resourceError;
    const { error: serviceError } = await db.from("services").insert({ id: serviceId, category_slug: "integration-tests", category_title: "Integration Tests", option_slug: `admin-${runId}`, name: "Admin Integration Service", short_description: "Isolated Phase 4 test service", vehicle_type: "Car", duration_minutes: 60, buffer_minutes: 0, required_resource_type: `admin_${runId}`, required_units: 2, confirmation_mode: "manual", pending_hold_minutes: 60, min_notice_hours: 0, max_advance_days: 60, cancellation_cutoff_minutes: 0, reschedule_cutoff_minutes: 0, is_active: true, is_dev_default: true });
    if (serviceError) throw serviceError;
    const { error: customerError } = await db.from("customers").insert({ id: customerId, full_name: "Admin Integration Customer", email: `admin-${runId}@example.invalid`, email_normalized: `admin-${runId}@example.invalid`, phone: "09170000000", phone_normalized: "09170000000" });
    if (customerError) throw customerError;
    const { error: vehicleError } = await db.from("vehicles").insert({ id: vehicleId, customer_id: customerId, vehicle_type: "Car", manufacturer: "Integration", model: "Admin Test", model_year: 2026 });
    if (vehicleError) throw vehicleError;
  });

  afterAll(async () => {
    if (!db) return;
    const cleanupErrors: string[] = [];
    if (nonMemberUserId) {
      const { error } = await db.auth.admin.deleteUser(nonMemberUserId);
      if (error) cleanupErrors.push("temporary non-member Auth user");
    }
    const cleanupResults = await Promise.all([
      db.from("blocked_dates").delete().eq("resource_id", resourceId).eq("reason", `Admin integration conflict ${runId}`),
      db.from("services").update({ is_active: false }).eq("id", serviceId),
      db.from("booking_resources").update({ is_active: false }).eq("id", resourceId),
      ...(createdHourIds.length
        ? [db.from("business_hours").delete().in("id", createdHourIds)]
        : []),
    ]);
    const cleanupLabels = ["isolated blocked date", "isolated service", "isolated resource", "temporary business hours"];
    cleanupResults.forEach((result, index) => {
      if (result.error) cleanupErrors.push(cleanupLabels[index]);
    });
    if (cleanupErrors.length) {
      throw new Error(`Integration cleanup failed for: ${cleanupErrors.join(", ")}.`);
    }
  });

  it("authenticates the active administrator and denies anon, authenticated, and non-member RPC execution", async () => {
    const publicConfig = readSupabasePublicConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
    const adminAuth = createClient(publicConfig.url, publicConfig.publishableKey, { auth: { persistSession: false } });
    const { data: adminData, error: adminError } = await adminAuth.auth.signInWithPassword({ email: adminEmail!, password: adminPassword! });
    expect(adminError).toBeNull();
    expect(adminData.user?.id).toBe(adminUserId);
    expect(adminData.user?.email_confirmed_at).toBeTruthy();
    const { data: membership, error: membershipError } = await db
      .from("admin_memberships")
      .select("user_id")
      .eq("user_id", adminData.user!.id)
      .eq("is_active", true)
      .single();
    expect(membershipError).toBeNull();
    expect(membership?.user_id).toBe(adminUserId);
    await adminAuth.auth.signOut({ scope: "local" });

    const anon = createClient(publicConfig.url, publicConfig.publishableKey, { auth: { persistSession: false } });
    const { error: anonError } = await anon.rpc("admin_transition_booking_atomic", { p_booking_id: randomUUID(), p_operation: "approve", p_admin_user_id: randomUUID() });
    expect(anonError).toBeTruthy();
    const email = `admin-nonmember-${runId}@example.invalid`; const password = `T3st-${randomUUID()}!`;
    const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error("Unable to create non-member.");
    nonMemberUserId = created.data.user.id;
    const authenticated = createClient(publicConfig.url, publicConfig.publishableKey, { auth: { persistSession: false } });
    await authenticated.auth.signInWithPassword({ email, password });
    const { error: authenticatedError } = await authenticated.rpc("admin_transition_booking_atomic", { p_booking_id: randomUUID(), p_operation: "approve", p_admin_user_id: nonMemberUserId });
    expect(authenticatedError).toBeTruthy();
    const { data } = await db.rpc("admin_transition_booking_atomic", { p_booking_id: randomUUID(), p_operation: "approve", p_admin_user_id: nonMemberUserId });
    expect((data as { ok: boolean }).ok).toBe(false);
  });

  it("approves, rejects, cancels, completes, and safely retries", async () => {
    const approveId = await insertBooking(dates.approve, "pending");
    expect((await transition(approveId, "approve")).status).toBe("confirmed");
    expect((await transition(approveId, "approve")).idempotent).toBe(true);
    const rejectId = await insertBooking(dates.reject, "pending");
    expect((await transition(rejectId, "reject")).status).toBe("rejected");
    const cancelId = await insertBooking(dates.cancel, "confirmed");
    expect((await transition(cancelId, "cancel")).status).toBe("cancelled");
    const completeId = await insertBooking(dates.past, "confirmed");
    expect((await transition(completeId, "complete")).status).toBe("completed");
  });

  it("expires an elapsed pending hold instead of approving it", async () => {
    const id = await insertBooking(dates.approve, "pending", "11:00", true);
    const result = await transition(id, "approve");
    expect(result.ok).toBe(false);
    const { data } = await db.from("bookings").select("status").eq("id", id).single();
    expect(data?.status).toBe("expired");
  });

  it("serializes concurrent rescheduling and enforces capacity", async () => {
    const first = await insertBooking(dates.first, "confirmed");
    const second = await insertBooking(dates.second, "confirmed");
    const results = await Promise.all([first, second].map((id) => transition(id, "reschedule", { p_new_appointment_date: dates.target, p_new_start_time_local: "10:00" })));
    expect(results.filter((result) => result.ok)).toHaveLength(1);
  });

  it("rejects settings changes that conflict with active bookings", async () => {
    const id = await insertBooking(dates.target, "confirmed", "13:00");
    const calls = [
      { p_kind: "service", p_id: serviceId, p_payload: { duration_minutes: "90", is_active: "true" } },
      { p_kind: "resource", p_id: resourceId, p_payload: { total_capacity: "1", is_active: "on" } },
      { p_kind: "block", p_id: null, p_payload: { blocked_date: dates.target, start_time: "12:00", end_time: "15:00", resource_id: resourceId, reason: `Admin integration conflict ${runId}` } },
    ];
    for (const call of calls) {
      const { data, error } = await db.rpc("admin_update_booking_setting_atomic", { ...call, p_admin_user_id: adminUserId });
      if (error) throw error;
      expect((data as { ok: boolean }).ok).toBe(false);
    }
    expect(id).toBeTruthy();
  });

  it("keeps both audit tables immutable to service_role", async () => {
    const { data: log } = await db
      .from("admin_activity_logs")
      .select("id")
      .eq("actor_user_id", adminUserId)
      .eq("target_type", "booking")
      .in("target_id", bookingIds)
      .limit(1)
      .single();
    expect(log?.id).toBeTruthy();
    const update = await db.from("admin_activity_logs").update({ action: "TAMPERED" }).eq("id", log!.id);
    const remove = await db.from("booking_audit_logs").delete().in("booking_id", bookingIds);
    expect(update.error).toBeTruthy();
    expect(remove.error).toBeTruthy();
  });
});
