import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Bike,
  Calendar,
  Car,
  Clock,
  Compass,
  Info,
  Layers,
  MapPin,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import { BRAND_CONFIG, SERVICE_CATEGORIES } from "@/lib/constants/site-data";
import { GALLERY_ITEMS } from "@/lib/constants/gallery-data";
import { MotionScope } from "@/components/motion/motion-scope";
import { SectionHeading } from "@/components/ui/section-heading";
import { StudioImagePlaceholder } from "@/components/ui/studio-image-placeholder";
import { ButtonLink } from "@/components/ui/button-link";
import { DevNotice, PendingValue, XpelClaim } from "@/components/ui/dev-notice";
import { ServiceCard } from "@/components/services/service-card";
import { WhyChoose } from "@/components/sections/why-choose";
import { BookingCta } from "@/components/sections/booking-cta";

const HERO_IMAGE = {
  src: "/images/dev-placeholders/hero-studio.jpg",
  alt: "Development placeholder photo: a dark sports coupe in a moody studio with red accent lighting",
  isPlaceholder: true,
};

/**
 * Homepage composition. Server-rendered; all animation is declared via
 * data attributes and executed by `MotionScope`.
 */
export function HomepageExperience() {
  const featuredGallery = GALLERY_ITEMS.slice(0, 4);

  return (
    <MotionScope className="bg-[#090909] text-white">
      {/* ================================================================
          HERO — image-based, cinematic reveal, restrained parallax
      ================================================================ */}
      <section
        data-animate="hero"
        aria-labelledby="hero-heading"
        className="relative isolate flex min-h-[min(760px,calc(100svh-5rem))] items-center overflow-hidden border-b border-[#292929] lg:min-h-[min(800px,calc(100svh-7rem))]"
      >
        <div data-hero-media className="absolute inset-0 -z-10">
          <div data-animate="parallax" data-parallax-amount="8" className="absolute inset-x-0 -top-[6%] -bottom-[6%]">
            <Image
              src={HERO_IMAGE.src}
              alt={HERO_IMAGE.alt}
              fill
              priority
              sizes="100vw"
              className="object-cover object-[72%_center] lg:object-center"
            />
          </div>
          {/* Readability overlays: strong on the text side, lighter on the vehicle */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-[#090909] via-[#090909]/80 to-[#090909]/10 max-lg:via-[#090909]/75 max-lg:to-[#090909]/55"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#090909] via-transparent to-[#090909]/50" />
          {HERO_IMAGE.isPlaceholder && (
            <p className="absolute right-4 bottom-4 z-10 border border-[#292929] bg-[#090909]/85 px-2.5 py-1 font-mono text-[10px] tracking-[0.16em] text-[#A3A3A3] uppercase">
              Placeholder image · not a Manila Auto Pros photo
            </p>
          )}
        </div>

        <div aria-hidden="true" className="absolute top-0 left-0 h-full w-1 bg-[#E11D2E]" />

        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
          <div className="max-w-3xl">
            <div
              data-hero-kicker
              className="inline-flex flex-wrap items-center gap-2.5 border border-[#292929] bg-[#090909]/70 px-3.5 py-1.5 backdrop-blur-sm"
            >
              <span className="h-2 w-2 bg-[#E11D2E]" aria-hidden="true" />
              <span className="font-mono text-[13px] font-semibold tracking-[0.08em] text-white uppercase">
                Quiricada St., Manila · Detailing &amp; Paint Protection
              </span>
            </div>

            <h1
              id="hero-heading"
              className="mt-6 font-display text-[clamp(3.25rem,9vw,5rem)] leading-[0.92] font-extrabold tracking-[0.02em] text-white uppercase"
            >
              <span data-headline-line className="block">
                Protect Your
              </span>
              <span data-headline-line className="block text-[#E11D2E]">
                Investment.
              </span>
              <span data-headline-line className="mt-2 block text-[clamp(1.8rem,5vw,2.5rem)] leading-tight">
                Preserve Your Vehicle&apos;s Beauty.
              </span>
            </h1>

            <p data-hero-sub className="mt-6 max-w-2xl text-base leading-[1.75] text-[#D0D0D0] sm:text-lg">
              Paint protection film, ceramic and graphene coatings, paint correction, window tint, and Moto Pros
              motorcycle care — from our shop on Quiricada Street, Manila.
            </p>

            <div data-hero-cta className="mt-9 flex flex-wrap items-center gap-4">
              <ButtonLink
                href="/booking"
                size="lg"
                showArrow
                icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
              >
                Book Appointment
              </ButtonLink>
              <ButtonLink href="/services" variant="secondary" size="lg" className="bg-[#090909]/60 backdrop-blur-sm">
                Explore Services
              </ButtonLink>
            </div>

            <dl
              data-hero-cta
              className="mt-12 grid max-w-2xl grid-cols-1 gap-4 border-t border-[#292929] pt-6 sm:grid-cols-3"
            >
              {[
                { label: "Protection", value: "PPF · Ceramic · Graphene" },
                { label: "Vehicles", value: "Cars & Motorcycles" },
                { label: "Schedule", value: "Mon – Sat · Sun Closed" },
              ].map((item, i) => (
                <div key={item.label} className={`border-l-2 pl-3.5 ${i === 0 ? "border-[#E11D2E]" : "border-[#292929]"}`}>
                  <dt className="font-mono text-xs tracking-[0.08em] text-[#A3A3A3] uppercase">{item.label}</dt>
                  <dd className="mt-1 font-display text-lg font-bold tracking-wide text-white uppercase">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ================================================================
          BRAND INTRODUCTION
      ================================================================ */}
      <section className="border-b border-[#292929] bg-[#141414] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-12 px-4 sm:px-6 lg:grid-cols-12">
          <div data-animate="headline" className="lg:col-span-5">
            <div data-headline-line className="inline-flex items-center gap-2.5">
              <span className="h-0.5 w-6 bg-[#E11D2E]" aria-hidden="true" />
              <span className="font-mono text-xs font-semibold tracking-[0.22em] text-[#E11D2E] uppercase">
                About Manila Auto Pros
              </span>
            </div>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-[0.03em] text-white uppercase sm:text-4xl lg:text-5xl">
              <span data-headline-line className="block">Built for owners who</span>
              <span data-headline-line className="block">care about the finish.</span>
            </h2>
            <div data-headline-line className="mt-8 border-l-2 border-[#E11D2E] bg-[#1C1C1C] p-5">
              <p className="font-mono text-xs tracking-[0.15em] text-[#E11D2E] uppercase">Our promise</p>
              <p className="mt-2 font-display text-xl font-bold tracking-wide text-white uppercase">
                &ldquo;{BRAND_CONFIG.tagline}&rdquo;
              </p>
            </div>
          </div>

          <div data-animate="fade-up" className="space-y-6 lg:col-span-7">
            <p className="text-base leading-relaxed text-white sm:text-lg">
              <strong className="font-semibold">Manila Auto Pros</strong> is a premium automotive detailing and paint
              protection shop on Quiricada Street, Manila — focused on keeping cars and motorcycles looking their best
              and protected for the long run.
            </p>
            <p className="text-base leading-relaxed text-[#A3A3A3]">
              Heat, rain, traffic, and road debris take a toll on paint. We help owners protect their investment with
              paint protection film, ceramic and graphene coatings, and window tint — backed by detailing and paint
              correction to make sure every surface is properly prepared.
            </p>

            <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
              <div className="border border-[#292929] bg-[#1C1C1C] p-5">
                <div className="flex items-center gap-3">
                  <Car className="h-5 w-5 text-[#E11D2E]" aria-hidden="true" />
                  <h3 className="font-display text-xl font-bold tracking-wider text-white uppercase">Automotive</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#A3A3A3]">
                  Paint protection film, ceramic &amp; graphene coatings, auto detailing, and window tint.
                </p>
              </div>
              <div className="border border-[#292929] bg-[#1C1C1C] p-5">
                <div className="flex items-center gap-3">
                  <Bike className="h-5 w-5 text-[#E11D2E]" aria-hidden="true" />
                  <h3 className="font-display text-xl font-bold tracking-wider text-white uppercase">Moto Pros</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#A3A3A3]">
                  Motorcycle coatings, PPF, detailing, and paint protection.
                </p>
              </div>
            </div>

            <ButtonLink href="/about" variant="ghost" showArrow>
              Learn more about us
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ================================================================
          FEATURED SERVICES
      ================================================================ */}
      <section className="border-b border-[#292929] bg-[#090909] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div data-animate="fade-up" className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
            <SectionHeading
              kicker="Our Services"
              title="Protection & detailing for cars and motorcycles."
              description="Every vehicle and paint condition is different. Explore our services, then book an appointment or send an inquiry for a vehicle-specific recommendation."
            />
            <ButtonLink href="/services" variant="secondary" showArrow className="shrink-0">
              All Services
            </ButtonLink>
          </div>

          <div data-animate="stagger" className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {SERVICE_CATEGORIES.map((service) => (
              <ServiceCard key={service.slug} service={service} />
            ))}

            <article
              data-animate-item
              className="flex flex-col justify-between border border-[#E11D2E]/60 bg-[#141414] p-6 sm:p-8"
            >
              <div>
                <span className="inline-flex items-center gap-2 border border-[#292929] bg-[#1C1C1C] px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.18em] text-[#E11D2E] uppercase">
                  Not sure where to start?
                </span>
                <h3 className="mt-5 font-display text-3xl font-extrabold tracking-[0.04em] text-white uppercase">
                  Get a recommendation for your vehicle.
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-[#A3A3A3]">
                  Vehicle size, paint condition, and how you drive all affect the right protection. Pricing is provided
                  per vehicle after we understand your needs.
                </p>
              </div>
              <div className="mt-8 space-y-3">
                <ButtonLink href="/booking" className="w-full" showArrow>
                  Book Appointment
                </ButtonLink>
                <ButtonLink href="/contact" variant="secondary" className="w-full">
                  Send an Inquiry
                </ButtonLink>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ================================================================
          WHY CHOOSE
      ================================================================ */}
      <WhyChoose />

      {/* ================================================================
          PAINT PROTECTION & DETAILING HIGHLIGHTS
      ================================================================ */}
      <section className="border-b border-[#292929] bg-[#090909] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div data-animate="fade-up">
            <SectionHeading
              kicker="Layers of Protection"
              title="How each service protects your vehicle."
              description="Film, coatings, correction, and tint each solve a different problem — and work best together."
            />
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div data-animate="fade-up" className="flex flex-col border border-[#292929] bg-[#1C1C1C]">
              <StudioImagePlaceholder
                src={SERVICE_CATEGORIES[0].image.src}
                alt=""
                isTemporaryPlaceholder={SERVICE_CATEGORIES[0].image.isPlaceholder}
                aspectClassName="aspect-[16/8]"
                className="border-x-0 border-t-0"
                sizes="(max-width: 1024px) 100vw, 50vw"
                maskReveal
              />
              <div className="flex flex-1 flex-col p-7 sm:p-9">
                <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.18em] text-[#E11D2E] uppercase">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Physical impact barrier
                </span>
                <h3 className="mt-4 font-display text-3xl font-extrabold tracking-[0.03em] text-white uppercase">
                  Paint Protection Film
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#A3A3A3]">
                  PPF absorbs stone chips, light scratches, and road debris. Available in clear, black, and matte
                  finishes with full-body or partial coverage.
                </p>
                <div className="mt-4 text-xs">
                  <XpelClaim className="font-mono tracking-wider text-white uppercase" />
                </div>
                <div className="mt-auto pt-6">
                  <ButtonLink href="/services/paint-protection-film" variant="ghost" showArrow>
                    PPF Details
                  </ButtonLink>
                </div>
              </div>
            </div>

            <div data-animate="fade-up" className="flex flex-col border border-[#292929] bg-[#1C1C1C]">
              <StudioImagePlaceholder
                src={SERVICE_CATEGORIES[1].image.src}
                alt=""
                isTemporaryPlaceholder={SERVICE_CATEGORIES[1].image.isPlaceholder}
                aspectClassName="aspect-[16/8]"
                className="border-x-0 border-t-0"
                sizes="(max-width: 1024px) 100vw, 50vw"
                maskReveal
              />
              <div className="flex flex-1 flex-col p-7 sm:p-9">
                <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.18em] text-[#E11D2E] uppercase">
                  <Layers className="h-4 w-4" aria-hidden="true" />
                  Gloss &amp; hydrophobic layer
                </span>
                <h3 className="mt-4 font-display text-3xl font-extrabold tracking-[0.03em] text-white uppercase">
                  Ceramic &amp; Graphene Coating
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#A3A3A3]">
                  Coatings add gloss and repel water and grime, making routine washing quicker and safer. Single or
                  multi-layer packages are available.
                </p>
                <div className="mt-auto pt-6">
                  <ButtonLink href="/services/ceramic-graphene-coating" variant="ghost" showArrow>
                    Coating Details
                  </ButtonLink>
                </div>
              </div>
            </div>
          </div>

          <ul data-animate="stagger" className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                icon: Sparkles,
                title: "Paint Correction & Detailing",
                text: "Decontamination, machine polishing, and interior/exterior detailing to restore worn surfaces.",
                href: "/services/auto-detailing",
              },
              {
                icon: Sun,
                title: "Heat-Rejection Window Tint",
                text: "Window films that help reduce cabin heat, glare, and UV exposure while preserving visibility.",
                href: "/services/automotive-window-tint",
              },
              {
                icon: Bike,
                title: "Moto Pros",
                text: "Coatings, PPF, and detailing tailored to motorcycles — tanks, fairings, wheels, and more.",
                href: "/services/moto-pros",
              },
            ].map(({ icon: Icon, title, text, href }) => (
              <li key={title} data-animate-item className="border border-[#292929] bg-[#141414] p-6">
                <Icon className="h-5 w-5 text-[#E11D2E]" aria-hidden="true" />
                <h3 className="mt-4 font-display text-2xl font-bold tracking-wide text-white uppercase">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#A3A3A3]">{text}</p>
                <Link
                  href={href}
                  className="mt-4 inline-flex items-center gap-1 font-mono text-xs font-semibold text-white uppercase transition-colors hover:text-[#E11D2E]"
                >
                  Learn more <span className="sr-only">about {title}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================================================================
          FEATURED GALLERY (labeled placeholder slots)
      ================================================================ */}
      <section className="border-b border-[#292929] bg-[#141414] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div data-animate="fade-up" className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
            <SectionHeading
              kicker="Project Gallery"
              title="Featured work."
              description="A showcase of completed Manila Auto Pros projects will appear here."
            />
            <ButtonLink href="/gallery" variant="secondary" showArrow className="shrink-0">
              Open Gallery
            </ButtonLink>
          </div>

          <div
            data-animate="fade-up"
            className="mt-8 flex items-start gap-3 border border-[#292929] bg-[#090909] p-4 text-xs text-[#A3A3A3]"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#E11D2E]" aria-hidden="true" />
            <p>
              The frames below are labeled placeholders, not customer projects. They will be replaced with real Manila
              Auto Pros photography.
            </p>
          </div>

          <div data-animate="stagger" className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredGallery.map((item) => (
              <Link
                key={item.id}
                href="/gallery"
                data-animate-item
                className="group block border border-[#292929] bg-[#1C1C1C] transition-colors hover:border-[#E11D2E]/70"
              >
                <StudioImagePlaceholder
                  src={item.image.src}
                  alt={item.image.alt}
                  isTemporaryPlaceholder={item.isPlaceholder}
                  aspectClassName="aspect-[3/2]"
                  className="border-x-0 border-t-0"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
                <div className="p-4">
                  <p className="font-mono text-[10px] tracking-wider text-[#E11D2E] uppercase">{item.vehicle}</p>
                  <p className="mt-1 font-display text-lg font-bold tracking-wide text-white uppercase">{item.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          BOOKING CTA
      ================================================================ */}
      <BookingCta />

      {/* ================================================================
          CONTACT & LOCATION
      ================================================================ */}
      <section className="bg-[#141414] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-12">
          <div data-animate="fade-up" className="lg:col-span-5">
            <SectionHeading
              kicker="Visit Us"
              title="Find Manila Auto Pros."
              description="Visit us on Quiricada Street, Manila, or book your appointment online before you arrive."
            />

            <dl className="mt-8 space-y-5 border-t border-[#292929] pt-6">
              <div className="flex items-start gap-3.5">
                <MapPin className="mt-1 h-5 w-5 shrink-0 text-[#E11D2E]" aria-hidden="true" />
                <div>
                  <dt className="font-display text-lg font-bold tracking-wider text-white uppercase">Address</dt>
                  <dd className="mt-1 text-sm text-[#A3A3A3]">{BRAND_CONFIG.location.fullAddress}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <Clock className="mt-1 h-5 w-5 shrink-0 text-[#E11D2E]" aria-hidden="true" />
                <div>
                  <dt className="font-display text-lg font-bold tracking-wider text-white uppercase">Operating Days</dt>
                  <dd className="mt-1 text-sm text-white">
                    {BRAND_CONFIG.schedule.operatingDays} ·{" "}
                    <span className="text-[#E11D2E]">{BRAND_CONFIG.schedule.closedDays}</span>
                  </dd>
                  <dd className="mt-1 text-sm">
                    Hours: <PendingValue value={BRAND_CONFIG.schedule.hours} />
                  </dd>
                </div>
              </div>
            </dl>

            <div className="mt-8">
              <ButtonLink href="/contact" showArrow>
                Contact Details
              </ButtonLink>
            </div>
          </div>

          <div data-animate="fade-up" className="lg:col-span-7">
            <div className="flex h-full flex-col border border-[#292929] bg-[#1C1C1C] p-6 sm:p-8">
              <div className="flex items-center gap-2.5 border-b border-[#292929] pb-4">
                <Compass className="h-5 w-5 text-[#E11D2E]" aria-hidden="true" />
                <span className="font-mono text-xs font-semibold tracking-[0.18em] text-white uppercase">
                  Quiricada Street, Manila
                </span>
              </div>
              <div className="bg-studio-grid relative my-6 flex min-h-64 flex-1 flex-col items-center justify-center border border-[#292929] bg-[#090909] p-6 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center border border-[#E11D2E] bg-[#141414]">
                  <MapPin className="h-6 w-6 text-[#E11D2E]" aria-hidden="true" />
                </div>
                <p className="mt-4 font-display text-2xl font-extrabold tracking-[0.06em] text-white uppercase">
                  Manila Auto Pros
                </p>
                <p className="mt-1 font-mono text-xs tracking-wider text-[#A3A3A3] uppercase">
                  {BRAND_CONFIG.location.fullAddress}
                </p>
                <a
                  href={BRAND_CONFIG.location.mapSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2 border border-[#292929] bg-[#141414] px-4 py-2 font-mono text-xs font-semibold tracking-wider text-white uppercase transition-colors hover:border-[#E11D2E]"
                >
                  Search on Google Maps
                  <span className="sr-only">(opens in a new tab)</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-[#E11D2E]" aria-hidden="true" />
                </a>
              </div>
              <DevNotice title="Map pending">
                Replace with an embedded map once the client confirms the exact pin / Google Business Profile.
              </DevNotice>
            </div>
          </div>
        </div>
      </section>
    </MotionScope>
  );
}
