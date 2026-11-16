import { describe, expect, it } from "vitest";
import { readEmailConfig, resolveDeliveryRecipients } from "../config";

const currentKey = Buffer.alloc(32, 7).toString("base64");
const previousKey = Buffer.alloc(32, 9).toString("base64");

function developmentEnvironment() {
  return {
    EMAIL_DELIVERY_MODE: "development",
    RESEND_API_KEY: `re_${"a".repeat(24)}`,
    RESEND_FROM_EMAIL: "Manila Auto Pros <notifications@example.test>",
    RESEND_ADMIN_NOTIFICATION_EMAILS:
      "admin-one@example.test,admin-two@example.test",
    RESEND_WEBHOOK_SECRET: `whsec_${"b".repeat(24)}`,
    EMAIL_DISPATCH_SECRET: "c".repeat(32),
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    EMAIL_TEST_RECIPIENT: "controlled-inbox@example.test",
    EMAIL_TOKEN_ENCRYPTION_KEY: currentKey,
    EMAIL_TOKEN_ENCRYPTION_KEY_VERSION: "dev-v2",
    EMAIL_TOKEN_ENCRYPTION_PREVIOUS_KEYS: JSON.stringify({
      "dev-v1": previousKey,
    }),
  };
}

describe("email configuration", () => {
  it("is disabled by default and requires no secrets", () => {
    expect(readEmailConfig({})).toEqual({ mode: "disabled", enabled: false });
  });

  it("loads enabled configuration and forces the development test recipient", () => {
    const config = readEmailConfig(developmentEnvironment());
    expect(config.enabled).toBe(true);
    if (!config.enabled) throw new Error("Expected enabled configuration");

    expect(config.tokenEncryptionKey).toHaveLength(32);
    expect(config.tokenDecryptionKeys.get("dev-v1")).toEqual(
      Buffer.from(previousKey, "base64")
    );
    expect(
      resolveDeliveryRecipients(["customer@example.com"], config)
    ).toEqual(["controlled-inbox@example.test"]);
  });

  it("rejects malformed encryption keys without exposing their value", () => {
    expect(() =>
      readEmailConfig({
        ...developmentEnvironment(),
        EMAIL_TOKEN_ENCRYPTION_KEY: "not-a-key",
      })
    ).toThrow("must be a base64-encoded 32-byte key");
  });

  it("requires HTTPS for production links", () => {
    expect(() =>
      readEmailConfig({
        ...developmentEnvironment(),
        EMAIL_DELIVERY_MODE: "production",
        NEXT_PUBLIC_SITE_URL: "http://example.test",
        EMAIL_TEST_RECIPIENT: undefined,
      })
    ).toThrow("Production email links require an HTTPS site URL");
  });
});

