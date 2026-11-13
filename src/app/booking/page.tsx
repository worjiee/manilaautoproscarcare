import type { Metadata } from "next";
import { Suspense } from "react";
import { BRAND_CONFIG } from "@/lib/constants/site-data";
import { PageHero } from "@/components/ui/page-hero";
import { BookingWizard } from "@/components/booking/booking-wizard";

export const metadata: Metadata = {
  title: "Online Appointment Booking",
  description: `Schedule your Car or Motorcycle detailing and paint protection appointment at ${BRAND_CONFIG.displayName}, ${BRAND_CONFIG.location.fullAddress}. Operating Monday through Saturday in Asia/Manila time.`,
};

function BookingWizardFallback() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="border border-[#292929] bg-[#141414] p-10 text-center font-mono text-xs text-[#A3A3A3] uppercase">
        Loading appointment scheduler...
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <>
      <PageHero
        kicker="Online Appointment Scheduling"
        titleLines={[
          "Schedule Your",
          <span key="accent" className="text-[#E11D2E]">
            Studio Appointment.
          </span>,
        ]}
        description={`Select your vehicle type, protection or detailing service, and preferred Monday–Saturday appointment slot on ${BRAND_CONFIG.location.fullAddress}.`}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Booking" }]}
      />

      <section aria-label="Appointment Booking Wizard" className="bg-[#090909]">
        <Suspense fallback={<BookingWizardFallback />}>
          <BookingWizard />
        </Suspense>
      </section>
    </>
  );
}
