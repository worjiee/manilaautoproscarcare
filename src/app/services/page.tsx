import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Calendar, Check } from "lucide-react";
import { BRAND_CONFIG, SERVICE_CATEGORIES } from "@/lib/constants/site-data";
import { MotionScope } from "@/components/motion/motion-scope";
import { PageHero } from "@/components/ui/page-hero";
import { SectionHeading } from "@/components/ui/section-heading";
import { StudioImagePlaceholder } from "@/components/ui/studio-image-placeholder";
import { ButtonLink } from "@/components/ui/button-link";
import { ServiceCard } from "@/components/services/service-card";
import { BookingCta } from "@/components/sections/booking-cta";

export const metadata: Metadata = {
  title: "Services — PPF, Ceramic & Graphene Coating, Detailing, Tint & Moto Pros",
  description: `Explore all automotive and motorcycle protection services at ${BRAND_CONFIG.displayName}, ${BRAND_CONFIG.location.fullAddress}: Paint Protection Film, Ceramic & Graphene Coating, Auto Detailing, Window Tint, and Moto Pros.`,
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        kicker="Services Directory"
        titleLines={[
          "Engineered Surface",
          <span key="accent" className="text-[#E11D2E]">
            Protection &amp; Detailing.
          </span>,
        ]}
        description="Five specialized service divisions for cars and motorcycles. Pricing is tailored to vehicle size, surface condition, and coverage scope after inspection."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Services" }]}
        image={{
          src: "/images/dev-placeholders/service-ppf.jpg",
          alt: "Development placeholder photo: paint protection film installation",
          isPlaceholder: true,
        }}
      >
        <ButtonLink
          href="/booking"
          size="lg"
          showArrow
          icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
        >
          Book Appointment
        </ButtonLink>
        <ButtonLink href="/contact" variant="secondary" size="lg">
          Request Consultation
        </ButtonLink>
      </PageHero>

      <MotionScope className="bg-[#090909] text-white">
        {/* Service Cards Directory Grid */}
        <section
          aria-labelledby="services-directory-heading"
          className="border-b border-[#292929] bg-[#090909] py-20 lg:py-28"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div data-animate="fade-up">
              <SectionHeading
                kicker="All Service Categories"
                title="Select a service division."
                description="Review key benefits and available options below, or open any division for its full process breakdown."
              />
            </div>

            <div
              data-animate="stagger"
              className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
            >
              {SERVICE_CATEGORIES.map((service) => (
                <ServiceCard
                  key={service.slug}
                  service={service}
                  headingLevel="h2"
                />
              ))}
            </div>
          </div>
        </section>

        {/* Detailed Category Showcases */}
        <section
          aria-label="Detailed Service Breakdown"
          className="border-b border-[#292929] bg-[#141414] py-20 lg:py-28"
        >
          <div className="mx-auto max-w-7xl space-y-20 px-4 sm:px-6">
            <div data-animate="fade-up">
              <SectionHeading
                kicker="Complete Specification Overview"
                title="Available treatments by category."
                description="Every service category includes multiple coverage and treatment options."
              />
            </div>

            {SERVICE_CATEGORIES.map((service, index) => (
              <article
                key={service.slug}
                data-animate="fade-up"
                className="grid grid-cols-1 items-start gap-10 border border-[#292929] bg-[#1C1C1C] p-6 sm:p-10 lg:grid-cols-12"
              >
                <div
                  className={`lg:col-span-5 ${
                    index % 2 === 1 ? "lg:order-2" : ""
                  }`}
                >
                  <StudioImagePlaceholder
                    src={service.image.src}
                    alt={service.image.alt}
                    isTemporaryPlaceholder={service.image.isPlaceholder}
                    aspectClassName="aspect-[16/10]"
                    sizes="(max-width: 1024px) 100vw, 42vw"
                    maskReveal
                  />

                  <div className="mt-6 border border-[#292929] bg-[#141414] p-5">
                    <h4 className="font-mono text-xs font-semibold tracking-[0.18em] text-[#E11D2E] uppercase">
                      Key Benefits
                    </h4>
                    <ul className="mt-3 space-y-2">
                      {service.benefits.map((benefit) => (
                        <li
                          key={benefit}
                          className="flex items-start gap-2.5 text-xs text-white"
                        >
                          <Check
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E11D2E]"
                            aria-hidden="true"
                          />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div
                  className={`lg:col-span-7 ${
                    index % 2 === 1 ? "lg:order-1" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold tracking-[0.2em] text-[#E11D2E] uppercase">
                      {service.kicker}
                    </span>
                    <span className="border border-[#292929] bg-[#141414] px-2.5 py-0.5 font-mono text-[10px] text-[#A3A3A3] uppercase">
                      {service.vehicleTypes.join(" / ")}
                    </span>
                  </div>

                  <h3 className="mt-3 font-display text-3xl font-extrabold tracking-[0.03em] text-white uppercase sm:text-4xl">
                    {service.title}
                  </h3>

                  <p className="mt-3 text-sm leading-relaxed text-[#A3A3A3] sm:text-base">
                    {service.description[0]}
                  </p>

                  <div className="mt-6 border-t border-[#292929] pt-6">
                    <h4 className="font-mono text-xs font-semibold tracking-[0.18em] text-white uppercase">
                      Available Options ({service.items.length})
                    </h4>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {service.items.map((item) => (
                        <div
                          key={item.id}
                          className="border border-[#292929] bg-[#141414] p-4"
                        >
                          <p className="font-display text-lg font-bold tracking-wide text-white uppercase">
                            {item.name}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-[#A3A3A3]">
                            {item.shortDescription}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <ButtonLink
                      href={`/services/${service.slug}`}
                      variant="secondary"
                      showArrow
                    >
                      View Details
                    </ButtonLink>
                    <ButtonLink
                      href={`/booking?service=${service.slug}`}
                      icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
                      showArrow
                    >
                      Book Appointment
                    </ButtonLink>
                    <Link
                      href="/contact"
                      className="ml-auto inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#A3A3A3] uppercase transition-colors hover:text-white"
                    >
                      Request Inquiry
                      <ArrowUpRight className="h-3.5 w-3.5 text-[#E11D2E]" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <BookingCta />
      </MotionScope>
    </>
  );
}
