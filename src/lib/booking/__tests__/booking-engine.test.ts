import { describe, expect, it, beforeEach } from "vitest";
import { createIsolatedBookingEngine } from "@/lib/booking/engine";
import {
  checkRateLimit,
  resetRateLimitBuckets,
} from "@/lib/security/rate-limiter";
import { hashBookingToken } from "@/lib/security/tokens";

/**
 * Deterministic reference timestamp:
 * Wednesday, 2026-10-21 08:00:00 Asia/Manila (00:00:00 UTC)
 */
const FIXED_NOW = new Date("2026-10-21T08:00:00+08:00");

/**
 * Valid Monday–Saturday test dates in Asia/Manila:
 * - Thursday: 2026-10-22 (25h+ after FIXED_NOW)
 * - Friday:   2026-10-23
 * - Saturday: 2026-10-24
 * - Sunday:   2026-10-25 (Closed)
 */
const THU_DATE = "2026-10-22";
const FRI_DATE = "2026-10-23";
const SUN_DATE = "2026-10-25";

describe("Manila Auto Pros — Phase 3 Real-Time Booking Engine & Security Suite", () => {
  beforeEach(() => {
    resetRateLimitBuckets();
  });

  it("1. Enforces Sunday closure across availability queries and booking creation", async () => {
    const engine = createIsolatedBookingEngine();

    const avail = await engine.getAvailability({
      dateStr: SUN_DATE,
      optionSlug: "exterior-detailing",
      now: FIXED_NOW,
    });

    expect(avail.ok).toBe(true);
    expect(avail.isSundayClosed).toBe(true);
    expect(avail.slots).toHaveLength(0);

    const createAttempt = await engine.createBooking({
      idempotencyKey: "idem-sunday-test-001",
      vehicleType: "Car",
      serviceOptionSlug: "exterior-detailing",
      manufacturer: "Toyota",
      model: "GR Yaris",
      year: 2025,
      appointmentDate: SUN_DATE,
      startTimeLocal: "09:00",
      customerName: "Juan Dela Cruz",
      customerEmail: "juan@example.com",
      customerPhone: "09171234567",
      now: FIXED_NOW,
    });

    expect(createAttempt.ok).toBe(false);
    if (!createAttempt.ok) {
      expect(createAttempt.errorCode).toBe("SUNDAY_CLOSED");
    }
  });

  it("2. Enforces operating hours boundaries (09:00–18:00 Asia/Manila)", async () => {
    const engine = createIsolatedBookingEngine();

    // `exterior-detailing` has 120-minute duration -> latest start is 16:00 (ends at 18:00)
    const avail = await engine.getAvailability({
      dateStr: THU_DATE,
      optionSlug: "exterior-detailing",
      now: FIXED_NOW,
    });

    const startTimes = avail.slots.map((s) => s.startTimeLocal);
    expect(startTimes[0]).toBe("09:00");
    expect(startTimes[startTimes.length - 1]).toBe("16:00");
    expect(startTimes).not.toContain("17:00");

    // Attempt to book before opening (08:00)
    const earlyAttempt = await engine.createBooking({
      idempotencyKey: "idem-hours-early-001",
      vehicleType: "Car",
      serviceOptionSlug: "exterior-detailing",
      manufacturer: "Porsche",
      model: "911",
      year: 2024,
      appointmentDate: THU_DATE,
      startTimeLocal: "08:00",
      customerName: "Juan Dela Cruz",
      customerEmail: "juan@example.com",
      customerPhone: "09171234567",
      now: FIXED_NOW,
    });
    expect(earlyAttempt.ok).toBe(false);
    if (!earlyAttempt.ok) {
      expect(earlyAttempt.errorCode).toBe("OUTSIDE_OPERATING_HOURS");
    }

    // Attempt to book a 120-min service at 17:00 (would end at 19:00 > 18:00)
    const lateAttempt = await engine.createBooking({
      idempotencyKey: "idem-hours-late-001",
      vehicleType: "Car",
      serviceOptionSlug: "exterior-detailing",
      manufacturer: "Porsche",
      model: "911",
      year: 2024,
      appointmentDate: THU_DATE,
      startTimeLocal: "17:00",
      customerName: "Juan Dela Cruz",
      customerEmail: "juan@example.com",
      customerPhone: "09171234567",
      now: FIXED_NOW,
    });
    expect(lateAttempt.ok).toBe(false);
    if (!lateAttempt.ok) {
      expect(lateAttempt.errorCode).toBe("OUTSIDE_OPERATING_HOURS");
    }
  });

  it("3. Calculates different service durations, turnover buffers, and multi-unit resource requirements", async () => {
    const engine = createIsolatedBookingEngine();

    // `heat-rejection-window-films` is 150 mins -> latest start 15:00 (ends 17:30 <= 18:00; 16:00 would end at 18:30)
    const shortAvail = await engine.getAvailability({
      dateStr: FRI_DATE,
      optionSlug: "heat-rejection-window-films",
      now: FIXED_NOW,
    });
    expect(shortAvail.durationMinutes).toBe(150);
    expect(shortAvail.requiredUnits).toBe(1);
    expect(shortAvail.slots.map((s) => s.startTimeLocal)).toContain("15:00");
    expect(shortAvail.slots.map((s) => s.startTimeLocal)).not.toContain("16:00");

    // `full-body-ppf` is 480 mins (8 hours) and requires 2 PPF bay units -> only 09:00 and 10:00 fit in 09:00–18:00
    const longAvail = await engine.getAvailability({
      dateStr: FRI_DATE,
      optionSlug: "full-body-ppf",
      now: FIXED_NOW,
    });
    expect(longAvail.durationMinutes).toBe(480);
    expect(longAvail.requiredUnits).toBe(2);
    expect(longAvail.slots.map((s) => s.startTimeLocal)).toEqual([
      "09:00",
      "10:00",
    ]);
  });

  it("4. Enforces full-day and partial-day blocked dates", async () => {
    const engine = createIsolatedBookingEngine();

    // Add partial-day block on THU_DATE from 12:00 to 15:00
    engine.addBlockedDate({
      blockedDate: THU_DATE,
      startTime: "12:00",
      endTime: "15:00",
      resourceId: null,
      reason: "Equipment calibration window",
      isActive: true,
    });

    const partialAvail = await engine.getAvailability({
      dateStr: THU_DATE,
      optionSlug: "exterior-detailing", // 120 mins
      now: FIXED_NOW,
    });

    const slot0900 = partialAvail.slots.find((s) => s.startTimeLocal === "09:00");
    const slot1100 = partialAvail.slots.find((s) => s.startTimeLocal === "11:00"); // 11:00-13:00 overlaps 12:00-15:00
    const slot1300 = partialAvail.slots.find((s) => s.startTimeLocal === "13:00");
    const slot1500 = partialAvail.slots.find((s) => s.startTimeLocal === "15:00");

    expect(slot0900?.status).toBe("available");
    expect(slot1100?.status).toBe("blocked");
    expect(slot1300?.status).toBe("blocked");
    expect(slot1500?.status).toBe("available");

    // Add full-day block on FRI_DATE
    engine.addBlockedDate({
      blockedDate: FRI_DATE,
      startTime: null,
      endTime: null,
      resourceId: null,
      reason: "Facility deep maintenance",
      isActive: true,
    });

    const fullDayAvail = await engine.getAvailability({
      dateStr: FRI_DATE,
      optionSlug: "exterior-detailing",
      now: FIXED_NOW,
    });
    expect(fullDayAvail.isDayBlocked).toBe(true);
    expect(fullDayAvail.slots).toHaveLength(0);
  });

  it("5. Tracks capacity exhaustion accurately across multi-unit resource pools", async () => {
    const engine = createIsolatedBookingEngine();

    // `motorcycle-detailing` uses `moto_pros_bay` (totalCapacity = 2), duration = 120m, buffer = 15m (effective 135m: 09:00 -> 11:15)
    const first = await engine.createBooking({
      idempotencyKey: "idem-cap-001",
      vehicleType: "Motorcycle",
      serviceOptionSlug: "motorcycle-detailing",
      manufacturer: "Ducati",
      model: "Panigale V4",
      year: 2025,
      appointmentDate: THU_DATE,
      startTimeLocal: "09:00",
      customerName: "Rider One",
      customerEmail: "rider1@example.com",
      customerPhone: "09170000001",
      now: FIXED_NOW,
    });
    expect(first.ok).toBe(true);

    const second = await engine.createBooking({
      idempotencyKey: "idem-cap-002",
      vehicleType: "Motorcycle",
      serviceOptionSlug: "motorcycle-detailing",
      manufacturer: "BMW",
      model: "S1000RR",
      year: 2025,
      appointmentDate: THU_DATE,
      startTimeLocal: "09:00",
      customerName: "Rider Two",
      customerEmail: "rider2@example.com",
      customerPhone: "09170000002",
      now: FIXED_NOW,
    });
    expect(second.ok).toBe(true);

    // Check availability: 09:00, 10:00, and 11:00 (overlaps 09:00-11:15 buffer) are now "full", while 12:00 is "available"
    const availAfterTwo = await engine.getAvailability({
      dateStr: THU_DATE,
      optionSlug: "motorcycle-detailing",
      now: FIXED_NOW,
    });
    expect(
      availAfterTwo.slots.find((s) => s.startTimeLocal === "09:00")?.status
    ).toBe("full");
    expect(
      availAfterTwo.slots.find((s) => s.startTimeLocal === "10:00")?.status
    ).toBe("full");
    expect(
      availAfterTwo.slots.find((s) => s.startTimeLocal === "11:00")?.status
    ).toBe("full");
    expect(
      availAfterTwo.slots.find((s) => s.startTimeLocal === "12:00")?.status
    ).toBe("available");
  });

  it("6. Prevents double bookings under concurrent reservation attempts (race condition safety)", async () => {
    const engine = createIsolatedBookingEngine();

    // `full-body-ppf` requires 2 units out of 2 total capacity in `car_surface_protection`.
    // Only 1 booking can succeed for the 09:00 slot on FRI_DATE.
    // Fire 5 simultaneous reservation requests via Promise.all:
    const concurrentRequests = Array.from({ length: 5 }, (_, idx) =>
      engine.createBooking({
        idempotencyKey: `idem-race-ppf-${idx}`,
        vehicleType: "Car",
        serviceOptionSlug: "full-body-ppf",
        manufacturer: "Porsche",
        model: `911 GT3 #${idx}`,
        year: 2025,
        appointmentDate: FRI_DATE,
        startTimeLocal: "09:00",
        customerName: `Concurrent Customer ${idx}`,
        customerEmail: `customer${idx}@example.com`,
        customerPhone: `0917111111${idx}`,
        now: FIXED_NOW,
      })
    );

    const outcomes = await Promise.all(concurrentRequests);
    const successes = outcomes.filter((r) => r.ok);
    const failures = outcomes.filter((r) => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(4);
    for (const fail of failures) {
      if (!fail.ok) {
        expect(fail.errorCode).toBe("SLOT_CAPACITY_EXHAUSTED");
      }
    }
  });

  it("7. Enforces pending booking holds and releases capacity automatically once expired", async () => {
    const engine = createIsolatedBookingEngine();

    // `full-body-ppf` is manual confirmation (`pending`), holds 2/2 units for 180 minutes (`pendingHoldMinutes: 180`)
    const pendingRes = await engine.createBooking({
      idempotencyKey: "idem-hold-001",
      vehicleType: "Car",
      serviceOptionSlug: "full-body-ppf",
      manufacturer: "Ferrari",
      model: "296 GTB",
      year: 2025,
      appointmentDate: FRI_DATE,
      startTimeLocal: "09:00",
      customerName: "Hold Tester",
      customerEmail: "hold@example.com",
      customerPhone: "09172223333",
      now: FIXED_NOW,
    });
    expect(pendingRes.ok).toBe(true);

    // 30 minutes later (hold still active): another booking for the same slot must be blocked
    const thirtyMinsLater = new Date(FIXED_NOW.getTime() + 30 * 60_000);
    const blockedWhileHeld = await engine.createBooking({
      idempotencyKey: "idem-hold-002",
      vehicleType: "Car",
      serviceOptionSlug: "clear-ppf",
      manufacturer: "BMW",
      model: "M3",
      year: 2025,
      appointmentDate: FRI_DATE,
      startTimeLocal: "09:00",
      customerName: "Second Customer",
      customerEmail: "second@example.com",
      customerPhone: "09172224444",
      now: thirtyMinsLater,
    });
    expect(blockedWhileHeld.ok).toBe(false);

    // 185 minutes later (hold expired): capacity is automatically released!
    const afterHoldExpired = new Date(FIXED_NOW.getTime() + 185 * 60_000);
    const allowedAfterExpiry = await engine.createBooking({
      idempotencyKey: "idem-hold-003",
      vehicleType: "Car",
      serviceOptionSlug: "clear-ppf",
      manufacturer: "BMW",
      model: "M3",
      year: 2025,
      appointmentDate: FRI_DATE,
      startTimeLocal: "09:00",
      customerName: "Second Customer",
      customerEmail: "second@example.com",
      customerPhone: "09172224444",
      now: afterHoldExpired,
    });
    expect(allowedAfterExpiry.ok).toBe(true);
  });

  it("8. Assigns 'confirmed' status immediately for automatic confirmation services", async () => {
    const engine = createIsolatedBookingEngine();

    // `exterior-detailing` has confirmationMode = "auto"
    const res = await engine.createBooking({
      idempotencyKey: "idem-auto-confirm-001",
      vehicleType: "Car",
      serviceOptionSlug: "exterior-detailing",
      manufacturer: "Subaru",
      model: "WRX",
      year: 2024,
      appointmentDate: THU_DATE,
      startTimeLocal: "09:00",
      customerName: "Auto Confirm Customer",
      customerEmail: "auto@example.com",
      customerPhone: "09173334444",
      now: FIXED_NOW,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.booking.confirmationMode).toBe("auto");
      expect(res.booking.status).toBe("confirmed");
      expect(res.booking.pendingExpiresAt).toBeNull();
    }
  });

  it("9. Assigns 'pending' status (never confirmed) with hold expiration for manual approval services", async () => {
    const engine = createIsolatedBookingEngine();

    // `multi-layer-coating` has confirmationMode = "manual"
    const res = await engine.createBooking({
      idempotencyKey: "idem-manual-approval-001",
      vehicleType: "Car",
      serviceOptionSlug: "multi-layer-coating",
      manufacturer: "Mercedes-Benz",
      model: "AMG GT",
      year: 2025,
      appointmentDate: FRI_DATE,
      startTimeLocal: "09:00",
      customerName: "Manual Approval Customer",
      customerEmail: "manual@example.com",
      customerPhone: "09175556666",
      now: FIXED_NOW,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.booking.confirmationMode).toBe("manual");
      expect(res.booking.status).toBe("pending");
      expect(res.booking.status).not.toBe("confirmed");
      expect(res.booking.pendingExpiresAt).toBeTruthy();
    }
  });

  it("10. Prevents duplicate booking records on repeated submissions with the same idempotencyKey", async () => {
    const engine = createIsolatedBookingEngine();

    const payload = {
      idempotencyKey: "idem-duplicate-test-999",
      vehicleType: "Car" as const,
      serviceOptionSlug: "interior-detailing",
      manufacturer: "Honda",
      model: "Civic Type R",
      year: 2025,
      appointmentDate: THU_DATE,
      startTimeLocal: "09:00",
      customerName: "Idempotent User",
      customerEmail: "idem@example.com",
      customerPhone: "09177778888",
      now: FIXED_NOW,
    };

    const first = await engine.createBooking(payload);
    const second = await engine.createBooking(payload);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.idempotentReplay).toBe(false);
      expect(second.idempotentReplay).toBe(true);
      expect(second.booking.id).toBe(first.booking.id);
      expect(second.booking.referenceCode).toBe(first.booking.referenceCode);
    }
  });

  it("11. Cancels a booking via single-purpose token, releases capacity, invalidates tokens, and logs audit", async () => {
    const engine = createIsolatedBookingEngine();

    // Reserve full-body-ppf (occupies all 2/2 units at 09:00)
    const created = await engine.createBooking({
      idempotencyKey: "idem-cancel-flow-001",
      vehicleType: "Car",
      serviceOptionSlug: "full-body-ppf",
      manufacturer: "Porsche",
      model: "Taycan",
      year: 2025,
      appointmentDate: FRI_DATE,
      startTimeLocal: "09:00",
      customerName: "Cancel Tester",
      customerEmail: "cancel@example.com",
      customerPhone: "09178889999",
      now: FIXED_NOW,
    });
    expect(created.ok).toBe(true);
    if (!created.ok || !created.tokens) return;

    // Verify only SHA-256 hashes are stored in `booking_tokens`
    const storedTokens = engine.getStoredTokenHashesForBooking(
      created.booking.id
    );
    expect(storedTokens).toHaveLength(2);
    expect(storedTokens.map((t) => t.tokenHash)).toContain(
      hashBookingToken(created.tokens.cancelToken)
    );
    expect(storedTokens.map((t) => t.tokenHash)).not.toContain(
      created.tokens.cancelToken
    );

    // Cancel using the cancel token
    const cancelRes = await engine.cancelByToken({
      rawToken: created.tokens.cancelToken,
      reason: "Client trip rescheduled",
      now: FIXED_NOW,
    });
    expect(cancelRes.ok).toBe(true);
    if (cancelRes.ok) {
      expect(cancelRes.status).toBe("cancelled");
    }

    // Verify capacity at 09:00 on FRI_DATE is now available again
    const availAfterCancel = await engine.getAvailability({
      dateStr: FRI_DATE,
      optionSlug: "full-body-ppf",
      now: FIXED_NOW,
    });
    expect(
      availAfterCancel.slots.find((s) => s.startTimeLocal === "09:00")?.status
    ).toBe("available");

    // Verify audit log was written
    const logs = engine.getAuditLogsForBooking(created.booking.id);
    expect(logs.map((l) => l.action)).toEqual([
      "BOOKING_CREATED",
      "BOOKING_CANCELLED_BY_TOKEN",
    ]);
  });

  it("12. Reschedules a booking via single-purpose token, transfers capacity atomically, and rotates tokens", async () => {
    const engine = createIsolatedBookingEngine();

    const created = await engine.createBooking({
      idempotencyKey: "idem-reschedule-flow-001",
      vehicleType: "Car",
      serviceOptionSlug: "full-body-ppf",
      manufacturer: "Lamborghini",
      model: "Huracan",
      year: 2024,
      appointmentDate: THU_DATE,
      startTimeLocal: "09:00",
      customerName: "Reschedule Tester",
      customerEmail: "resched@example.com",
      customerPhone: "09179990000",
      now: FIXED_NOW,
    });
    expect(created.ok).toBe(true);
    if (!created.ok || !created.tokens) return;

    // Reschedule from THU_DATE 09:00 to FRI_DATE 10:00
    const resched = await engine.rescheduleByToken({
      rawToken: created.tokens.rescheduleToken,
      newAppointmentDate: FRI_DATE,
      newStartTimeLocal: "10:00",
      now: FIXED_NOW,
    });
    expect(resched.ok).toBe(true);
    if (!resched.ok) return;

    expect(resched.appointmentDate).toBe(FRI_DATE);
    expect(resched.startTimeLocal).toBe("10:00");
    expect(resched.newTokens.cancelToken).not.toBe(created.tokens.cancelToken);

    // Old slot on THU_DATE 09:00 is now available
    const thuAvail = await engine.getAvailability({
      dateStr: THU_DATE,
      optionSlug: "full-body-ppf",
      now: FIXED_NOW,
    });
    expect(
      thuAvail.slots.find((s) => s.startTimeLocal === "09:00")?.status
    ).toBe("available");

    // New slot on FRI_DATE 10:00 is now full
    const friAvail = await engine.getAvailability({
      dateStr: FRI_DATE,
      optionSlug: "full-body-ppf",
      now: FIXED_NOW,
    });
    expect(
      friAvail.slots.find((s) => s.startTimeLocal === "10:00")?.status
    ).toBe("full");

    // Old reschedule token cannot be reused
    const reuseAttempt = await engine.rescheduleByToken({
      rawToken: created.tokens.rescheduleToken,
      newAppointmentDate: THU_DATE,
      newStartTimeLocal: "09:00",
      now: FIXED_NOW,
    });
    expect(reuseAttempt.ok).toBe(false);
    if (!reuseAttempt.ok) {
      expect(reuseAttempt.errorCode).toBe("TOKEN_ALREADY_USED");
    }
  });

  it("13. Rejects expired, already-used, wrong-purpose, and malformed tokens", async () => {
    const engine = createIsolatedBookingEngine();

    const created = await engine.createBooking({
      idempotencyKey: "idem-token-sec-001",
      vehicleType: "Car",
      serviceOptionSlug: "exterior-detailing",
      manufacturer: "Mazda",
      model: "MX-5",
      year: 2025,
      appointmentDate: THU_DATE,
      startTimeLocal: "09:00",
      customerName: "Token Security User",
      customerEmail: "tokensec@example.com",
      customerPhone: "09171239876",
      now: FIXED_NOW,
    });
    expect(created.ok).toBe(true);
    if (!created.ok || !created.tokens) return;

    // 13a. Wrong purpose: using cancelToken to reschedule must fail
    const wrongPurpose = await engine.rescheduleByToken({
      rawToken: created.tokens.cancelToken,
      newAppointmentDate: FRI_DATE,
      newStartTimeLocal: "09:00",
      now: FIXED_NOW,
    });
    expect(wrongPurpose.ok).toBe(false);
    if (!wrongPurpose.ok) {
      expect(wrongPurpose.errorCode).toBe("INVALID_TOKEN");
    }

    // 13b. Expired token: 30 days in the future
    const expiredNow = new Date(FIXED_NOW.getTime() + 30 * 86_400_000);
    const expiredCancel = await engine.cancelByToken({
      rawToken: created.tokens.cancelToken,
      now: expiredNow,
    });
    expect(expiredCancel.ok).toBe(false);
    if (!expiredCancel.ok) {
      expect(expiredCancel.errorCode).toBe("TOKEN_EXPIRED");
    }

    // 13c. Malformed / unknown token
    const unknownCancel = await engine.cancelByToken({
      rawToken: "completely-unknown-token-string-1234567890",
      now: FIXED_NOW,
    });
    expect(unknownCancel.ok).toBe(false);
    if (!unknownCancel.ok) {
      expect(unknownCancel.errorCode).toBe("INVALID_TOKEN");
    }
  });

  it("14. Blocks unauthorized direct table access (RLS policy model) and enforces rate limits", () => {
    const engine = createIsolatedBookingEngine();

    // Public configuration tables are readable by anon
    expect(engine.queryTableAsAnon("services").allowed).toBe(true);
    expect(engine.queryTableAsAnon("business_hours").allowed).toBe(true);
    expect(engine.queryTableAsAnon("blocked_dates").allowed).toBe(true);
    expect(engine.queryTableAsAnon("booking_resources").allowed).toBe(true);

    // Sensitive PII, booking, token, and audit tables deny direct anon access
    expect(engine.queryTableAsAnon("customers")).toEqual({
      allowed: false,
      errorCode: "RLS_ACCESS_DENIED",
    });
    expect(engine.queryTableAsAnon("vehicles")).toEqual({
      allowed: false,
      errorCode: "RLS_ACCESS_DENIED",
    });
    expect(engine.queryTableAsAnon("bookings")).toEqual({
      allowed: false,
      errorCode: "RLS_ACCESS_DENIED",
    });
    expect(engine.queryTableAsAnon("booking_tokens")).toEqual({
      allowed: false,
      errorCode: "RLS_ACCESS_DENIED",
    });
    expect(engine.queryTableAsAnon("booking_audit_logs")).toEqual({
      allowed: false,
      errorCode: "RLS_ACCESS_DENIED",
    });

    // Rate limiter blocks excessive requests in sliding window
    const key = "booking-submit:test-ip";
    expect(checkRateLimit({ key, maxRequests: 2, windowMs: 60_000 }).allowed).toBe(
      true
    );
    expect(checkRateLimit({ key, maxRequests: 2, windowMs: 60_000 }).allowed).toBe(
      true
    );
    const third = checkRateLimit({ key, maxRequests: 2, windowMs: 60_000 });
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });
});
