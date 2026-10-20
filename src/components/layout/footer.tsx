import Link from "next/link";
import {
  MapPin,
  Clock,
  ShieldCheck,
  ArrowUpRight,
  Calendar,
  Lock,
} from "lucide-react";
import {
  BRAND_CONFIG,
  NAV_LINKS,
  SERVICE_CATEGORIES,
} from "@/lib/constants/site-data";
import { BrandMark } from "@/components/ui/brand-mark";

export function Footer() {
  return (
    <footer className="border-t border-[#292929] bg-[#090909] text-white">
      {/* Top Pre-Footer Strip */}
      <div className="border-b border-[#292929] bg-[#141414]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center">
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.2em] uppercase text-[#E11D2E]">
              QUIRICADA STREET • MANILA, PHILIPPINES
            </p>
            <p className="mt-1 font-display text-2xl font-extrabold tracking-[0.04em] uppercase text-white sm:text-3xl">
              {BRAND_CONFIG.tagline}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/booking"
              className="group inline-flex items-center gap-2 bg-[#E11D2E] px-6 py-3.5 font-display text-sm font-bold tracking-[0.14em] uppercase text-white transition-colors hover:bg-[#FF3045]"
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              <span>Book Studio Slot</span>
              <ArrowUpRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 border border-[#292929] bg-[#1C1C1C] px-6 py-3.5 font-display text-sm font-bold tracking-[0.14em] uppercase text-white transition-colors hover:border-white/40"
            >
              Inquire About Protection
            </Link>
          </div>
        </div>
      </div>

      {/* Main Footer Grid */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-12">
          {/* Column 1: Brand Identity & Accreditation Note */}
          <div className="lg:col-span-4">
            <BrandMark size="lg" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-[#A3A3A3]">
              Dedicated automotive detailing, multi-stage paint correction,
              ceramic and graphene coatings, window solar tinting, and paint
              protection film studio serving four-wheel and two-wheel machines
              in Manila.
            </p>

            <div className="mt-6 border border-[#292929] bg-[#141414] p-4">
              <div className="flex items-start gap-2.5">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#E11D2E]"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-mono text-xs font-semibold tracking-wider uppercase text-white">
                    {BRAND_CONFIG.xpelClaim.text}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#A3A3A3]">
                    {BRAND_CONFIG.xpelClaim.verificationNote}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Protection & Detailing Divisions */}
          <div className="lg:col-span-3">
            <h3 className="font-mono text-xs font-semibold tracking-[0.2em] uppercase text-[#E11D2E]">
              SERVICE DIVISIONS
            </h3>
            <ul className="mt-5 space-y-3">
              {SERVICE_CATEGORIES.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/services/${category.slug}`}
                    className="group inline-flex items-center gap-2 text-sm text-[#A3A3A3] transition-colors hover:text-white"
                  >
                    <span
                      className="h-1 w-1 bg-[#292929] transition-colors group-hover:bg-[#E11D2E]"
                      aria-hidden="true"
                    />
                    <span>{category.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Navigation */}
          <div className="lg:col-span-2">
            <h3 className="font-mono text-xs font-semibold tracking-[0.2em] uppercase text-[#E11D2E]">
              NAVIGATION
            </h3>
            <ul className="mt-5 space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#A3A3A3] transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/booking"
                  className="font-semibold text-sm text-white transition-colors hover:text-[#E11D2E]"
                >
                  Online Booking
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Studio Location & Operating Schedule */}
          <div className="lg:col-span-3">
            <h3 className="font-mono text-xs font-semibold tracking-[0.2em] uppercase text-[#E11D2E]">
              STUDIO TELEMETRY
            </h3>
            <div className="mt-5 space-y-4 text-sm text-[#A3A3A3]">
              <div className="flex items-start gap-3">
                <MapPin
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#E11D2E]"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold text-white">Studio Address</p>
                  <p className="mt-0.5">{BRAND_CONFIG.location.fullAddress}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#E11D2E]"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold text-white">Operating Days</p>
                  <p className="mt-0.5">{BRAND_CONFIG.schedule.operatingDays}</p>
                  <p className="text-xs text-[#E11D2E]">
                    {BRAND_CONFIG.schedule.closedDays}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-[#A3A3A3]">
                    {BRAND_CONFIG.schedule.hoursDefaultLabel}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Legal & Admin Strip */}
      <div className="border-t border-[#292929] bg-[#090909]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-6 text-xs text-[#A3A3A3] sm:flex-row sm:items-center sm:px-6">
          <p className="font-mono text-[11px] tracking-wider uppercase">
            &copy; 2026 {BRAND_CONFIG.name}. ALL RIGHTS RESERVED.
          </p>

          <div className="flex flex-wrap items-center gap-6 font-mono text-[11px] tracking-wider uppercase">
            <span>TIMEZONE: {BRAND_CONFIG.location.timezone}</span>
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 text-[#A3A3A3] transition-colors hover:text-white"
            >
              <Lock className="h-3 w-3 text-[#E11D2E]" aria-hidden="true" />
              <span>Admin Portal</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
