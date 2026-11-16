import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getRequiredSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { readEmailConfig, resolveDeliveryRecipients, type EnabledEmailConfig } from "./config";
import {
  decryptManagementLinkSecrets,
  type EncryptedManagementLinkEnvelopeV1,
} from "./management-link-envelope";
import { getResendClient } from "./resend-client";
import { renderBookingNotification } from "./templates/booking-notifications";
import type { BookingEmailTemplateDataV1, EmailEventType, RenderedBookingEmail } from "./types";
import {
  decryptFrozenEmailPayload,
  encryptFrozenEmailPayload,
  hashFrozenEmailPayload,
  type FrozenEmailPayloadEnvelopeV1,
  type FrozenEmailPayloadV1,
} from "./frozen-payload-envelope";

const CUSTOMER_LINK_EVENTS = new Set<EmailEventType>([
  "booking.request_received",
  "booking.confirmed",
  "booking.rescheduled",
]);

type DeliverySecret = EncryptedManagementLinkEnvelopeV1 & {
  cancelTokenHash: string;
  rescheduleTokenHash: string;
};

export interface ClaimedEmailWork {
  eventId: string;
  leaseToken?: string;
  deliveryId?: string;
  attemptNumber?: number;
  recipientEmail?: string;
  idempotencyKey?: string;
  contentSha256?: string;
  payloadEnvelope?: FrozenEmailPayloadEnvelopeV1;
  eventType: EmailEventType;
  recipientKind: "customer" | "admin";
  templateKey?: string;
  templateVersion: number;
  bookingStatus: BookingEmailTemplateDataV1["bookingStatus"];
  appointmentDate: string;
  startTimeLocal: string;
  endTimeLocal: string;
  bookingReference: string;
  customerName: string;
  customerEmail?: string;
  serviceName: string;
  vehicleSummary: string;
  deliverySecret: DeliverySecret | null;
}

export interface EmailProviderResult {
  outcome: "accepted" | "retryable_failure" | "permanent_failure" | "ambiguous";
  messageId?: string;
  responseCode?: number;
  errorCode?: string;
  retryAfterSeconds?: number;
}

export interface EmailProvider {
  send(input: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    idempotencyKey: string;
  }): Promise<EmailProviderResult>;
}

type RpcClient = Pick<SupabaseClient, "rpc">;

function errorCode(value: unknown, fallback: string): string {
  const normalized = String(value ?? fallback).toUpperCase().replace(/[^A-Z0-9_:-]/g, "_");
  return normalized.slice(0, 100) || fallback;
}

function getStatusCode(value: unknown): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = "statusCode" in value ? Number(value.statusCode) : undefined;
  return candidate && candidate >= 100 && candidate <= 599 ? candidate : undefined;
}

function readRetryAfterValue(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if ("retryAfter" in value && typeof value.retryAfter === "string") return value.retryAfter;
  if (!("headers" in value) || !value.headers) return null;
  const headers = value.headers;
  if (headers instanceof Headers) return headers.get("retry-after");
  if (typeof headers === "object") {
    const record = headers as Record<string, unknown>;
    const candidate = record["retry-after"] ?? record["Retry-After"];
    return typeof candidate === "string" ? candidate : null;
  }
  return null;
}

export function parseRetryAfterSeconds(value: unknown, now = Date.now()): number | undefined {
  const raw = readRetryAfterValue(value)?.trim();
  if (!raw) return undefined;
  if (/^\d+$/.test(raw)) return Math.min(Math.max(Number(raw), 10), 86_400);
  const date = Date.parse(raw);
  if (!Number.isFinite(date)) return undefined;
  return Math.min(Math.max(Math.ceil((date - now) / 1000), 10), 86_400);
}

export function boundedRetryDelay(attemptNumber: number, providerDelay?: number): number {
  const exponent = Math.min(Math.max(attemptNumber - 1, 0), 11);
  const exponential = Math.min(30 * 2 ** exponent, 21_600);
  return Math.min(Math.max(exponential, providerDelay ?? 0, 10), 86_400);
}

export function classifyProviderError(value: unknown): EmailProviderResult {
  const status = getStatusCode(value);
  const retryAfter = parseRetryAfterSeconds(value);
  return {
    outcome: status === 408 || status === 429 || (status !== undefined && status >= 500)
      ? "retryable_failure"
      : "permanent_failure",
    responseCode: status,
    errorCode: errorCode(
      value && typeof value === "object" && "name" in value ? value.name : null,
      "RESEND_REJECTED"
    ),
    retryAfterSeconds: retryAfter,
  };
}

