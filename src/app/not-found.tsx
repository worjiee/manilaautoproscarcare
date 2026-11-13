import { ArrowUpRight, Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

export default function NotFound() {
  return (
    <section className="bg-studio-grid flex min-h-[70vh] items-center justify-center border-b border-[#292929] bg-[#090909] px-4 py-20 text-white sm:px-6">
      <div className="w-full max-w-2xl border border-[#292929] bg-[#141414] p-8 sm:p-12">
        <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.2em] text-[#E11D2E] uppercase">
          <Compass className="h-4 w-4" aria-hidden="true" />
          404 // Route Not Found
        </div>
        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-wide text-white uppercase sm:text-5xl">
          The requested page could not be located.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[#A3A3A3] sm:text-base">
          Check the URL or use the links below to return to the Manila Auto Pros
          homepage, browse our service divisions, or schedule an appointment.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/" showArrow>
            Return to Homepage
          </ButtonLink>
          <ButtonLink href="/services" variant="secondary">
            Explore Services
          </ButtonLink>
          <ButtonLink
            href="/booking"
            variant="secondary"
            icon={<ArrowUpRight className="h-4 w-4 text-[#E11D2E]" />}
          >
            Book Appointment
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
