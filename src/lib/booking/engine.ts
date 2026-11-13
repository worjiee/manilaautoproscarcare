import { randomUUID } from "node:crypto";
import {
  generateBookingReference,
  generateBookingToken,
  hashBookingToken,
} from "@/lib/security/tokens";
import {
  getSupabaseServiceRoleClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import {
  DEFAULT_BOOKING_RESOURCES,
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_SERVICES_CONFIG,
} from "./seed-defaults";
import type {
  AvailabilityQueryResult,
  BlockedDateRow,
  BookingAuditLogRow,
  BookingFailure,
  BookingResourceRow,
  BookingRow,
  BookingStatus,
  BookingTokenPurpose,
  BookingTokenRow,
  BusinessHoursRow,
  CancelBookingResult,
  CreateBookingInput,
  CreateBookingResult,
  CustomerRow,
  RescheduleBookingResult,
  ServiceConfigRow,
  TimeSlotOption,
  TokenInspectionResult,
  VehicleRow,
} from "./types";

/* -------------------------------------------------------------------------- */
/*                       ASIA/MANILA TIME & DATE HELPERS                      */
/* -------------------------------------------------------------------------- */

export function parseTimeToMinutes(timeStr: string): number {
  const [hh, mm] = timeStr.split(":").map((n) => Number(n));
  return (hh || 0) * 60 + (mm || 0);
}

export function minutesToTimeStr(totalMinutes: number): string {
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function formatLocalTime12h(timeStr: string): string {
  const mins = parseTimeToMinutes(timeStr);
  const hh24 = Math.floor(mins / 60);
  const mm = mins % 60;
  const period = hh24 >= 12 ? "PM" : "AM";
  const hh12 = hh24 % 12 === 0 ? 12 : hh24 % 12;
  return `${hh12}:${String(mm).padStart(2, "0")} ${period}`;
}

/**
 * Converts a YYYY-MM-DD date and HH:MM local time in Asia/Manila (UTC+8) to an ISO string.
 */
export function toManilaInstantIso(dateStr: string, timeStr: string): string {
  const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return new Date(`${dateStr}T${normalizedTime}+08:00`).toISOString();
}

/**
 * Returns day of week (0 = Sunday .. 6 = Saturday) for a YYYY-MM-DD date in Asia/Manila.
 */
export function getManilaDayOfWeek(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00+08:00`);
  return d.getUTCDay();
}

/**
 * Formats a Date object as YYYY-MM-DD in Asia/Manila.
 */
export function toManilaDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/* -------------------------------------------------------------------------- */
/*                          SERVER-SIDE VALIDATION                            */
/* -------------------------------------------------------------------------- */

export function validateBookingSubmissionInput(
  input: Partial<CreateBookingInput>
): BookingFailure | null {
  const fieldErrors: Record<string, string> = {};

  if (!input.idempotencyKey || input.idempotencyKey.trim().length < 8) {
    fieldErrors.idempotencyKey = "Valid idempotency key is required.";
  }

  if (input.vehicleType !== "Car" && input.vehicleType !== "Motorcycle") {
    fieldErrors.vehicleType = "Vehicle type must be Car or Motorcycle.";
  }

  if (!input.serviceOptionSlug || !input.serviceOptionSlug.trim()) {
    fieldErrors.serviceOptionSlug = "Service option is required.";
  }

  if (!input.manufacturer || input.manufacturer.trim().length < 2) {
    fieldErrors.manufacturer = "Vehicle manufacturer is required.";
  }

  if (!input.model || input.model.trim().length < 1) {
    fieldErrors.model = "Vehicle model is required.";
  }

  const year = Number(input.year);
  if (!Number.isInteger(year) || year < 1950 || year > 2030) {
    fieldErrors.year = "Model year must be between 1950 and 2030.";
  }

  if (
    !input.appointmentDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.appointmentDate)
  ) {
    fieldErrors.appointmentDate = "Valid appointment date (YYYY-MM-DD) is required.";
  }

  if (
    !input.startTimeLocal ||
    !/^\d{2}:\d{2}$/.test(input.startTimeLocal)
  ) {
    fieldErrors.startTimeLocal = "Valid start time (HH:MM) is required.";
  }

  if (!input.customerName || input.customerName.trim().length < 2) {
    fieldErrors.customerName = "Customer full name is required.";
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!input.customerEmail || !emailRegex.test(input.customerEmail.trim())) {
    fieldErrors.customerEmail = "Valid customer email is required.";
  }

  const phoneDigits = (input.customerPhone ?? "").replace(/\D/g, "");
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    fieldErrors.customerPhone = "Valid mobile number (10–15 digits) is required.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      errorCode: "VALIDATION_ERROR",
      message: "Please correct the highlighted fields and try again.",
      fieldErrors,
    };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*                  TRANSACTIONAL BOOKING ENGINE IMPLEMENTATION               */
/* -------------------------------------------------------------------------- */

const PUBLIC_READABLE_TABLES = new Set([
  "services",
  "business_hours",
  "blocked_dates",
  "booking_resources",
]);

export class BookingEngine {
  private resources: BookingResourceRow[];
  private services: ServiceConfigRow[];
  private businessHours: BusinessHoursRow[];
  private blockedDates: BlockedDateRow[];
  private customers: CustomerRow[] = [];
  private vehicles: VehicleRow[] = [];
  private bookings: BookingRow[] = [];
  private tokens: BookingTokenRow[] = [];
  private auditLogs: BookingAuditLogRow[] = [];

  /** Per-resource-date mutex queue to serialize concurrent reservations atomically. */
  private lockQueues = new Map<string, Promise<void>>();

  constructor(options?: {
    resources?: BookingResourceRow[];
    services?: ServiceConfigRow[];
    businessHours?: BusinessHoursRow[];
    blockedDates?: BlockedDateRow[];
  }) {
    this.resources = structuredClone(
      options?.resources ?? DEFAULT_BOOKING_RESOURCES
    );
    this.services = structuredClone(
      options?.services ?? DEFAULT_SERVICES_CONFIG
    );
    this.businessHours = structuredClone(
      options?.businessHours ?? DEFAULT_BUSINESS_HOURS
    );
    this.blockedDates = structuredClone(options?.blockedDates ?? []);
  }

  /**
   * Acquires an exclusive FIFO async mutex on `lockKey` (equivalent to
   * PostgreSQL `pg_advisory_xact_lock` + `SELECT ... FOR UPDATE`).
   */
  private async withResourceLock<T>(
    lockKey: string,
    fn: () => Promise<T> | T
  ): Promise<T> {
    const previous = this.lockQueues.get(lockKey) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chained = previous.then(() => current);
    this.lockQueues.set(lockKey, chained);

    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.lockQueues.get(lockKey) === chained) {
        this.lockQueues.delete(lockKey);
      }
    }
  }

  /**
   * Simulates RLS enforcement for direct anonymous table access tests.
   */
  public queryTableAsAnon(tableName: string): {
    allowed: boolean;
    errorCode?: string;
  } {
    if (!PUBLIC_READABLE_TABLES.has(tableName)) {
      return {
        allowed: false,
        errorCode: "RLS_ACCESS_DENIED",
      };
    }
    return { allowed: true };
  }

  public addBlockedDate(block: Omit<BlockedDateRow, "id">): BlockedDateRow {
    const row: BlockedDateRow = {
      id: randomUUID(),
      ...block,
    };
    this.blockedDates.push(row);
    return row;
  }

  public getServiceConfig(optionSlug: string): ServiceConfigRow | undefined {
    return this.services.find(
      (s) => s.optionSlug === optionSlug && s.isActive
    );
  }

  public getAllActiveServices(): ServiceConfigRow[] {
    return this.services.filter((s) => s.isActive);
  }

  public getAuditLogsForBooking(bookingId: string): BookingAuditLogRow[] {
    return this.auditLogs.filter((l) => l.bookingId === bookingId);
  }

  public getStoredTokenHashesForBooking(bookingId: string): BookingTokenRow[] {
    return this.tokens.filter((t) => t.bookingId === bookingId);
  }

  /**
   * Computes peak overlapping allocated units in `[startMs, effectiveEndMs)`
   * for a given resource on a date, counting `confirmed` bookings and unexpired
   * `pending` holds (`pendingExpiresAt > nowMs`).
   */
  private computePeakOverlappingUnits(params: {
    resourceId: string;
    appointmentDate: string;
    startMs: number;
    effectiveEndMs: number;
    nowMs: number;
    excludeBookingId?: string;
  }): number {
    const activeBookings = this.bookings.filter((b) => {
      if (b.resourceId !== params.resourceId) return false;
      if (b.appointmentDate !== params.appointmentDate) return false;
      if (params.excludeBookingId && b.id === params.excludeBookingId) {
        return false;
      }
      if (b.status === "confirmed") return true;
      if (b.status === "pending") {
        if (!b.pendingExpiresAt) return true;
        return new Date(b.pendingExpiresAt).getTime() > params.nowMs;
      }
      return false;
    });

    if (activeBookings.length === 0) return 0;

    // Collect all interval boundary points inside [startMs, effectiveEndMs)
    const points = new Set<number>([params.startMs]);
    for (const b of activeBookings) {
      const bStart = new Date(b.startAt).getTime();
      const bEffEnd =
        new Date(b.endAt).getTime() + b.bufferMinutes * 60_000;
      if (bStart < params.effectiveEndMs && bEffEnd > params.startMs) {
        points.add(Math.max(params.startMs, bStart));
      }
    }

    let peakUnits = 0;
    for (const pt of points) {
      let unitsAtPoint = 0;
      for (const b of activeBookings) {
        const bStart = new Date(b.startAt).getTime();
        const bEffEnd =
          new Date(b.endAt).getTime() + b.bufferMinutes * 60_000;
        if (bStart <= pt && pt < bEffEnd) {
          unitsAtPoint += b.allocatedUnits;
        }
      }
      if (unitsAtPoint > peakUnits) {
        peakUnits = unitsAtPoint;
      }
    }

    return peakUnits;
  }

  /**
   * Calculates live availability for a given `dateStr` (YYYY-MM-DD in Asia/Manila)
   * and `optionSlug`.
   */
  public async getAvailability(params: {
    dateStr: string;
    optionSlug: string;
    now?: Date;
    excludeBookingId?: string;
  }): Promise<AvailabilityQueryResult> {
    const now = params.now ?? new Date();
    const nowMs = now.getTime();
    const backendMode = isSupabaseConfigured()
      ? "supabase"
      : "local-transactional";

    const service = this.getServiceConfig(params.optionSlug);
    if (!service) {
      return {
        ok: false,
        date: params.dateStr,
        timezone: "Asia/Manila",
        optionSlug: params.optionSlug,
        serviceName: "Unknown Service",
        durationMinutes: 0,
        confirmationMode: "manual",
        resourceName: "N/A",
        requiredUnits: 1,
        isSundayClosed: false,
        isDayBlocked: false,
        blockedReason: null,
        isOutOfAdvanceWindow: false,
        isDevDefaultConfig: true,
        backendMode,
        slots: [],
        errorCode: "INVALID_SERVICE",
        errorMessage: "Selected service option could not be found.",
      };
    }

    const resource = this.resources.find(
      (r) => r.resourceType === service.requiredResourceType && r.isActive
    );

    if (!resource) {
      return {
        ok: false,
        date: params.dateStr,
        timezone: "Asia/Manila",
        optionSlug: service.optionSlug,
        serviceName: service.name,
        durationMinutes: service.durationMinutes,
        confirmationMode: service.confirmationMode,
        resourceName: "Unavailable",
        requiredUnits: service.requiredUnits,
        isSundayClosed: false,
        isDayBlocked: false,
        blockedReason: null,
        isOutOfAdvanceWindow: false,
        isDevDefaultConfig: service.isDevDefault,
        backendMode,
        slots: [],
        errorCode: "RESOURCE_UNAVAILABLE",
        errorMessage: "Required studio bay resource pool is inactive.",
      };
    }

    const dow = getManilaDayOfWeek(params.dateStr);
    const hours = this.businessHours.find((h) => h.dayOfWeek === dow);

    if (dow === 0 || !hours || hours.isClosed) {
      return {
        ok: true,
        date: params.dateStr,
        timezone: "Asia/Manila",
        optionSlug: service.optionSlug,
        serviceName: service.name,
        durationMinutes: service.durationMinutes,
        confirmationMode: service.confirmationMode,
        resourceName: resource.name,
        requiredUnits: service.requiredUnits,
        isSundayClosed: true,
        isDayBlocked: false,
        blockedReason: "Sunday: Studio Closed",
        isOutOfAdvanceWindow: false,
        isDevDefaultConfig: service.isDevDefault || hours?.isDevDefault === true,
        backendMode,
        slots: [],
      };
    }

    // Check max advance window
    const todayManilaStr = toManilaDateString(now);
    const todayManilaMs = new Date(`${todayManilaStr}T00:00:00+08:00`).getTime();
    const targetDateMs = new Date(`${params.dateStr}T00:00:00+08:00`).getTime();
    const diffDays = Math.round((targetDateMs - todayManilaMs) / 86_400_000);

    if (diffDays < 0 || diffDays > service.maxAdvanceDays) {
      return {
        ok: true,
        date: params.dateStr,
        timezone: "Asia/Manila",
        optionSlug: service.optionSlug,
        serviceName: service.name,
        durationMinutes: service.durationMinutes,
        confirmationMode: service.confirmationMode,
        resourceName: resource.name,
        requiredUnits: service.requiredUnits,
        isSundayClosed: false,
        isDayBlocked: false,
        blockedReason:
          diffDays < 0
            ? "Cannot schedule appointments in the past."
            : `Appointments can be scheduled up to ${service.maxAdvanceDays} days in advance.`,
        isOutOfAdvanceWindow: true,
        isDevDefaultConfig: service.isDevDefault,
        backendMode,
        slots: [],
      };
    }

    // Check full-day blocked dates
    const dayBlocks = this.blockedDates.filter(
      (b) =>
        b.isActive &&
        b.blockedDate === params.dateStr &&
        (b.resourceId === null || b.resourceId === resource.id)
    );

    const fullDayBlock = dayBlocks.find(
      (b) => b.startTime === null && b.endTime === null
    );

    if (fullDayBlock) {
      return {
        ok: true,
        date: params.dateStr,
        timezone: "Asia/Manila",
        optionSlug: service.optionSlug,
        serviceName: service.name,
        durationMinutes: service.durationMinutes,
        confirmationMode: service.confirmationMode,
        resourceName: resource.name,
        requiredUnits: service.requiredUnits,
        isSundayClosed: false,
        isDayBlocked: true,
        blockedReason: fullDayBlock.reason,
        isOutOfAdvanceWindow: false,
        isDevDefaultConfig: service.isDevDefault,
        backendMode,
        slots: [],
      };
    }

    const openMins = parseTimeToMinutes(hours.openTime);
    const closeMins = parseTimeToMinutes(hours.closeTime);
    const stepMins = hours.slotIntervalMinutes;
    const minNoticeCutoffMs = nowMs + service.minNoticeHours * 3_600_000;

    const slots: TimeSlotOption[] = [];

    for (
      let startMins = openMins;
      startMins + service.durationMinutes <= closeMins;
      startMins += stepMins
    ) {
      const endMins = startMins + service.durationMinutes;
      const startTimeLocal = minutesToTimeStr(startMins);
      const endTimeLocal = minutesToTimeStr(endMins);

      const startIso = toManilaInstantIso(params.dateStr, startTimeLocal);
      const startMs = new Date(startIso).getTime();
      const effectiveEndMs =
        startMs + (service.durationMinutes + service.bufferMinutes) * 60_000;

      // 1. Check minimum notice
      if (startMs < minNoticeCutoffMs) {
        slots.push({
          id: startTimeLocal,
          startTimeLocal,
          endTimeLocal,
          label: `${formatLocalTime12h(startTimeLocal)} – ${formatLocalTime12h(
            endTimeLocal
          )} PHT`,
          windowLabel: `${service.durationMinutes} min • ${resource.code}`,
          status: "past_notice",
          remainingUnits: 0,
          totalUnits: resource.totalCapacity,
          requiredUnits: service.requiredUnits,
          reason: `Requires at least ${service.minNoticeHours}h advance notice`,
        });
        continue;
      }

      // 2. Check partial-day blocked window
      const overlappingBlock = dayBlocks.find((b) => {
        if (!b.startTime || !b.endTime) return false;
        const bStart = parseTimeToMinutes(b.startTime);
        const bEnd = parseTimeToMinutes(b.endTime);
        return startMins < bEnd && endMins > bStart;
      });

      if (overlappingBlock) {
        slots.push({
          id: startTimeLocal,
          startTimeLocal,
          endTimeLocal,
          label: `${formatLocalTime12h(startTimeLocal)} – ${formatLocalTime12h(
            endTimeLocal
          )} PHT`,
          windowLabel: `${service.durationMinutes} min • ${resource.code}`,
          status: "blocked",
          remainingUnits: 0,
          totalUnits: resource.totalCapacity,
          requiredUnits: service.requiredUnits,
          reason: overlappingBlock.reason,
        });
        continue;
      }

      // 3. Check overlapping capacity
      const usedUnits = this.computePeakOverlappingUnits({
        resourceId: resource.id,
        appointmentDate: params.dateStr,
        startMs,
        effectiveEndMs,
        nowMs,
        excludeBookingId: params.excludeBookingId,
      });

      const remainingUnits = Math.max(0, resource.totalCapacity - usedUnits);
      const hasCapacity = remainingUnits >= service.requiredUnits;

      slots.push({
        id: startTimeLocal,
        startTimeLocal,
        endTimeLocal,
        label: `${formatLocalTime12h(startTimeLocal)} – ${formatLocalTime12h(
          endTimeLocal
        )} PHT`,
        windowLabel: `${service.durationMinutes} min • ${resource.code}`,
        status: hasCapacity ? "available" : "full",
        remainingUnits,
        totalUnits: resource.totalCapacity,
        requiredUnits: service.requiredUnits,
        reason: hasCapacity
          ? `${remainingUnits} of ${resource.totalCapacity} bay units open (${
              service.confirmationMode === "auto"
                ? "Instant Confirmation"
                : "Admin Approval Hold"
            })`
          : "All studio bays allocated for this window",
      });
    }

    return {
      ok: true,
      date: params.dateStr,
      timezone: "Asia/Manila",
      optionSlug: service.optionSlug,
      serviceName: service.name,
      durationMinutes: service.durationMinutes,
      confirmationMode: service.confirmationMode,
      resourceName: resource.name,
      requiredUnits: service.requiredUnits,
      isSundayClosed: false,
      isDayBlocked: false,
      blockedReason: null,
      isOutOfAdvanceWindow: false,
      isDevDefaultConfig: service.isDevDefault || hours.isDevDefault,
      backendMode,
      slots,
    };
  }

  /**
   * Concurrency-safe atomic booking reservation.
   */
  public async createBooking(
    input: CreateBookingInput
  ): Promise<CreateBookingResult> {
    const validationFailure = validateBookingSubmissionInput(input);
    if (validationFailure) return validationFailure;

    const now = input.now ?? new Date();
    const nowMs = now.getTime();

    const service = this.getServiceConfig(input.serviceOptionSlug);
    if (!service) {
      return {
        ok: false,
        errorCode: "INVALID_SERVICE",
        message: "The selected service option is invalid or inactive.",
      };
    }

    if (service.vehicleType !== input.vehicleType) {
      return {
        ok: false,
        errorCode: "VEHICLE_TYPE_MISMATCH",
        message: `Service "${service.name}" is only available for ${service.vehicleType} vehicles.`,
      };
    }

    const resource = this.resources.find(
      (r) => r.resourceType === service.requiredResourceType && r.isActive
    );
    if (!resource) {
      return {
        ok: false,
        errorCode: "RESOURCE_UNAVAILABLE",
        message: "Studio bay resource pool is unavailable.",
      };
    }

    const cancelTokenPair = generateBookingToken();
    const rescheduleTokenPair = generateBookingToken();
    const referenceCode = generateBookingReference(input.appointmentDate);
    const startIso = toManilaInstantIso(
      input.appointmentDate,
      input.startTimeLocal
    );
    const tokenExpiresAt = new Date(
      Math.max(
        new Date(startIso).getTime() + 7 * 86_400_000,
        nowMs + 7 * 86_400_000
      )
    ).toISOString();

    // If Supabase is configured, execute atomic PL/pgSQL RPC first
    const supabase = getSupabaseServiceRoleClient();
    if (supabase) {
      const { data, error } = await supabase.rpc("create_booking_atomic", {
        p_idempotency_key: input.idempotencyKey.trim(),
        p_reference_code: referenceCode,
        p_option_slug: service.optionSlug,
        p_vehicle_type: input.vehicleType,
        p_manufacturer: input.manufacturer.trim(),
        p_model: input.model.trim(),
        p_model_year: Number(input.year),
        p_vehicle_notes: input.vehicleNotes ?? "",
        p_appointment_date: input.appointmentDate,
        p_start_time_local: `${input.startTimeLocal}:00`,
        p_customer_name: input.customerName.trim(),
        p_customer_email: input.customerEmail.trim(),
        p_customer_phone: input.customerPhone.trim(),
        p_additional_requests: input.additionalRequests ?? "",
        p_cancel_token_hash: cancelTokenPair.tokenHash,
        p_reschedule_token_hash: rescheduleTokenPair.tokenHash,
        p_token_expires_at: tokenExpiresAt,
        p_now: now.toISOString(),
      });

      if (error || !data) {
        return {
          ok: false,
          errorCode: "INTERNAL_ERROR",
          message:
            "Unable to process reservation at this time. Please try again.",
        };
      }

      if (!data.ok) {
        return {
          ok: false,
          errorCode: data.error_code ?? "INTERNAL_ERROR",
          message: data.message ?? "Reservation could not be completed.",
        };
      }

      return {
        ok: true,
        idempotentReplay: Boolean(data.idempotent_replay),
        backendMode: "supabase",
        booking: {
          id: data.booking_id,
          referenceCode: data.reference_code,
          status: data.status,
          confirmationMode: data.confirmation_mode,
          serviceName: service.name,
          categoryTitle: service.categoryTitle,
          vehicleSummary: `${input.year} ${input.manufacturer.trim()} ${input.model.trim()}`,
          appointmentDate: data.appointment_date,
          startTimeLocal: data.start_time_local,
          endTimeLocal: data.end_time_local,
          durationMinutes: service.durationMinutes,
          resourceName: resource.name,
          allocatedUnits: service.requiredUnits,
          pendingExpiresAt: data.pending_expires_at ?? null,
        },
        tokens: data.idempotent_replay
          ? undefined
          : {
              cancelToken: cancelTokenPair.rawToken,
              rescheduleToken: rescheduleTokenPair.rawToken,
              expiresAt: tokenExpiresAt,
            },
      };
    }

    // Local Transactional Engine (serialized via per-resource mutex lock matching SELECT ... FOR UPDATE on booking_resources)
    const lockKey = resource.id;

    return this.withResourceLock(lockKey, async () => {
      // 1. Check idempotency key inside critical section
      const existingByIdempotency = this.bookings.find(
        (b) => b.idempotencyKey === input.idempotencyKey.trim()
      );
      if (existingByIdempotency) {
        const existingVehicle = this.vehicles.find(
          (v) => v.id === existingByIdempotency.vehicleId
        );
        return {
          ok: true,
          idempotentReplay: true,
          backendMode: "local-transactional",
          booking: {
            id: existingByIdempotency.id,
            referenceCode: existingByIdempotency.referenceCode,
            status: existingByIdempotency.status,
            confirmationMode: existingByIdempotency.confirmationMode,
            serviceName: service.name,
            categoryTitle: service.categoryTitle,
            vehicleSummary: existingVehicle
              ? `${existingVehicle.modelYear} ${existingVehicle.manufacturer} ${existingVehicle.model}`
              : `${input.year} ${input.manufacturer} ${input.model}`,
            appointmentDate: existingByIdempotency.appointmentDate,
            startTimeLocal: existingByIdempotency.startTimeLocal,
            endTimeLocal: existingByIdempotency.endTimeLocal,
            durationMinutes: existingByIdempotency.durationMinutes,
            resourceName: resource.name,
            allocatedUnits: existingByIdempotency.allocatedUnits,
            pendingExpiresAt: existingByIdempotency.pendingExpiresAt,
          },
        };
      }

      // 2. Check Sunday & Operating Hours
      const dow = getManilaDayOfWeek(input.appointmentDate);
      if (dow === 0) {
        return {
          ok: false,
          errorCode: "SUNDAY_CLOSED",
          message: "Manila Auto Pros is closed on Sundays.",
        };
      }

      const hours = this.businessHours.find((h) => h.dayOfWeek === dow);
      if (!hours || hours.isClosed) {
        return {
          ok: false,
          errorCode: "DAY_CLOSED",
          message: "Studio is closed on the selected date.",
        };
      }

      const startMins = parseTimeToMinutes(input.startTimeLocal);
      const endMins = startMins + service.durationMinutes;
      const openMins = parseTimeToMinutes(hours.openTime);
      const closeMins = parseTimeToMinutes(hours.closeTime);

      if (startMins < openMins || endMins > closeMins) {
        return {
          ok: false,
          errorCode: "OUTSIDE_OPERATING_HOURS",
          message:
            "Requested appointment start time or service duration exceeds studio operating hours.",
        };
      }

      const endTimeLocal = minutesToTimeStr(endMins);
      const startAtIso = toManilaInstantIso(
        input.appointmentDate,
        input.startTimeLocal
      );
      const startMs = new Date(startAtIso).getTime();
      const endMs = startMs + service.durationMinutes * 60_000;
      const effectiveEndMs =
        startMs + (service.durationMinutes + service.bufferMinutes) * 60_000;

      // 3. Check minimum notice and maximum advance window
      if (startMs < nowMs + service.minNoticeHours * 3_600_000) {
        return {
          ok: false,
          errorCode: "MIN_NOTICE_VIOLATION",
          message: `Appointments for ${service.name} require at least ${service.minNoticeHours} hours advance notice.`,
        };
      }

      const todayManilaStr = toManilaDateString(now);
      const todayManilaMs = new Date(
        `${todayManilaStr}T00:00:00+08:00`
      ).getTime();
      const targetDateMs = new Date(
        `${input.appointmentDate}T00:00:00+08:00`
      ).getTime();
      const diffDays = Math.round((targetDateMs - todayManilaMs) / 86_400_000);

      if (diffDays < 0 || diffDays > service.maxAdvanceDays) {
        return {
          ok: false,
          errorCode: "MAX_ADVANCE_VIOLATION",
          message: `Appointments must be scheduled within ${service.maxAdvanceDays} days.`,
        };
      }

      // 4. Check Blocked Dates
      const matchingBlock = this.blockedDates.find((b) => {
        if (!b.isActive || b.blockedDate !== input.appointmentDate) return false;
        if (b.resourceId !== null && b.resourceId !== resource.id) return false;
        if (b.startTime === null && b.endTime === null) return true;
        const bStart = parseTimeToMinutes(b.startTime!);
        const bEnd = parseTimeToMinutes(b.endTime!);
        return startMins < bEnd && endMins > bStart;
      });

      if (matchingBlock) {
        return {
          ok: false,
          errorCode: "DATE_BLOCKED",
          message: `Selected date/time is blocked: ${matchingBlock.reason}`,
        };
      }

      // 5. Re-verify capacity inside lock
      const overlappingUnits = this.computePeakOverlappingUnits({
        resourceId: resource.id,
        appointmentDate: input.appointmentDate,
        startMs,
        effectiveEndMs,
        nowMs,
      });

      if (overlappingUnits + service.requiredUnits > resource.totalCapacity) {
        return {
          ok: false,
          errorCode: "SLOT_CAPACITY_EXHAUSTED",
          message:
            "The selected time slot no longer has sufficient studio bay capacity. Please select another window.",
        };
      }

      // 6. Create Customer & Vehicle rows
      const customerId = randomUUID();
      const customerRow: CustomerRow = {
        id: customerId,
        fullName: input.customerName.trim(),
        email: input.customerEmail.trim(),
        emailNormalized: input.customerEmail.trim().toLowerCase(),
        phone: input.customerPhone.trim(),
        phoneNormalized: input.customerPhone.replace(/\D/g, ""),
        createdAt: now.toISOString(),
      };
      this.customers.push(customerRow);

      const vehicleId = randomUUID();
      const vehicleRow: VehicleRow = {
        id: vehicleId,
        customerId,
        vehicleType: input.vehicleType,
        manufacturer: input.manufacturer.trim(),
        model: input.model.trim(),
        modelYear: Number(input.year),
        notes: input.vehicleNotes?.trim() || null,
        createdAt: now.toISOString(),
      };
      this.vehicles.push(vehicleRow);

      // 7. Determine confirmation status & pending expiration
      const status: BookingStatus =
        service.confirmationMode === "auto" ? "confirmed" : "pending";
      const pendingExpiresAt =
        service.confirmationMode === "manual"
          ? new Date(
              nowMs + service.pendingHoldMinutes * 60_000
            ).toISOString()
          : null;

      const bookingId = randomUUID();
      const bookingRow: BookingRow = {
        id: bookingId,
        referenceCode,
        idempotencyKey: input.idempotencyKey.trim(),
        customerId,
        vehicleId,
        serviceId: service.id,
        optionSlug: service.optionSlug,
        resourceId: resource.id,
        allocatedUnits: service.requiredUnits,
        appointmentDate: input.appointmentDate,
        startTimeLocal: input.startTimeLocal,
        endTimeLocal,
        startAt: startAtIso,
        endAt: new Date(endMs).toISOString(),
        durationMinutes: service.durationMinutes,
        bufferMinutes: service.bufferMinutes,
        confirmationMode: service.confirmationMode,
        status,
        pendingExpiresAt,
        additionalRequests: input.additionalRequests?.trim() || null,
        cancellationReason: null,
        cancelledAt: null,
        rescheduledCount: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      this.bookings.push(bookingRow);

      // 8. Persist ONLY SHA-256 token hashes
      this.tokens.push(
        {
          id: randomUUID(),
          bookingId,
          purpose: "cancel",
          tokenHash: cancelTokenPair.tokenHash,
          expiresAt: tokenExpiresAt,
          usedAt: null,
          revokedAt: null,
          createdAt: now.toISOString(),
        },
        {
          id: randomUUID(),
          bookingId,
          purpose: "reschedule",
          tokenHash: rescheduleTokenPair.tokenHash,
          expiresAt: tokenExpiresAt,
          usedAt: null,
          revokedAt: null,
          createdAt: now.toISOString(),
        }
      );

      // 9. Write Audit Log
      this.auditLogs.push({
        id: randomUUID(),
        bookingId,
        actorType: "customer",
        action: "BOOKING_CREATED",
        previousStatus: null,
        newStatus: status,
        metadata: {
          referenceCode,
          optionSlug: service.optionSlug,
          allocatedUnits: service.requiredUnits,
          confirmationMode: service.confirmationMode,
        },
        createdAt: now.toISOString(),
      });

      return {
        ok: true,
        idempotentReplay: false,
        backendMode: "local-transactional",
        booking: {
          id: bookingId,
          referenceCode,
          status,
          confirmationMode: service.confirmationMode,
          serviceName: service.name,
          categoryTitle: service.categoryTitle,
          vehicleSummary: `${vehicleRow.modelYear} ${vehicleRow.manufacturer} ${vehicleRow.model}`,
          appointmentDate: bookingRow.appointmentDate,
          startTimeLocal: bookingRow.startTimeLocal,
          endTimeLocal: bookingRow.endTimeLocal,
          durationMinutes: bookingRow.durationMinutes,
          resourceName: resource.name,
          allocatedUnits: bookingRow.allocatedUnits,
          pendingExpiresAt,
        },
        tokens: {
          cancelToken: cancelTokenPair.rawToken,
          rescheduleToken: rescheduleTokenPair.rawToken,
          expiresAt: tokenExpiresAt,
        },
      };
    });
  }

  /**
   * Inspects a raw single-purpose token without mutating it.
   */
  public async inspectToken(params: {
    rawToken: string;
    expectedPurpose?: BookingTokenPurpose;
    now?: Date;
  }): Promise<TokenInspectionResult> {
    const now = params.now ?? new Date();
    if (!params.rawToken || params.rawToken.trim().length < 16) {
      return {
        ok: false,
        errorCode: "INVALID_TOKEN",
        message: "Security token is invalid or malformed.",
      };
    }

    const tokenHash = hashBookingToken(params.rawToken);
    const tokenRow = this.tokens.find((t) => t.tokenHash === tokenHash);

    if (!tokenRow) {
      return {
        ok: false,
        errorCode: "INVALID_TOKEN",
        message: "Security token was not recognized.",
      };
    }

    if (
      params.expectedPurpose &&
      tokenRow.purpose !== params.expectedPurpose
    ) {
      return {
        ok: false,
        errorCode: "INVALID_TOKEN",
        message: `This token is only valid for "${tokenRow.purpose}" operations, not "${params.expectedPurpose}".`,
      };
    }

    if (tokenRow.usedAt || tokenRow.revokedAt) {
      return {
        ok: false,
        errorCode: "TOKEN_ALREADY_USED",
        message: "This single-use security token has already been used or revoked.",
      };
    }

    if (new Date(tokenRow.expiresAt).getTime() <= now.getTime()) {
      return {
        ok: false,
        errorCode: "TOKEN_EXPIRED",
        message: "This security token has expired.",
      };
    }

    const booking = this.bookings.find((b) => b.id === tokenRow.bookingId);
    if (!booking) {
      return {
        ok: false,
        errorCode: "BOOKING_NOT_FOUND",
        message: "Associated booking could not be found.",
      };
    }

    const service = this.services.find((s) => s.id === booking.serviceId);
    const vehicle = this.vehicles.find((v) => v.id === booking.vehicleId);

    return {
      ok: true,
      purpose: tokenRow.purpose,
      booking: {
        referenceCode: booking.referenceCode,
        status: booking.status,
        serviceOptionSlug: booking.optionSlug,
        serviceName: service?.name ?? booking.optionSlug,
        vehicleType: vehicle?.vehicleType ?? "Car",
        vehicleSummary: vehicle
          ? `${vehicle.modelYear} ${vehicle.manufacturer} ${vehicle.model}`
          : "Customer Vehicle",
        appointmentDate: booking.appointmentDate,
        startTimeLocal: booking.startTimeLocal,
        endTimeLocal: booking.endTimeLocal,
        durationMinutes: booking.durationMinutes,
      },
    };
  }

  /**
   * Atomically cancels a booking using a single-purpose `cancel` token,
   * releasing its allocated resource capacity and invalidating all tokens.
   */
  public async cancelByToken(params: {
    rawToken: string;
    reason?: string;
    now?: Date;
  }): Promise<CancelBookingResult> {
    const now = params.now ?? new Date();
    if (!params.rawToken || params.rawToken.trim().length < 16) {
      return {
        ok: false,
        errorCode: "INVALID_TOKEN",
        message: "Cancellation token is invalid.",
      };
    }

    const tokenHash = hashBookingToken(params.rawToken);

    const supabase = getSupabaseServiceRoleClient();
    if (supabase) {
      const { data, error } = await supabase.rpc(
        "cancel_booking_by_token_atomic",
        {
          p_token_hash: tokenHash,
          p_reason: params.reason ?? "Cancelled by customer",
          p_now: now.toISOString(),
        }
      );

      if (error || !data) {
        return {
          ok: false,
          errorCode: "INTERNAL_ERROR",
          message: "Unable to process cancellation right now.",
        };
      }

      if (!data.ok) {
        return {
          ok: false,
          errorCode: data.error_code ?? "INVALID_TOKEN",
          message: data.message ?? "Cancellation failed.",
        };
      }

      return {
        ok: true,
        referenceCode: data.reference_code,
        previousStatus: data.previous_status,
        status: "cancelled",
      };
    }

    const tokenRow = this.tokens.find((t) => t.tokenHash === tokenHash);
    if (!tokenRow || tokenRow.purpose !== "cancel") {
      return {
        ok: false,
        errorCode: "INVALID_TOKEN",
        message: "Invalid cancellation token.",
      };
    }

    const booking = this.bookings.find((b) => b.id === tokenRow.bookingId);
    if (!booking) {
      return {
        ok: false,
        errorCode: "BOOKING_NOT_FOUND",
        message: "Booking record not found.",
      };
    }

    const lockKey = booking.resourceId;
    return this.withResourceLock(lockKey, async () => {
      if (tokenRow.usedAt || tokenRow.revokedAt) {
        return {
          ok: false,
          errorCode: "TOKEN_ALREADY_USED",
          message: "This cancellation token has already been used or revoked.",
        };
      }

      if (new Date(tokenRow.expiresAt).getTime() <= now.getTime()) {
        return {
          ok: false,
          errorCode: "TOKEN_EXPIRED",
          message: "This cancellation token has expired.",
        };
      }

      if (
        booking.status === "cancelled" ||
        booking.status === "rejected" ||
        booking.status === "completed"
      ) {
        return {
          ok: false,
          errorCode: "INVALID_BOOKING_STATE",
          message: `Appointment cannot be cancelled from "${booking.status}" status.`,
        };
      }

      const previousStatus = booking.status;
      booking.status = "cancelled";
      booking.cancellationReason =
        params.reason?.trim() || "Cancelled by customer";
      booking.cancelledAt = now.toISOString();
      booking.updatedAt = now.toISOString();

      // Mark cancel token used and revoke all other active tokens for this booking
      tokenRow.usedAt = now.toISOString();
      for (const sibling of this.tokens) {
        if (
          sibling.bookingId === booking.id &&
          sibling.id !== tokenRow.id &&
          !sibling.usedAt &&
          !sibling.revokedAt
        ) {
          sibling.revokedAt = now.toISOString();
        }
      }

      this.auditLogs.push({
        id: randomUUID(),
        bookingId: booking.id,
        actorType: "customer",
        action: "BOOKING_CANCELLED_BY_TOKEN",
        previousStatus,
        newStatus: "cancelled",
        metadata: {
          reason: booking.cancellationReason,
        },
        createdAt: now.toISOString(),
      });

      return {
        ok: true,
        referenceCode: booking.referenceCode,
        previousStatus,
        status: "cancelled",
      };
    });
  }

  /**
   * Atomically reschedules a booking using a single-purpose `reschedule` token.
   * Re-validates the new slot, releases old capacity, assigns new capacity,
   * invalidates the consumed token, and issues fresh single-purpose tokens.
   */
  public async rescheduleByToken(params: {
    rawToken: string;
    newAppointmentDate: string;
    newStartTimeLocal: string;
    now?: Date;
  }): Promise<RescheduleBookingResult> {
    const now = params.now ?? new Date();
    const nowMs = now.getTime();

    if (!params.rawToken || params.rawToken.trim().length < 16) {
      return {
        ok: false,
        errorCode: "INVALID_TOKEN",
        message: "Reschedule token is invalid.",
      };
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(params.newAppointmentDate) ||
      !/^\d{2}:\d{2}$/.test(params.newStartTimeLocal)
    ) {
      return {
        ok: false,
        errorCode: "VALIDATION_ERROR",
        message: "Valid new date and start time are required.",
      };
    }

    const tokenHash = hashBookingToken(params.rawToken);
    const newCancelToken = generateBookingToken();
    const newRescheduleToken = generateBookingToken();
    const newStartIso = toManilaInstantIso(
      params.newAppointmentDate,
      params.newStartTimeLocal
    );
    const newTokenExpiresAt = new Date(
      Math.max(
        new Date(newStartIso).getTime() + 7 * 86_400_000,
        nowMs + 7 * 86_400_000
      )
    ).toISOString();

    const supabase = getSupabaseServiceRoleClient();
    if (supabase) {
      const { data, error } = await supabase.rpc(
        "reschedule_booking_by_token_atomic",
        {
          p_token_hash: tokenHash,
          p_new_appointment_date: params.newAppointmentDate,
          p_new_start_time_local: `${params.newStartTimeLocal}:00`,
          p_new_cancel_token_hash: newCancelToken.tokenHash,
          p_new_reschedule_token_hash: newRescheduleToken.tokenHash,
          p_new_token_expires_at: newTokenExpiresAt,
          p_now: now.toISOString(),
        }
      );

      if (error || !data) {
        return {
          ok: false,
          errorCode: "INTERNAL_ERROR",
          message: "Unable to reschedule appointment right now.",
        };
      }

      if (!data.ok) {
        return {
          ok: false,
          errorCode: data.error_code ?? "INVALID_TOKEN",
          message: data.message ?? "Rescheduling failed.",
        };
      }

      return {
        ok: true,
        referenceCode: data.reference_code,
        status: data.status,
        appointmentDate: data.appointment_date,
        startTimeLocal: data.start_time_local,
        endTimeLocal: data.end_time_local,
        newTokens: {
          cancelToken: newCancelToken.rawToken,
          rescheduleToken: newRescheduleToken.rawToken,
          expiresAt: newTokenExpiresAt,
        },
      };
    }

    const tokenRow = this.tokens.find((t) => t.tokenHash === tokenHash);
    if (!tokenRow || tokenRow.purpose !== "reschedule") {
      return {
        ok: false,
        errorCode: "INVALID_TOKEN",
        message: "Invalid reschedule token.",
      };
    }

    const booking = this.bookings.find((b) => b.id === tokenRow.bookingId);
    if (!booking) {
      return {
        ok: false,
        errorCode: "BOOKING_NOT_FOUND",
        message: "Booking record not found.",
      };
    }

    const lockKey = booking.resourceId;
    return this.withResourceLock(lockKey, async () => {
      if (tokenRow.usedAt || tokenRow.revokedAt) {
        return {
          ok: false,
          errorCode: "TOKEN_ALREADY_USED",
          message: "This reschedule token has already been used or revoked.",
        };
      }

      if (new Date(tokenRow.expiresAt).getTime() <= now.getTime()) {
        return {
          ok: false,
          errorCode: "TOKEN_EXPIRED",
          message: "This reschedule token has expired.",
        };
      }

      if (booking.status !== "pending" && booking.status !== "confirmed") {
        return {
          ok: false,
          errorCode: "INVALID_BOOKING_STATE",
          message: "Only pending or confirmed appointments can be rescheduled.",
        };
      }

      const service = this.services.find((s) => s.id === booking.serviceId);
      const resource = this.resources.find((r) => r.id === booking.resourceId);
      if (!service || !resource) {
        return {
          ok: false,
          errorCode: "RESOURCE_UNAVAILABLE",
          message: "Service or studio bay configuration unavailable.",
        };
      }

      const dow = getManilaDayOfWeek(params.newAppointmentDate);
      if (dow === 0) {
        return {
          ok: false,
          errorCode: "SUNDAY_CLOSED",
          message: "Manila Auto Pros is closed on Sundays.",
        };
      }

      const hours = this.businessHours.find((h) => h.dayOfWeek === dow);
      if (!hours || hours.isClosed) {
        return {
          ok: false,
          errorCode: "DAY_CLOSED",
          message: "Studio is closed on the selected date.",
        };
      }

      const startMins = parseTimeToMinutes(params.newStartTimeLocal);
      const endMins = startMins + service.durationMinutes;
      const openMins = parseTimeToMinutes(hours.openTime);
      const closeMins = parseTimeToMinutes(hours.closeTime);

      if (startMins < openMins || endMins > closeMins) {
        return {
          ok: false,
          errorCode: "OUTSIDE_OPERATING_HOURS",
          message: "Requested new slot exceeds operating hours.",
        };
      }

      const newEndTimeLocal = minutesToTimeStr(endMins);
      const startMs = new Date(newStartIso).getTime();
      const endMs = startMs + service.durationMinutes * 60_000;
      const effectiveEndMs =
        startMs + (service.durationMinutes + service.bufferMinutes) * 60_000;

      if (startMs < nowMs + service.minNoticeHours * 3_600_000) {
        return {
          ok: false,
          errorCode: "MIN_NOTICE_VIOLATION",
          message: `Rescheduled time must be at least ${service.minNoticeHours} hours in advance.`,
        };
      }

      const matchingBlock = this.blockedDates.find((b) => {
        if (!b.isActive || b.blockedDate !== params.newAppointmentDate)
          return false;
        if (b.resourceId !== null && b.resourceId !== resource.id) return false;
        if (b.startTime === null && b.endTime === null) return true;
        const bStart = parseTimeToMinutes(b.startTime!);
        const bEnd = parseTimeToMinutes(b.endTime!);
        return startMins < bEnd && endMins > bStart;
      });

      if (matchingBlock) {
        return {
          ok: false,
          errorCode: "DATE_BLOCKED",
          message: `Selected date/time is blocked: ${matchingBlock.reason}`,
        };
      }

      const overlappingUnits = this.computePeakOverlappingUnits({
        resourceId: resource.id,
        appointmentDate: params.newAppointmentDate,
        startMs,
        effectiveEndMs,
        nowMs,
        excludeBookingId: booking.id,
      });

      if (overlappingUnits + booking.allocatedUnits > resource.totalCapacity) {
        return {
          ok: false,
          errorCode: "SLOT_CAPACITY_EXHAUSTED",
          message:
            "The requested new time slot does not have enough bay capacity.",
        };
      }

      const oldDate = booking.appointmentDate;
      const oldStart = booking.startTimeLocal;

      booking.appointmentDate = params.newAppointmentDate;
      booking.startTimeLocal = params.newStartTimeLocal;
      booking.endTimeLocal = newEndTimeLocal;
      booking.startAt = newStartIso;
      booking.endAt = new Date(endMs).toISOString();
      booking.rescheduledCount += 1;
      booking.updatedAt = now.toISOString();

      // Invalidate used reschedule token & revoke sibling tokens
      tokenRow.usedAt = now.toISOString();
      for (const sibling of this.tokens) {
        if (
          sibling.bookingId === booking.id &&
          sibling.id !== tokenRow.id &&
          !sibling.usedAt &&
          !sibling.revokedAt
        ) {
          sibling.revokedAt = now.toISOString();
        }
      }

      this.tokens.push(
        {
          id: randomUUID(),
          bookingId: booking.id,
          purpose: "cancel",
          tokenHash: newCancelToken.tokenHash,
          expiresAt: newTokenExpiresAt,
          usedAt: null,
          revokedAt: null,
          createdAt: now.toISOString(),
        },
        {
          id: randomUUID(),
          bookingId: booking.id,
          purpose: "reschedule",
          tokenHash: newRescheduleToken.tokenHash,
          expiresAt: newTokenExpiresAt,
          usedAt: null,
          revokedAt: null,
          createdAt: now.toISOString(),
        }
      );

      this.auditLogs.push({
        id: randomUUID(),
        bookingId: booking.id,
        actorType: "customer",
        action: "BOOKING_RESCHEDULED_BY_TOKEN",
        previousStatus: booking.status,
        newStatus: booking.status,
        metadata: {
          oldDate,
          oldStart,
          newDate: booking.appointmentDate,
          newStart: booking.startTimeLocal,
        },
        createdAt: now.toISOString(),
      });

      return {
        ok: true,
        referenceCode: booking.referenceCode,
        status: booking.status,
        appointmentDate: booking.appointmentDate,
        startTimeLocal: booking.startTimeLocal,
        endTimeLocal: booking.endTimeLocal,
        newTokens: {
          cancelToken: newCancelToken.rawToken,
          rescheduleToken: newRescheduleToken.rawToken,
          expiresAt: newTokenExpiresAt,
        },
      };
    });
  }
}

/** Singleton engine instance used by Next.js Server Actions in development/runtime. */
const globalForBooking = globalThis as unknown as {
  __manilaAutoProsBookingEngine?: BookingEngine;
};

export const defaultBookingEngine =
  globalForBooking.__manilaAutoProsBookingEngine ??
  (globalForBooking.__manilaAutoProsBookingEngine = new BookingEngine());

export function createIsolatedBookingEngine(
  options?: ConstructorParameters<typeof BookingEngine>[0]
): BookingEngine {
  return new BookingEngine(options);
}
