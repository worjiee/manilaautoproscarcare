"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface MotionScopeProps {
  children: ReactNode;
  className?: string;
}

/**
 * Declarative GSAP animation scope for the public site.
 *
 * Wrap any (server-rendered) markup and opt elements in via data attributes:
 *
 * | Attribute                         | Effect                                         |
 * | --------------------------------- | ---------------------------------------------- |
 * | `data-animate="hero"`             | On-load timeline for descendants:              |
 * |   `data-hero-media`               |   cinematic clip-path + scale image reveal     |
 * |   `data-hero-kicker`              |   kicker fade-up                               |
 * |   `data-headline-line`            |   staggered headline lines                     |
 * |   `data-hero-sub`                 |   supporting copy                              |
 * |   `data-hero-cta`                 |   staggered CTAs                               |
 * | `data-animate="headline"`         | Scroll-triggered staggered `data-headline-line`|
 * | `data-animate="fade-up"`          | Scroll-triggered fade + translate              |
 * | `data-animate="stagger"`          | Scroll-triggered stagger of `data-animate-item`|
 * | `data-animate="mask"`             | Scroll-triggered clip-path image mask reveal   |
 * | `data-animate="parallax"`         | Subtle scrubbed parallax (desktop only)        |
 *
 * Elements are pre-hidden by CSS only when JS is running and the user has no
 * reduced-motion preference (see globals.css), preventing flashes and layout
 * shift. Reduced-motion users see static content immediately.
 */
export function MotionScope({ children, className }: MotionScopeProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();

      /* Font metrics and responsive copy wrapping can change trigger positions
         after first paint. Refresh once fonts settle and again after viewport
         resizing so preserved ScrollTrigger animations stay aligned. */
      const refresh = () => ScrollTrigger.refresh();
      document.fonts?.ready.then(refresh);
      window.addEventListener("load", refresh, { once: true });
      window.addEventListener("resize", refresh, { passive: true });

      mm.add(
        {
          desktop: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
          mobile: "(max-width: 767px) and (prefers-reduced-motion: no-preference)",
        },
        (context) => {
          const { desktop } = context.conditions as {
            desktop: boolean;
            mobile: boolean;
          };
          const distance = desktop ? 32 : 16;

          /* ---------------------------- Hero timeline --------------------------- */
          q<HTMLElement>('[data-animate="hero"]').forEach((hero) => {
            const h = gsap.utils.selector(hero);
            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
            const media = h("[data-hero-media]");
            const mediaImg = h("[data-hero-media] img");

            if (media.length) {
              tl.fromTo(
                media,
                { autoAlpha: 0, clipPath: desktop ? "inset(6% 4% 6% 4%)" : "inset(0% 0% 0% 0%)" },
                {
                  autoAlpha: 1,
                  clipPath: "inset(0% 0% 0% 0%)",
                  duration: desktop ? 1.3 : 0.6,
                  ease: "power4.out",
                },
                0
              );
              if (desktop && mediaImg.length) {
                tl.fromTo(mediaImg, { scale: 1.08 }, { scale: 1, duration: 1.8, ease: "power2.out" }, 0);
              }
            }

            tl.fromTo(h("[data-hero-kicker]"), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5 }, desktop ? 0.35 : 0.1)
              .fromTo(
                h("[data-headline-line]"),
                { autoAlpha: 0, y: distance + 8 },
                { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12 },
                "-=0.25"
              )
              .fromTo(h("[data-hero-sub]"), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.55 }, "-=0.4")
              .fromTo(
                h("[data-hero-cta]"),
                { autoAlpha: 0, y: 14 },
                { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08 },
                "-=0.3"
              );
          });

          /* ------------------------- Scroll headline lines ---------------------- */
          q<HTMLElement>('[data-animate="headline"]').forEach((el) => {
            gsap.fromTo(
              gsap.utils.selector(el)("[data-headline-line]"),
              { autoAlpha: 0, y: distance },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.7,
                stagger: 0.1,
                ease: "power3.out",
                scrollTrigger: { trigger: el, start: "top 88%", once: true },
              }
            );
          });

          /* ------------------------------- Fade up ------------------------------ */
          q<HTMLElement>('[data-animate="fade-up"]').forEach((el) => {
            gsap.fromTo(
              el,
              { autoAlpha: 0, y: distance },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.75,
                ease: "power3.out",
                scrollTrigger: { trigger: el, start: "top 88%", once: true },
              }
            );
          });

          /* -------------------------------- Stagger ----------------------------- */
          q<HTMLElement>('[data-animate="stagger"]').forEach((group) => {
            const items = gsap.utils.selector(group)("[data-animate-item]");
            if (!items.length) return;
            gsap.fromTo(
              items,
              { autoAlpha: 0, y: distance },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.7,
                stagger: desktop ? 0.1 : 0.05,
                ease: "power3.out",
                scrollTrigger: { trigger: group, start: "top 85%", once: true },
              }
            );
          });

          /* ------------------------------ Image mask ---------------------------- */
          q<HTMLElement>('[data-animate="mask"]').forEach((el) => {
            const img = el.querySelector("img");
            const tl = gsap.timeline({
              scrollTrigger: { trigger: el, start: "top 85%", once: true },
            });
            tl.fromTo(
              el,
              { autoAlpha: 0, clipPath: "inset(0% 0% 100% 0%)" },
              { autoAlpha: 1, clipPath: "inset(0% 0% 0% 0%)", duration: desktop ? 1 : 0.6, ease: "power4.out" }
            );
            if (img && desktop) {
              tl.fromTo(img, { scale: 1.12 }, { scale: 1, duration: 1.3, ease: "power2.out" }, 0);
            }
          });

          /* ------------------------------- Parallax ----------------------------- */
          if (desktop) {
            q<HTMLElement>('[data-animate="parallax"]').forEach((el) => {
              const amount = Number(el.dataset.parallaxAmount ?? 8);
              gsap.fromTo(
                el,
                { yPercent: -amount / 2 },
                {
                  yPercent: amount / 2,
                  ease: "none",
                  scrollTrigger: {
                    trigger: el.parentElement ?? el,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: true,
                  },
                }
              );
            });
          }
        }
      );

      return () => {
        window.removeEventListener("load", refresh);
        window.removeEventListener("resize", refresh);
        mm.revert();
      };
    },
    { scope: rootRef }
  );

  return (
    <div ref={rootRef} data-motion-root="" className={className}>
      {children}
    </div>
  );
}
