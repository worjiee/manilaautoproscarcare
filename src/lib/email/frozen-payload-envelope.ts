import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const VERSION = 1 as const;
const ALGORITHM = "aes-256-gcm" as const;

export interface FrozenEmailPayloadV1 {
  version: typeof VERSION;
  eventId: string;
  idempotencyKey: string;
  templateKey: string;
  templateVersion: number;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface FrozenEmailPayloadEnvelopeV1 {
  version: typeof VERSION;
  algorithm: typeof ALGORITHM;
  keyVersion: string;
  nonce: string;
  ciphertext: string;
  authTag: string;
  aadSha256: string;
}

export interface FrozenPayloadBinding {
  eventId: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateKey: string;
  templateVersion: number;
  contentSha256: string;
}

export function hashFrozenEmailPayload(payload: FrozenEmailPayloadV1): string {
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

function aad(binding: FrozenPayloadBinding): Buffer {
  if (
    !/^[0-9a-f-]{36}$/.test(binding.eventId) ||
    !binding.recipientEmail ||
    !binding.idempotencyKey ||
    !/^[a-z0-9._-]{3,100}$/.test(binding.templateKey) ||
    !Number.isSafeInteger(binding.templateVersion) ||
    binding.templateVersion < 1 ||
    !/^[0-9a-f]{64}$/.test(binding.contentSha256)
  ) {
    throw new Error("EMAIL_PAYLOAD_ERROR: Invalid frozen-payload binding.");
  }
  return Buffer.from(
    [
      "manila-auto-pros",
      "email-payload",
      "v1",
      binding.eventId,
      binding.recipientEmail,
      binding.idempotencyKey,
      binding.templateKey,
      String(binding.templateVersion),
      binding.contentSha256,
    ].join(":"),
    "utf8"
  );
}

function assertKey(key: Buffer, keyVersion: string) {
  if (key.length !== 32 || !/^[A-Za-z0-9._-]{1,64}$/.test(keyVersion)) {
    throw new Error("EMAIL_PAYLOAD_ERROR: Invalid encryption key configuration.");
  }
}

export function encryptFrozenEmailPayload(params: {
  payload: FrozenEmailPayloadV1;
  binding: FrozenPayloadBinding;
  key: Buffer;
  keyVersion: string;
}): FrozenEmailPayloadEnvelopeV1 {
  assertKey(params.key, params.keyVersion);
  if (
    params.payload.eventId !== params.binding.eventId ||
    params.payload.to !== params.binding.recipientEmail ||
    params.payload.idempotencyKey !== params.binding.idempotencyKey ||
    params.payload.templateKey !== params.binding.templateKey ||
    params.payload.templateVersion !== params.binding.templateVersion ||
    hashFrozenEmailPayload(params.payload) !== params.binding.contentSha256
  ) {
    throw new Error("EMAIL_PAYLOAD_ERROR: Payload does not match its binding.");
  }
  const additionalData = aad(params.binding);
  const nonce = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, params.key, nonce);
  cipher.setAAD(additionalData);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(params.payload), "utf8"),
    cipher.final(),
  ]);
  return {
    version: VERSION,
    algorithm: ALGORITHM,
    keyVersion: params.keyVersion,
    nonce: nonce.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    aadSha256: createHash("sha256").update(additionalData).digest("hex"),
  };
}

export function decryptFrozenEmailPayload(params: {
  envelope: FrozenEmailPayloadEnvelopeV1;
  binding: FrozenPayloadBinding;
  key: Buffer;
  expectedKeyVersion: string;
}): FrozenEmailPayloadV1 {
  assertKey(params.key, params.expectedKeyVersion);
  if (
    params.envelope.version !== VERSION ||
    params.envelope.algorithm !== ALGORITHM ||
    params.envelope.keyVersion !== params.expectedKeyVersion
  ) {
    throw new Error("EMAIL_PAYLOAD_ERROR: Envelope metadata is invalid.");
  }
  const additionalData = aad(params.binding);
  const actual = Buffer.from(createHash("sha256").update(additionalData).digest("hex"));
  const expected = Buffer.from(params.envelope.aadSha256);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("EMAIL_PAYLOAD_ERROR: Envelope binding is invalid.");
  }
  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      params.key,
      Buffer.from(params.envelope.nonce, "base64url")
    );
    decipher.setAAD(additionalData);
    decipher.setAuthTag(Buffer.from(params.envelope.authTag, "base64url"));
    const payload = JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(params.envelope.ciphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8")
    ) as FrozenEmailPayloadV1;
    if (
      payload.version !== VERSION ||
      payload.eventId !== params.binding.eventId ||
      payload.to !== params.binding.recipientEmail ||
      payload.idempotencyKey !== params.binding.idempotencyKey ||
      payload.templateKey !== params.binding.templateKey ||
      payload.templateVersion !== params.binding.templateVersion ||
      hashFrozenEmailPayload(payload) !== params.binding.contentSha256
    ) {
      throw new Error("binding mismatch");
    }
    return payload;
  } catch {
    throw new Error("EMAIL_PAYLOAD_ERROR: Envelope authentication failed.");
  }
}
