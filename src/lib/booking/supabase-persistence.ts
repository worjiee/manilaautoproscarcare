import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { hashBookingToken } from "@/lib/security/tokens";
import type {
  AvailabilityQueryResult,
  BookingResourceRow,
  BookingStatus,
  BookingTokenPurpose,
  ServiceConfigRow,
  TimeSlotOption,
  TokenInspectionResult,
} from "./types";

type ServiceRecord = {
  id: string;
  category_slug: string;
  category_title: string;
  option_slug: string;
  name: string;
  short_description: string;
  vehicle_type: "Car" | "Motorcycle";
  duration_minutes: number;
  buffer_minutes: number;
  required_resource_type: string;
  required_units: number;
  confirmation_mode: "auto" | "manual";
  pending_hold_minutes: number;
  min_notice_hours: number;
  max_advance_days: number;
  cancellation_cutoff_minutes: number;
  reschedule_cutoff_minutes: number;
  is_active: boolean;
  is_dev_default: boolean;
};

type ResourceRecord = {
  id: string;
  code: string;
  name: string;
  resource_type: string;
  vehicle_type: "Car" | "Motorcycle";
  total_capacity: number;
  is_active: boolean;
  is_dev_default: boolean;
};

type BusinessHoursRecord = {
  open_time: string;
  close_time: string;
  slot_interval_minutes: number;
  is_closed: boolean;
  is_dev_default: boolean;
};

type BlockedDateRecord = {
  start_time: string | null;
  end_time: string | null;
  reason: string;
};

type AllocationRecord = {
  id: string;
  allocated_units: number;
  start_at: string;
  end_at: string;
  buffer_minutes: number;
  status: "pending" | "confirmed";
  pending_expires_at: string | null;
};

export type SupabaseBookingContext = {
  service: ServiceConfigRow;
  resource: BookingResourceRow;
};

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(
    totalMinutes % 60
  ).padStart(2, "0")}`;
}

function formatTime12h(time: string): string {
  const totalMinutes = parseTimeToMinutes(time);
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function toManilaInstant(date: string, time: string): number {
  return new Date(`${date}T${time}:00+08:00`).getTime();
}

function toManilaDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getDayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00+08:00`).getUTCDay();
}

function mapService(row: ServiceRecord): ServiceConfigRow {
  return {
    id: row.id,
    categorySlug: row.category_slug,
    categoryTitle: row.category_title,
    optionSlug: row.option_slug,
    name: row.name,
    shortDescription: row.short_description,
    vehicleType: row.vehicle_type,
    durationMinutes: row.duration_minutes,
    bufferMinutes: row.buffer_minutes,
    requiredResourceType: row.required_resource_type,
    requiredUnits: row.required_units,
    confirmationMode: row.confirmation_mode,
    pendingHoldMinutes: row.pending_hold_minutes,
    minNoticeHours: row.min_notice_hours,
    maxAdvanceDays: row.max_advance_days,
    cancellationCutoffMinutes: row.cancellation_cutoff_minutes,
    rescheduleCutoffMinutes: row.reschedule_cutoff_minutes,
    isActive: row.is_active,
    isDevDefault: row.is_dev_default,
  };
}

function mapResource(row: ResourceRecord): BookingResourceRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    resourceType: row.resource_type,
    vehicleType: row.vehicle_type,
    totalCapacity: row.total_capacity,
    isActive: row.is_active,
    isDevDefault: row.is_dev_default,
  };
}

