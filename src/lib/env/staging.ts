import "server-only";

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const DEMO_EMAIL_PATTERN = /^[^\s@]+@example\.test$/i;

export type StagingDemoPolicy = {
  demoMode: boolean;
  publicBookingEnabled: boolean;
  projectRef: string | null;
  serviceSlugs: readonly string[];
};

function enabled(value: string | undefined): boolean {
  return value === "true";
}

function projectRefFromUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const suffix = ".supabase.co";
    if (!hostname.endsWith(suffix)) return null;
    return hostname.slice(0, -suffix.length);
  } catch {
    return null;
  }
}

export function readStagingDemoPolicy(
  env: NodeJS.ProcessEnv = process.env
): StagingDemoPolicy {
  const demoMode = enabled(env.STAGING_DEMO_MODE);
  const publicBookingEnabled = enabled(env.PUBLIC_BOOKING_ENABLED);
  const projectRef = env.STAGING_SUPABASE_PROJECT_REF?.trim() || null;
  const serviceSlugs = (env.STAGING_DEMO_SERVICE_SLUGS ?? "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);

  if (publicBookingEnabled && !demoMode) {
    throw new Error(
      "PUBLIC_BOOKING_ENABLED may only be enabled with STAGING_DEMO_MODE."
    );
  }

  if (!demoMode) {
    return { demoMode, publicBookingEnabled: false, projectRef, serviceSlugs };
  }

  if (env.VERCEL_ENV === "production") {
    throw new Error("Staging demo mode is forbidden in Vercel production.");
  }
  if (!projectRef || !PROJECT_REF_PATTERN.test(projectRef)) {
    throw new Error("A valid STAGING_SUPABASE_PROJECT_REF is required.");
  }
  if (projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL) !== projectRef) {
    throw new Error("The Supabase URL does not match the staging project marker.");
  }
  if ((env.EMAIL_DELIVERY_MODE ?? "disabled") !== "disabled") {
    throw new Error("Email delivery must remain disabled in staging demo mode.");
  }
  if (publicBookingEnabled && serviceSlugs.length === 0) {
    throw new Error("At least one demo service slug must be explicitly allowed.");
  }

  return {
    demoMode,
    publicBookingEnabled,
    projectRef,
    serviceSlugs: [...new Set(serviceSlugs)],
  };
}

export function isAllowedDemoServiceSlug(
  policy: StagingDemoPolicy,
  slug: string
): boolean {
  return policy.publicBookingEnabled && policy.serviceSlugs.includes(slug.trim());
}

export function validateDemoCustomer(input: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.customerName.trim().toLowerCase().startsWith("demo ")) {
    errors.customerName = 'Demo names must begin with "Demo ".';
  }
  if (!DEMO_EMAIL_PATTERN.test(input.customerEmail.trim())) {
    errors.customerEmail = "Use a synthetic @example.test email address.";
  }
  if (input.customerPhone.replace(/\D/g, "") !== "09000000000") {
    errors.customerPhone = "Use the staging-only phone number 09000000000.";
  }
  return errors;
}
