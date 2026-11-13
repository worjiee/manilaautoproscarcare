import Link from "next/link";
import { Calendar, Check } from "lucide-react";
import type { ServiceCategory } from "@/lib/constants/site-data";
import { StudioImagePlaceholder } from "@/components/ui/studio-image-placeholder";
import { ButtonLink } from "@/components/ui/button-link";

interface ServiceCardProps {
  service: ServiceCategory;
  /** "full" shows benefits; "compact" is used for related-service grids. */
  variant?: "full" | "compact";
  headingLevel?: "h2" | "h3";
}

/** Service card used on the homepage, services directory, and related services. */
export function ServiceCard({ service, variant = "full", headingLevel = "h3" }: ServiceCardProps) {
  const Heading = headingLevel;
  const detailHref = `/services/${service.slug}`;

  return (
    <article
      data-animate-item
      className="group flex h-full flex-col border border-[#292929] bg-[#1C1C1C] transition-colors duration-300 hover:border-[#E11D2E]/70"
    >
      <Link href={detailHref} tabIndex={-1} aria-hidden="true" className="block">
        <StudioImagePlaceholder
          src={service.image.src}
          alt=""
          isTemporaryPlaceholder={service.image.isPlaceholder}
          aspectClassName="aspect-[16/10]"
          className="border-x-0 border-t-0"
        />
      </Link>

      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-semibold tracking-[0.1em] text-[#E11D2E] uppercase">
            {service.kicker.split(" // ")[0]}
          </span>
          <span className="border border-[#292929] bg-[#141414] px-2 py-1 font-mono text-xs text-[#A3A3A3] uppercase">
            {service.vehicleTypes.join(" / ")}
          </span>
        </div>

        <Heading className="mt-3 font-display text-2xl font-extrabold tracking-[0.04em] text-white uppercase sm:text-3xl">
          <Link href={detailHref} className="transition-colors hover:text-[#E11D2E]">
            {service.title}
          </Link>
        </Heading>

        <p className="mt-3 text-base leading-[1.7] text-[#A3A3A3]">{service.summary}</p>

        {variant === "full" && (
          <ul className="mt-5 space-y-2 border-t border-[#292929] pt-4" aria-label={`${service.title} key benefits`}>
            {service.benefits.slice(0, 4).map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5 text-sm font-medium text-white">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E11D2E]" aria-hidden="true" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
          <ButtonLink href={detailHref} variant="secondary" size="sm" showArrow aria-label={`View details: ${service.title}`}>
            View Details
          </ButtonLink>
          {variant === "full" && (
            <ButtonLink
              href={`/booking?service=${service.slug}`}
              variant="primary"
              size="sm"
              icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
              aria-label={`Book appointment: ${service.title}`}
            >
              Book
            </ButtonLink>
          )}
        </div>
      </div>
    </article>
  );
}
