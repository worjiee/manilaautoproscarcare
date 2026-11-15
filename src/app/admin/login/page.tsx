import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AdminLoginForm } from "@/components/admin/login-form";
import { getAdminSession } from "@/lib/admin/auth";

export const instant = false;

export default async function AdminLoginPage() {
  await connection();
  if (await getAdminSession()) redirect("/admin/dashboard");
  return <div className="flex min-h-screen items-center justify-center bg-studio-grid px-4"><section className="w-full max-w-md border border-white/10 bg-[#141414] p-8 shadow-2xl"><p className="font-mono text-xs tracking-widest text-[#FF5262] uppercase">Restricted operations</p><h1 className="mt-3 font-display text-4xl font-extrabold uppercase">Admin sign in</h1><p className="mt-3 text-sm text-[#B8B8B8]">A valid account and active administrator membership are both required.</p><AdminLoginForm /></section></div>;
}
