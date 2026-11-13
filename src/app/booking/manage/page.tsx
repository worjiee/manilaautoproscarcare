import type { Metadata } from "next";
import { Suspense } from "react";
import { BRAND_CONFIG } from "@/lib/constants/site-data";
import { PageHero } from "@/components/ui/page-hero";
import { BookingManageView } from "@/components/booking/booking-manage-view";

export const metadata: Metadata = {
  title: "Manage Appointment (Cancel / Reschedule)",
  description: `Verify your single-purpose security token to reschedule or cancel your appointment at ${BRAND_CONFIG.displayName}.`,
  robots: {
    index: false,
    follow: false,
  },
};

function BookingManageFallback() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="border border-[#292929] bg-[#141414] p-10 text-center font-mono text-xs text-[#A3A3A3] uppercase">
        Loading token verification interface...
      </div>
    </div>
  );
}

export default function BookingManagePage() {
  return (
    <>
      <PageHero
        kicker="Self-Service Appointment Management"
        titleLines={[
          "Manage Your",
          <span key="accent" className="text-[#E11D2E]">
            Studio Reservation.
          </span>,
        ]}
        description="Use your single-purpose appointment security token to reschedule or cancel your reservation safely."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Booking", href: "/booking" },
          { label: "Manage Reservation" },
        ]}
      />

      <section
        aria-label="Customer Token Appointment Management"
        className="bg-[#090909]"
      >
        <Suspense fallback={<BookingManageFallback />}>
          <BookingManageView />
        </Suspense>
      </section>
    </>
  );
}
