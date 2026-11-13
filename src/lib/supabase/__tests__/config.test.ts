import { describe, expect, it } from "vitest";
import {
  readSupabasePublicConfig,
  readSupabaseSecretConfig,
} from "@/lib/supabase/config";

const PROJECT_URL = "https://project-ref.supabase.co";

describe("Supabase key configuration", () => {
  it("accepts a new-format publishable key in the existing public variable", () => {
    expect(
      readSupabasePublicConfig(PROJECT_URL, "sb_publishable_test-value")
    ).toEqual({
      url: PROJECT_URL,
      publishableKey: "sb_publishable_test-value",
    });
  });

  it("accepts a new-format secret key in the existing service-role variable", () => {
    expect(
      readSupabaseSecretConfig(PROJECT_URL, "sb_secret_test-value")
    ).toEqual({
      url: PROJECT_URL,
      secretKey: "sb_secret_test-value",
    });
  });

  it("rejects a secret key in a browser-exposed variable", () => {
    expect(() =>
      readSupabasePublicConfig(PROJECT_URL, "sb_secret_test-value")
    ).toThrow(/must never be exposed/);
  });

  it("rejects a publishable key in the privileged server variable", () => {
    expect(() =>
      readSupabaseSecretConfig(PROJECT_URL, "sb_publishable_test-value")
    ).toThrow(/server-only secret key/);
  });

  it("rejects REST endpoint URLs instead of silently producing nested paths", () => {
    expect(() =>
      readSupabasePublicConfig(
        `${PROJECT_URL}/rest/v1/`,
        "sb_publishable_test-value"
      )
    ).toThrow(/project base URL/);
  });

  it("treats documented placeholders as unconfigured", () => {
    expect(
      readSupabasePublicConfig(
        "https://your-project-ref.supabase.co",
        "sb_publishable_placeholder"
      )
    ).toBeNull();
  });
});
