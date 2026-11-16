import "server-only";

import { requireAdmin } from "@/lib/admin/auth";
import { getRequiredSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { readStagingDemoPolicy } from "@/lib/env/staging";

const bookingSelect = "id,reference_code,status,appointment_date,start_time_local,end_time_local,start_at,end_at,pending_expires_at,confirmation_mode,created_at,additional_requests,customers(full_name,email,phone),vehicles(vehicle_type,manufacturer,model,model_year),services(name,option_slug),booking_resources(name,code)";
const demoBookingSelect = "id,reference_code,status,appointment_date,start_time_local,end_time_local,start_at,end_at,pending_expires_at,confirmation_mode,created_at,additional_requests,customers(full_name,email,phone),vehicles(vehicle_type,manufacturer,model,model_year),services!inner(name,option_slug),booking_resources(name,code)";

export async function getAdminBookings(filters?: { status?: string; q?: string; from?: string; to?: string }) {
  await requireAdmin();
  const db = getRequiredSupabaseServiceRoleClient();
  const policy = readStagingDemoPolicy();
  let query = db.from("bookings").select(policy.demoMode ? demoBookingSelect : bookingSelect).order("start_at", { ascending: true }).limit(250);
  if (policy.demoMode) query = query.in("services.option_slug", [...policy.serviceSlugs]);
  if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters?.from) query = query.gte("appointment_date", filters.from);
  if (filters?.to) query = query.lte("appointment_date", filters.to);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load bookings.");
  const rows = data ?? [];
  const search = filters?.q?.trim().toLowerCase();
  if (!search) return rows;
  return rows.filter((row) => {
    const customer = row.customers as unknown as { full_name?: string; email?: string } | null;
    const service = row.services as unknown as { name?: string } | null;
    return [row.reference_code, customer?.full_name, customer?.email, service?.name]
      .some((value) => String(value ?? "").toLowerCase().includes(search));
  });
}

export async function getDashboardData() {
  await requireAdmin();
  const db = getRequiredSupabaseServiceRoleClient();
  const policy = readStagingDemoPolicy();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  let query = db.from("bookings").select(policy.demoMode ? "id,status,appointment_date,start_time_local,created_at,reference_code,services!inner(name,option_slug),customers(email)" : "id,status,appointment_date,start_time_local,created_at,reference_code,services(name,option_slug),customers(email)").gte("appointment_date", today).order("created_at", { ascending: false }).limit(100);
  if (policy.demoMode) query = query.in("services.option_slug", [...policy.serviceSlugs]);
  const { data: bookings, error } = await query;
  if (error) throw new Error("Unable to load dashboard data.");
  const rows = (bookings ?? []).filter((booking) => {
    const customer = booking.customers as unknown as { email?: string } | null;
    return !customer?.email?.endsWith("@example.invalid");
  });
  return {
    today,
    counts: {
      today: rows.filter((b) => b.appointment_date === today && ["pending", "confirmed"].includes(b.status)).length,
      pending: rows.filter((b) => b.status === "pending").length,
      confirmed: rows.filter((b) => b.status === "confirmed").length,
      upcoming: rows.filter((b) => ["pending", "confirmed"].includes(b.status)).length,
    },
    breakdown: Object.entries(rows.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.status]: (acc[b.status] || 0) + 1 }), {})),
    recent: [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 8),
  };
}

export async function getAdminSettings() {
  await requireAdmin();
  const db = getRequiredSupabaseServiceRoleClient();
  const policy = readStagingDemoPolicy();
  const [services, resources, hours, blocks] = await Promise.all([
    db.from("services").select("*").order("name"),
    db.from("booking_resources").select("*").order("code"),
    db.from("business_hours").select("*").order("day_of_week"),
    db.from("blocked_dates").select("id,blocked_date,start_time,end_time,reason,is_active,resource_id").order("blocked_date"),
  ]);
  if (services.error || resources.error || hours.error || blocks.error) throw new Error("Unable to load business settings.");
  return {
    services: policy.demoMode ? (services.data ?? []).filter((service) => policy.serviceSlugs.includes(service.option_slug)) : services.data ?? [],
    resources: resources.data ?? [],
    hours: hours.data ?? [],
    blocks: blocks.data ?? [],
  };
}

export async function getBookingAudit(bookingId: string) {
  await requireAdmin();
  const db = getRequiredSupabaseServiceRoleClient();
  const policy = readStagingDemoPolicy();
  if (policy.demoMode) {
    const { data: booking } = await db.from("bookings").select("id,services!inner(option_slug)").eq("id", bookingId).in("services.option_slug", [...policy.serviceSlugs]).maybeSingle();
    if (!booking) throw new Error("Booking is outside the approved demo scope.");
  }
  const { data, error } = await db.from("booking_audit_logs").select("id,actor_type,action,previous_status,new_status,metadata,created_at").eq("booking_id", bookingId).order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load booking audit history.");
  return data ?? [];
}
