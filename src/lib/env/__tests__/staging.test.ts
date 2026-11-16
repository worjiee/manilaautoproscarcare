import { describe, expect, it } from "vitest";
import {
  isAllowedDemoServiceSlug,
  readStagingDemoPolicy,
  validateDemoCustomer,
} from "../staging";

const validEnv = {
  NODE_ENV: "test",
  STAGING_DEMO_MODE: "true",
  PUBLIC_BOOKING_ENABLED: "true",
  STAGING_SUPABASE_PROJECT_REF: "qcjslbakgdofmzthqxuu",
  STAGING_DEMO_SERVICE_SLUGS: "full-detailing,motorcycle-detailing",
  NEXT_PUBLIC_SUPABASE_URL: "https://qcjslbakgdofmzthqxuu.supabase.co",
  EMAIL_DELIVERY_MODE: "disabled",
  VERCEL_ENV: "preview",
} as NodeJS.ProcessEnv;

describe("private staging demo policy", () => {
  it("accepts a private preview with a matching project and explicit services", () => {
    const policy = readStagingDemoPolicy(validEnv);
    expect(policy.publicBookingEnabled).toBe(true);
    expect(isAllowedDemoServiceSlug(policy, "full-detailing")).toBe(true);
    expect(isAllowedDemoServiceSlug(policy, "paint-correction")).toBe(false);
  });

  it("fails closed for production, project mismatches, and email delivery", () => {
    expect(() => readStagingDemoPolicy({ ...validEnv, VERCEL_ENV: "production" })).toThrow();
    expect(() => readStagingDemoPolicy({ ...validEnv, STAGING_SUPABASE_PROJECT_REF: "aaaaaaaaaaaaaaaaaaaa" })).toThrow();
    expect(() => readStagingDemoPolicy({ ...validEnv, EMAIL_DELIVERY_MODE: "development" })).toThrow();
  });

  it("will not enable public booking outside demo mode", () => {
    expect(() => readStagingDemoPolicy({ NODE_ENV: "test", PUBLIC_BOOKING_ENABLED: "true" } as NodeJS.ProcessEnv)).toThrow();
  });

  it("requires synthetic customer details", () => {
    expect(validateDemoCustomer({
      customerName: "Demo Reviewer",
      customerEmail: "reviewer@example.test",
      customerPhone: "09000000000",
    })).toEqual({});
    expect(Object.keys(validateDemoCustomer({
      customerName: "Real Person",
      customerEmail: "person@gmail.com",
      customerPhone: "09171234567",
    }))).toEqual(["customerName", "customerEmail", "customerPhone"]);
  });
});
