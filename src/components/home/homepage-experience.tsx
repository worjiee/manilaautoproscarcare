"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  Layers,
  Sun,
  Bike,
  Car,
  MapPin,
  Clock,
  CheckCircle2,
  Calendar,
  Compass,
  Info,
} from "lucide-react";
import {
  BRAND_CONFIG,
  SERVICE_CATEGORIES,
  WHY_CHOOSE_PILLARS,
  FEATURED_GALLERY_PLACEHOLDERS,
} from "@/lib/constants/site-data";
import { SectionHeading } from "@/components/ui/section-heading";
import { StudioImagePlaceholder } from "@/components/ui/studio-image-placeholder";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function HomepageExperience() {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: "(min-width: 768px)",
          isMobile: "(max-width: 767px)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { isDesktop, reduceMotion } = context.conditions as {
            isDesktop: boolean;
            isMobile: boolean;
            reduceMotion: boolean;
          };

          if (reduceMotion) {
            gsap.set(
              "[data-hero-kicker], [data-hero-line], [data-hero-sub], [data-hero-cta], [data-hero-visual], [data-reveal], [data-service-card], [data-gallery-card]",
              { autoAlpha: 1, y: 0, x: 0, scale: 1, clipPath: "none" }
            );
            return;
          }

          // 1. Cinematic Hero Timeline
          const heroTl = gsap.timeline({
            defaults: { ease: "power3.out" },
          });

          heroTl
            .fromTo(
              "[data-hero-visual]",
              {
                autoAlpha: 0,
                scale: 1.06,
                clipPath: "inset(8% 8% 8% 8%)",
              },
              {
                autoAlpha: 1,
                scale: 1,
                clipPath: "inset(0% 0% 0% 0%)",
                duration: 1.15,
                ease: "power4.out",
              }
            )
            .fromTo(
              "[data-hero-kicker]",
              { autoAlpha: 0, y: 16 },
              { autoAlpha: 1, y: 0, duration: 0.55 },
              "-=0.8"
            )
            .fromTo(
              "[data-hero-line]",
              { autoAlpha: 0, y: 36 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.7,
                stagger: 0.12,
              },
              "-=0.45"
            )
            .fromTo(
              "[data-hero-sub]",
              { autoAlpha: 0, y: 20 },
              { autoAlpha: 1, y: 0, duration: 0.6 },
              "-=0.4"
            )
            .fromTo(
              "[data-hero-cta]",
              { autoAlpha: 0, y: 18 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.55,
                stagger: 0.08,
              },
              "-=0.35"
            );

          // Subtle Hero Parallax on desktop only
          if (isDesktop) {
            gsap.to("[data-hero-parallax]", {
              yPercent: 10,
              ease: "none",
              scrollTrigger: {
                trigger: "[data-hero-section]",
                start: "top top",
                end: "bottom top",
                scrub: true,
              },
            });
          }

          // 2. Scroll-triggered Section Reveals
          const revealSections = gsap.utils.toArray<HTMLElement>("[data-reveal]");
          revealSections.forEach((el) => {
            gsap.fromTo(
              el,
              { autoAlpha: 0, y: isDesktop ? 32 : 18 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.75,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: el,
                  start: "top 86%",
                  once: true,
                },
              }
            );
          });

          // 3. Staggered Service Cards
          const serviceCards = gsap.utils.toArray<HTMLElement>("[data-service-card]");
          if (serviceCards.length > 0) {
            gsap.fromTo(
              serviceCards,
              { autoAlpha: 0, y: isDesktop ? 36 : 20 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.7,
                stagger: isDesktop ? 0.1 : 0.06,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: "[data-services-grid]",
                  start: "top 82%",
                  once: true,
                },
              }
            );
          }

          // 4. Staggered Gallery Cards
          const galleryCards = gsap.utils.toArray<HTMLElement>("[data-gallery-card]");
          if (galleryCards.length > 0) {
            gsap.fromTo(
              galleryCards,
              { autoAlpha: 0, y: isDesktop ? 32 : 18 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.7,
                stagger: isDesktop ? 0.12 : 0.06,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: "[data-gallery-grid]",
                  start: "top 84%",
                  once: true,
                },
              }
            );
          }
        }
      );
    },
    { scope: rootRef }
  );

  return (
    <div ref={rootRef} className="bg-[#090909] text-white">
      {/* =====================================================================
          SECTION 2: CINEMATIC AUTOMOTIVE HERO SECTION
      ===================================================================== */}
      <section
        data-hero-section
        className="relative overflow-hidden border-b border-[#292929] bg-[#090909] bg-studio-grid pt-10 pb-20 lg:pt-16 lg:pb-28"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
            {/* Hero Left Column: Typography & Inquiry CTAs */}
            <div className="z-10 lg:col-span-7">
              <div
                data-hero-kicker
                className="inline-flex flex-wrap items-center gap-2.5 border border-[#292929] bg-[#141414] px-3.5 py-1.5"
              >
                <span className="h-2 w-2 bg-[#E11D2E]" aria-hidden="true" />
                <span className="font-mono text-xs font-semibold tracking-[0.2em] uppercase text-white">
                  QUIRICADA ST., MANILA • AUTOMOTIVE &amp; MOTO PROS STUDIO
                </span>
              </div>

              <h1 className="mt-6 font-display text-5xl leading-[0.94] font-extrabold tracking-[0.02em] uppercase text-white sm:text-6xl lg:text-7xl">
                <span data-hero-line className="block">
                  PROTECT YOUR <span className="text-[#E11D2E]">INVESTMENT.</span>
                </span>
                <span data-hero-line className="mt-1 block">
                  PRESERVE YOUR VEHICLE&apos;S BEAUTY.
                </span>
              </h1>

              <p
                data-hero-sub
                className="mt-6 max-w-2xl text-base leading-relaxed text-[#A3A3A3] sm:text-lg"
              >
                Manila Auto Pros is a dedicated surface protection and detailing
                facility on Quiricada Street, Manila. From precision XPEL Paint
                Protection Film and multi-layer ceramic or graphene coatings to
                surgical paint correction, solar window tinting, and Moto Pros
                two-wheel protection.
              </p>

              {/* Primary Hero CTAs */}
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/booking"
                  data-hero-cta
                  className="group inline-flex items-center gap-3 bg-[#E11D2E] px-7 py-4 font-display text-base font-bold tracking-[0.14em] uppercase text-white transition-colors duration-200 hover:bg-[#FF3045]"
                >
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  <span>Schedule Appointment</span>
                  <ArrowUpRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden="true"
                  />
                </Link>

                <Link
                  href="/services"
                  data-hero-cta
                  className="inline-flex items-center gap-3 border border-[#292929] bg-[#141414] px-7 py-4 font-display text-base font-bold tracking-[0.14em] uppercase text-white transition-colors duration-200 hover:border-white/40 hover:bg-[#1C1C1C]"
                >
                  <span>Explore Protection Packages</span>
                </Link>
              </div>

              {/* Hero Telemetry Strip */}
              <div
                data-hero-cta
                className="mt-12 grid grid-cols-1 gap-4 border-t border-[#292929] pt-6 sm:grid-cols-3"
              >
                <div className="border-l-2 border-[#E11D2E] pl-3.5">
                  <p className="font-mono text-[11px] tracking-[0.16em] uppercase text-[#A3A3A3]">
                    FILM &amp; COATING ARMOR
                  </p>
                  <p className="mt-1 font-display text-lg font-bold tracking-wide uppercase text-white">
                    PPF • CERAMIC • GRAPHENE
                  </p>
                </div>

                <div className="border-l-2 border-[#292929] pl-3.5">
                  <p className="font-mono text-[11px] tracking-[0.16em] uppercase text-[#A3A3A3]">
                    VEHICLE DIVISIONS
                  </p>
                  <p className="mt-1 font-display text-lg font-bold tracking-wide uppercase text-white">
                    CARS &amp; MOTO PROS
                  </p>
                </div>

                <div className="border-l-2 border-[#292929] pl-3.5">
                  <p className="font-mono text-[11px] tracking-[0.16em] uppercase text-[#A3A3A3]">
                    STUDIO SCHEDULE
                  </p>
                  <p className="mt-1 font-display text-lg font-bold tracking-wide uppercase text-white">
                    MON – SAT (SUN CLOSED)
                  </p>
                </div>
              </div>
            </div>

            {/* Hero Right Column: Cinematic Visual Frame */}
            <div className="lg:col-span-5">
              <div
                data-hero-visual
                className="relative overflow-hidden border border-[#292929] bg-[#141414]"
              >
                {/* Top Frame Header */}
                <div className="flex items-center justify-between border-b border-[#292929] bg-[#090909] px-4 py-2.5 font-mono text-[11px] tracking-[0.16em] uppercase text-[#A3A3A3]">
                  <span className="flex items-center gap-2 text-white">
                    <span className="h-2 w-2 bg-[#E11D2E]" />
                    STUDIO BAY TELEMETRY
                  </span>
                  <span>QUIRICADA ST. // MANILA</span>
                </div>

                <div
                  data-hero-parallax
                  className="relative aspect-[16/11] w-full overflow-hidden"
                >
                  <Image
                    src="/images/placeholders/hero-studio.svg"
                    alt="Temporary Studio Asset Placeholder — Manila Auto Pros Detailing & PPF Bay"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    className="object-cover"
                  />
                </div>

                {/* Accreditation Draft Notice Bar */}
                <div className="border-t border-[#292929] bg-[#1C1C1C] p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck
                      className="mt-0.5 h-5 w-5 shrink-0 text-[#E11D2E]"
                      aria-hidden="true"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-sm font-bold tracking-[0.1em] uppercase text-white">
                          {BRAND_CONFIG.xpelClaim.text}
                        </p>
                        <span className="border border-[#292929] bg-[#090909] px-1.5 py-0.5 font-mono text-[10px] text-[#A3A3A3]">
                          DRAFT CLAIM — PENDING VERIFICATION
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#A3A3A3]">
                        Full-body and high-impact partial urethane film
                        installations in Clear, Black, and Matte finishes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: BRAND INTRODUCTION
      ===================================================================== */}
      <section className="border-b border-[#292929] bg-[#141414] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div
            data-reveal
            className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12"
          >
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-2.5">
                <span className="h-0.5 w-6 bg-[#E11D2E]" aria-hidden="true" />
                <span className="font-mono text-xs font-semibold tracking-[0.22em] uppercase text-[#E11D2E]">
                  ABOUT MANILA AUTO PROS
                </span>
              </div>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-[0.03em] uppercase text-white sm:text-4xl lg:text-5xl">
                BUILT FOR OWNERS WHO REFUSE COMPROMISE ON SURFACE FINISH.
              </h2>

              <div className="mt-8 border-l-2 border-[#E11D2E] bg-[#1C1C1C] p-5">
                <p className="font-mono text-xs tracking-[0.15em] uppercase text-[#E11D2E]">
                  STUDIO MANDATE
                </p>
                <p className="mt-2 font-display text-xl font-bold tracking-wide uppercase text-white">
                  &ldquo;{BRAND_CONFIG.tagline}&rdquo;
                </p>
              </div>
            </div>

            <div className="space-y-6 lg:col-span-7">
              <p className="text-base leading-relaxed text-white sm:text-lg">
                Situated on Quiricada Street in Manila,{" "}
                <strong className="font-semibold text-white">
                  Manila Auto Pros
                </strong>{" "}
                was established to bring disciplined, studio-grade paint
                preservation and restorative detailing to daily drivers,
                executive fleets, weekend sportscars, and high-performance
                motorcycles.
              </p>
              <p className="text-base leading-relaxed text-[#A3A3A3]">
                Metro Manila’s dense traffic, intense tropical UV index, sudden
                downpours, and airborne road grit rapidly degrade unprotected
                factory clear coats. Rather than masking defects with temporary
                glazes, our technicians focus on foundational surface
                decontamination, measured machine correction, and long-term
                physical or chemical barriers.
              </p>

              <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
                <div className="border border-[#292929] bg-[#1C1C1C] p-5">
                  <div className="flex items-center gap-3">
                    <Car className="h-5 w-5 text-[#E11D2E]" aria-hidden="true" />
                    <h3 className="font-display text-xl font-bold tracking-wider uppercase text-white">
                      Automotive Studio
                    </h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#A3A3A3]">
                    XPEL Paint Protection Film, Ceramic &amp; Graphene Coatings,
                    Multi-Stage Paint Correction, Interior/Exterior Detailing,
                    and Heat-Rejection Window Tint.
                  </p>
                </div>

                <div className="border border-[#292929] bg-[#1C1C1C] p-5">
                  <div className="flex items-center gap-3">
                    <Bike className="h-5 w-5 text-[#E11D2E]" aria-hidden="true" />
                    <h3 className="font-display text-xl font-bold tracking-wider uppercase text-white">
                      Moto Pros Division
                    </h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#A3A3A3]">
                    Specialized two-wheel care including Motorcycle PPF tank and
                    fairing kits, Ceramic &amp; Graphene coatings, and intricate
                    mechanical detailing.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/about"
                  className="group inline-flex items-center gap-2 font-display text-sm font-bold tracking-[0.16em] uppercase text-white transition-colors hover:text-[#E11D2E]"
                >
                  <span>Learn More About Our Studio</span>
                  <ArrowUpRight
                    className="h-4 w-4 text-[#E11D2E] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 4: FEATURED SERVICES (ALL 5 CORE DIVISIONS)
      ===================================================================== */}
      <section className="border-b border-[#292929] bg-[#090909] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div
            data-reveal
            className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end"
          >
            <SectionHeading
              kicker="CORE PROTECTION & RESTORATION DIVISIONS"
              title="ENGINEERED SURFACE CARE FOR CARS & MOTORCYCLES."
              description="Every vehicle configuration and paint condition requires a tailored approach. Select a division below to explore specifications or request a bespoke consultation."
            />
            <Link
              href="/services"
              className="inline-flex shrink-0 items-center gap-2 border border-[#292929] bg-[#141414] px-6 py-3.5 font-display text-sm font-bold tracking-[0.14em] uppercase text-white transition-colors hover:border-[#E11D2E] hover:bg-[#1C1C1C]"
            >
              <span>View Complete Service Catalog</span>
              <ArrowUpRight className="h-4 w-4 text-[#E11D2E]" aria-hidden="true" />
            </Link>
          </div>

          <div
            data-services-grid
            className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
          >
            {SERVICE_CATEGORIES.map((category) => (
              <article
                key={category.slug}
                data-service-card
                className="group flex flex-col justify-between border border-[#292929] bg-[#1C1C1C] transition-colors duration-300 hover:border-[#E11D2E]"
              >
                <div>
                  <StudioImagePlaceholder
                    src={category.placeholderAsset.src}
                    alt={category.placeholderAsset.alt}
                    aspectClassName="aspect-[16/10]"
                    className="border-x-0 border-t-0"
                  />

                  <div className="p-6 sm:p-7">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold tracking-[0.16em] uppercase text-[#E11D2E]">
                        {category.kicker}
                      </span>
                      <span className="border border-[#292929] bg-[#141414] px-2 py-0.5 font-mono text-[10px] uppercase text-[#A3A3A3]">
                        {category.vehicleTypes.join(" / ")}
                      </span>
                    </div>

                    <h3 className="mt-3 font-display text-2xl font-extrabold tracking-[0.04em] uppercase text-white sm:text-3xl">
                      {category.title}
                    </h3>

                    <p className="mt-2.5 text-sm leading-relaxed text-[#A3A3A3]">
                      {category.description}
                    </p>

                    {/* Sub-services checklist */}
                    <ul className="mt-5 space-y-2 border-t border-[#292929] pt-4">
                      {category.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center gap-2.5 text-xs font-medium text-white"
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 bg-[#E11D2E]"
                            aria-hidden="true"
                          />
                          <span>{item.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Inquiry-Based CTA Footer (No Public Prices) */}
                <div className="border-t border-[#292929] bg-[#141414] px-6 py-4 sm:px-7">
                  <div className="flex items-center justify-between gap-4">
                    <Link
                      href={`/services/${category.slug}`}
                      className="inline-flex items-center gap-1.5 font-display text-sm font-bold tracking-[0.14em] uppercase text-white transition-colors group-hover:text-[#E11D2E]"
                    >
                      <span>Inspect Specifications</span>
                      <ArrowUpRight
                        className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        aria-hidden="true"
                      />
                    </Link>

                    <Link
                      href={`/booking?service=${category.slug}`}
                      className="border border-[#292929] bg-[#1C1C1C] px-3 py-1.5 font-mono text-[11px] font-semibold tracking-wider uppercase text-white transition-colors hover:border-[#E11D2E] hover:bg-[#E11D2E]"
                    >
                      Inquire / Book
                    </Link>
                  </div>
                </div>
              </article>
            ))}

            {/* 6th Card: Bespoke Multi-Service Consultation Card */}
            <article
              data-service-card
              className="flex flex-col justify-between border border-[#E11D2E]/60 bg-[#141414] p-6 sm:p-8"
            >
              <div>
                <span className="inline-flex items-center gap-2 border border-[#292929] bg-[#1C1C1C] px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase text-[#E11D2E]">
                  BESPOKE PROTECTION ASSESSMENT
                </span>

                <h3 className="mt-5 font-display text-3xl font-extrabold tracking-[0.04em] uppercase text-white">
                  NOT SURE WHICH PROTECTION LAYER FITS YOUR BUILD?
                </h3>

                <p className="mt-4 text-sm leading-relaxed text-[#A3A3A3]">
                  Because vehicle size, paint condition, usage profile, and film
                  coverage vary significantly, we evaluate each car or
                  motorcycle individually rather than publishing one-size-fits-all
                  pricing.
                </p>

                <div className="mt-6 space-y-3 border-t border-[#292929] pt-5 text-xs text-white">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#E11D2E]"
                      aria-hidden="true"
                    />
                    <span>
                      Tailored combinations (e.g., Front-End Partial PPF +
                      Full-Body Ceramic Coating)
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#E11D2E]"
                      aria-hidden="true"
                    />
                    <span>
                      Under-light paint inspection on Quiricada Street before
                      work begins
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#E11D2E]"
                      aria-hidden="true"
                    />
                    <span>
                      Dedicated scheduling for both 4-wheel vehicles and Moto
                      Pros motorcycles
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <Link
                  href="/booking"
                  className="flex w-full items-center justify-center gap-2 bg-[#E11D2E] px-6 py-3.5 font-display text-sm font-bold tracking-[0.14em] uppercase text-white transition-colors hover:bg-[#FF3045]"
                >
                  <span>Request Appointment Slot</span>
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/contact"
                  className="flex w-full items-center justify-center gap-2 border border-[#292929] bg-[#1C1C1C] px-6 py-3.5 font-display text-sm font-bold tracking-[0.14em] uppercase text-white transition-colors hover:border-white/40"
                >
                  <span>Speak With Our Team</span>
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 5: WHY CHOOSE MANILA AUTO PROS
      ===================================================================== */}
      <section className="border-b border-[#292929] bg-[#141414] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div data-reveal>
            <SectionHeading
              kicker="STUDIO STANDARDS & METHODOLOGY"
              title="WHY DISCERNING OWNERS TRUST MANILA AUTO PROS."
              description="Every step in our workflow is designed to protect factory clear coat integrity, eliminate surface contamination, and deliver clean, long-lasting installations."
            />
          </div>

          <div
            data-reveal
            className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {WHY_CHOOSE_PILLARS.map((pillar) => (
              <div
                key={pillar.code}
                className="flex flex-col justify-between border border-[#292929] bg-[#1C1C1C] p-6 transition-colors hover:border-[#E11D2E]"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-[#292929] pb-4">
                    <span className="font-mono text-2xl font-bold text-[#E11D2E]">
                      {pillar.code}
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#A3A3A3]">
                      PROTOCOL
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-2xl font-bold tracking-[0.03em] uppercase text-white">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#A3A3A3]">
                    {pillar.description}
                  </p>
                </div>

                <div className="mt-6 h-0.5 w-10 bg-[#E11D2E]" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 6: PAINT PROTECTION & DETAILING HIGHLIGHTS
      ===================================================================== */}
      <section className="border-b border-[#292929] bg-[#090909] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div data-reveal>
            <SectionHeading
              kicker="TECHNICAL ARCHITECTURE"
              title="MULTI-DISCIPLINE SURFACE DEFENSE."
              description="Understanding how urethane films, molecular coatings, corrective polishing, and solar window films work together to preserve your vehicle inside and out."
            />
          </div>

          <div
            data-reveal
            className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-12"
          >
            {/* Highlight 1: PPF Architecture */}
            <div className="border border-[#292929] bg-[#1C1C1C] p-7 sm:p-9 lg:col-span-6">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.18em] uppercase text-[#E11D2E]">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  URETHANE IMPACT BARRIER
                </span>
                <span className="font-mono text-xs text-[#A3A3A3]">
                  CLEAR • BLACK • MATTE
                </span>
              </div>

              <h3 className="mt-4 font-display text-3xl font-extrabold tracking-[0.03em] uppercase text-white">
                XPEL PAINT PROTECTION FILM OPTIONS
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-[#A3A3A3]">
                Unlike liquid coatings alone, Paint Protection Film absorbs
                physical impacts from gravel, road rash, and minor abrasions.
                Available in optically clear gloss, deep piano black accents, or
                stealth matte finishes.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="border border-[#292929] bg-[#141414] p-4">
                  <p className="font-display text-base font-bold tracking-wider uppercase text-white">
                    Full Body PPF
                  </p>
                  <p className="mt-1 text-xs text-[#A3A3A3]">
                    Complete exterior panel encapsulation for maximum archival
                    preservation.
                  </p>
                </div>
                <div className="border border-[#292929] bg-[#141414] p-4">
                  <p className="font-display text-base font-bold tracking-wider uppercase text-white">
                    Partial / Strike-Zone PPF
                  </p>
                  <p className="mt-1 text-xs text-[#A3A3A3]">
                    Targeted protection for front bumpers, hoods, fenders,
                    headlights, and mirrors.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-[#292929] pt-5">
                <span className="font-mono text-[11px] text-[#A3A3A3]">
                  *Draft claim: Accredited XPEL dealer/installer (verify prior
                  to launch)
                </span>
                <Link
                  href="/services/paint-protection-film"
                  className="inline-flex items-center gap-1.5 font-display text-sm font-bold tracking-wider uppercase text-[#E11D2E] hover:text-[#FF3045]"
                >
                  <span>PPF Details</span>
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Highlight 2: Ceramic & Graphene Matrix */}
            <div className="border border-[#292929] bg-[#1C1C1C] p-7 sm:p-9 lg:col-span-6">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.18em] uppercase text-[#E11D2E]">
                  <Layers className="h-4 w-4" aria-hidden="true" />
                  HYDROPHOBIC MOLECULAR BOND
                </span>
                <span className="font-mono text-xs text-[#A3A3A3]">
                  SINGLE &amp; MULTI-LAYER
                </span>
              </div>

              <h3 className="mt-4 font-display text-3xl font-extrabold tracking-[0.03em] uppercase text-white">
                CERAMIC &amp; GRAPHENE COATING ARCHITECTURES
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-[#A3A3A3]">
                Engineered to defend clear coats against UV oxidation, chemical
                etching, and tropical grime. Our coatings create an ultra-slick
                hydrophobic surface that makes routine washing faster and safer.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="border border-[#292929] bg-[#141414] p-4">
                  <p className="font-display text-base font-bold tracking-wider uppercase text-white">
                    Premium Ceramic Coating
                  </p>
                  <p className="mt-1 text-xs text-[#A3A3A3]">
                    Deep glass-like gloss, high contact-angle water beading, and
                    chemical resistance.
                  </p>
                </div>
                <div className="border border-[#292929] bg-[#141414] p-4">
                  <p className="font-display text-base font-bold tracking-wider uppercase text-white">
                    Graphene &amp; Multi-Layer
                  </p>
                  <p className="mt-1 text-xs text-[#A3A3A3]">
                    Enhanced thermal dispersion and multi-coat durability for
                    demanding conditions.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-[#292929] pt-5">
                <span className="font-mono text-[11px] text-[#A3A3A3]">
                  Includes Paint Enhancement &amp; Decontamination Prep
                </span>
                <Link
                  href="/services/ceramic-graphene-coating"
                  className="inline-flex items-center gap-1.5 font-display text-sm font-bold tracking-wider uppercase text-[#E11D2E] hover:text-[#FF3045]"
                >
                  <span>Coating Details</span>
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Highlight 3: Restorative Auto Detailing, Window Tint & Moto Pros */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:col-span-12">
              <div className="border border-[#292929] bg-[#141414] p-6">
                <Sparkles className="h-5 w-5 text-[#E11D2E]" aria-hidden="true" />
                <h4 className="mt-4 font-display text-2xl font-bold tracking-wide uppercase text-white">
                  Paint Correction &amp; Full Detailing
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-[#A3A3A3]">
                  Paint decontamination, machine polishing, multi-stage defect
                  correction, and deep interior/exterior detailing to reset
                  worn surfaces.
                </p>
                <Link
                  href="/services/auto-detailing"
                  className="mt-4 inline-flex items-center gap-1 font-mono text-xs font-semibold uppercase text-white hover:text-[#E11D2E]"
                >
                  Explore Detailing <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="border border-[#292929] bg-[#141414] p-6">
                <Sun className="h-5 w-5 text-[#E11D2E]" aria-hidden="true" />
                <h4 className="mt-4 font-display text-2xl font-bold tracking-wide uppercase text-white">
                  Heat-Rejection Window Films
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-[#A3A3A3]">
                  Premium automotive window tint installations designed to block
                  infrared cabin heat and UV rays while preserving driver
                  visibility.
                </p>
                <Link
                  href="/services/automotive-window-tint"
                  className="mt-4 inline-flex items-center gap-1 font-mono text-xs font-semibold uppercase text-white hover:text-[#E11D2E]"
                >
                  Explore Window Tint <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="border border-[#292929] bg-[#141414] p-6">
                <Bike className="h-5 w-5 text-[#E11D2E]" aria-hidden="true" />
                <h4 className="mt-4 font-display text-2xl font-bold tracking-wide uppercase text-white">
                  Moto Pros Two-Wheel Care
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-[#A3A3A3]">
                  Dedicated motorcycle PPF installation, ceramic and graphene
                  coatings, and precision detailing for fairings, tanks, and
                  wheels.
                </p>
                <Link
                  href="/services/moto-pros"
                  className="mt-4 inline-flex items-center gap-1 font-mono text-xs font-semibold uppercase text-white hover:text-[#E11D2E]"
                >
                  Explore Moto Pros <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 7: FEATURED PROJECT GALLERY (PLACEHOLDER SLOTS)
      ===================================================================== */}
      <section className="border-b border-[#292929] bg-[#141414] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div
            data-reveal
            className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end"
          >
            <SectionHeading
              kicker="STUDIO PORTFOLIO & TRANSFORMATIONS"
              title="FEATURED PROJECT GALLERY."
              description="Reserved showcase slots structured for genuine Manila Auto Pros shop and vehicle transformation photography."
            />

            <Link
              href="/gallery"
              className="inline-flex shrink-0 items-center gap-2 border border-[#292929] bg-[#1C1C1C] px-6 py-3.5 font-display text-sm font-bold tracking-[0.14em] uppercase text-white transition-colors hover:border-[#E11D2E]"
            >
              <span>Open Full Project Gallery</span>
              <ArrowUpRight className="h-4 w-4 text-[#E11D2E]" aria-hidden="true" />
            </Link>
          </div>

          {/* Explicit Asset Integrity Banner */}
          <div
            data-reveal
            className="mt-8 flex items-start gap-3 border border-[#292929] bg-[#090909] p-4 text-xs text-[#A3A3A3]"
          >
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-[#E11D2E]"
              aria-hidden="true"
            />
            <p>
              <strong className="font-mono uppercase text-white">
                Media Integrity Notice:
              </strong>{" "}
              The visual frames below are clearly labeled temporary architectural
              placeholders. Actual Manila Auto Pros shop and completed project
              photographs will replace these frames upon client asset delivery.
            </p>
          </div>

          <div
            data-gallery-grid
            className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2"
          >
            {FEATURED_GALLERY_PLACEHOLDERS.map((project) => (
              <article
                key={project.id}
                data-gallery-card
                className="group border border-[#292929] bg-[#1C1C1C] transition-colors hover:border-[#E11D2E]"
              >
                <StudioImagePlaceholder
                  src={project.placeholderAsset.src}
                  alt={project.placeholderAsset.alt}
                  badgeText={project.placeholderAsset.label}
                  aspectClassName="aspect-[16/10]"
                  className="border-x-0 border-t-0"
                />

                <div className="p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold tracking-wider uppercase text-[#E11D2E]">
                      {project.category}
                    </span>
                    <span className="border border-[#292929] bg-[#141414] px-2.5 py-0.5 font-mono text-[10px] uppercase text-[#A3A3A3]">
                      {project.vehicleCategory}
                    </span>
                  </div>

                  <h3 className="mt-2.5 font-display text-2xl font-extrabold tracking-[0.03em] uppercase text-white">
                    {project.title}
                  </h3>

                  <p className="mt-1 font-mono text-xs text-white/80">
                    Scope: {project.servicePerformed}
                  </p>

                  <p className="mt-3 text-sm leading-relaxed text-[#A3A3A3]">
                    {project.scopeSummary}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 8: BOOKING CALL-TO-ACTION
      ===================================================================== */}
      <section className="relative overflow-hidden border-b border-[#292929] bg-[#090909] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div
            data-reveal
            className="relative border border-[#292929] bg-[#141414] p-8 sm:p-12 lg:p-16"
          >
            <span
              aria-hidden="true"
              className=" absolute inset-y-0 left-0 w-1.5 bg-[#E11D2E]"
            />

            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <span className="font-mono text-xs font-semibold tracking-[0.2em] uppercase text-[#E11D2E]">
                  ONLINE APPOINTMENT SCHEDULING
                </span>
                <h2 className="mt-3 font-display text-4xl font-extrabold tracking-[0.03em] uppercase text-white sm:text-5xl">
                  RESERVE YOUR STUDIO BAY ON QUIRICADA STREET.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#A3A3A3]">
                  Select your vehicle type (Car or Motorcycle), choose your
                  desired protection or detailing package, and request your
                  preferred date and time slot in{" "}
                  <span className="text-white">Asia/Manila</span> time.
                </p>

                <div className="mt-6 flex flex-wrap gap-6 font-mono text-xs tracking-wider uppercase text-[#A3A3A3]">
                  <span className="flex items-center gap-2 text-white">
                    <span className="h-1.5 w-1.5 bg-[#E11D2E]" />
                    MONDAY – SATURDAY OPERATION
                  </span>
                  <span className="flex items-center gap-2 text-white">
                    <span className="h-1.5 w-1.5 bg-[#E11D2E]" />
                    CARS &amp; MOTORCYCLES
                  </span>
                  <span className="flex items-center gap-2 text-white">
                    <span className="h-1.5 w-1.5 bg-[#E11D2E]" />
                    INQUIRY &amp; RESERVATION CONFIRMATION
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:col-span-4">
                <Link
                  href="/booking"
                  className="group inline-flex items-center justify-center gap-3 bg-[#E11D2E] px-7 py-4 font-display text-base font-bold tracking-[0.14em] uppercase text-white transition-colors hover:bg-[#FF3045]"
                >
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  <span>Book Appointment Online</span>
                  <ArrowUpRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 border border-[#292929] bg-[#1C1C1C] px-7 py-4 font-display text-base font-bold tracking-[0.14em] uppercase text-white transition-colors hover:border-white/40"
                >
                  <span>Request Custom Quote</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 9: CONTACT & LOCATION
      ===================================================================== */}
      <section className="bg-[#141414] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div data-reveal className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <SectionHeading
                kicker="STUDIO LOCATION & DISPATCH"
                title="VISIT MANILA AUTO PROS."
                description="Conveniently located on Quiricada Street, Manila. Drop by for an in-person paint assessment or schedule your appointment online prior to arrival."
              />

              <div className="mt-8 space-y-5 border-t border-[#292929] pt-6">
                <div className="flex items-start gap-3.5">
                  <MapPin
                    className="mt-1 h-5 w-5 shrink-0 text-[#E11D2E]"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="font-display text-lg font-bold tracking-wider uppercase text-white">
                      Facility Address
                    </h3>
                    <p className="mt-1 text-sm text-[#A3A3A3]">
                      {BRAND_CONFIG.location.fullAddress}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <Clock
                    className="mt-1 h-5 w-5 shrink-0 text-[#E11D2E]"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="font-display text-lg font-bold tracking-wider uppercase text-white">
                      Operating Days &amp; Hours
                    </h3>
                    <p className="mt-1 text-sm text-white">
                      {BRAND_CONFIG.schedule.operatingDays} •{" "}
                      <span className="text-[#E11D2E]">
                        {BRAND_CONFIG.schedule.closedDays}
                      </span>
                    </p>
                    <p className="mt-1 font-mono text-xs text-[#A3A3A3]">
                      {BRAND_CONFIG.schedule.hoursDefaultLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 bg-[#E11D2E] px-6 py-3.5 font-display text-sm font-bold tracking-[0.14em] uppercase text-white transition-colors hover:bg-[#FF3045]"
                >
                  <span>Full Contact Details</span>
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Right Column: Architectural Location Card */}
            <div className="lg:col-span-7">
              <div className="flex h-full flex-col justify-between border border-[#292929] bg-[#1C1C1C] p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#292929] pb-4">
                  <div className="flex items-center gap-2.5">
                    <Compass
                      className="h-5 w-5 text-[#E11D2E]"
                      aria-hidden="true"
                    />
                    <span className="font-mono text-xs font-semibold tracking-[0.18em] uppercase text-white">
                      LOCATOR // QUIRICADA STREET, MANILA
                    </span>
                  </div>
                  <span className="font-mono text-xs text-[#A3A3A3]">
                    14.6138° N, 120.9806° E (APPROX. CORRIDOR)
                  </span>
                </div>

                {/* Stylized Architectural Corridor Map */}
                <div className="relative my-6 flex min-h-64 flex-col items-center justify-center overflow-hidden border border-[#292929] bg-[#090909] bg-studio-grid p-6 text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center border border-[#E11D2E] bg-[#141414]">
                    <MapPin className="h-6 w-6 text-[#E11D2E]" aria-hidden="true" />
                  </div>
                  <p className="mt-4 font-display text-2xl font-extrabold tracking-[0.06em] uppercase text-white">
                    MANILA AUTO PROS STUDIO
                  </p>
                  <p className="mt-1 font-mono text-xs tracking-wider uppercase text-[#A3A3A3]">
                    {BRAND_CONFIG.location.fullAddress}
                  </p>
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=Quiricada+Street+Manila+Philippines"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-2 border border-[#292929] bg-[#141414] px-4 py-2 font-mono text-xs font-semibold tracking-wider uppercase text-white transition-colors hover:border-[#E11D2E]"
                  >
                    <span>Open Quiricada St. in Google Maps</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-[#E11D2E]" />
                  </a>
                </div>

                <div className="grid grid-cols-1 gap-4 border-t border-[#292929] pt-4 text-xs text-[#A3A3A3] sm:grid-cols-2">
                  <div>
                    <span className="font-mono uppercase text-white">
                      Vehicle Reception:
                    </span>{" "}
                    Cars, SUVs, Pickups &amp; Motorcycles (Moto Pros)
                  </div>
                  <div className="sm:text-right">
                    <span className="font-mono uppercase text-white">
                      Scheduling Timezone:
                    </span>{" "}
                    {BRAND_CONFIG.location.timezone} (UTC+8)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
