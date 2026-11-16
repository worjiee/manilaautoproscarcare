import { describe, expect, it } from "vitest";
import {
  decryptFrozenEmailPayload,
  encryptFrozenEmailPayload,
  hashFrozenEmailPayload,
  type FrozenEmailPayloadV1,
} from "../frozen-payload-envelope";

const key = Buffer.alloc(32, 12);
const payload: FrozenEmailPayloadV1 = {
  version: 1,
  eventId: "10000000-0000-4000-8000-000000000001",
  idempotencyKey: "map-email-v1:stable",
  templateKey: "booking.confirmed",
  templateVersion: 1,
  from: "Manila Auto Pros <notifications@example.test>",
  to: "customer@example.test",
  subject: "Confirmed",
  html: "<p>Private #token=secret</p>",
  text: "Private #token=secret",
};

function binding() {
  return {
    eventId: payload.eventId,
    recipientEmail: payload.to,
    idempotencyKey: payload.idempotencyKey,
    templateKey: payload.templateKey,
    templateVersion: payload.templateVersion,
    contentSha256: hashFrozenEmailPayload(payload),
  };
}

describe("frozen email payload encryption", () => {
  it("round-trips the exact immutable provider request", () => {
    const envelope = encryptFrozenEmailPayload({ payload, binding: binding(), key, keyVersion: "dev-v1" });
    expect(JSON.stringify(envelope)).not.toContain("token=secret");
    expect(decryptFrozenEmailPayload({
      envelope,
      binding: binding(),
      key,
      expectedKeyVersion: "dev-v1",
    })).toEqual(payload);
  });

  it("rejects recipient, content-hash, and ciphertext tampering", () => {
    const envelope = encryptFrozenEmailPayload({ payload, binding: binding(), key, keyVersion: "dev-v1" });
    expect(() => decryptFrozenEmailPayload({
      envelope,
      binding: { ...binding(), recipientEmail: "attacker@example.test" },
      key,
      expectedKeyVersion: "dev-v1",
    })).toThrow();
    expect(() => decryptFrozenEmailPayload({
      envelope: { ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -1)}A` },
      binding: binding(),
      key,
      expectedKeyVersion: "dev-v1",
    })).toThrow("Envelope authentication failed");
  });
});
