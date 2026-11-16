import { Button, Hr, Section, Text } from "react-email";
import { render } from "@react-email/render";

import type {
  BookingEmailTemplateDataV1,
  EmailEventType,
  RenderedBookingEmail,
} from "../types";
import { BookingEmailShell } from "./booking-email-shell";

const MANILA_TIME_ZONE = "Asia/Manila";

const copy: Record<
  EmailEventType,
  { eyebrow: string; title: string; preview: string; subject: string; message: string }
> = {
  "booking.request_received": {
    eyebrow: "Request received",
    title: "We received your booking request",
    preview: "Your Manila Auto Pros booking request is awaiting review.",
    subject: "Booking request received",
    message: "Your request is pending review. This is not yet a confirmed appointment.",
  },
  "booking.confirmed": {
    eyebrow: "Appointment confirmed",
    title: "Your appointment is confirmed",
    preview: "Your Manila Auto Pros appointment has been confirmed.",
    subject: "Booking confirmed",
    message: "Your appointment is confirmed. We look forward to seeing you.",
  },
  "booking.rejected": {
    eyebrow: "Request update",
    title: "We could not confirm your request",
    preview: "An update about your Manila Auto Pros booking request.",
    subject: "Booking request not confirmed",
    message: "Unfortunately, we could not confirm this booking request.",
  },
  "booking.cancelled": {
    eyebrow: "Appointment cancelled",
    title: "Your booking was cancelled",
    preview: "Your Manila Auto Pros booking has been cancelled.",
    subject: "Booking cancelled",
    message: "This booking is cancelled and no longer reserves an appointment slot.",
  },
  "booking.rescheduled": {
    eyebrow: "Appointment rescheduled",
    title: "Your appointment has a new schedule",
    preview: "Your Manila Auto Pros appointment schedule was updated.",
    subject: "Booking rescheduled",
    message: "Your appointment has been moved to the schedule shown below.",
  },
  "booking.pending_expired": {
    eyebrow: "Request expired",
    title: "Your booking request expired",
    preview: "Your pending Manila Auto Pros booking request has expired.",
    subject: "Booking request expired",
    message: "This pending request expired before it was confirmed and no longer holds a slot.",
  },
  "admin.new_pending_booking": {
    eyebrow: "Admin notification",
    title: "A booking request needs review",
    preview: "A new Manila Auto Pros booking request is pending.",
    subject: "New pending booking request",
    message: "A new customer request is waiting for an administrator decision.",
  },
};

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIME_ZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00+08:00`));
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const marker = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${marker}`;
}

function BookingNotification({ data }: { data: BookingEmailTemplateDataV1 }) {
  const content = copy[data.eventType];
  return (
    <BookingEmailShell
      preview={content.preview}
      eyebrow={content.eyebrow}
      title={content.title}
    >
      {data.customerFirstName ? (
        <Text style={styles.text}>Hi {data.customerFirstName},</Text>
      ) : null}
      <Text style={styles.text}>{content.message}</Text>
      <Section style={styles.details}>
        <Text style={styles.detail}><strong>Reference:</strong> {data.bookingReference}</Text>
        <Text style={styles.detail}><strong>Service:</strong> {data.serviceName}</Text>
        <Text style={styles.detail}><strong>Vehicle:</strong> {data.vehicleSummary}</Text>
        <Text style={styles.detail}>
          <strong>Schedule:</strong> {formatDate(data.appointmentDate)}, {formatTime(data.startTimeLocal)}–{formatTime(data.endTimeLocal)}
        </Text>
        <Text style={styles.detail}><strong>Status:</strong> {data.bookingStatus}</Text>
      </Section>
      {data.rescheduleUrl || data.cancelUrl || data.adminUrl ? <Hr style={styles.rule} /> : null}
      {data.rescheduleUrl ? <Button style={styles.primaryButton} href={data.rescheduleUrl}>Manage or reschedule</Button> : null}
      {data.cancelUrl ? <Button style={styles.secondaryButton} href={data.cancelUrl}>Cancel booking</Button> : null}
      {data.adminUrl ? <Button style={styles.primaryButton} href={data.adminUrl}>Review in admin dashboard</Button> : null}
      {(data.rescheduleUrl || data.cancelUrl) ? (
        <Text style={styles.securityNote}>These private links expire and should not be forwarded.</Text>
      ) : null}
    </BookingEmailShell>
  );
}

export async function renderBookingNotification(
  data: BookingEmailTemplateDataV1
): Promise<RenderedBookingEmail> {
  if (data.version !== 1 || !copy[data.eventType]) {
    throw new Error("EMAIL_TEMPLATE_ERROR: Unsupported template data.");
  }
  const element = <BookingNotification data={data} />;
  const subject = `[${data.bookingReference}] ${copy[data.eventType].subject}`;
  return {
    subject,
    html: await render(element),
    text: await render(element, { plainText: true }),
  };
}

const styles = {
  text: { color: "#E5E5E5", fontSize: "15px", lineHeight: "1.65", margin: "0 0 16px" },
  details: { backgroundColor: "#0B0B0B", borderLeft: "3px solid #E11D2E", padding: "14px 18px" },
  detail: { color: "#F5F5F5", fontSize: "14px", lineHeight: "1.55", margin: "4px 0" },
  rule: { borderColor: "#292929", margin: "24px 0" },
  primaryButton: { backgroundColor: "#E11D2E", color: "#FFFFFF", fontSize: "14px", fontWeight: "700", margin: "0 10px 10px 0", padding: "12px 18px", textDecoration: "none" },
  secondaryButton: { backgroundColor: "#2A2A2A", color: "#FFFFFF", fontSize: "14px", fontWeight: "700", margin: "0 0 10px", padding: "12px 18px", textDecoration: "none" },
  securityNote: { color: "#A3A3A3", fontSize: "11px", lineHeight: "1.5", margin: "12px 0 0" },
} as const;