export async function getSupabaseBookingContext(
  supabase: SupabaseClient,
  optionSlug: string
): Promise<SupabaseBookingContext | null> {
  const { data: rawService, error: serviceError } = await supabase
    .from("services")
    .select(
      "id,category_slug,category_title,option_slug,name,short_description,vehicle_type,duration_minutes,buffer_minutes,required_resource_type,required_units,confirmation_mode,pending_hold_minutes,min_notice_hours,max_advance_days,cancellation_cutoff_minutes,reschedule_cutoff_minutes,is_active,is_dev_default"
    )
    .eq("option_slug", optionSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (serviceError) throw new Error("Unable to read Supabase service configuration.");
  if (!rawService) return null;

  const service = mapService(rawService as ServiceRecord);
  const { data: rawResource, error: resourceError } = await supabase
    .from("booking_resources")
    .select(
      "id,code,name,resource_type,vehicle_type,total_capacity,is_active,is_dev_default"
    )
    .eq("resource_type", service.requiredResourceType)
    .eq("is_active", true)
    .order("code", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (resourceError) throw new Error("Unable to read Supabase resource configuration.");
  if (!rawResource) return null;

  return {
    service,
    resource: mapResource(rawResource as ResourceRecord),
  };
}

function availabilityFailure(params: {
  date: string;
  optionSlug: string;
  errorCode: AvailabilityQueryResult["errorCode"];
  errorMessage: string;
  service?: ServiceConfigRow;
  resource?: BookingResourceRow;
}): AvailabilityQueryResult {
  return {
    ok: false,
    date: params.date,
    timezone: "Asia/Manila",
    optionSlug: params.optionSlug,
    serviceName: params.service?.name ?? "",
    durationMinutes: params.service?.durationMinutes ?? 0,
    confirmationMode: params.service?.confirmationMode ?? "manual",
    resourceName: params.resource?.name ?? "",
    requiredUnits: params.service?.requiredUnits ?? 1,
    isSundayClosed: false,
    isDayBlocked: false,
    blockedReason: null,
    isOutOfAdvanceWindow: false,
    isDevDefaultConfig:
      params.service?.isDevDefault === true ||
      params.resource?.isDevDefault === true,
    backendMode: "supabase",
    slots: [],
    errorCode: params.errorCode,
    errorMessage: params.errorMessage,
  };
}

function peakAllocatedUnits(params: {
  bookings: AllocationRecord[];
  startMs: number;
  effectiveEndMs: number;
  nowMs: number;
}): number {
  const active = params.bookings.filter((booking) => {
    if (booking.status === "confirmed") return true;
    return (
      booking.pending_expires_at === null ||
      new Date(booking.pending_expires_at).getTime() > params.nowMs
    );
  });
  const points = new Set<number>([params.startMs]);

  for (const booking of active) {
    const start = new Date(booking.start_at).getTime();
    const end =
      new Date(booking.end_at).getTime() + booking.buffer_minutes * 60_000;
    if (start < params.effectiveEndMs && end > params.startMs) {
      points.add(Math.max(params.startMs, start));
    }
  }

  let peak = 0;
  for (const point of points) {
    const units = active.reduce((total, booking) => {
      const start = new Date(booking.start_at).getTime();
      const end =
        new Date(booking.end_at).getTime() + booking.buffer_minutes * 60_000;
      return start <= point && point < end
        ? total + booking.allocated_units
        : total;
    }, 0);
    peak = Math.max(peak, units);
  }

  return peak;
}

export async function getSupabaseAvailability(
  supabase: SupabaseClient,
  params: {
    dateStr: string;
    optionSlug: string;
    now: Date;
    excludeBookingId?: string;
  }
): Promise<AvailabilityQueryResult> {
  try {
    const context = await getSupabaseBookingContext(
      supabase,
      params.optionSlug
    );
    if (!context) {
      return availabilityFailure({
        date: params.dateStr,
        optionSlug: params.optionSlug,
        errorCode: "INVALID_SERVICE",
        errorMessage: "Selected service option could not be found.",
      });
    }

    const { service, resource } = context;
    const dayOfWeek = getDayOfWeek(params.dateStr);
    const { data: rawHours, error: hoursError } = await supabase
      .from("business_hours")
      .select(
        "open_time,close_time,slot_interval_minutes,is_closed,is_dev_default"
      )
      .eq("day_of_week", dayOfWeek)
      .maybeSingle();

    if (hoursError) throw new Error("Unable to read Supabase business hours.");
    const hours = rawHours as BusinessHoursRecord | null;
    if (dayOfWeek === 0 || !hours || hours.is_closed) {
      return {
        ...availabilityFailure({
          date: params.dateStr,
          optionSlug: params.optionSlug,
          service,
          resource,
          errorCode: undefined,
          errorMessage: "",
        }),
        ok: true,
        isSundayClosed: dayOfWeek === 0,
        blockedReason: dayOfWeek === 0 ? "Sunday: Studio Closed" : "Studio Closed",
        errorCode: undefined,
        errorMessage: undefined,
      };
    }

    const nowMs = params.now.getTime();
    const todayMs = new Date(`${toManilaDate(params.now)}T00:00:00+08:00`).getTime();
    const targetMs = new Date(`${params.dateStr}T00:00:00+08:00`).getTime();
    const differenceDays = Math.round((targetMs - todayMs) / 86_400_000);
    if (differenceDays < 0 || differenceDays > service.maxAdvanceDays) {
      return {
        ...availabilityFailure({
          date: params.dateStr,
          optionSlug: params.optionSlug,
          service,
          resource,
          errorCode: undefined,
          errorMessage: "",
        }),
        ok: true,
        isOutOfAdvanceWindow: true,
        blockedReason:
          differenceDays < 0
            ? "Cannot schedule appointments in the past."
            : `Appointments can be scheduled up to ${service.maxAdvanceDays} days in advance.`,
        errorCode: undefined,
        errorMessage: undefined,
      };
    }

    const { data: rawBlocks, error: blocksError } = await supabase
      .from("blocked_dates")
      .select("start_time,end_time,reason")
      .eq("blocked_date", params.dateStr)
      .eq("is_active", true)
      .or(`resource_id.is.null,resource_id.eq.${resource.id}`);
    if (blocksError) throw new Error("Unable to read Supabase blocked dates.");
    const blocks = (rawBlocks ?? []) as BlockedDateRecord[];
    const fullDayBlock = blocks.find(
      (block) => block.start_time === null && block.end_time === null
    );
    if (fullDayBlock) {
      return {
        ...availabilityFailure({
          date: params.dateStr,
          optionSlug: params.optionSlug,
          service,
          resource,
          errorCode: undefined,
          errorMessage: "",
        }),
        ok: true,
        isDayBlocked: true,
        blockedReason: fullDayBlock.reason,
        errorCode: undefined,
        errorMessage: undefined,
      };
    }

    let bookingsQuery = supabase
      .from("bookings")
      .select(
        "id,allocated_units,start_at,end_at,buffer_minutes,status,pending_expires_at"
      )
      .eq("resource_id", resource.id)
      .eq("appointment_date", params.dateStr)
      .in("status", ["pending", "confirmed"]);
    if (params.excludeBookingId) {
      bookingsQuery = bookingsQuery.neq("id", params.excludeBookingId);
    }
    const { data: rawBookings, error: bookingsError } = await bookingsQuery;
    if (bookingsError) throw new Error("Unable to read Supabase allocations.");
    const bookings = (rawBookings ?? []) as AllocationRecord[];

    const openMinutes = parseTimeToMinutes(hours.open_time);
    const closeMinutes = parseTimeToMinutes(hours.close_time);
    const minimumNoticeMs = nowMs + service.minNoticeHours * 3_600_000;
    const slots: TimeSlotOption[] = [];

    for (
      let startMinutes = openMinutes;
      startMinutes + service.durationMinutes <= closeMinutes;
      startMinutes += hours.slot_interval_minutes
    ) {
      const endMinutes = startMinutes + service.durationMinutes;
      const startTime = minutesToTime(startMinutes);
      const endTime = minutesToTime(endMinutes);
      const startMs = toManilaInstant(params.dateStr, startTime);
      const effectiveEndMs =
        startMs +
        (service.durationMinutes + service.bufferMinutes) * 60_000;
      let status: TimeSlotOption["status"] = "available";
      let reason = "";
      let remainingUnits = resource.totalCapacity;

      if (startMs < minimumNoticeMs) {
        status = "past_notice";
        reason = `Requires at least ${service.minNoticeHours}h advance notice`;
        remainingUnits = 0;
      } else {
        const block = blocks.find((candidate) => {
          if (!candidate.start_time || !candidate.end_time) return false;
          return (
            startMinutes < parseTimeToMinutes(candidate.end_time) &&
            endMinutes > parseTimeToMinutes(candidate.start_time)
          );
        });

        if (block) {
          status = "blocked";
          reason = block.reason;
          remainingUnits = 0;
        } else {
          const usedUnits = peakAllocatedUnits({
            bookings,
            startMs,
            effectiveEndMs,
            nowMs,
          });
          remainingUnits = Math.max(0, resource.totalCapacity - usedUnits);
          status =
            remainingUnits >= service.requiredUnits ? "available" : "full";
          reason =
            status === "available"
              ? `${remainingUnits} of ${resource.totalCapacity} bay units open (${
                  service.confirmationMode === "auto"
                    ? "Instant Confirmation"
                    : "Admin Approval Hold"
                })`
              : "All studio bays allocated for this window";
        }
      }

      slots.push({
        id: startTime,
        startTimeLocal: startTime,
        endTimeLocal: endTime,
        label: `${formatTime12h(startTime)} – ${formatTime12h(endTime)} PHT`,
        windowLabel: `${service.durationMinutes} min • ${resource.code}`,
        status,
        remainingUnits,
        totalUnits: resource.totalCapacity,
        requiredUnits: service.requiredUnits,
        reason,
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
      isDevDefaultConfig:
        service.isDevDefault || resource.isDevDefault || hours.is_dev_default,
      backendMode: "supabase",
      slots,
    };
  } catch {
    return availabilityFailure({
      date: params.dateStr,
      optionSlug: params.optionSlug,
      errorCode: "INTERNAL_ERROR",
      errorMessage: "Unable to load live schedule availability at this moment.",
    });
  }
}

export async function inspectSupabaseBookingToken(
  supabase: SupabaseClient,
  params: {
    rawToken: string;
    expectedPurpose?: BookingTokenPurpose;
    now: Date;
  }
): Promise<TokenInspectionResult> {
  const tokenHash = hashBookingToken(params.rawToken);
  const { data: token, error: tokenError } = await supabase
    .from("booking_tokens")
    .select("booking_id,purpose,expires_at,used_at,revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenError) {
    return { ok: false, errorCode: "INTERNAL_ERROR", message: "Unable to verify security token at this time." };
  }
  if (!token) {
    return { ok: false, errorCode: "INVALID_TOKEN", message: "Security token was not recognized." };
  }

  const purpose = token.purpose as BookingTokenPurpose;
  if (params.expectedPurpose && purpose !== params.expectedPurpose) {
    return { ok: false, errorCode: "INVALID_TOKEN", message: "Security token is not valid for this operation." };
  }
  if (token.used_at || token.revoked_at) {
    return { ok: false, errorCode: "TOKEN_ALREADY_USED", message: "This single-use security token has already been used or revoked." };
  }
  if (new Date(token.expires_at).getTime() <= params.now.getTime()) {
    return { ok: false, errorCode: "TOKEN_EXPIRED", message: "This security token has expired." };
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "reference_code,status,service_id,vehicle_id,appointment_date,start_time_local,end_time_local,duration_minutes"
    )
    .eq("id", token.booking_id)
    .maybeSingle();
  if (bookingError || !booking) {
    return { ok: false, errorCode: "BOOKING_NOT_FOUND", message: "Associated booking could not be found." };
  }

  const [{ data: service, error: serviceError }, { data: vehicle, error: vehicleError }] =
    await Promise.all([
      supabase
        .from("services")
        .select("option_slug,name")
        .eq("id", booking.service_id)
        .maybeSingle(),
      supabase
        .from("vehicles")
        .select("vehicle_type,manufacturer,model,model_year")
        .eq("id", booking.vehicle_id)
        .maybeSingle(),
    ]);
  if (serviceError || vehicleError || !service || !vehicle) {
    return { ok: false, errorCode: "INTERNAL_ERROR", message: "Unable to load booking details at this time." };
  }

  return {
    ok: true,
    purpose,
    booking: {
      referenceCode: booking.reference_code,
      status: booking.status as BookingStatus,
      serviceOptionSlug: service.option_slug,
      serviceName: service.name,
      vehicleType: vehicle.vehicle_type as "Car" | "Motorcycle",
      vehicleSummary: `${vehicle.model_year} ${vehicle.manufacturer} ${vehicle.model}`,
      appointmentDate: booking.appointment_date,
      startTimeLocal: String(booking.start_time_local).slice(0, 5),
      endTimeLocal: String(booking.end_time_local).slice(0, 5),
      durationMinutes: booking.duration_minutes,
    },
  };
}
