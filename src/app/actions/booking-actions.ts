"use server";

import { headers } from "next/headers";
import { defaultBookingEngine } from "@/lib/booking/engine";
import type {
  AvailabilityQueryResult,
  BookingTokenPurpose,
  CancelBookingResult,
  CreateBookingInput,
  CreateBookingResult,
  RescheduleBookingResult,
  TokenInspectionResult,
} from "@/lib/booking/types";
import { checkRateLimit } from "@/lib/security/rate-limiter";

async function getClientRateLimitKey(scope: string): Promise<string> {
  try {
    const hdrs = await headers();
    const forwardedFor = hdrs.get("x-forwarded-for");
    const realIp = hdrs.get("x-real-ip");
    const ip =
      forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || "local-client";
    return `${scope}:${ip}`;
  } catch {
    return `${scope}:local-client`;
  }
}

/**
 * Server Action: Queries live availability for a date (YYYY-MM-DD in Asia/Manila)
 * and a specific service option slug.
 */
export async function getLiveServiceAvailabilityAction(params: {
  dateStr: string;
  optionSlug: string;
  excludeBookingId?: string;
}): Promise<AvailabilityQueryResult> {
  try {
    const rlKey = await getClientRateLimitKey("availability");
    const rl = checkRateLimit({
      key: rlKey,
      maxRequests: 60,
      windowMs: 60_000,
    });

    if (!rl.allowed) {
      return {
        ok: false,
        date: params.dateStr,
        timezone: "Asia/Manila",
        optionSlug: params.optionSlug,
        serviceName: "",
        durationMinutes: 0,
        confirmationMode: "manual",
        resourceName: "",
        requiredUnits: 1,
        isSundayClosed: false,
        isDayBlocked: false,
        blockedReason: null,
        isOutOfAdvanceWindow: false,
        isDevDefaultConfig: true,
        backendMode: "local-transactional",
        slots: [],
        errorCode: "RATE_LIMITED",
        errorMessage:
          "Too many availability checks in a short period. Please wait a moment and try again.",
      };
    }

    return await defaultBookingEngine.getAvailability({
      dateStr: params.dateStr,
      optionSlug: params.optionSlug,
      excludeBookingId: params.excludeBookingId,
    });
  } catch {
    return {
      ok: false,
      date: params.dateStr,
      timezone: "Asia/Manila",
      optionSlug: params.optionSlug,
      serviceName: "",
      durationMinutes: 0,
      confirmationMode: "manual",
      resourceName: "",
      requiredUnits: 1,
      isSundayClosed: false,
      isDayBlocked: false,
      blockedReason: null,
      isOutOfAdvanceWindow: false,
      isDevDefaultConfig: true,
      backendMode: "local-transactional",
      slots: [],
      errorCode: "INTERNAL_ERROR",
      errorMessage:
        "Unable to load live schedule availability at this moment. Please try again.",
    };
  }
}

/**
 * Server Action: Atomically validates and creates a booking reservation.
 */
export async function submitBookingReservationAction(
  input: Omit<CreateBookingInput, "now">
): Promise<CreateBookingResult> {
  try {
    const rlKey = await getClientRateLimitKey("booking-submit");
    const rl = checkRateLimit({
      key: rlKey,
      maxRequests: 10,
      windowMs: 60_000,
    });

    if (!rl.allowed) {
      return {
        ok: false,
        errorCode: "RATE_LIMITED",
        message:
          "Too many booking attempts from this connection. Please wait one minute before retrying.",
      };
    }

    return await defaultBookingEngine.createBooking(input);
  } catch {
    return {
      ok: false,
      errorCode: "INTERNAL_ERROR",
      message:
        "An unexpected server error occurred while processing your booking. Please try again.",
    };
  }
}

/**
 * Server Action: Inspects a single-purpose customer token without consuming it.
 */
export async function inspectBookingTokenAction(params: {
  rawToken: string;
  expectedPurpose?: BookingTokenPurpose;
}): Promise<TokenInspectionResult> {
  try {
    const rlKey = await getClientRateLimitKey("token-inspect");
    const rl = checkRateLimit({
      key: rlKey,
      maxRequests: 30,
      windowMs: 60_000,
    });

    if (!rl.allowed) {
      return {
        ok: false,
        errorCode: "RATE_LIMITED",
        message: "Too many requests. Please wait a moment and try again.",
      };
    }

    return await defaultBookingEngine.inspectToken({
      rawToken: params.rawToken,
      expectedPurpose: params.expectedPurpose,
    });
  } catch {
    return {
      ok: false,
      errorCode: "INTERNAL_ERROR",
      message: "Unable to verify security token at this time.",
    };
  }
}

/**
 * Server Action: Atomically cancels a booking via a single-purpose `cancel` token.
 */
export async function cancelBookingByTokenAction(params: {
  rawToken: string;
  reason?: string;
}): Promise<CancelBookingResult> {
  try {
    const rlKey = await getClientRateLimitKey("token-cancel");
    const rl = checkRateLimit({
      key: rlKey,
      maxRequests: 10,
      windowMs: 60_000,
    });

    if (!rl.allowed) {
      return {
        ok: false,
        errorCode: "RATE_LIMITED",
        message: "Too many cancellation attempts. Please wait a moment.",
      };
    }

    return await defaultBookingEngine.cancelByToken({
      rawToken: params.rawToken,
      reason: params.reason,
    });
  } catch {
    return {
      ok: false,
      errorCode: "INTERNAL_ERROR",
      message: "Unable to complete appointment cancellation at this time.",
    };
  }
}

/**
 * Server Action: Atomically reschedules a booking via a single-purpose `reschedule` token.
 */
export async function rescheduleBookingByTokenAction(params: {
  rawToken: string;
  newAppointmentDate: string;
  newStartTimeLocal: string;
}): Promise<RescheduleBookingResult> {
  try {
    const rlKey = await getClientRateLimitKey("token-reschedule");
    const rl = checkRateLimit({
      key: rlKey,
      maxRequests: 10,
      windowMs: 60_000,
    });

    if (!rl.allowed) {
      return {
        ok: false,
        errorCode: "RATE_LIMITED",
        message: "Too many reschedule attempts. Please wait a moment.",
      };
    }

    return await defaultBookingEngine.rescheduleByToken({
      rawToken: params.rawToken,
      newAppointmentDate: params.newAppointmentDate,
      newStartTimeLocal: params.newStartTimeLocal,
    });
  } catch {
    return {
      ok: false,
      errorCode: "INTERNAL_ERROR",
      message: "Unable to reschedule appointment at this time.",
    };
  }
}
