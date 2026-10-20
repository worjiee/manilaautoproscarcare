"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  MapPin,
  Clock,
  Menu,
  X,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { BRAND_CONFIG, NAV_LINKS } from "@/lib/constants/site-data";
import { BrandMark } from "@/components/ui/brand-mark";

gsap.registerPlugin(useGSAP);

export function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const headerRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 24);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  useGSAP(
    () => {
      if (!drawerRef.current) return;
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      const items = drawerRef.current.querySelectorAll("[data-mobile-nav-item]");

      if (isMobileMenuOpen) {
        if (prefersReducedMotion) {
          gsap.set(drawerRef.current, { autoAlpha: 1, y: 0 });
          gsap.set(items, { autoAlpha: 1, x: 0 });
        } else {
          gsap.fromTo(
            drawerRef.current,
            { autoAlpha: 0, y: -12 },
            { autoAlpha: 1, y: 0, duration: 0.28, ease: "power3.out" }
          );
          gsap.fromTo(
            items,
            { autoAlpha: 0, x: -16 },
            {
              autoAlpha: 1,
              x: 0,
              duration: 0.32,
              stagger: 0.045,
              ease: "power2.out",
              delay: 0.06,
            }
          );
        }
      }
    },
    { dependencies: [isMobileMenuOpen], scope: headerRef }
  );

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-50 w-full transition-colors duration-300 ${
        isScrolled
          ? "border-b border-[#292929] bg-[#090909]/95 backdrop-blur-md"
          : "border-b border-[#292929]/80 bg-[#090909]"
      }`}
    >
      {/* Top Studio Telemetry Bar */}
      <div className="hidden border-b border-[#292929] bg-[#141414] lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-xs text-[#A3A3A3]">
          <div className="flex items-center gap-6">
            <span className="inline-flex items-center gap-2 font-mono tracking-wider uppercase">
              <MapPin className="h-3.5 w-3.5 text-[#E11D2E]" aria-hidden="true" />
              {BRAND_CONFIG.location.fullAddress}
            </span>
            <span className="h-3 w-px bg-[#292929]" aria-hidden="true" />
            <span className="inline-flex items-center gap-2 font-mono tracking-wider uppercase">
              <Clock className="h-3.5 w-3.5 text-[#E11D2E]" aria-hidden="true" />
              {BRAND_CONFIG.schedule.operatingDays} ({BRAND_CONFIG.schedule.closedDays})
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span
              className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wider uppercase text-white"
              title={BRAND_CONFIG.xpelClaim.verificationNote}
            >
              <ShieldCheck
                className="h-3.5 w-3.5 text-[#E11D2E]"
                aria-hidden="true"
              />
              {BRAND_CONFIG.xpelClaim.text}
              <span className="ml-1 border border-[#292929] bg-[#1C1C1C] px-1.5 py-0.5 text-[9px] text-[#A3A3A3]">
                PENDING VERIFICATION
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Primary Navigation Bar */}
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
        <BrandMark />

        {/* Desktop Navigation Links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden items-center gap-1 lg:flex"
        >
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`group relative px-4 py-2 font-display text-base font-bold tracking-[0.12em] uppercase transition-colors duration-200 ${
                  isActive
                    ? "text-white"
                    : "text-[#A3A3A3] hover:text-white"
                }`}
              >
                {link.label}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-4 bottom-0.5 h-0.5 bg-[#E11D2E] transition-transform duration-200 origin-left ${
                    isActive
                      ? "scale-x-100"
                      : "scale-x-0 group-hover:scale-x-100"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        {/* Desktop CTA Actions */}
        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 border border-[#292929] bg-[#141414] px-4 py-2.5 font-display text-sm font-bold tracking-[0.14em] uppercase text-white transition-colors duration-200 hover:border-white/40 hover:bg-[#1C1C1C]"
          >
            Explore Services
          </Link>
          <Link
            href="/booking"
            className="group inline-flex items-center gap-2 bg-[#E11D2E] px-5 py-2.5 font-display text-sm font-bold tracking-[0.14em] uppercase text-white transition-colors duration-200 hover:bg-[#FF3045]"
          >
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <span>Book Appointment</span>
            <ArrowUpRight
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>

        {/* Mobile Menu Trigger */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-navigation-drawer"
          aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          className="inline-flex h-11 w-11 items-center justify-center border border-[#292929] bg-[#141414] text-white transition-colors hover:border-[#E11D2E] lg:hidden"
        >
          {isMobileMenuOpen ? (
            <X className="h-5 w-5 text-[#E11D2E]" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div
          id="mobile-navigation-drawer"
          ref={drawerRef}
          className="fixed inset-x-0 top-20 bottom-0 z-50 flex flex-col justify-between overflow-y-auto border-t border-[#292929] bg-[#090909] px-6 py-8 lg:hidden"
        >
          <nav aria-label="Mobile Navigation" className="flex flex-col space-y-2">
            {NAV_LINKS.map((link, index) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  data-mobile-nav-item
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center justify-between border-b border-[#292929] py-4 font-display text-2xl font-extrabold tracking-[0.1em] uppercase transition-colors ${
                    isActive
                      ? "text-[#E11D2E]"
                      : "text-white hover:text-[#E11D2E]"
                  }`}
                >
                  <span>{link.label}</span>
                  <span className="font-mono text-xs text-[#A3A3A3]">
                    0{index + 1}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div
            data-mobile-nav-item
            className="mt-8 space-y-5 border-t border-[#292929] pt-6"
          >
            <div className="space-y-2 text-xs text-[#A3A3A3]">
              <p className="flex items-center gap-2 font-mono uppercase text-white">
                <MapPin className="h-4 w-4 text-[#E11D2E]" aria-hidden="true" />
                {BRAND_CONFIG.location.fullAddress}
              </p>
              <p className="flex items-center gap-2 font-mono uppercase">
                <Clock className="h-4 w-4 text-[#E11D2E]" aria-hidden="true" />
                {BRAND_CONFIG.schedule.operatingDays} • {BRAND_CONFIG.schedule.closedDays}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                href="/booking"
                onClick={() => setIsMobileMenuOpen(false)}
                className="inline-flex items-center justify-center gap-2 bg-[#E11D2E] px-5 py-3.5 font-display text-base font-bold tracking-[0.14em] uppercase text-white transition-colors hover:bg-[#FF3045]"
              >
                <Calendar className="h-4 w-4" aria-hidden="true" />
                Schedule Appointment
              </Link>
              <Link
                href="/contact"
                onClick={() => setIsMobileMenuOpen(false)}
                className="inline-flex items-center justify-center gap-2 border border-[#292929] bg-[#141414] px-5 py-3.5 font-display text-base font-bold tracking-[0.14em] uppercase text-white transition-colors hover:border-white/40"
              >
                Request Consultation
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
