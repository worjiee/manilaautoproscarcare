export const EMAIL_EVENT_TYPES = [
  "booking.request_received",
  "booking.confirmed",
  "booking.rejected",
  "booking.cancelled",
  "booking.rescheduled",
  "booking.pending_expired",
  "admin.new_pending_booking",
] as const;

export type EmailEventType = (typeof EMAIL_EVENT_TYPES)[number];
export type EmailRecipientKind = "customer" | "admin";
export type EmailDeliveryMode = "disabled" | "development" | "production";

export const EMAIL_TEMPLATE_VERSION = 1 as const;

export interface BookingEmailTemplateDataV1 {
  version: typeof EMAIL_TEMPLATE_VERSION;
  eventType: EmailEventType;
  recipientKind: EmailRecipientKind;
  bookingReference: string;
  serviceName: string;
  vehicleSummary: string;
  appointmentDate: string;
  startTimeLocal: string;
  endTimeLocal: string;
  bookingStatus:
    | "pending"
    | "confirmed"
    | "rejected"
    | "expired"
    | "cancelled"
    | "completed";
  customerFirstName?: string;
  manageUrl?: string;
  adminUrl?: string;
}

export interface VersionedEmailTemplate<TData> {
  readonly key: EmailEventType;
  readonly version: number;
  readonly subject: (data: TData) => string;
  readonly render: (data: TData) => React.ReactElement;
}

