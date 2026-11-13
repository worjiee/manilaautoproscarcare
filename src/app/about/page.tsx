import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Bike,
  Calendar,
  Car,
  Check,
  Layers,
  MapPin,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import { BRAND_CONFIG, SERVICE_CATEGORIES } from "@/lib/constants/site-data";
import { MotionScope } from "@/components/motion/motion-scope";
import { PageHero } from "@/components/ui/page-hero";
import { SectionHeading } from "@/components/ui/section-heading";
import { StudioImagePlaceholder } from "@/components/ui/studio-image-placeholder";
import { ButtonLink } from "@/components/ui/button-link";
import { XpelClaim } from "@/components/ui/dev-notice";
import { WhyChoose } from "@/components/sections/why-choose";
import { BookingCta } from "@/components/sections/booking-cta";

export const metadata: Metadata = {
  title: "About Manila Auto Pros",
  description: `Learn about ${BRAND_CONFIG.displayName} on ${BRAND_CONFIG.location.fullAddress} — our philosophy, surface preparation standards, and dedicated Car and Moto Pros service divisions.`,
};

const COMMITMENT_STANDARDS = [
  {
    code: "01",
    title: "Inspection Before Recommendation",
    description:
      "Every vehicle arrives with different paint condition, panel geometry, and driving exposure. We inspect surfaces first and tailor the recommended scope to the vehicle in front of us.",
  },
  {
    code: "02",
    title: "Surface Decontamination First",
    description:
      "Protective films and liquid coatings can only bond as well as the surface underneath. Proper washing, chemical decontamination, and clay preparation precede protection work.",
  },
  {
    code: "03",
    title: "Correction Where Required",
    description:
      "Before locking paint beneath urethane film or ceramic and graphene coatings, machine polishing and paint correction are available to address swirl marks, haze, and light defects.",
  },
  {
    code: "04",
    title: "Clear Aftercare Guidance",
    description:
      "Long-term preservation depends on safe washing habits after handover. Every appointment concludes with straightforward maintenance guidance suited to the installed protection.",
  },
] as const;

