import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { getRequiredSupabaseServiceRoleClient } from "@/lib/supabase/server";

export type AdminSession = { userId: string; email: string; displayName: string };

export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  // Supabase validates token expiry against the current time. Keep that work out
  // of Cache Components prerendering regardless of which route calls the DAL.
  await connection();
  const auth = await createSupabaseAuthServerClient();
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) return null;

  const service = getRequiredSupabaseServiceRoleClient();
  const { data: membership, error: membershipError } = await service
    .from("admin_memberships")
    .select("display_name")
    .eq("user_id", data.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError || !membership) return null;
  return {
    userId: data.user.id,
    email: data.user.email ?? "",
    displayName: String(membership.display_name || data.user.email || "Administrator"),
  };
});

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}
