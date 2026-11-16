import { describe, expect, it } from "vitest";
import { renderBookingNotification } from "../templates/booking-notifications";
import type { BookingEmailTemplateDataV1, EmailEventType } from "../types";

const events: Array<[EmailEventType, BookingEmailTemplateDataV1["bookingStatus"]]> = [
  ["booking.request_received", "pending"],
  ["booking.confirmed", "confirmed"],
  ["booking.rejected", "rejected"],
  ["booking.cancelled", "cancelled"],
  ["booking.rescheduled", "confirmed"],
  ["booking.pending_expired", "expired"],
  ["admin.new_pending_booking", "pending"],
];

function data(eventType: EmailEventType, bookingStatus: BookingEmailTemplateDataV1["bookingStatus"]): BookingEmailTemplateDataV1 {
  return {
    version: 1,
    eventType,
    recipientKind: eventType.startsWith("admin.") ? "admin" : "customer",
    bookingReference: "MAP-20261116-TEMPLATE",
    serviceName: "Premium Detail",
    vehicleSummary: "2024 Toyota Corolla",
    appointmentDate: "2026-11-20",
    startTimeLocal: "09:00:00",
    endTimeLocal: "11:00:00",
    bookingStatus,
    customerFirstName: "Alex",
    cancelUrl: "https://example.test/booking/manage#token=cancel-secret&action=cancel",
    rescheduleUrl: "https://example.test/booking/manage#token=reschedule-secret&action=reschedule",
    adminUrl: eventType.startsWith("admin.") ? "https://example.test/admin/bookings" : undefined,
  };
}

describe("booking notification templates", () => {
  it.each(events)("renders %s with Manila-local booking facts", async (eventType, status) => {
    const email = await renderBookingNotification(data(eventType, status));
    expect(email.subject).toContain("MAP-20261116-TEMPLATE");
    expect(email.html).toContain("Premium Detail");
    expect(email.html).toContain("Friday, November 20, 2026");
    expect(email.html).toContain("9:00 AM");
    expect(email.html).toContain(status);
    expect(email.text).not.toContain("undefined");
  });

  it("does not add management tokens unless links are explicitly supplied", async () => {
    const input = data("booking.pending_expired", "expired");
    delete input.cancelUrl;
    delete input.rescheduleUrl;
    const email = await renderBookingNotification(input);
    expect(email.html).not.toContain("#token=");
    expect(email.text).not.toContain("secret");
  });
});
