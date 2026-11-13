import type { Metadata } from "next";
import { Calendar } from "lucide-react";
import { BRAND_CONFIG } from "@/lib/constants/site-data";
import { MotionScope } from "@/components/motion/motion-scope";
import { PageHero } from "@/components/ui/page-hero";
import { ButtonLink } from "@/components/ui/button-link";
import { GalleryExperience } from "@/components/gallery/gallery-experience";
import { BookingCta } from "@/components/sections/booking-cta";

export const metadata: Metadata = {
  title: "Project Gallery",
  description: `Project gallery for ${BRAND_CONFIG.displayName} (${BRAND_CONFIG.location.fullAddress}). Filter by Car or Motorcycle and service division.`,
};

export default function GalleryPage() {
  return (
    <>
      <PageHero
        kicker="Portfolio & Showcase"
        titleLines={[
          "Project",
          <span key="accent" className="text-[#E11D2E]">
            Gallery.
          </span>,
        ]}
        description="Browse our structured portfolio slots by vehicle category (Car or Motorcycle) and service division. Clearly labeled placeholders are displayed until official client photography is supplied."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Gallery" }]}
        image={{
          src: "/images/dev-placeholders/service-coating.jpg",
          alt: "Development placeholder photo: water beading on glossy coated paint",
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

      <GalleryExperience />

      <MotionScope className="bg-[#090909] text-white">
        <BookingCta />
      </MotionScope>
    </>
  );
}
