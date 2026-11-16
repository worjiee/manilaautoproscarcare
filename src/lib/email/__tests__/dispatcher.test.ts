import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  boundedRetryDelay,
  classifyProviderError,
  dispatchEmailBatch,
  parseRetryAfterSeconds,
  type ClaimedEmailWork,
  type EmailProvider,
} from "../dispatcher";
import {
  encryptFrozenEmailPayload,
  hashFrozenEmailPayload,
  type FrozenEmailPayloadV1,
} from "../frozen-payload-envelope";

const originalEnvironment = { ...process.env };

function configureEmail() {
  Object.assign(process.env, {
    EMAIL_DELIVERY_MODE: "development",
    RESEND_API_KEY: `re_${"a".repeat(24)}`,
    RESEND_FROM_EMAIL: "Manila Auto Pros <notifications@example.test>",
    RESEND_ADMIN_NOTIFICATION_EMAILS: "admin@example.test",
    RESEND_WEBHOOK_SECRET: `whsec_${"b".repeat(24)}`,
    EMAIL_DISPATCH_SECRET: "c".repeat(32),
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    EMAIL_TEST_RECIPIENT: "controlled@example.test",
    EMAIL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    EMAIL_TOKEN_ENCRYPTION_KEY_VERSION: "dev-v1",
  });
}

function work(overrides: Partial<ClaimedEmailWork> = {}): ClaimedEmailWork {
  return {
    eventId: "10000000-0000-4000-8000-000000000001",
    leaseToken: "20000000-0000-4000-8000-000000000001",
    eventType: "booking.cancelled",
    recipientKind: "customer",
    templateKey: "booking.cancelled",
    templateVersion: 1,
    bookingStatus: "cancelled",
    appointmentDate: "2026-11-20",
    startTimeLocal: "09:00:00",
    endTimeLocal: "11:00:00",
    bookingReference: "MAP-TEST-DISPATCH",
    customerName: "Alex Driver",
    customerEmail: "customer@example.test",
    serviceName: "Premium Detail",
    vehicleSummary: "2024 Toyota Corolla",
    deliverySecret: null,
    ...overrides,
  };
}

function frozenDelivery(overrides: Partial<ClaimedEmailWork> = {}): ClaimedEmailWork {
  const base = work({
    deliveryId: "30000000-0000-4000-8000-000000000002",
    recipientEmail: "controlled@example.test",
    idempotencyKey: "map-email-v1:stable",
    templateKey: "booking.cancelled",
    attemptNumber: 1,
    ...overrides,
  });
  const payload: FrozenEmailPayloadV1 = {
    version: 1,
    eventId: base.eventId,
    idempotencyKey: base.idempotencyKey!,
    templateKey: base.templateKey!,
    templateVersion: base.templateVersion,
    from: "Manila Auto Pros <notifications@example.test>",
    to: base.recipientEmail!,
    subject: "Frozen subject",
    html: "<p>Frozen HTML</p>",
    text: "Frozen text",
  };
  const contentSha256 = hashFrozenEmailPayload(payload);
  return {
    ...base,
    contentSha256,
    payloadEnvelope: encryptFrozenEmailPayload({
      payload,
      binding: {
        eventId: base.eventId,
        recipientEmail: base.recipientEmail!,
        idempotencyKey: base.idempotencyKey!,
        templateKey: base.templateKey!,
        templateVersion: base.templateVersion,
        contentSha256,
      },
      key: Buffer.alloc(32, 7),
      keyVersion: "dev-v1",
    }),
  };
}

beforeEach(configureEmail);
afterEach(() => {
  vi.restoreAllMocks();
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnvironment)) delete process.env[key];
  }
  Object.assign(process.env, originalEnvironment);
});