export function createResendEmailProvider(): EmailProvider {
  return {
    async send(input) {
      const resend = getResendClient();
      if (!resend) return { outcome: "permanent_failure", errorCode: "EMAIL_DISABLED" };
      try {
        const response = await resend.emails.send(
          {
            from: input.from,
            to: [input.to],
            subject: input.subject,
            html: input.html,
            text: input.text,
          },
          { idempotencyKey: input.idempotencyKey }
        );
        if (response.error) {
          return classifyProviderError(response.error);
        }
        return response.data?.id
          ? { outcome: "accepted", messageId: response.data.id, responseCode: 200 }
          : { outcome: "ambiguous", errorCode: "RESEND_AMBIGUOUS_RESPONSE", retryAfterSeconds: 60 };
      } catch (error) {
        return {
          outcome: "ambiguous",
          errorCode: errorCode(error instanceof Error ? error.name : null, "RESEND_NETWORK_ERROR"),
          retryAfterSeconds: 60,
        };
      }
    },
  };
}

function requireWorkArray(value: unknown): ClaimedEmailWork[] {
  if (!Array.isArray(value)) throw new Error("EMAIL_DISPATCH_ERROR: Invalid claim response.");
  return value as ClaimedEmailWork[];
}

function managementUrls(work: ClaimedEmailWork, config: EnabledEmailConfig) {
  if (!CUSTOMER_LINK_EVENTS.has(work.eventType)) return {};
  const secret = work.deliverySecret;
  if (!secret) throw new Error("EMAIL_LINK_ERROR: Active management envelope is unavailable.");
  const key = config.tokenDecryptionKeys.get(secret.keyVersion);
  if (!key) throw new Error("EMAIL_LINK_ERROR: Encryption key version is unavailable.");
  const tokens = decryptManagementLinkSecrets({
    envelope: secret,
    binding: {
      tokenVersion: secret.tokenVersion,
      cancelTokenHash: secret.cancelTokenHash,
      rescheduleTokenHash: secret.rescheduleTokenHash,
    },
    key,
    expectedKeyVersion: secret.keyVersion,
  });
  if (Date.parse(tokens.expiresAt) <= Date.now()) {
    throw new Error("EMAIL_LINK_ERROR: Management envelope has expired.");
  }
  return {
    cancelUrl: `${config.siteUrl}/booking/manage#token=${encodeURIComponent(tokens.cancelToken)}&action=cancel`,
    rescheduleUrl: `${config.siteUrl}/booking/manage#token=${encodeURIComponent(tokens.rescheduleToken)}&action=reschedule`,
  };
}

