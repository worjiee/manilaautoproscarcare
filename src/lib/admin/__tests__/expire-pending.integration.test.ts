import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/jobs/expire-pending/route";
import { getRequiredSupabaseServiceRoleClient } from "@/lib/supabase/server";

const approvedDevelopmentRef = "qcjslbakgdofmzthqxuu";
const runRequested = process.env.RUN_SUPABASE_INTEGRATION_TESTS === "true";
const writesAuthorized =
  process.env.SUPABASE_INTEGRATION_ALLOW_WRITES === "true";
const cronSecret = process.env.ADMIN_CRON_SECRET;

function configuredRef() {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
    ).hostname.split(".")[0];
  } catch {
    return null;
  }
}

const enabled =
  runRequested &&
  writesAuthorized &&
  process.env.VERCEL_ENV !== "production" &&
  process.env.SUPABASE_INTEGRATION_PROJECT_REF === approvedDevelopmentRef &&
  configuredRef() === approvedDevelopmentRef &&
  Boolean(cronSecret && cronSecret.length >= 32);

const describeLive = enabled ? describe.sequential : describe.skip;

function futureNonSundayAppointment() {
  for (let offset = 10; offset <= 16; offset += 1) {
    const candidate = new Date(Date.now() + offset * 86_400_000);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(candidate);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value ?? "";
    const date = `${part("year")}-${part("month")}-${part("day")}`;
    const dayOfWeek = new Date(`${date}T12:00:00+08:00`).getUTCDay();
    if (dayOfWeek !== 0) return { date, dayOfWeek };
  }
  throw new Error("Could not select a non-Sunday integration-test date.");
}

