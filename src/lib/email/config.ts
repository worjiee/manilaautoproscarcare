import "server-only";

import type { EmailDeliveryMode } from "./types";

const SIMPLE_EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const FROM_EMAIL_PATTERN = /^(?:[^\r\n<>]{1,100}\s+<)?([^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)>?$/;

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export type DisabledEmailConfig = {
  mode: "disabled";
  enabled: false;
};

export type EnabledEmailConfig = {
  mode: Exclude<EmailDeliveryMode, "disabled">;
  enabled: true;
  resendApiKey: string;
  resendFromEmail: string;
  adminNotificationEmails: readonly string[];
  resendWebhookSecret: string;
  dispatchSecret: string;
  siteUrl: string;
  testRecipient: string | null;
  tokenEncryptionKey: Buffer;
  tokenEncryptionKeyVersion: string;
  tokenDecryptionKeys: ReadonlyMap<string, Buffer>;
};

export type EmailConfig = DisabledEmailConfig | EnabledEmailConfig;

function requireValue(env: EnvironmentSource, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`EMAIL_CONFIGURATION_ERROR: ${name} is required.`);
  }
  return value;
}

function parseEmail(value: string, name: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length > 254 ||
    !SIMPLE_EMAIL_PATTERN.test(normalized) ||
    /[\r\n]/.test(normalized)
  ) {
    throw new Error(`EMAIL_CONFIGURATION_ERROR: ${name} is not a valid email address.`);
  }
  return normalized;
}

function parseFromEmail(value: string): string {
  const trimmed = value.trim();
  const match = FROM_EMAIL_PATTERN.exec(trimmed);
  if (!match || trimmed.length > 320 || /[\r\n]/.test(trimmed)) {
    throw new Error("EMAIL_CONFIGURATION_ERROR: RESEND_FROM_EMAIL is invalid.");
  }
  parseEmail(match[1], "RESEND_FROM_EMAIL");
  return trimmed;
}

function parseEncryptionKey(value: string): Buffer {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    throw new Error(
      "EMAIL_CONFIGURATION_ERROR: EMAIL_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key."
    );
  }
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) {
    throw new Error(
      "EMAIL_CONFIGURATION_ERROR: EMAIL_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes."
    );
  }
  return key;
}

function parsePreviousEncryptionKeys(
  rawValue: string | undefined,
  currentVersion: string,
  currentKey: Buffer
): ReadonlyMap<string, Buffer> {
  const keys = new Map<string, Buffer>([[currentVersion, currentKey]]);
  if (!rawValue?.trim()) return keys;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error(
      "EMAIL_CONFIGURATION_ERROR: EMAIL_TOKEN_ENCRYPTION_PREVIOUS_KEYS must be a JSON object."
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      "EMAIL_CONFIGURATION_ERROR: EMAIL_TOKEN_ENCRYPTION_PREVIOUS_KEYS must be a JSON object."
    );
  }

  for (const [version, encodedKey] of Object.entries(parsed)) {
    if (
      !/^[A-Za-z0-9._-]{1,64}$/.test(version) ||
      version === currentVersion ||
      typeof encodedKey !== "string"
    ) {
      throw new Error(
        "EMAIL_CONFIGURATION_ERROR: Previous encryption key metadata is invalid."
      );
    }
    keys.set(version, parseEncryptionKey(encodedKey));
  }
  return keys;
}

