import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const MANAGEMENT_LINK_ENVELOPE_VERSION = 1 as const;
export const MANAGEMENT_LINK_ALGORITHM = "aes-256-gcm" as const;

export interface ManagementLinkSecrets {
  cancelToken: string;
  rescheduleToken: string;
  expiresAt: string;
}

export interface ManagementLinkBinding {
  tokenVersion: number;
  cancelTokenHash: string;
  rescheduleTokenHash: string;
}

export interface EncryptedManagementLinkEnvelopeV1 {
  version: typeof MANAGEMENT_LINK_ENVELOPE_VERSION;
  algorithm: typeof MANAGEMENT_LINK_ALGORITHM;
  keyVersion: string;
  tokenVersion: number;
  nonce: string;
  ciphertext: string;
  authTag: string;
  aadSha256: string;
  expiresAt: string;
}

function assertBinding(binding: ManagementLinkBinding): void {
  if (
    !Number.isSafeInteger(binding.tokenVersion) ||
    binding.tokenVersion < 1 ||
    !/^[0-9a-f]{64}$/.test(binding.cancelTokenHash) ||
    !/^[0-9a-f]{64}$/.test(binding.rescheduleTokenHash)
  ) {
    throw new Error("EMAIL_ENVELOPE_ERROR: Invalid booking-token binding.");
  }
}

function assertKey(key: Buffer, keyVersion: string): void {
  if (key.length !== 32 || !/^[A-Za-z0-9._-]{1,64}$/.test(keyVersion)) {
    throw new Error("EMAIL_ENVELOPE_ERROR: Invalid encryption key configuration.");
  }
}

function buildAdditionalAuthenticatedData(binding: ManagementLinkBinding): Buffer {
  assertBinding(binding);
  return Buffer.from(
    [
      "manila-auto-pros",
      "booking-links",
      "v1",
      String(binding.tokenVersion),
      binding.cancelTokenHash,
      binding.rescheduleTokenHash,
    ].join(":"),
    "utf8"
  );
}

function hashRawToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function encryptManagementLinkSecrets(params: {
  secrets: ManagementLinkSecrets;
  binding: ManagementLinkBinding;
  key: Buffer;
  keyVersion: string;
}): EncryptedManagementLinkEnvelopeV1 {
  assertKey(params.key, params.keyVersion);
  const { secrets, binding } = params;
  if (
    hashRawToken(secrets.cancelToken) !== binding.cancelTokenHash ||
    hashRawToken(secrets.rescheduleToken) !== binding.rescheduleTokenHash ||
    !Number.isFinite(Date.parse(secrets.expiresAt))
  ) {
    throw new Error(
      "EMAIL_ENVELOPE_ERROR: Plaintext tokens do not match the authenticated binding."
    );
  }

  const aad = buildAdditionalAuthenticatedData(binding);
  const nonce = randomBytes(12);
  const cipher = createCipheriv(MANAGEMENT_LINK_ALGORITHM, params.key, nonce);
  cipher.setAAD(aad);
  const plaintext = Buffer.from(JSON.stringify(secrets), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    version: MANAGEMENT_LINK_ENVELOPE_VERSION,
    algorithm: MANAGEMENT_LINK_ALGORITHM,
    keyVersion: params.keyVersion,
    tokenVersion: binding.tokenVersion,
    nonce: nonce.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    aadSha256: createHash("sha256").update(aad).digest("hex"),
    expiresAt: secrets.expiresAt,
  };
}

export function decryptManagementLinkSecrets(params: {
  envelope: EncryptedManagementLinkEnvelopeV1;
  binding: ManagementLinkBinding;
  key: Buffer;
  expectedKeyVersion: string;
}): ManagementLinkSecrets {
  assertKey(params.key, params.expectedKeyVersion);
  const { envelope, binding } = params;
  if (
    envelope.version !== MANAGEMENT_LINK_ENVELOPE_VERSION ||
    envelope.algorithm !== MANAGEMENT_LINK_ALGORITHM ||
    envelope.keyVersion !== params.expectedKeyVersion ||
    envelope.tokenVersion !== binding.tokenVersion
  ) {
    throw new Error("EMAIL_ENVELOPE_ERROR: Envelope metadata is invalid.");
  }

  const aad = buildAdditionalAuthenticatedData(binding);
  const actualAadHash = Buffer.from(
    createHash("sha256").update(aad).digest("hex"),
    "utf8"
  );
  const expectedAadHash = Buffer.from(envelope.aadSha256, "utf8");
  if (
    actualAadHash.length !== expectedAadHash.length ||
    !timingSafeEqual(actualAadHash, expectedAadHash)
  ) {
    throw new Error("EMAIL_ENVELOPE_ERROR: Envelope binding is invalid.");
  }

  try {
    const decipher = createDecipheriv(
      MANAGEMENT_LINK_ALGORITHM,
      params.key,
      Buffer.from(envelope.nonce, "base64url")
    );
    decipher.setAAD(aad);
    decipher.setAuthTag(Buffer.from(envelope.authTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const secrets = JSON.parse(plaintext) as ManagementLinkSecrets;

    if (
      hashRawToken(secrets.cancelToken) !== binding.cancelTokenHash ||
      hashRawToken(secrets.rescheduleToken) !== binding.rescheduleTokenHash ||
      secrets.expiresAt !== envelope.expiresAt
    ) {
      throw new Error("Decrypted values do not match the binding.");
    }
    return secrets;
  } catch {
    throw new Error("EMAIL_ENVELOPE_ERROR: Envelope authentication failed.");
  }
}

