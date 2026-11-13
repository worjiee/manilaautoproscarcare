import type { VehicleType } from "@/lib/constants/site-data";

export type ConfirmationMode = "auto" | "manual";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "cancelled"
  | "completed";

export type BookingTokenPurpose = "cancel" | "reschedule";

export type AuditActorType = "customer" | "system" | "admin";

export type BookingErrorCode =
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INVALID_SERVICE"
  | "VEHICLE_TYPE_MISMATCH"
  | "SUNDAY_CLOSED"
  | "DAY_CLOSED"
  | "OUTSIDE_OPERATING_HOURS"
  | "MIN_NOTICE_VIOLATION"
  | "MAX_ADVANCE_VIOLATION"
  | "DATE_BLOCKED"
  | "RESOURCE_UNAVAILABLE"
  | "SLOT_CAPACITY_EXHAUSTED"
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "TOKEN_ALREADY_USED"
  | "BOOKING_NOT_FOUND"
  | "INVALID_BOOKING_STATE"
  | "INTERNAL_ERROR";

export interface BookingResourceRow {
  id: string;
  code: string;
  name: string;
  resourceType: string;
  vehicleType: VehicleType;
  totalCapacity: number;
  isActive: boolean;
  isDevDefault: boolean;
}

export interface ServiceConfigRow {
  id: string;
  categorySlug: string;
  categoryTitle: string;
  optionSlug: string;
  name: string;
  shortDescription: string;
  vehicleType: VehicleType;
  durationMinutes: number;
  bufferMinutes: number;
  requiredResourceType: string;
  requiredUnits: number;
  confirmationMode: ConfirmationMode;
  pendingHoldMinutes: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
  isActive: boolean;
  isDevDefault: boolean;
}

export interface BusinessHoursRow {
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  dayName: string;
  openTime: string; // "HH:MM"
  closeTime: string; // "HH:MM"
  slotIntervalMinutes: number;
  isClosed: boolean;
  timezone: "Asia/Manila";
  isDevDefault: boolean;
}

export interface BlockedDateRow {
  id: string;
  blockedDate: string; // "YYYY-MM-DD"
  startTime: string | null; // "HH:MM" or null for full day
  endTime: string | null; // "HH:MM" or null for full day
  resourceId: string | null;
  reason: string;
  isActive: boolean;
}

export interface CustomerRow {
  id: string;
  fullName: string;
  email: string;
  emailNormalized: string;
  phone: string;
  phoneNormalized: string;
  createdAt: string;
}

export interface VehicleRow {
  id: string;
  customerId: string;
  vehicleType: VehicleType;
  manufacturer: string;
  model: string;
  modelYear: number;
  notes: string | null;
  createdAt: string;
}

export interface BookingRow {
  id: string;
  referenceCode: string;
  idempotencyKey: string;
  customerId: string;
  vehicleId: string;
  serviceId: string;
  optionSlug: string;
  resourceId: string;
  allocatedUnits: number;
  appointmentDate: string; // "YYYY-MM-DD"
  startTimeLocal: string; // "HH:MM"
  endTimeLocal: string; // "HH:MM"
  startAt: string; // ISO TIMESTAMPTZ
  endAt: string; // ISO TIMESTAMPTZ
  durationMinutes: number;
  bufferMinutes: number;
  confirmationMode: ConfirmationMode;
  status: BookingStatus;
  pendingExpiresAt: string | null;
  additionalRequests: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  rescheduledCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookingTokenRow {
  id: string;
  bookingId: string;
  purpose: BookingTokenPurpose;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface BookingAuditLogRow {
  id: string;
  bookingId: string;
  actorType: AuditActorType;
  action: string;
  previousStatus: BookingStatus | null;
  newStatus: BookingStatus | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TimeSlotOption {
  id: string; // e.g. "09:00"
  startTimeLocal: string; // "09:00"
  endTimeLocal: string; // "13:00"
  label: string; // "9:00 AM – 1:00 PM PHT"
  windowLabel: string;
  status: "available" | "full" | "blocked" | "past_notice";
  remainingUnits: number;
  totalUnits: number;
  requiredUnits: number;
  reason: string;
}

export interface AvailabilityQueryResult {
  ok: boolean;
  date: string;
  timezone: "Asia/Manila";
  optionSlug: string;
  serviceName: string;
  durationMinutes: number;
  confirmationMode: ConfirmationMode;
  resourceName: string;
  requiredUnits: number;
  isSundayClosed: boolean;
  isDayBlocked: boolean;
  blockedReason: string | null;
  isOutOfAdvanceWindow: boolean;
  isDevDefaultConfig: boolean;
  backendMode: "supabase" | "local-transactional";
  slots: TimeSlotOption[];
  errorCode?: BookingErrorCode;
  errorMessage?: string;
}

export interface CreateBookingInput {
  idempotencyKey: string;
  vehicleType: VehicleType;
  serviceCategorySlug?: string;
  serviceOptionSlug: string;
  manufacturer: string;
  model: string;
  year: number;
  vehicleNotes?: string;
  appointmentDate: string; // YYYY-MM-DD
  startTimeLocal: string; // HH:MM
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  additionalRequests?: string;
  now?: Date;
}

export interface CreateBookingSuccess {
  ok: true;
  idempotentReplay: boolean;
  backendMode: "supabase" | "local-transactional";
  booking: {
    id: string;
    referenceCode: string;
    status: BookingStatus;
    confirmationMode: ConfirmationMode;
    serviceName: string;
    categoryTitle: string;
    vehicleSummary: string;
    appointmentDate: string;
    startTimeLocal: string;
    endTimeLocal: string;
    durationMinutes: number;
    resourceName: string;
    allocatedUnits: number;
    pendingExpiresAt: string | null;
  };
  /**
   * Single-purpose tokens returned ONCE at creation time so the customer can
   * manage their appointment immediately (and for Phase 5 email integration).
   * Only SHA-256 hashes are stored in the database.
   */
  tokens?: {
    cancelToken: string;
    rescheduleToken: string;
    expiresAt: string;
  };
}

export type BookingSuccess = CreateBookingSuccess;

export interface BookingFailure {
  ok: false;
  errorCode: BookingErrorCode;
  message: string;
  fieldErrors?: Record<string, string>;
}

export type CreateBookingResult = CreateBookingSuccess | BookingFailure;

export type CancelBookingResult =
  | {
      ok: true;
      referenceCode: string;
      previousStatus: BookingStatus;
      status: BookingStatus;
    }
  | BookingFailure;

export type RescheduleBookingResult =
  | {
      ok: true;
      referenceCode: string;
      status: BookingStatus;
      appointmentDate: string;
      startTimeLocal: string;
      endTimeLocal: string;
      newTokens: {
        cancelToken: string;
        rescheduleToken: string;
        expiresAt: string;
      };
    }
  | BookingFailure;

export type TokenInspectionResult =
  | {
      ok: true;
      purpose: BookingTokenPurpose;
      booking: {
        referenceCode: string;
        status: BookingStatus;
        serviceOptionSlug: string;
        serviceName: string;
        vehicleType: VehicleType;
        vehicleSummary: string;
        appointmentDate: string;
        startTimeLocal: string;
        endTimeLocal: string;
        durationMinutes: number;
      };
    }
  | BookingFailure;
