"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSupabasePublicConfig } from "@/lib/supabase/config";

let browserClient: SupabaseClient | null = null;

/**
 * Browser-safe Supabase client using only the public key. The existing
 * NEXT_PUBLIC_SUPABASE_ANON_KEY variable accepts the newer sb_publishable_ key.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  const config = readSupabasePublicConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  if (!config) return null;

  if (!browserClient) {
    browserClient = createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return browserClient;
}
