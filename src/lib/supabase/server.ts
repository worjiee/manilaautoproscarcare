import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  readSupabasePublicConfig,
  readSupabaseSecretConfig,
} from "@/lib/supabase/config";

function assertServerEnvironment() {
  if (typeof window !== "undefined") {
    throw new Error(
      "SECURITY_VIOLATION: Server Supabase client must never be invoked in browser context."
    );
  }
}

export function isSupabaseConfigured(): boolean {
  assertServerEnvironment();
  return Boolean(
    readSupabaseSecretConfig(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  );
}

/**
 * Least-privilege server-side Supabase client using the public key (respects
 * RLS as anon, or authenticated when a user session JWT is present).
 */
export function getSupabaseAnonServerClient(): SupabaseClient | null {
  assertServerEnvironment();
  const config = readSupabasePublicConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  if (!config) return null;

  return createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Privileged server-only Supabase client. The existing service-role variable
 * accepts the newer sb_secret_ key, which Supabase maps to the service_role
 * PostgreSQL role and therefore bypasses RLS.
 */
export function getSupabaseServiceRoleClient(): SupabaseClient | null {
  assertServerEnvironment();
  const config = readSupabaseSecretConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (!config) return null;

  return createClient(config.url, config.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function getRequiredSupabaseServiceRoleClient(): SupabaseClient {
  const client = getSupabaseServiceRoleClient();
  if (!client) {
    throw new Error(
      "Supabase is required for booking persistence. In-memory fallback is disabled."
    );
  }
  return client;
}
