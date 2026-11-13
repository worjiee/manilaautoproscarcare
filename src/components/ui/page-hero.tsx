import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { MotionScope } from "@/components/motion/motion-scope";
import type { MediaAsset } from "@/lib/constants/site-data";

interface Crumb {
  label: string;
  href?: string;
}

interface PageHeroProps {
  kicker: string;
  /** Each entry renders as an independently animated headline line. */
  titleLines: ReactNode[];
  description?: ReactNode;
  image?: MediaAsset;
  breadcrumbs?: Crumb[];
  children?: ReactNode;
  /** Use a taller, more dramatic composition (e.g. service detail pages). */
  tall?: boolean;
}

/**
 * Cinematic inner-page header: full-bleed image with dark overlay, staggered
 * headline reveal, and restrained desktop parallax. Falls back to the studio
 * grid when no image is provided.
 */
export function PageHero({
  kicker,
  titleLines,
  description,
  image,
  breadcrumbs,
  children,
  tall = false,
}: PageHeroProps) {
  return (
    <MotionScope>
      <section
        data-animate="hero"
        className={`relative isolate overflow-hidden border-b border-[#292929] bg-[#090909] ${
          tall ? "min-h-[560px] lg:min-h-[640px]" : "min-h-[440px] lg:min-h-[520px]"
        } flex items-end`}
      >
        {image ? (
          <div data-hero-media className="absolute inset-0 -z-10">
            <div
              data-animate="parallax"
              data-parallax-amount="10"
              className="absolute inset-x-0 -top-[8%] -bottom-[8%]"
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                priority
                sizes="100vw"
                className="object-cover object-center"
              />
            </div>
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-[#090909] via-[#090909]/85 to-[#090909]/40"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#090909] via-transparent to-[#090909]/60"
            />
            {image.isPlaceholder && (
              <p className="absolute right-4 bottom-4 z-10 border border-[#292929] bg-[#090909]/85 px-2.5 py-1 font-mono text-[10px] tracking-[0.16em] text-[#A3A3A3] uppercase">
                Placeholder image · not a Manila Auto Pros photo
              </p>
            )}
          </div>
        ) : (
          <div aria-hidden="true" className="bg-studio-grid absolute inset-0 -z-10" />
        )}

        <div aria-hidden="true" className="absolute top-0 left-0 h-full w-1 bg-[#E11D2E]" />

        <div className="mx-auto w-full max-w-7xl px-4 pt-20 pb-14 sm:px-6 lg:pb-20">
          {breadcrumbs && (
            <nav aria-label="Breadcrumb" data-hero-kicker className="mb-6">
              <ol className="flex flex-wrap items-center gap-1.5 font-mono text-xs tracking-[0.08em] text-[#A3A3A3] uppercase">
                {breadcrumbs.map((crumb, i) => (
                  <li key={crumb.label} className="flex items-center gap-1.5">
                    {crumb.href ? (
                      <Link href={crumb.href} className="transition-colors hover:text-white">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span aria-current="page" className="text-white">
                        {crumb.label}
                      </span>
                    )}
                    {i < breadcrumbs.length - 1 && (
                      <ChevronRight className="h-3 w-3 text-[#E11D2E]" aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div data-hero-kicker className="inline-flex items-center gap-2.5">
            <span className="h-0.5 w-6 bg-[#E11D2E]" aria-hidden="true" />
            <span className="font-mono text-[13px] font-semibold tracking-[0.1em] text-[#E11D2E] uppercase">
              {kicker}
            </span>
          </div>

          <h1 className="mt-4 max-w-4xl font-display text-[clamp(3rem,8vw,4.75rem)] leading-[0.96] font-extrabold tracking-[0.02em] text-white uppercase">
            {titleLines.map((line, i) => (
              <span key={i} data-headline-line className="block">
                {line}
              </span>
            ))}
          </h1>

          {description && (
            <p data-hero-sub className="mt-6 max-w-2xl text-base leading-[1.75] text-[#D0D0D0] sm:text-lg">
              {description}
            </p>
          )}

          {children && (
            <div data-hero-cta className="mt-8 flex flex-wrap items-center gap-3">
              {children}
            </div>
          )}
        </div>
      </section>
    </MotionScope>
  );
}