describeLive("pending booking expiration scheduler", () => {
  let db: SupabaseClient;
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const resourceId = randomUUID();
  const serviceId = randomUUID();
  const businessHoursId = randomUUID();
  const customerId = randomUUID();
  const vehicleId = randomUUID();
  const appointment = futureNonSundayAppointment();
  const bookingIds: string[] = [];
  let resourceCreated = false;
  let serviceCreated = false;
  let businessHoursCreated = false;
  let elapsedPendingId = "";
  let futurePendingId = "";
  let alreadyExpiredId = "";
  let confirmedId = "";
  let concurrentFirstId = "";
  let concurrentSecondId = "";

  function trustedRequest(secret = cronSecret) {
    return new Request("http://localhost/api/jobs/expire-pending", {
      method: "POST",
      headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
    });
  }

  async function insertBooking(
    status: "pending" | "confirmed" | "expired",
    startHour: number,
    pendingExpiresAt: string | null
  ) {
    const id = randomUUID();
    const date = appointment.date;
    const start = `${String(startHour).padStart(2, "0")}:00`;
    const end = `${String(startHour + 1).padStart(2, "0")}:00`;
    const { error } = await db.from("bookings").insert({
      id,
      reference_code: `EXP-${runId}-${bookingIds.length}`,
      idempotency_key: `expiration-integration-${runId}-${bookingIds.length}`,
      request_fingerprint: "e".repeat(64),
      customer_id: customerId,
      vehicle_id: vehicleId,
      service_id: serviceId,
      resource_id: resourceId,
      allocated_units: 1,
      appointment_date: date,
      start_time_local: start,
      end_time_local: end,
      start_at: new Date(`${date}T${start}:00+08:00`).toISOString(),
      end_at: new Date(`${date}T${end}:00+08:00`).toISOString(),
      duration_minutes: 60,
      buffer_minutes: 0,
      confirmation_mode: "manual",
      status,
      pending_expires_at: pendingExpiresAt,
    });
    if (error) throw error;
    bookingIds.push(id);
    return id;
  }

  async function assertNoUnrelatedElapsedPending() {
    const { data, error } = await db
      .from("bookings")
      .select("id")
      .eq("status", "pending")
      .lte("pending_expires_at", new Date().toISOString());
    if (error) throw error;
    const unrelated = (data ?? []).filter(
      ({ id }) => !bookingIds.includes(id)
    );
    if (unrelated.length) {
      throw new Error(
        "Expiration integration test refused to sweep unrelated pending bookings."
      );
    }
  }

  async function assertConfigurationIsolation() {
    const [services, resources, hours] = await Promise.all([
      db.from("services").select("id").eq("is_active", true),
      db.from("booking_resources").select("id").eq("is_active", true),
      db
        .from("business_hours")
        .select("id")
        .eq("day_of_week", appointment.dayOfWeek),
    ]);
    if (services.error || resources.error || hours.error) {
      throw new Error("Could not verify isolated booking configuration.");
    }
    if (
      (services.data ?? []).length > 0 ||
      (resources.data ?? []).length > 0 ||
      (hours.data ?? []).length > 0
    ) {
      throw new Error(
        "Expiration integration test requires an empty isolated booking configuration."
      );
    }
  }

  async function closeFixtureConfiguration() {
    if (serviceCreated) {
      const { error } = await db
        .from("services")
        .update({ is_active: false })
        .eq("id", serviceId);
      if (error) {
        throw new Error("Could not deactivate isolated test service.");
      }
    }
    if (resourceCreated) {
      const { error } = await db
        .from("booking_resources")
        .update({ is_active: false })
        .eq("id", resourceId);
      if (error) {
        throw new Error("Could not deactivate isolated test resource.");
      }
    }
    if (businessHoursCreated) {
      const { error } = await db
        .from("business_hours")
        .delete()
        .eq("id", businessHoursId);
      if (error) {
        throw new Error("Could not remove isolated test business hours.");
      }
    }
  }

  async function makeTestBookingsEligible(ids: string[]) {
    const { data, error } = await db
      .from("bookings")
      .update({ pending_expires_at: new Date(Date.now() - 60_000).toISOString() })
      .in("id", ids)
      .eq("status", "pending")
      .select("id");
    if (error) throw error;
    if ((data ?? []).length !== ids.length) {
      throw new Error(
        "Expiration integration fixtures were not eligible for expiration."
      );
    }
  }

  async function expirationAuditCount(id: string) {
    const { count, error } = await db
      .from("booking_audit_logs")
      .select("*", { count: "exact", head: true })
      .eq("booking_id", id)
      .eq("action", "BOOKING_PENDING_EXPIRED");
    if (error) throw error;
    return count;
  }

  async function status(id: string) {
    const { data, error } = await db
      .from("bookings")
      .select("status,pending_expires_at")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  }

  beforeAll(async () => {
    if (
      configuredRef() !== approvedDevelopmentRef ||
      process.env.SUPABASE_INTEGRATION_PROJECT_REF !== approvedDevelopmentRef
    ) {
      throw new Error(
        "Expiration integration testing is restricted to the approved development project."
      );
    }
    db = getRequiredSupabaseServiceRoleClient();
    await assertNoUnrelatedElapsedPending();
    await assertConfigurationIsolation();

    const { error: resourceError } = await db.from("booking_resources").insert({
      id: resourceId,
      code: `EXP-${runId}`,
      name: "Expiration Integration Resource",
      resource_type: `expiration_${runId}`,
      vehicle_type: "Car",
      total_capacity: 10,
      is_active: true,
      is_dev_default: true,
    });
    if (resourceError) throw resourceError;
    resourceCreated = true;

    const { error: serviceError } = await db.from("services").insert({
      id: serviceId,
      category_slug: "integration-tests",
      category_title: "Integration Tests",
      option_slug: `expiration-${runId}`,
      name: "Expiration Integration Service",
      short_description: "Isolated pending-expiration test service",
      vehicle_type: "Car",
      duration_minutes: 60,
      buffer_minutes: 0,
      required_resource_type: `expiration_${runId}`,
      required_units: 1,
      confirmation_mode: "manual",
      pending_hold_minutes: 60,
      min_notice_hours: 0,
      max_advance_days: 60,
      cancellation_cutoff_minutes: 0,
      reschedule_cutoff_minutes: 0,
      is_active: true,
      is_dev_default: true,
    });
    if (serviceError) throw serviceError;
    serviceCreated = true;

    const { error: hoursError } = await db.from("business_hours").insert({
      id: businessHoursId,
      day_of_week: appointment.dayOfWeek,
      day_name: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ][appointment.dayOfWeek],
      open_time: "07:00",
      close_time: "18:00",
      slot_interval_minutes: 60,
      is_closed: false,
      timezone: "Asia/Manila",
      is_dev_default: true,
    });
    if (hoursError) throw hoursError;
    businessHoursCreated = true;

    const email = `expiration-${runId}@example.invalid`;
    const { error: customerError } = await db.from("customers").insert({
      id: customerId,
      full_name: "Expiration Integration Customer",
      email,
      email_normalized: email,
      phone: "09170000000",
      phone_normalized: "09170000000",
    });
    if (customerError) throw customerError;

    const { error: vehicleError } = await db.from("vehicles").insert({
      id: vehicleId,
      customer_id: customerId,
      vehicle_type: "Car",
      manufacturer: "Integration",
      model: "Expiration Test",
      model_year: 2026,
    });
    if (vehicleError) throw vehicleError;

    elapsedPendingId = await insertBooking(
      "pending",
      8,
      new Date(Date.now() + 3_600_000).toISOString()
    );
    futurePendingId = await insertBooking(
      "pending",
      9,
      new Date(Date.now() + 3_600_000).toISOString()
    );
    alreadyExpiredId = await insertBooking("expired", 10, null);
    confirmedId = await insertBooking("confirmed", 11, null);
    concurrentFirstId = await insertBooking(
      "pending",
      12,
      new Date(Date.now() + 3_600_000).toISOString()
    );
    concurrentSecondId = await insertBooking(
      "pending",
      13,
      new Date(Date.now() + 3_600_000).toISOString()
    );

    await closeFixtureConfiguration();
  });

  afterAll(async () => {
    if (!db) return;
    await closeFixtureConfiguration();
    if (serviceCreated) {
      const { data, error } = await db
        .from("services")
        .select("is_active")
        .eq("id", serviceId)
        .single();
      if (error) throw error;
      expect(data.is_active).toBe(false);
    }
    if (resourceCreated) {
      const { data, error } = await db
        .from("booking_resources")
        .select("is_active")
        .eq("id", resourceId)
        .single();
      if (error) throw error;
      expect(data.is_active).toBe(false);
    }
    if (businessHoursCreated) {
      const { count, error } = await db
        .from("business_hours")
        .select("*", { count: "exact", head: true })
        .eq("id", businessHoursId);
      if (error) throw error;
      expect(count).toBe(0);
    }
  });

  it("rejects an unauthorized endpoint invocation without expiring a booking", async () => {
    const response = await POST(trustedRequest("wrong-secret"));
    expect(response.status).toBe(401);
    expect((await status(elapsedPendingId)).status).toBe("pending");
  });

  it("expires an elapsed pending booking and audits it", async () => {
    await assertNoUnrelatedElapsedPending();
    await makeTestBookingsEligible([elapsedPendingId]);
    const response = await POST(trustedRequest());
    const body = (await response.json()) as {
      ok: boolean;
      expiredCount: number;
    };
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.expiredCount).toBeGreaterThanOrEqual(0);
    expect(await status(elapsedPendingId)).toEqual({
      status: "expired",
      pending_expires_at: null,
    });
    expect(await expirationAuditCount(elapsedPendingId)).toBe(1);
  });

  it("does not alter non-expired, already-expired, or confirmed bookings", async () => {
    expect((await status(futurePendingId)).status).toBe("pending");
    expect((await status(alreadyExpiredId)).status).toBe("expired");
    expect((await status(confirmedId)).status).toBe("confirmed");
  });

  it("is idempotent when the scheduler repeats a completed sweep", async () => {
    await assertNoUnrelatedElapsedPending();
    const response = await POST(trustedRequest());
    const body = (await response.json()) as {
      ok: boolean;
      expiredCount: number;
    };
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.expiredCount).toBeGreaterThanOrEqual(0);
    expect((await status(elapsedPendingId)).status).toBe("expired");
    expect(await expirationAuditCount(elapsedPendingId)).toBe(1);
  });

  it("serializes concurrent expiration attempts without duplicate audits", async () => {
    await assertNoUnrelatedElapsedPending();
    await makeTestBookingsEligible([concurrentFirstId, concurrentSecondId]);

    const responses = await Promise.all([
      POST(trustedRequest()),
      POST(trustedRequest()),
    ]);
    const bodies = await Promise.all(
      responses.map(
        async (response) =>
          (await response.json()) as { ok: boolean; expiredCount: number }
      )
    );
    expect(responses.every(({ status }) => status === 200)).toBe(true);
    expect(bodies.every(({ ok }) => ok)).toBe(true);
    expect(
      bodies.every(({ expiredCount }) => expiredCount >= 0)
    ).toBe(true);

    for (const id of [concurrentFirstId, concurrentSecondId]) {
      expect((await status(id)).status).toBe("expired");
      expect(await expirationAuditCount(id)).toBe(1);
    }
  });
});
