import Link from "next/link";
import { connection } from "next/server";
import { CalendarDays, LayoutDashboard, ListChecks, Settings } from "lucide-react";
import { logoutAdmin } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { readStagingDemoPolicy } from "@/lib/env/staging";

export const instant = false;

const links = [["/admin/dashboard", "Overview", LayoutDashboard], ["/admin/bookings", "Bookings", ListChecks], ["/admin/calendar", "Calendar", CalendarDays], ["/admin/settings", "Settings", Settings]] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const admin = await requireAdmin();
  const policy = readStagingDemoPolicy();
  const visibleLinks = policy.demoMode ? links.filter(([href]) => href !== "/admin/settings") : links;
  return <div className="min-h-screen bg-[#090909] text-white lg:grid lg:grid-cols-[250px_1fr]">
    <aside className="border-b border-white/10 bg-[#111] p-4 lg:min-h-screen lg:border-r lg:border-b-0 lg:p-6"><Link href="/admin/dashboard" className="font-display text-2xl font-extrabold uppercase">Manila <span className="text-[#FF5262]">Auto Pros</span></Link><p className="mt-1 font-mono text-xs text-[#A3A3A3]">{policy.demoMode ? "DEMO OPERATIONS CONSOLE" : "OPERATIONS CONSOLE"}</p><nav aria-label="Admin" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">{visibleLinks.map(([href,label,Icon]) => <Link key={href} href={href} className="flex min-h-11 items-center gap-3 border border-white/10 px-3 text-sm hover:border-[#E11D2E]"><Icon className="h-4 w-4 text-[#FF5262]" />{label}</Link>)}</nav><div className="mt-6 border-t border-white/10 pt-4"><p className="truncate text-sm font-semibold">{admin.displayName}</p><p className="truncate text-xs text-[#A3A3A3]">{admin.email}</p><form action={logoutAdmin}><button className="mt-3 text-xs font-bold text-[#FF5262] uppercase">Sign out</button></form></div></aside>
    <div className="min-w-0 p-4 sm:p-6 lg:p-10">{children}</div>
  </div>;
}
