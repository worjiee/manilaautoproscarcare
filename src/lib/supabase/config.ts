export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

export type SupabaseSecretConfig = {
  url: string;
  secretKey: string;
};

function isPlaceholder(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("placeholder") ||
    normalized.includes("your-project") ||
    normalized.includes("your-supabase")
  );
}

function parseProjectUrl(value: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      "Invalid NEXT_PUBLIC_SUPABASE_URL: expected the Supabase project base URL."
    );
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname !== "/" && parsed.pathname !== "")
  ) {
    throw new Error(
      "Invalid NEXT_PUBLIC_SUPABASE_URL: use the project base URL without /rest/v1 or another path."
    );
  }

  return parsed.origin;
}

function isLegacyJwtKey(value: string): boolean {
  return value.startsWith("eyJ") && value.split(".").length === 3;
}

export function readSupabasePublicConfig(
  urlValue: string | undefined,
  keyValue: string | undefined
): SupabasePublicConfig | null {
  const url = urlValue?.trim();
  const publishableKey = keyValue?.trim();

  if (!url || !publishableKey || isPlaceholder(url) || isPlaceholder(publishableKey)) {
    return null;
  }

  if (publishableKey.startsWith("sb_secret_")) {
    throw new Error(
      "Invalid NEXT_PUBLIC_SUPABASE_ANON_KEY: a secret key must never be exposed through a NEXT_PUBLIC_ variable."
    );
  }

  if (
    !publishableKey.startsWith("sb_publishable_") &&
    !isLegacyJwtKey(publishableKey)
  ) {
    throw new Error(
      "Invalid NEXT_PUBLIC_SUPABASE_ANON_KEY: expected a publishable key."
    );
  }

  return { url: parseProjectUrl(url), publishableKey };
}

export function readSupabaseSecretConfig(
  urlValue: string | undefined,
  keyValue: string | undefined
): SupabaseSecretConfig | null {
  const url = urlValue?.trim();
  const secretKey = keyValue?.trim();

  if (!url || !secretKey || isPlaceholder(url) || isPlaceholder(secretKey)) {
    return null;
  }

  if (secretKey.startsWith("sb_publishable_")) {
    throw new Error(
      "Invalid SUPABASE_SERVICE_ROLE_KEY: expected a server-only secret key, not a publishable key."
    );
  }

  if (!secretKey.startsWith("sb_secret_") && !isLegacyJwtKey(secretKey)) {
    throw new Error(
      "Invalid SUPABASE_SERVICE_ROLE_KEY: expected a Supabase secret key."
    );
  }

  return { url: parseProjectUrl(url), secretKey };
}
