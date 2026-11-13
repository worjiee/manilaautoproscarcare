import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function assertServerEnvironment() {
  if (typeof window !== "undefined") {
    throw new Error(
      "SECURITY_VIOLATION: Server Supabase client must never be invoked in browser context."
    );
  }
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return false;
  if (
    url.includes("your-project-ref") ||
    serviceKey.includes("placeholder")
  ) {
    return false;
  }
  return true;
}

/**
 * Least-privilege server-side Supabase client using the anon key (respects RLS).
 */
export function getSupabaseAnonServerClient(): SupabaseClient | null {
  assertServerEnvironment();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !url ||
    !anonKey ||
    url.includes("your-project-ref") ||
    anonKey.includes("placeholder")
  ) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Privileged server-only Supabase client for atomic booking RPCs and token
 * validation where RLS intentionally blocks direct anonymous table access.
 */
export function getSupabaseServiceRoleClient(): SupabaseClient | null {
  assertServerEnvironment();
  if (!isSupabaseConfigured()) {
    return null;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
