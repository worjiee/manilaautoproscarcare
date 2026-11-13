import type { VehicleType } from "@/lib/constants/site-data";

export interface BookingDraft {
  vehicleType: VehicleType | "";
  serviceCategorySlug: string;
  serviceOptionId: string;
  manufacturer: string;
  model: string;
  year: string;
  vehicleNotes: string;
  appointmentDate: string; // YYYY-MM-DD in Asia/Manila
  timeSlotId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  additionalRequests: string;
}

export interface MockTimeSlot {
  id: string;
  label: string;
  windowLabel: string;
  status: "available" | "full";
  mockNotice: string;
}

export interface MockAvailabilityResult {
  date: string;
  timezone: "Asia/Manila";
  isSundayClosed: boolean;
  isMockData: true;
  slots: MockTimeSlot[];
}

/**
 * Parses a YYYY-MM-DD date string in Asia/Manila (UTC+8) and checks if it falls on Sunday.
 */
export function isSundayInManila(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const date = new Date(`${dateStr}T12:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return false;
  return date.getUTCDay() === 0;
}

/**
 * Formats a YYYY-MM-DD date string for display in Asia/Manila timezone.
 */
export function formatManilaDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const date = new Date(`${dateStr}T12:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Manila",
  }).format(date);
}

/**
 * Generates upcoming dates in Asia/Manila timezone from a reference YYYY-MM-DD anchor.
 * Using a deterministic anchor avoids Next.js 16 `blocking-prerender-current-time` errors.
 */
export function getUpcomingManilaDates(
  count = 14,
  anchorDateStr = "2026-10-21"
): {
  dateStr: string;
  dayShort: string;
  dayNum: string;
  monthShort: string;
  isSunday: boolean;
}[] {
  const results: {
    dateStr: string;
    dayShort: string;
    dayNum: string;
    monthShort: string;
    isSunday: boolean;
  }[] = [];

  const baseDate = new Date(`${anchorDateStr}T12:00:00+08:00`);

  for (let i = 1; i <= count; i++) {
    const d = new Date(baseDate.getTime() + i * 86_400_000);
    const dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);

    const dayShort = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      weekday: "short",
    }).format(d);

    const dayNum = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      day: "2-digit",
    }).format(d);

    const monthShort = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      month: "short",
    }).format(d);

    results.push({
      dateStr,
      dayShort,
      dayNum,
      monthShort,
      isSunday: d.getUTCDay() === 0,
    });
  }

  return results;
}

/**
 * Clearly labeled mock availability adapter.
 * In Phase 3, this function will be replaced by a Supabase Server Action that queries
 * real `business_hours`, `blocked_dates`, `services`, and `bookings` tables.
 */
export async function fetchMockAvailability(
  dateStr: string
): Promise<MockAvailabilityResult> {
  await new Promise((resolve) => setTimeout(resolve, 260));

  const sunday = isSundayInManila(dateStr);
  if (sunday) {
    return {
      date: dateStr,
      timezone: "Asia/Manila",
      isSundayClosed: true,
      isMockData: true,
      slots: [],
    };
  }

  // Deterministic variation by day of month to demonstrate available vs full UI states
  const dayNum = Number(dateStr.split("-")[2] ?? "1");

  const slots: MockTimeSlot[] = [
    {
      id: "mock-slot-morning",
      label: "Morning Intake Window (Mock Slot A)",
      windowLabel: "Mock Window A • Asia/Manila",
      status: "available",
      mockNotice:
        "Mock preview slot — exact studio opening hour & service duration pending client confirmation",
    },
    {
      id: "mock-slot-midday",
      label: "Midday Intake Window (Mock Slot B)",
      windowLabel: "Mock Window B • Asia/Manila",
      status: dayNum % 4 === 0 ? "full" : "available",
      mockNotice:
        dayNum % 4 === 0
          ? "Mock capacity reached (demonstration state)"
          : "Mock preview slot — exact bay capacity & duration pending client confirmation",
    },
    {
      id: "mock-slot-afternoon",
      label: "Afternoon Intake Window (Mock Slot C)",
      windowLabel: "Mock Window C • Asia/Manila",
      status: "available",
      mockNotice:
        "Mock preview slot — exact afternoon cutoff hour pending client confirmation",
    },
  ];

  return {
    date: dateStr,
    timezone: "Asia/Manila",
    isSundayClosed: false,
    isMockData: true,
    slots,
  };
}