async function renderWork(work: ClaimedEmailWork, config: EnabledEmailConfig): Promise<RenderedBookingEmail> {
  if (work.templateVersion !== 1) throw new Error("EMAIL_TEMPLATE_ERROR: Unsupported version.");
  const firstName = work.customerName.trim().split(/\s+/)[0];
  return renderBookingNotification({
    version: 1,
    eventType: work.eventType,
    recipientKind: work.recipientKind,
    bookingReference: work.bookingReference,
    serviceName: work.serviceName,
    vehicleSummary: work.vehicleSummary,
    appointmentDate: work.appointmentDate,
    startTimeLocal: work.startTimeLocal,
    endTimeLocal: work.endTimeLocal,
    bookingStatus: work.bookingStatus,
    customerFirstName: work.recipientKind === "customer" ? firstName : undefined,
    adminUrl: work.recipientKind === "admin" ? `${config.siteUrl}/admin/bookings` : undefined,
    ...managementUrls(work, config),
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableIdempotencyKey(eventId: string, recipient: string): string {
  return `map-email-v1:${eventId}:${sha256(recipient).slice(0, 24)}`;
}

async function invoke(client: RpcClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`EMAIL_DATABASE_ERROR: ${name}: ${error.code ?? "RPC_FAILED"}`);
  return data;
}

async function materializePendingEvents(client: RpcClient, config: EnabledEmailConfig, limit: number) {
  const claimed = requireWorkArray(await invoke(client, "claim_email_outbox_events_atomic", {
    p_limit: limit,
    p_lease_seconds: 180,
  }));
  let materialized = 0;
  for (const work of claimed) {
    try {
      const rendered = await renderWork(work, config);
      const requested = work.recipientKind === "admin"
        ? config.adminNotificationEmails
        : [work.customerEmail!];
      const recipients = resolveDeliveryRecipients(requested, config);
      const deliveries = recipients.map((recipientEmail) => ({
        recipientEmail,
        idempotencyKey: stableIdempotencyKey(work.eventId, recipientEmail),
      })).map(({ recipientEmail, idempotencyKey }) => {
        const payload: FrozenEmailPayloadV1 = {
          version: 1,
          eventId: work.eventId,
          idempotencyKey,
          templateKey: work.eventType,
          templateVersion: 1,
          from: config.resendFromEmail,
          to: recipientEmail,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        };
        const contentSha256 = hashFrozenEmailPayload(payload);
        return {
          recipient_email: recipientEmail,
          idempotency_key: idempotencyKey,
          template_key: work.eventType,
          template_version: 1,
          content_sha256: contentSha256,
          payload_envelope: encryptFrozenEmailPayload({
            payload,
            binding: {
              eventId: work.eventId,
              recipientEmail,
              idempotencyKey,
              templateKey: work.eventType,
              templateVersion: 1,
              contentSha256,
            },
            key: config.tokenEncryptionKey,
            keyVersion: config.tokenEncryptionKeyVersion,
          }),
        };
      });
      await invoke(client, "materialize_email_outbox_event_atomic", {
        p_event_id: work.eventId,
        p_lease_token: work.leaseToken,
        p_deliveries: deliveries,
      });
      materialized += 1;
    } catch (error) {
      await invoke(client, "release_email_outbox_event_atomic", {
        p_event_id: work.eventId,
        p_lease_token: work.leaseToken,
        p_error_code: errorCode(error instanceof Error ? error.message.split(":")[0] : null, "MATERIALIZATION_FAILED"),
        p_retry_after_seconds: 300,
      });
    }
  }
  return materialized;
}

export async function dispatchEmailBatch(options: {
  client?: RpcClient;
  provider?: EmailProvider;
  limit?: number;
} = {}) {
  const config = readEmailConfig();
  if (!config.enabled) return { enabled: false, materialized: 0, accepted: 0, retried: 0, failed: 0 };

  const client = options.client ?? getRequiredSupabaseServiceRoleClient();
  const provider = options.provider ?? createResendEmailProvider();
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
  const materialized = await materializePendingEvents(client, config, limit);
  const claimed = requireWorkArray(await invoke(client, "claim_email_deliveries_atomic", {
    p_limit: limit,
    p_lease_seconds: 180,
  }));
  let accepted = 0;
  let retried = 0;
  let failed = 0;

  for (const work of claimed) {
    let result: EmailProviderResult;
    try {
      if (!work.payloadEnvelope) throw new Error("EMAIL_PAYLOAD_ERROR: Frozen payload is unavailable.");
      const key = config.tokenDecryptionKeys.get(work.payloadEnvelope.keyVersion);
      if (!key) throw new Error("EMAIL_PAYLOAD_ERROR: Frozen payload key is unavailable.");
      const payload = decryptFrozenEmailPayload({
        envelope: work.payloadEnvelope,
        binding: {
          eventId: work.eventId,
          recipientEmail: work.recipientEmail!,
          idempotencyKey: work.idempotencyKey!,
          templateKey: work.templateKey!,
          templateVersion: work.templateVersion,
          contentSha256: work.contentSha256!,
        },
        key,
        expectedKeyVersion: work.payloadEnvelope.keyVersion,
      });
      result = await provider.send({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        idempotencyKey: payload.idempotencyKey,
      });
    } catch (error) {
      result = {
        outcome: "permanent_failure",
        errorCode: errorCode(error instanceof Error ? error.message.split(":")[0] : null, "RENDER_FAILED"),
      };
    }
    await invoke(client, "record_email_delivery_result_atomic", {
      p_delivery_id: work.deliveryId,
      p_lease_token: work.leaseToken,
      p_outcome: result.outcome,
      p_provider_message_id: result.messageId ?? null,
      p_response_code: result.responseCode ?? null,
      p_error_code: result.errorCode ?? null,
      p_retry_after_seconds: boundedRetryDelay(
        work.attemptNumber ?? 1,
        result.retryAfterSeconds
      ),
    });
    if (result.outcome === "accepted") accepted += 1;
    else if (result.outcome === "retryable_failure" || result.outcome === "ambiguous") retried += 1;
    else failed += 1;
  }
  return { enabled: true, materialized, accepted, retried, failed };
}
