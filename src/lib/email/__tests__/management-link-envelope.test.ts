import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptManagementLinkSecrets,
  encryptManagementLinkSecrets,
} from "../management-link-envelope";

function hash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function fixture() {
  const cancelToken = randomBytes(32).toString("base64url");
  const rescheduleToken = randomBytes(32).toString("base64url");
  return {
    key: randomBytes(32),
    secrets: {
      cancelToken,
      rescheduleToken,
      expiresAt: "2026-12-31T16:00:00.000Z",
    },
    binding: {
      tokenVersion: 1,
      cancelTokenHash: hash(cancelToken),
      rescheduleTokenHash: hash(rescheduleToken),
    },
  };
}

describe("management-link authenticated encryption", () => {
  it("round-trips a token pair without placing plaintext in the envelope", () => {
    const data = fixture();
    const envelope = encryptManagementLinkSecrets({
      ...data,
      keyVersion: "dev-v1",
    });

    const serialized = JSON.stringify(envelope);
    expect(serialized).not.toContain(data.secrets.cancelToken);
    expect(serialized).not.toContain(data.secrets.rescheduleToken);
    expect(envelope.algorithm).toBe("aes-256-gcm");
    expect(envelope.tokenVersion).toBe(1);

    expect(
      decryptManagementLinkSecrets({
        envelope,
        binding: data.binding,
        key: data.key,
        expectedKeyVersion: "dev-v1",
      })
    ).toEqual(data.secrets);
  });

  it("rejects a token pair that does not match its hash binding", () => {
    const data = fixture();
    expect(() =>
      encryptManagementLinkSecrets({
        ...data,
        secrets: { ...data.secrets, cancelToken: "different-token" },
        keyVersion: "dev-v1",
      })
    ).toThrow("Plaintext tokens do not match");
  });

  it("rejects ciphertext tampering and binding substitution", () => {
    const data = fixture();
    const envelope = encryptManagementLinkSecrets({
      ...data,
      keyVersion: "dev-v1",
    });
    const tampered = {
      ...envelope,
      ciphertext: `${envelope.ciphertext.slice(0, -1)}${
        envelope.ciphertext.endsWith("A") ? "B" : "A"
      }`,
    };

    expect(() =>
      decryptManagementLinkSecrets({
        envelope: tampered,
        binding: data.binding,
        key: data.key,
        expectedKeyVersion: "dev-v1",
      })
    ).toThrow("Envelope authentication failed");

    expect(() =>
      decryptManagementLinkSecrets({
        envelope,
        binding: { ...data.binding, tokenVersion: 2 },
        key: data.key,
        expectedKeyVersion: "dev-v1",
      })
    ).toThrow("Envelope metadata is invalid");
  });
});

