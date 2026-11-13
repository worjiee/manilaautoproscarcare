"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Menu, X, ArrowUpRight, Calendar } from "lucide-react";
import { NAV_LINKS } from "@/lib/constants/site-data";
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
      className={`sticky top-0 z-50 h-20 w-full border-b border-[#292929] transition-colors duration-300 ${
        isScrolled
          ? "bg-[#090909]/95 shadow-[0_10px_30px_rgba(0,0,0,0.2)] backdrop-blur-md"
          : "bg-[#090909]"
      }`}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <BrandMark />

        {/* Desktop Navigation Links */}
        <nav
          aria-label="Primary Navigation"
          className="ml-auto hidden items-center gap-0.5 xl:flex"
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
                aria-current={isActive ? "page" : undefined}
                className={`group relative flex min-h-11 items-center px-3.5 py-2 font-sans text-[15px] font-medium tracking-[0.04em] transition-colors duration-200 xl:px-4 ${
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

        {/* Desktop booking action */}
        <div className="ml-4 hidden items-center xl:flex">
          <Link
            href="/booking"
            className="group inline-flex min-h-11 items-center gap-2 whitespace-nowrap bg-[#E11D2E] px-5 py-2.5 font-sans text-sm font-bold tracking-[0.05em] text-white transition-colors duration-200 hover:bg-[#FF3045]"
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
          className="inline-flex h-11 w-11 items-center justify-center border border-[#292929] bg-[#141414] text-white transition-colors hover:border-[#E11D2E] xl:hidden"
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
          className="fixed inset-x-0 top-20 bottom-0 z-50 flex flex-col justify-between overflow-y-auto border-t border-[#292929] bg-[#090909] px-6 py-8 xl:hidden"
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
                  aria-current={isActive ? "page" : undefined}
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
            className="mt-8 border-t border-[#292929] pt-6"
          >
            <Link
              href="/booking"
              onClick={() => setIsMobileMenuOpen(false)}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-[#E11D2E] px-5 py-3 font-sans text-[15px] font-bold tracking-[0.06em] text-white transition-colors hover:bg-[#FF3045]"
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              Book Appointment
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