export function readEmailConfig(
  env: EnvironmentSource = process.env
): EmailConfig {
  const rawMode = env.EMAIL_DELIVERY_MODE?.trim() || "disabled";
  if (!(["disabled", "development", "production"] as const).includes(
    rawMode as EmailDeliveryMode
  )) {
    throw new Error(
      "EMAIL_CONFIGURATION_ERROR: EMAIL_DELIVERY_MODE must be disabled, development, or production."
    );
  }

  const mode = rawMode as EmailDeliveryMode;
  if (mode === "disabled") {
    return { mode, enabled: false };
  }

  const resendApiKey = requireValue(env, "RESEND_API_KEY");
  if (!/^re_[A-Za-z0-9_-]{16,}$/.test(resendApiKey)) {
    throw new Error("EMAIL_CONFIGURATION_ERROR: RESEND_API_KEY has an invalid format.");
  }

  const resendWebhookSecret = requireValue(env, "RESEND_WEBHOOK_SECRET");
  if (!/^whsec_[A-Za-z0-9_-]{16,}$/.test(resendWebhookSecret)) {
    throw new Error(
      "EMAIL_CONFIGURATION_ERROR: RESEND_WEBHOOK_SECRET has an invalid format."
    );
  }

  const dispatchSecret = requireValue(env, "EMAIL_DISPATCH_SECRET");
  if (dispatchSecret.length < 32) {
    throw new Error(
      "EMAIL_CONFIGURATION_ERROR: EMAIL_DISPATCH_SECRET must contain at least 32 characters."
    );
  }

  const rawAdminEmails = requireValue(env, "RESEND_ADMIN_NOTIFICATION_EMAILS")
    .split(",")
    .map((value) => parseEmail(value, "RESEND_ADMIN_NOTIFICATION_EMAILS"));
  const adminNotificationEmails = [...new Set(rawAdminEmails)];
  if (adminNotificationEmails.length === 0 || adminNotificationEmails.length > 10) {
    throw new Error(
      "EMAIL_CONFIGURATION_ERROR: Configure between one and ten administrator recipients."
    );
  }

  const rawSiteUrl = requireValue(env, "NEXT_PUBLIC_SITE_URL");
  let siteUrl: URL;
  try {
    siteUrl = new URL(rawSiteUrl);
  } catch {
    throw new Error("EMAIL_CONFIGURATION_ERROR: NEXT_PUBLIC_SITE_URL is invalid.");
  }
  if (
    !["http:", "https:"].includes(siteUrl.protocol) ||
    (mode === "production" && siteUrl.protocol !== "https:")
  ) {
    throw new Error(
      "EMAIL_CONFIGURATION_ERROR: Production email links require an HTTPS site URL."
    );
  }

  const testRecipient =
    mode === "development"
      ? parseEmail(requireValue(env, "EMAIL_TEST_RECIPIENT"), "EMAIL_TEST_RECIPIENT")
      : null;

  const tokenEncryptionKeyVersion = requireValue(
    env,
    "EMAIL_TOKEN_ENCRYPTION_KEY_VERSION"
  );
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(tokenEncryptionKeyVersion)) {
    throw new Error(
      "EMAIL_CONFIGURATION_ERROR: EMAIL_TOKEN_ENCRYPTION_KEY_VERSION is invalid."
    );
  }

  const tokenEncryptionKey = parseEncryptionKey(
    requireValue(env, "EMAIL_TOKEN_ENCRYPTION_KEY")
  );

  return {
    mode,
    enabled: true,
    resendApiKey,
    resendFromEmail: parseFromEmail(
      requireValue(env, "RESEND_FROM_EMAIL")
    ),
    adminNotificationEmails,
    resendWebhookSecret,
    dispatchSecret,
    siteUrl: siteUrl.toString().replace(/\/$/, ""),
    testRecipient,
    tokenEncryptionKey,
    tokenEncryptionKeyVersion,
    tokenDecryptionKeys: parsePreviousEncryptionKeys(
      env.EMAIL_TOKEN_ENCRYPTION_PREVIOUS_KEYS,
      tokenEncryptionKeyVersion,
      tokenEncryptionKey
    ),
  };
}

export function resolveDeliveryRecipients(
  requestedRecipients: readonly string[],
  config: EnabledEmailConfig
): readonly string[] {
  if (config.mode === "development") {
    return [config.testRecipient!];
  }
  return [...new Set(requestedRecipients.map((email) => parseEmail(email, "recipient")))];
}