describe("email dispatcher", () => {
  it("uses a stable provider idempotency key and records acceptance", async () => {
    let materialized: Record<string, unknown> | undefined;
    const calls: string[] = [];
    const client = {
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        calls.push(name);
        if (name === "claim_email_outbox_events_atomic") return { data: [work()], error: null };
        if (name === "materialize_email_outbox_event_atomic") {
          materialized = (args.p_deliveries as Array<Record<string, unknown>>)[0];
          return { data: 1, error: null };
        }
        if (name === "claim_email_deliveries_atomic") {
          return { data: [work({
            deliveryId: "30000000-0000-4000-8000-000000000001",
            recipientEmail: String(materialized!.recipient_email),
            idempotencyKey: String(materialized!.idempotency_key),
            contentSha256: String(materialized!.content_sha256),
            templateKey: String(materialized!.template_key),
            attemptNumber: 1,
            payloadEnvelope: materialized!.payload_envelope as ClaimedEmailWork["payloadEnvelope"],
          })], error: null };
        }
        return { data: "accepted", error: null };
      }),
    };
    const send = vi.fn(async (_input: Parameters<EmailProvider["send"]>[0]) => {
      void _input;
      return { outcome: "accepted" as const, messageId: "provider-1", responseCode: 200 };
    });
    const result = await dispatchEmailBatch({ client: client as never, provider: { send }, limit: 1 });
    expect(result).toMatchObject({ accepted: 1, failed: 0 });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].idempotencyKey).toMatch(/^map-email-v1:/);
    expect(send.mock.calls[0][0].to).toBe("controlled@example.test");
    expect(calls.at(-1)).toBe("record_email_delivery_result_atomic");
  });

  it.each([
    ["retryable_failure", "PROVIDER_BUSY"],
    ["ambiguous", "NETWORK_TIMEOUT"],
    ["permanent_failure", "INVALID_RECIPIENT"],
  ] as const)("records %s provider outcomes without throwing", async (outcome, code) => {
    const recorded: Record<string, unknown>[] = [];
    const delivery = frozenDelivery();
    const renderedClient = {
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        if (name === "claim_email_outbox_events_atomic") return { data: [], error: null };
        if (name === "claim_email_deliveries_atomic") {
          return { data: [delivery], error: null };
        }
        recorded.push(args);
        return { data: "retry", error: null };
      }),
    };
    const provider: EmailProvider = { send: vi.fn(async () => ({ outcome, errorCode: code, retryAfterSeconds: 60 })) };
    await dispatchEmailBatch({ client: renderedClient as never, provider, limit: 1 });
    expect(recorded[0]).toMatchObject({ p_outcome: outcome, p_error_code: code });
  });

  it("honors Retry-After and bounded exponential retry delays", () => {
    expect(parseRetryAfterSeconds({ headers: { "retry-after": "240" } })).toBe(240);
    const now = Date.parse("2026-11-16T12:00:00Z");
    expect(parseRetryAfterSeconds({ retryAfter: "Sun, 16 Nov 2026 12:05:00 GMT" }, now)).toBe(300);
    expect(boundedRetryDelay(1)).toBe(30);
    expect(boundedRetryDelay(4)).toBe(240);
    expect(boundedRetryDelay(2, 600)).toBe(600);
    expect(boundedRetryDelay(20)).toBe(21_600);
  });

  it.each([408, 429, 500, 503])("classifies HTTP %i as retryable", (statusCode) => {
    expect(classifyProviderError({ statusCode, name: "provider_error" }).outcome)
      .toBe("retryable_failure");
  });

  it.each([400, 401, 403, 422])("classifies HTTP %i as permanent", (statusCode) => {
    expect(classifyProviderError({ statusCode, name: "provider_error" }).outcome)
      .toBe("permanent_failure");
  });

  it("never sends when an active management envelope is unavailable", async () => {
    const released: Record<string, unknown>[] = [];
    const client = {
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        if (name === "claim_email_outbox_events_atomic") {
          return { data: [work({ eventType: "booking.confirmed", bookingStatus: "confirmed" })], error: null };
        }
        if (name === "release_email_outbox_event_atomic") released.push(args);
        return { data: name === "claim_email_deliveries_atomic" ? [] : "pending", error: null };
      }),
    };
    const provider: EmailProvider = { send: vi.fn() };
    const result = await dispatchEmailBatch({ client: client as never, provider, limit: 1 });
    expect(provider.send).not.toHaveBeenCalled();
    expect(released).toHaveLength(1);
    expect(released[0].p_error_code).toBe("EMAIL_LINK_ERROR");
    expect(result.accepted).toBe(0);
  });
});
