import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BookingEngine } from "@/lib/booking/engine";
import type { CreateBookingInput } from "@/lib/booking/types";
import {
  getRequiredSupabaseServiceRoleClient,
  getSupabaseAnonServerClient,
} from "@/lib/supabase/server";

loadEnvConfig(process.cwd());

function configuredProjectRef(): string | null {
  try {
    const hostname = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
    ).hostname;
    return hostname.endsWith(".supabase.co") ? hostname.split(".")[0] : null;
  } catch {
    return null;
  }
}

const expectedProjectRef = process.env.SUPABASE_INTEGRATION_PROJECT_REF;
const integrationWritesEnabled =
  process.env.RUN_SUPABASE_INTEGRATION_TESTS === "true" &&
  process.env.SUPABASE_INTEGRATION_ALLOW_WRITES === "true" &&
  process.env.VERCEL_ENV !== "production" &&
  Boolean(expectedProjectRef) &&
  configuredProjectRef() === expectedProjectRef;

const describeIntegration = integrationWritesEnabled ? describe : describe.skip;

function manilaDateAfter(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function nextOpenDate(startOffset: number): string {
  for (let offset = startOffset; offset < startOffset + 10; offset += 1) {
    const candidate = manilaDateAfter(offset);
    const day = new Date(`${candidate}T12:00:00+08:00`).getUTCDay();
    if (day !== 0) return candidate;
  }
  throw new Error("Unable to select a non-Sunday integration-test date.");
}

describeIntegration("Supabase PostgreSQL booking integration", () => {
  let admin: SupabaseClient;
  let engine: BookingEngine;
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const resourceType = `integration_${runId}`;
  const autoSlug = `integration-auto-${runId}`;
  const manualSlug = `integration-manual-${runId}`;
  const resourceIds: string[] = [];
  const serviceIds: string[] = [];
  const bookingIds: string[] = [];
  const customerIds: string[] = [];
  const vehicleIds: string[] = [];
  let authUserId: string | null = null;

  const dates = {
    availability: nextOpenDate(3),
    concurrency: nextOpenDate(5),
    pending: nextOpenDate(7),
    cancellation: nextOpenDate(9),
    rescheduleFrom: nextOpenDate(11),
    rescheduleTo: nextOpenDate(13),
    idempotency: nextOpenDate(15),
  };

  function bookingInput(
    date: string,
    serviceOptionSlug = autoSlug
  ): CreateBookingInput {
    return {
      idempotencyKey: `integration-${runId}-${randomUUID()}`,
      vehicleType: "Car",
      serviceOptionSlug,
      manufacturer: "Integration",
      model: "Test Vehicle",
      year: 2026,
      appointmentDate: date,
      startTimeLocal: "09:00",
      customerName: "Integration Test Customer",
      customerEmail: `integration-${runId}@example.invalid`,
      customerPhone: "09170000000",
    };
  }

  async function trackBooking(bookingId: string): Promise<void> {
    bookingIds.push(bookingId);
    const { data, error } = await admin
      .from("bookings")
      .select("customer_id,vehicle_id")
      .eq("id", bookingId)
      .single();
    if (error) throw error;
    customerIds.push(data.customer_id);
    vehicleIds.push(data.vehicle_id);
  }

  beforeAll(async () => {
    admin = getRequiredSupabaseServiceRoleClient();
    engine = new BookingEngine();

    const requiredDays = new Set(
      Object.values(dates).map((date) =>
        new Date(`${date}T12:00:00+08:00`).getUTCDay()
      )
    );
    const { data: hours, error: hoursError } = await admin
      .from("business_hours")
      .select("day_of_week,is_closed")
      .in("day_of_week", [...requiredDays]);
    if (hoursError) throw hoursError;
    if (
      !hours ||
      hours.length !== requiredDays.size ||
      hours.some((row) => row.is_closed)
    ) {
      throw new Error(
        "Dedicated integration project must contain open business-hour rows for the test dates."
      );
    }

    const { data: resources, error: resourceError } = await admin
      .from("booking_resources")
      .insert([
        {
          code: `IT-${runId}`,
          name: "Isolated Integration Test Bay",
          resource_type: resourceType,
          vehicle_type: "Car",
          total_capacity: 1,
          is_active: true,
          is_dev_default: true,
        },
      ])
      .select("id");
    if (resourceError || !resources?.[0]) {
      throw resourceError ?? new Error("Failed to create test resource.");
    }
    resourceIds.push(resources[0].id);

    const commonService = {
      category_slug: "integration-tests",
      category_title: "Integration Tests",
      short_description: "Isolated PostgreSQL integration test service.",
      vehicle_type: "Car",
      duration_minutes: 60,
      buffer_minutes: 0,
      required_resource_type: resourceType,
      required_units: 1,
      pending_hold_minutes: 60,
      min_notice_hours: 0,
      max_advance_days: 60,
      is_active: true,
      is_dev_default: true,
    };
    const { data: services, error: serviceError } = await admin
      .from("services")
      .insert([
        {
          ...commonService,
          option_slug: autoSlug,
          name: "Integration Auto Service",
          confirmation_mode: "auto",
        },
        {
          ...commonService,
          option_slug: manualSlug,
          name: "Integration Manual Service",
          confirmation_mode: "manual",
        },
      ])
      .select("id");
    if (serviceError || services?.length !== 2) {
      throw serviceError ?? new Error("Failed to create test services.");
    }
    serviceIds.push(...services.map((service) => service.id));
  });

  afterAll(async () => {
    // Audit history is intentionally immutable, so completed integration runs
    // retain their uniquely tagged private lifecycle rows. Disable their
    // configuration so retained rows cannot affect future availability runs.
    if (serviceIds.length > 0) {
      await admin.from("services").update({ is_active: false }).in("id", serviceIds);
    }
    if (resourceIds.length > 0) {
      await admin
        .from("booking_resources")
        .update({ is_active: false })
        .in("id", resourceIds);
    }
    if (authUserId) {
      await admin.auth.admin.deleteUser(authUserId);
    }
  });

  it("reads availability and blocked dates from PostgreSQL", async () => {
    const initial = await engine.getAvailability({
      dateStr: dates.availability,
      optionSlug: autoSlug,
    });
    expect(initial.ok).toBe(true);
    expect(initial.backendMode).toBe("supabase");
    expect(initial.slots.some((slot) => slot.status === "available")).toBe(true);

    const { data: block, error } = await admin
      .from("blocked_dates")
      .insert({
        blocked_date: dates.availability,
        resource_id: resourceIds[0],
        reason: "Isolated integration block",
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    try {
      const blocked = await engine.getAvailability({
        dateStr: dates.availability,
        optionSlug: autoSlug,
      });
      expect(blocked.ok).toBe(true);
      expect(blocked.isDayBlocked).toBe(true);
    } finally {
      await admin.from("blocked_dates").delete().eq("id", block.id);
    }
  });

  it("creates one concurrent reservation and rejects capacity exhaustion", async () => {
    const attempts = await Promise.all([
      engine.createBooking(bookingInput(dates.concurrency)),
      engine.createBooking(bookingInput(dates.concurrency)),
    ]);
    const successes = attempts.filter((result) => result.ok);
    const failures = attempts.filter((result) => !result.ok);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      ok: false,
      errorCode: "SLOT_CAPACITY_EXHAUSTED",
    });
    if (successes[0]?.ok) await trackBooking(successes[0].booking.id);
  });

  it("serializes concurrent idempotent retries and rejects payload mismatch", async () => {
    const input = bookingInput(dates.idempotency);
    const attempts = await Promise.all([
      engine.createBooking(input),
      engine.createBooking(input),
    ]);
    expect(attempts.every((result) => result.ok)).toBe(true);
    if (!attempts[0].ok || !attempts[1].ok) return;
    expect(attempts[0].booking.id).toBe(attempts[1].booking.id);
    expect(
      attempts.filter((result) => result.ok && result.idempotentReplay)
    ).toHaveLength(1);
    expect(
      attempts.filter((result) => result.ok && Boolean(result.tokens))
    ).toHaveLength(1);
    await trackBooking(attempts[0].booking.id);

    const mismatch = await engine.createBooking({
      ...input,
      startTimeLocal: "10:00",
    });
    expect(mismatch).toMatchObject({
      ok: false,
      errorCode: "IDEMPOTENCY_KEY_REUSED",
    });
  });

  it("honors pending approval and releases expired pending capacity", async () => {
    const created = await engine.createBooking(
      bookingInput(dates.pending, manualSlug)
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.booking.status).toBe("pending");
    await trackBooking(created.booking.id);

    const held = await engine.getAvailability({
      dateStr: dates.pending,
      optionSlug: manualSlug,
    });
    expect(held.slots.find((slot) => slot.startTimeLocal === "09:00")?.status).toBe(
      "full"
    );

    const { error } = await admin
      .from("bookings")
      .update({ pending_expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", created.booking.id);
    if (error) throw error;

    const forbiddenApproval = await admin
      .from("bookings")
      .update({ status: "confirmed", pending_expires_at: null })
      .eq("id", created.booking.id);
    expect(forbiddenApproval.error).not.toBeNull();

    const released = await engine.getAvailability({
      dateStr: dates.pending,
      optionSlug: manualSlug,
    });
    expect(
      released.slots.find((slot) => slot.startTimeLocal === "09:00")?.status
    ).toBe("available");

    if (!created.tokens) throw new Error("Expected pending booking tokens.");
    const expiredReschedule = await engine.rescheduleByToken({
      rawToken: created.tokens.rescheduleToken,
      newAppointmentDate: dates.rescheduleTo,
      newStartTimeLocal: "09:00",
    });
    expect(expiredReschedule).toMatchObject({
      ok: false,
      errorCode: "PENDING_EXPIRED",
    });

    const { data: expiredBooking, error: expiredBookingError } = await admin
      .from("bookings")
      .select("status,pending_expires_at")
      .eq("id", created.booking.id)
      .single();
    if (expiredBookingError) throw expiredBookingError;
    expect(expiredBooking).toEqual({ status: "expired", pending_expires_at: null });

    const { data: audit, error: auditError } = await admin
      .from("booking_audit_logs")
      .select("action")
      .eq("booking_id", created.booking.id)
      .eq("action", "BOOKING_PENDING_EXPIRED");
    if (auditError) throw auditError;
    expect(audit).toHaveLength(1);

    const sweepCandidate = await engine.createBooking(
      bookingInput(dates.pending, manualSlug)
    );
    expect(sweepCandidate.ok).toBe(true);
    if (!sweepCandidate.ok) return;
    await trackBooking(sweepCandidate.booking.id);
    const { error: expireSetupError } = await admin
      .from("bookings")
      .update({ pending_expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", sweepCandidate.booking.id);
    if (expireSetupError) throw expireSetupError;
    const { data: sweptCount, error: sweepError } = await admin.rpc(
      "expire_pending_bookings_atomic"
    );
    if (sweepError) throw sweepError;
    expect(sweptCount).toBeGreaterThanOrEqual(1);
    const { data: swept, error: sweptError } = await admin
      .from("bookings")
      .select("status,pending_expires_at")
      .eq("id", sweepCandidate.booking.id)
      .single();
    if (sweptError) throw sweptError;
    expect(swept).toEqual({ status: "expired", pending_expires_at: null });
  });

  it("validates tokens and atomically cancels and reschedules bookings", async () => {
    const cancellable = await engine.createBooking(
      bookingInput(dates.cancellation)
    );
    expect(cancellable.ok).toBe(true);
    if (!cancellable.ok || !cancellable.tokens) return;
    await trackBooking(cancellable.booking.id);

    const inspected = await engine.inspectToken({
      rawToken: cancellable.tokens.cancelToken,
      expectedPurpose: "cancel",
    });
    expect(inspected.ok).toBe(true);
    expect(JSON.stringify(inspected)).not.toContain("tokenHash");

    const cancelled = await engine.cancelByToken({
      rawToken: cancellable.tokens.cancelToken,
    });
    expect(cancelled).toMatchObject({ ok: true, status: "cancelled" });
    const reused = await engine.inspectToken({
      rawToken: cancellable.tokens.cancelToken,
    });
    expect(reused).toMatchObject({ ok: false, errorCode: "TOKEN_ALREADY_USED" });

    const reschedulable = await engine.createBooking(
      bookingInput(dates.rescheduleFrom)
    );
    expect(reschedulable.ok).toBe(true);
    if (!reschedulable.ok || !reschedulable.tokens) return;
    await trackBooking(reschedulable.booking.id);
    const rescheduled = await engine.rescheduleByToken({
      rawToken: reschedulable.tokens.rescheduleToken,
      newAppointmentDate: dates.rescheduleTo,
      newStartTimeLocal: "09:00",
    });
    expect(rescheduled).toMatchObject({
      ok: true,
      appointmentDate: dates.rescheduleTo,
    });
    if (rescheduled.ok) {
      const rotated = await engine.inspectToken({
        rawToken: rescheduled.newTokens.cancelToken,
        expectedPurpose: "cancel",
      });
      expect(rotated.ok).toBe(true);
    }

    const invalid = await engine.inspectToken({ rawToken: randomUUID() });
    expect(invalid).toMatchObject({ ok: false, errorCode: "INVALID_TOKEN" });
  });

  it("denies private tables and privileged RPCs to anon and authenticated users", async () => {
    const anon = getSupabaseAnonServerClient();
    if (!anon) throw new Error("Publishable Supabase client is not configured.");
    const anonPrivateRead = await anon.from("bookings").select("id").limit(1);
    expect(anonPrivateRead.error).not.toBeNull();
    const anonRpc = await anon.rpc("cancel_booking_by_token_atomic", {
      p_token_hash: "0".repeat(64),
      p_reason: "authorization test",
    });
    expect(anonRpc.error).not.toBeNull();

    const email = `integration-auth-${runId}@example.invalid`;
    const password = `T3st-${randomUUID()}!`;
    const { data: createdUser, error: createUserError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (createUserError) throw createUserError;
    authUserId = createdUser.user.id;
    const { error: signInError } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) throw signInError;

    const authenticatedPrivateRead = await anon
      .from("bookings")
      .select("id")
      .limit(1);
    expect(authenticatedPrivateRead.error).not.toBeNull();
    const authenticatedRpc = await anon.rpc(
      "cancel_booking_by_token_atomic",
      {
        p_token_hash: "0".repeat(64),
        p_reason: "authorization test",
      }
    );
    expect(authenticatedRpc.error).not.toBeNull();
  });
});