export default function AboutPage() {
  const carDivisions = SERVICE_CATEGORIES.filter((s) =>
    s.vehicleTypes.includes("Car")
  );
  const motoDivision = SERVICE_CATEGORIES.find((s) => s.slug === "moto-pros");

  return (
    <>
      {/* 1. Cinematic Page Header */}
      <PageHero
        kicker="About Manila Auto Pros"
        titleLines={[
          "Dedicated To Surface",
          <span key="accent" className="text-[#E11D2E]">
            Preservation.
          </span>,
        ]}
        description={`${BRAND_CONFIG.tagline} Located on ${BRAND_CONFIG.location.fullAddress}, serving both four-wheel vehicles and motorcycles.`}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "About" }]}
        image={{
          src: "/images/dev-placeholders/hero-studio.jpg",
          alt: "Development placeholder photo: studio view of a dark sports coupe",
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
        <ButtonLink href="/services" variant="secondary" size="lg">
          Explore Services
        </ButtonLink>
      </PageHero>

      <MotionScope className="bg-[#090909] text-white">
        {/* 2. Manila Auto Pros Introduction */}
        <section className="border-b border-[#292929] bg-[#090909] py-20 lg:py-28">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-12 px-4 sm:px-6 lg:grid-cols-12">
            <div data-animate="fade-up" className="lg:col-span-6">
              <SectionHeading
                kicker="Who We Are"
                title="A focused detailing and paint protection studio on Quiricada Street."
              />
              <div className="mt-6 space-y-5 text-base leading-relaxed text-[#A3A3A3]">
                <p className="text-white">
                  <strong>{BRAND_CONFIG.displayName}</strong> is an automotive
                  detailing and paint protection business located on{" "}
                  {BRAND_CONFIG.location.fullAddress}. Our focus is clear: help
                  owners protect their investment and preserve their
                  vehicle&apos;s appearance through disciplined surface
                  preparation and proven protective treatments.
                </p>
                <p>
                  Driving in Manila exposes painted surfaces, trim, and glass to
                  intense sun, heavy rain, dense traffic, and road debris. Left
                  unprotected, clear coats accumulate swirl marks, stone chips,
                  water spots, and UV fading.
                </p>
                <p>
                  By combining restorative auto detailing with paint protection
                  film, ceramic and graphene coatings, heat-rejection window
                  tint, and dedicated motorcycle care under one roof, we provide
                  a complete preservation workflow from preparation to long-term
                  protection.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-[#292929] pt-6 font-mono text-xs text-[#A3A3A3] uppercase">
                <span className="inline-flex items-center gap-2 text-white">
                  <MapPin className="h-4 w-4 text-[#E11D2E]" aria-hidden="true" />
                  {BRAND_CONFIG.location.fullAddress}
                </span>
                <span>•</span>
                <span>{BRAND_CONFIG.schedule.operatingDays}</span>
                <span>•</span>
                <span className="text-[#E11D2E]">
                  {BRAND_CONFIG.schedule.closedDays}
                </span>
              </div>
            </div>

            <div data-animate="fade-up" className="lg:col-span-6">
              <StudioImagePlaceholder
                src="/images/dev-placeholders/service-ppf.jpg"
                alt="Development placeholder photo: technician applying paint protection film"
                caption="PLACEHOLDER IMAGE // STUDIO PHOTOGRAPHY TO BE SUPPLIED BY CLIENT"
                aspectClassName="aspect-[16/11]"
                sizes="(max-width: 1024px) 100vw, 50vw"
                maskReveal
              />
            </div>
          </div>
        </section>

        {/* 3. Business Philosophy */}
        <section className="border-b border-[#292929] bg-[#141414] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div data-animate="fade-up" className="grid grid-cols-1 gap-10 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <SectionHeading
                  kicker="Business Philosophy"
                  title="Preparation defines the final finish."
                />
              </div>

              <div className="space-y-6 lg:col-span-7">
                <blockquote className="border-l-2 border-[#E11D2E] bg-[#1C1C1C] p-6 sm:p-8">
                  <p className="font-mono text-xs font-semibold tracking-[0.18em] text-[#E11D2E] uppercase">
                    Guiding Principle
                  </p>
                  <p className="mt-2 font-display text-2xl font-extrabold tracking-wide text-white uppercase sm:text-3xl">
                    &ldquo;{BRAND_CONFIG.tagline}&rdquo;
                  </p>
                </blockquote>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="border border-[#292929] bg-[#1C1C1C] p-6">
                    <h3 className="font-display text-xl font-bold tracking-wider text-white uppercase">
                      No One-Size-Fits-All Packages
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-[#A3A3A3]">
                      A brand-new vehicle seeking preventive film coverage has
                      different requirements from a daily-driven car needing
                      multi-step paint correction. We recommend only the work
                      your vehicle actually needs.
                    </p>
                  </div>

                  <div className="border border-[#292929] bg-[#1C1C1C] p-6">
                    <h3 className="font-display text-xl font-bold tracking-wider text-white uppercase">
                      Layered Defense
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-[#A3A3A3]">
                      Different threats require different solutions: urethane
                      film for physical stone chips, ceramic or graphene
                      coatings for chemical and UV defense, detailing for
                      surface clarity, and window tint for cabin heat control.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Commitment to Professional Installation */}
        <section className="border-b border-[#292929] bg-[#090909] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div data-animate="fade-up">
              <SectionHeading
                kicker="Installation Standards"
                title="Our commitment to disciplined execution."
                description="From initial inspection to final handover, every appointment follows a structured workflow designed to protect your vehicle's factory finish."
              />
            </div>

            <div
              data-animate="stagger"
              className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {COMMITMENT_STANDARDS.map((step) => (
                <div
                  key={step.code}
                  data-animate-item
                  className="flex flex-col justify-between border border-[#292929] bg-[#1C1C1C] p-6"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-[#292929] pb-4">
                      <span className="font-mono text-2xl font-bold text-[#E11D2E]">
                        {step.code}
                      </span>
                      <span className="font-mono text-[10px] tracking-[0.18em] text-[#A3A3A3] uppercase">
                        Workflow
                      </span>
                    </div>
                    <h3 className="mt-5 font-display text-2xl font-bold tracking-wide text-white uppercase">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#A3A3A3]">
                      {step.description}
                    </p>
                  </div>
                  <div className="mt-6 h-0.5 w-10 bg-[#E11D2E]" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Automotive Protection Expertise */}
        <section className="border-b border-[#292929] bg-[#141414] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div data-animate="fade-up">
              <SectionHeading
                kicker="Core Specialties"
                title="Automotive & motorcycle protection expertise."
                description="Our studio covers five complementary disciplines so you can address paint, glass, and interior care in one facility."
              />
            </div>

            <div
              data-animate="stagger"
              className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
              <div
                data-animate-item
                className="border border-[#292929] bg-[#1C1C1C] p-7"
              >
                <ShieldCheck className="h-6 w-6 text-[#E11D2E]" aria-hidden="true" />
                <h3 className="mt-4 font-display text-2xl font-bold tracking-wide text-white uppercase">
                  Paint Protection Film (PPF)
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#A3A3A3]">
                  Clear, black, and matte PPF installations with full-body or
                  partial coverage options to defend painted panels against
                  stone chips and abrasion.
                </p>
                <div className="mt-4 text-xs">
                  <XpelClaim className="font-mono tracking-wider text-white uppercase" />
                </div>
              </div>

              <div
                data-animate-item
                className="border border-[#292929] bg-[#1C1C1C] p-7"
              >
                <Layers className="h-6 w-6 text-[#E11D2E]" aria-hidden="true" />
                <h3 className="mt-4 font-display text-2xl font-bold tracking-wide text-white uppercase">
                  Ceramic &amp; Graphene Coatings
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#A3A3A3]">
                  Single and multi-layer ceramic and graphene coating packages
                  paired with paint enhancement for deep gloss and hydrophobic
                  ease of cleaning.
                </p>
              </div>

              <div
                data-animate-item
                className="border border-[#292929] bg-[#1C1C1C] p-7"
              >
                <Sparkles className="h-6 w-6 text-[#E11D2E]" aria-hidden="true" />
                <h3 className="mt-4 font-display text-2xl font-bold tracking-wide text-white uppercase">
                  Auto Detailing &amp; Correction
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#A3A3A3]">
                  Full detailing, multi-step paint correction, machine
                  polishing, paint decontamination, and dedicated interior and
                  exterior detailing.
                </p>
              </div>

              <div
                data-animate-item
                className="border border-[#292929] bg-[#1C1C1C] p-7"
              >
                <Sun className="h-6 w-6 text-[#E11D2E]" aria-hidden="true" />
                <h3 className="mt-4 font-display text-2xl font-bold tracking-wide text-white uppercase">
                  Automotive Window Tint
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#A3A3A3]">
                  Premium window tint installation and heat-rejection window
                  films engineered to reduce cabin heat, glare, and UV exposure.
                </p>
              </div>

              <div
                data-animate-item
                className="border border-[#292929] bg-[#1C1C1C] p-7 md:col-span-2 lg:col-span-2"
              >
                <Bike className="h-6 w-6 text-[#E11D2E]" aria-hidden="true" />
                <h3 className="mt-4 font-display text-2xl font-bold tracking-wide text-white uppercase">
                  Moto Pros Motorcycle Division
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#A3A3A3]">
                  Dedicated motorcycle ceramic coating, graphene coating, PPF
                  installation, detailing, and paint protection packages built
                  for two-wheel machines.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Car and Motorcycle Service Divisions */}
        <section className="border-b border-[#292929] bg-[#090909] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div data-animate="fade-up">
              <SectionHeading
                kicker="Service Divisions"
                title="Dedicated care for four wheels and two wheels."
                description="Whether you drive a daily commuter, weekend sports car, SUV, or motorcycle, our services are organized around your vehicle category."
              />
            </div>

            <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Car Division */}
              <div
                data-animate="fade-up"
                className="flex flex-col justify-between border border-[#292929] bg-[#1C1C1C] p-7 sm:p-9"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-[#292929] pb-4">
                    <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.18em] text-[#E11D2E] uppercase">
                      <Car className="h-4 w-4" aria-hidden="true" />
                      Division 01 // Four-Wheel
                    </span>
                    <span className="font-mono text-xs text-[#A3A3A3]">
                      CARS • SUVS • PICKUPS
                    </span>
                  </div>

                  <h3 className="mt-5 font-display text-3xl font-extrabold tracking-wide text-white uppercase">
                    Automotive Detailing &amp; Protection
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#A3A3A3]">
                    Complete exterior and interior care across four specialized
                    automotive service categories:
                  </p>

                  <ul className="mt-6 space-y-3">
                    {carDivisions.map((cat) => (
                      <li
                        key={cat.slug}
                        className="flex items-center justify-between border border-[#292929] bg-[#141414] px-4 py-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <Check
                            className="h-4 w-4 shrink-0 text-[#E11D2E]"
                            aria-hidden="true"
                          />
                          <span className="font-display text-lg font-bold tracking-wide text-white uppercase">
                            {cat.title}
                          </span>
                        </div>
                        <Link
                          href={`/services/${cat.slug}`}
                          className="inline-flex items-center gap-1 font-mono text-xs text-[#A3A3A3] uppercase transition-colors hover:text-white"
                        >
                          Details
                          <ArrowUpRight className="h-3.5 w-3.5 text-[#E11D2E]" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-4">
                  <ButtonLink href="/booking?vehicle=Car" showArrow>
                    Book Car Appointment
                  </ButtonLink>
                </div>
              </div>

              {/* Motorcycle Division (Moto Pros) */}
              <div
                data-animate="fade-up"
                className="flex flex-col justify-between border border-[#292929] bg-[#1C1C1C] p-7 sm:p-9"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-[#292929] pb-4">
                    <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.18em] text-[#E11D2E] uppercase">
                      <Bike className="h-4 w-4" aria-hidden="true" />
                      Division 02 // Two-Wheel
                    </span>
                    <span className="font-mono text-xs text-[#A3A3A3]">
                      MOTO PROS
                    </span>
                  </div>

                  <h3 className="mt-5 font-display text-3xl font-extrabold tracking-wide text-white uppercase">
                    Moto Pros Motorcycle Care
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#A3A3A3]">
                    Motorcycles have exposed mechanical assemblies, compact
                    painted fairings, and high-friction tank zones that benefit
                    from specialized protection:
                  </p>

                  {motoDivision && (
                    <ul className="mt-6 space-y-3">
                      {motoDivision.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center gap-2.5 border border-[#292929] bg-[#141414] px-4 py-3"
                        >
                          <Check
                            className="h-4 w-4 shrink-0 text-[#E11D2E]"
                            aria-hidden="true"
                          />
                          <span className="font-display text-lg font-bold tracking-wide text-white uppercase">
                            {item.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-8 flex flex-wrap gap-3 pt-4">
                  <ButtonLink href="/booking?vehicle=Motorcycle" showArrow>
                    Book Motorcycle Appointment
                  </ButtonLink>
                  <ButtonLink href="/services/moto-pros" variant="secondary">
                    Explore Moto Pros
                  </ButtonLink>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Why Choose Us Section */}
        <WhyChoose />

        {/* 8. Booking Call-to-Action */}
        <BookingCta />
      </MotionScope>
    </>
  );
}
