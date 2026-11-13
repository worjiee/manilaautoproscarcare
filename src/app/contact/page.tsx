import type { Metadata } from "next";
import {
  ArrowUpRight,
  Calendar,
  Clock,
  Compass,
  Mail,
  MapPin,
  Phone,
  Share2,
} from "lucide-react";
import { BRAND_CONFIG, SOCIAL_LINKS } from "@/lib/constants/site-data";
import { MotionScope } from "@/components/motion/motion-scope";
import { PageHero } from "@/components/ui/page-hero";
import { SectionHeading } from "@/components/ui/section-heading";
import { ButtonLink } from "@/components/ui/button-link";
import { DevNotice, PendingValue } from "@/components/ui/dev-notice";
import { ContactInquiryForm } from "@/components/contact/contact-inquiry-form";
import { BookingCta } from "@/components/sections/booking-cta";

export const metadata: Metadata = {
  title: "Contact & Studio Location",
  description: `Contact ${BRAND_CONFIG.displayName} on ${BRAND_CONFIG.location.fullAddress}. Operating ${BRAND_CONFIG.schedule.operatingDays} (${BRAND_CONFIG.schedule.closedDays}).`,
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        kicker="Studio Location & Inquiries"
        titleLines={[
          "Contact",
          <span key="accent" className="text-[#E11D2E]">
            Manila Auto Pros.
          </span>,
        ]}
        description={`Visit our studio on ${BRAND_CONFIG.location.fullAddress}, send a service inquiry below, or schedule your appointment online.`}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Contact" }]}
      >
        <ButtonLink
          href="/booking"
          size="lg"
          showArrow
          icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
        >
          Book Appointment
        </ButtonLink>
      </PageHero>

      <MotionScope className="bg-[#090909] text-white">
        {/* Main Contact Details + Inquiry Form */}
        <section className="border-b border-[#292929] bg-[#090909] py-20 lg:py-28">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-12 px-4 sm:px-6 lg:grid-cols-12">
            {/* Left Column: Confirmed Business Information & Marked Missing Info */}
            <div data-animate="fade-up" className="space-y-8 lg:col-span-5">
              <SectionHeading
                kicker="Business Information"
                title={BRAND_CONFIG.name}
                description="Confirmed studio location and operating days are listed below. Unconfirmed contact channels are explicitly marked for configuration once supplied by the client."
              />

              <dl className="space-y-4 border-t border-[#292929] pt-6">
                <div className="border border-[#292929] bg-[#141414] p-5">
                  <dt className="flex items-center gap-2.5 font-mono text-xs font-semibold tracking-wider text-[#E11D2E] uppercase">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    Studio Address
                  </dt>
                  <dd className="mt-2 font-display text-2xl font-bold tracking-wide text-white uppercase">
                    {BRAND_CONFIG.location.fullAddress}
                  </dd>
                </div>

                <div className="border border-[#292929] bg-[#141414] p-5">
                  <dt className="flex items-center gap-2.5 font-mono text-xs font-semibold tracking-wider text-[#E11D2E] uppercase">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    Operating Schedule ({BRAND_CONFIG.location.timezone})
                  </dt>
                  <dd className="mt-2 font-display text-2xl font-bold tracking-wide text-white uppercase">
                    {BRAND_CONFIG.schedule.operatingDays}
                  </dd>
                  <dd className="mt-1 font-mono text-xs font-semibold text-[#E11D2E] uppercase">
                    {BRAND_CONFIG.schedule.closedDays}
                  </dd>
                  <dd className="mt-2 text-xs text-[#A3A3A3]">
                    Operating Hours:{" "}
                    <PendingValue
                      value={BRAND_CONFIG.schedule.hours}
                      fallback="Pending client confirmation"
                    />
                  </dd>
                </div>

                <div className="border border-[#292929] bg-[#141414] p-5">
                  <dt className="flex items-center gap-2.5 font-mono text-xs font-semibold tracking-wider text-[#E11D2E] uppercase">
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Telephone / Mobile Dispatch
                  </dt>
                  <dd className="mt-2 text-sm">
                    <dt>0966 169 6824</dt>
                  </dd>
                </div>

                <div className="border border-[#292929] bg-[#141414] p-5">
                  <dt className="flex items-center gap-2.5 font-mono text-xs font-semibold tracking-wider text-[#E11D2E] uppercase">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Official Inquiry Email
                  </dt>
                  <dd className="mt-2 text-sm">
                    <dt>mangapitsolomon@gmail.com</dt>
                  </dd>
                </div>
              </dl>

              {/* Social Media Section (No Invented URLs) */}
              <div className="border border-[#292929] bg-[#141414] p-6">
                <div className="flex items-center gap-2.5">
                  <Share2
                    className="h-4 w-4 text-[#E11D2E]"
                    aria-hidden="true"
                  />
                  <h3 className="font-mono text-xs font-semibold tracking-[0.18em] text-white uppercase">
                    Official Social Media Channels
                  </h3>
                </div>

                {SOCIAL_LINKS.length > 0 ? (
                  <ul className="mt-4 flex flex-wrap gap-3">
                    {SOCIAL_LINKS.map((social) => (
                      <li key={social.platform}>
                        <a
                          href={social.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 border border-[#292929] bg-[#1C1C1C] px-4 py-2 font-mono text-xs text-white uppercase hover:border-[#E11D2E]"
                        >
                          <span>{social.platform}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-[#E11D2E]" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3">
                    <p className="text-xs leading-relaxed text-[#A3A3A3]">
                      Official Facebook, Instagram, and TikTok profile URLs have
                      not yet been supplied. Configure verified social handles
                      in{" "}
                      <code className="font-mono text-white">
                        SOCIAL_LINKS
                      </code>{" "}
                      inside{" "}
                      <code className="font-mono text-white">
                        src/lib/constants/site-data.ts
                      </code>
                      .
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Contact Inquiry Form */}
            <div data-animate="fade-up" className="lg:col-span-7">
              <ContactInquiryForm />
            </div>
          </div>
        </section>

        {/* Map Integration Placeholder Section */}
        <section
          aria-labelledby="map-section-heading"
          className="border-b border-[#292929] bg-[#141414] py-20 lg:py-28"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div data-animate="fade-up">
              <SectionHeading
                kicker="Quiricada Street, Manila"
                title="Studio Map & Directions."
                description="Located on Quiricada Street in Manila, accessible for both four-wheel vehicles and motorcycles."
              />
            </div>

            <div
              data-animate="fade-up"
              className="mt-10 border border-[#292929] bg-[#1C1C1C] p-6 sm:p-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#292929] pb-4">
                <div className="flex items-center gap-2.5">
                  <Compass
                    className="h-5 w-5 text-[#E11D2E]"
                    aria-hidden="true"
                  />
                  <h3
                    id="map-section-heading"
                    className="font-mono text-xs font-semibold tracking-[0.18em] text-white uppercase"
                  >
                    Map Integration Placeholder // {BRAND_CONFIG.location.fullAddress}
                  </h3>
                </div>
                <span className="font-mono text-xs text-[#A3A3A3] uppercase">
                  TIMEZONE: {BRAND_CONFIG.location.timezone}
                </span>
              </div>

              <div className="bg-studio-grid relative my-6 flex min-h-80 flex-col items-center justify-center border border-[#292929] bg-[#090909] p-8 text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center border border-[#E11D2E] bg-[#141414]">
                  <MapPin className="h-7 w-7 text-[#E11D2E]" aria-hidden="true" />
                </div>
                <p className="mt-4 font-display text-3xl font-extrabold tracking-wide text-white uppercase">
                  {BRAND_CONFIG.name}
                </p>
                <p className="mt-1 font-mono text-xs tracking-wider text-[#A3A3A3] uppercase">
                  {BRAND_CONFIG.location.fullAddress}
                </p>
                <p className="mt-3 max-w-md text-xs leading-relaxed text-[#A3A3A3]">
                  Interactive map embed slot reserved for the confirmed Manila
                  Auto Pros Google Maps pin on Quiricada Street.
                </p>
                <a
                  href={BRAND_CONFIG.location.mapSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 border border-[#292929] bg-[#141414] px-5 py-2.5 font-mono text-xs font-semibold tracking-wider text-white uppercase transition-colors hover:border-[#E11D2E]"
                >
                  <span>Search Quiricada Street on Google Maps</span>
                  <span className="sr-only">(opens in a new tab)</span>
                  <ArrowUpRight className="h-4 w-4 text-[#E11D2E]" />
                </a>
              </div>

              <DevNotice title="Map embed configuration">
                Once the client confirms the exact building number / Google
                Business Profile place ID on Quiricada Street, replace the
                placeholder frame above with the official Google Maps iframe.
              </DevNotice>
            </div>
          </div>
        </section>

        {/* Booking CTA */}
        <BookingCta />
      </MotionScope>
    </>
  );
}
