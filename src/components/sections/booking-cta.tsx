import { Calendar, MessageSquare } from "lucide-react";
import { BRAND_CONFIG } from "@/lib/constants/site-data";
import { ButtonLink } from "@/components/ui/button-link";

interface BookingCtaProps {
  title?: string;
  description?: string;
  /** Pre-select a service in the booking flow. */
  serviceSlug?: string;
  kicker?: string;
}

/** Reusable booking call-to-action band. Place inside a `MotionScope`. */
export function BookingCta({
  kicker = "Online Appointment Scheduling",
  title = "Reserve your appointment on Quiricada Street.",
  description = "Choose your vehicle type and service, then request a preferred date and time. Scheduling runs Monday to Saturday in Asia/Manila time.",
  serviceSlug,
}: BookingCtaProps) {
  const bookingHref = serviceSlug ? `/booking?service=${serviceSlug}` : "/booking";

  return (
    <section aria-labelledby="booking-cta-heading" className="border-b border-[#292929] bg-[#090909] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div data-animate="fade-up" className="relative overflow-hidden border border-[#292929] bg-[#141414] p-8 sm:p-12 lg:p-16">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-[#E11D2E]" />
          <span
            aria-hidden="true"
            className="bg-studio-grid pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 opacity-60 lg:block"
          />

          <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <p className="font-mono text-xs font-semibold tracking-[0.2em] text-[#E11D2E] uppercase">{kicker}</p>
              <h2
                id="booking-cta-heading"
                className="mt-3 font-display text-4xl font-extrabold tracking-[0.03em] text-white uppercase sm:text-5xl"
              >
                {title}
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#A3A3A3]">{description}</p>
              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs tracking-wider text-white uppercase">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-[#E11D2E]" aria-hidden="true" />
                  {BRAND_CONFIG.schedule.operatingDays}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-[#E11D2E]" aria-hidden="true" />
                  Cars &amp; Motorcycles
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-[#E11D2E]" aria-hidden="true" />
                  Pricing on inquiry
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3 lg:col-span-4">
              <ButtonLink
                href={bookingHref}
                size="lg"
                showArrow
                icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
              >
                Book Appointment
              </ButtonLink>
              <ButtonLink
                href="/contact"
                variant="secondary"
                size="lg"
                icon={<MessageSquare className="h-4 w-4" aria-hidden="true" />}
              >
                Send an Inquiry
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
