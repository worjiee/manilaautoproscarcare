import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Calendar, Check, MessageSquare } from "lucide-react";
import {
  BRAND_CONFIG,
  SERVICE_CATEGORIES,
  getRelatedServices,
  getServiceBySlug,
} from "@/lib/constants/site-data";
import { MotionScope } from "@/components/motion/motion-scope";
import { PageHero } from "@/components/ui/page-hero";
import { SectionHeading } from "@/components/ui/section-heading";
import { StudioImagePlaceholder } from "@/components/ui/studio-image-placeholder";
import { ButtonLink } from "@/components/ui/button-link";
import { XpelClaim } from "@/components/ui/dev-notice";
import { ServiceCard } from "@/components/services/service-card";
import { BookingCta } from "@/components/sections/booking-cta";

export function generateStaticParams() {
  return SERVICE_CATEGORIES.map((service) => ({
    slug: service.slug,
  }));
}

interface ServiceDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ServiceDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = getServiceBySlug(slug);

  if (!service) {
    return {
      title: "Service Not Found",
    };
  }

  return {
    title: `${service.title} in Manila`,
    description: service.seoDescription,
  };
}

export default async function ServiceDetailPage({
  params,
}: ServiceDetailPageProps) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);

  if (!service) {
    notFound();
  }

  const relatedServices = getRelatedServices(service);

  return (
    <>
      {/* 1. Service Hero */}
      <PageHero
        tall
        kicker={service.kicker}
        titleLines={[
          service.title,
          <span
            key="tagline"
            className="mt-2 block text-2xl leading-tight font-bold text-[#E11D2E] sm:text-3xl lg:text-4xl"
          >
            {service.tagline}
          </span>,
        ]}
        description={service.summary}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Services", href: "/services" },
          { label: service.title },
        ]}
        image={service.image}
      >
        <ButtonLink
          href={`/booking?service=${service.slug}`}
          size="lg"
          showArrow
          icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
        >
          Book {service.title}
        </ButtonLink>
        <ButtonLink
          href="/contact"
          variant="secondary"
          size="lg"
          icon={<MessageSquare className="h-4 w-4" aria-hidden="true" />}
        >
          Inquire About Scope
        </ButtonLink>
      </PageHero>

      <MotionScope className="bg-[#090909] text-white">
        {/* 2. Detailed Service Description & 4. Benefits */}
        <section className="border-b border-[#292929] bg-[#090909] py-20 lg:py-28">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-12 px-4 sm:px-6 lg:grid-cols-12">
            <div data-animate="fade-up" className="lg:col-span-7">
              <SectionHeading
                kicker="Service Overview"
                title={`Why ${service.title} matters for your vehicle.`}
              />

              <div className="mt-6 space-y-5 text-base leading-relaxed text-[#A3A3A3]">
                {service.description.map((paragraph, idx) => (
                  <p
                    key={idx}
                    className={idx === 0 ? "text-lg text-white" : undefined}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              {service.slug === "paint-protection-film" && (
                <div className="mt-6 border border-[#292929] bg-[#141414] p-4 text-xs">
                  <XpelClaim className="font-mono font-semibold tracking-wider text-white uppercase" />
                </div>
              )}

              <div className="mt-10 border border-[#292929] bg-[#141414] p-6 sm:p-8">
                <h3 className="font-mono text-xs font-semibold tracking-[0.2em] text-[#E11D2E] uppercase">
                  Key Benefits
                </h3>
                <ul className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  {service.benefits.map((benefit) => (
                    <li
                      key={benefit}
                      className="flex items-start gap-3 border border-[#292929] bg-[#1C1C1C] p-4 text-sm text-white"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#E11D2E]"
                        aria-hidden="true"
                      />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div data-animate="fade-up" className="space-y-6 lg:col-span-5">
              <StudioImagePlaceholder
                src={service.image.src}
                alt={service.image.alt}
                isTemporaryPlaceholder={service.image.isPlaceholder}
                caption="PLACEHOLDER IMAGE // AWAITING CLIENT PHOTOGRAPHY"
                aspectClassName="aspect-[16/11]"
                sizes="(max-width: 1024px) 100vw, 42vw"
                maskReveal
              />

              <div className="border border-[#292929] bg-[#1C1C1C] p-6">
                <p className="font-mono text-xs font-semibold tracking-[0.18em] text-[#E11D2E] uppercase">
                  Studio Specifications
                </p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between border-b border-[#292929] pb-3">
                    <dt className="text-[#A3A3A3]">Eligible Vehicles</dt>
                    <dd className="font-mono text-xs font-semibold text-white uppercase">
                      {service.vehicleTypes.join(" / ")}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#292929] pb-3">
                    <dt className="text-[#A3A3A3]">Location</dt>
                    <dd className="text-white">
                      {BRAND_CONFIG.location.fullAddress}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#292929] pb-3">
                    <dt className="text-[#A3A3A3]">Operating Days</dt>
                    <dd className="text-white">
                      {BRAND_CONFIG.schedule.operatingDays}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-[#A3A3A3]">Quotation Policy</dt>
                    <dd className="font-mono text-xs text-white uppercase">
                      Per-Vehicle Inquiry
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Available Service Options */}
        <section className="border-b border-[#292929] bg-[#141414] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div data-animate="fade-up">
              <SectionHeading
                kicker="Available Options"
                title={`${service.title} Treatments & Coverage`}
                description="Choose a specific option below when scheduling your appointment or requesting a consultation."
              />
            </div>

            <div
              data-animate="stagger"
              className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
              {service.items.map((item, idx) => (
                <article
                  key={item.id}
                  data-animate-item
                  className="flex flex-col justify-between border border-[#292929] bg-[#1C1C1C] p-6 sm:p-7 transition-colors hover:border-[#E11D2E]/70"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-[#292929] pb-3">
                      <span className="font-mono text-xs font-bold text-[#E11D2E]">
                        OPTION 0{idx + 1}
                      </span>
                      <span className="font-mono text-[10px] tracking-wider text-[#A3A3A3] uppercase">
                        {service.vehicleTypes.join(" / ")}
                      </span>
                    </div>

                    <h3 className="mt-5 font-display text-2xl font-extrabold tracking-wide text-white uppercase">
                      {item.name}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#A3A3A3]">
                      {item.shortDescription}
                    </p>
                  </div>

                  <div className="mt-6 border-t border-[#292929] pt-4">
                    <Link
                      href={`/booking?service=${service.slug}&option=${item.id}`}
                      className="inline-flex items-center gap-2 font-display text-sm font-bold tracking-[0.14em] text-white uppercase transition-colors hover:text-[#E11D2E]"
                    >
                      <Calendar
                        className="h-4 w-4 text-[#E11D2E]"
                        aria-hidden="true"
                      />
                      <span>Select in Booking</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Process Overview */}
        <section className="border-b border-[#292929] bg-[#090909] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div data-animate="fade-up">
              <SectionHeading
                kicker="Studio Workflow"
                title={`How ${service.title} is performed.`}
                description="Every appointment follows a disciplined sequence from inspection and preparation through application and handover."
              />
            </div>

            <ol
              data-animate="stagger"
              className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {service.process.map((step, index) => (
                <li
                  key={step.title}
                  data-animate-item
                  className="flex flex-col justify-between border border-[#292929] bg-[#1C1C1C] p-6"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-[#292929] pb-4">
                      <span className="font-mono text-2xl font-bold text-[#E11D2E]">
                        0{index + 1}
                      </span>
                      <span className="font-mono text-[10px] tracking-[0.18em] text-[#A3A3A3] uppercase">
                        Stage {index + 1} of {service.process.length}
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
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 6. Related Services */}
        <section className="border-b border-[#292929] bg-[#141414] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div
              data-animate="fade-up"
              className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end"
            >
              <SectionHeading
                kicker="Complementary Treatments"
                title="Related protection & detailing services."
                description="Combine services for comprehensive bumper-to-bumper vehicle preservation."
              />
              <ButtonLink href="/services" variant="secondary" showArrow>
                All Services
              </ButtonLink>
            </div>

            <div
              data-animate="stagger"
              className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3"
            >
              {relatedServices.map((rel) => (
                <ServiceCard
                  key={rel.slug}
                  service={rel}
                  variant="compact"
                  headingLevel="h3"
                />
              ))}
            </div>
          </div>
        </section>

        {/* 7. Booking CTA */}
        <BookingCta
          serviceSlug={service.slug}
          title={`Ready to schedule ${service.title}?`}
          description={`Select your vehicle and request a preferred date and time slot on Quiricada Street, Manila.`}
        />
      </MotionScope>
    </>
  );
}
