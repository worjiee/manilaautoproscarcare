"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Info,
  X,
  Calendar,
} from "lucide-react";
import {
  SERVICE_CATEGORIES,
  type VehicleType,
} from "@/lib/constants/site-data";
import {
  GALLERY_ITEMS,
  type GalleryItem,
} from "@/lib/constants/gallery-data";
import { StudioImagePlaceholder } from "@/components/ui/studio-image-placeholder";

gsap.registerPlugin(useGSAP);

type VehicleFilter = "All" | VehicleType;

export function GalleryExperience() {
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>("All");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const serviceTitleBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of SERVICE_CATEGORIES) {
      map.set(s.slug, s.title);
    }
    return map;
  }, []);

  const filteredItems = useMemo(() => {
    return GALLERY_ITEMS.filter((item) => {
      const matchesVehicle =
        vehicleFilter === "All" || item.vehicle === vehicleFilter;
      const matchesService =
        serviceFilter === "all" || item.serviceSlug === serviceFilter;
      return matchesVehicle && matchesService;
    });
  }, [vehicleFilter, serviceFilter]);

  const activeItem: GalleryItem | null =
    activeIndex !== null && filteredItems[activeIndex]
      ? filteredItems[activeIndex]
      : null;

  // Smooth GSAP reveal whenever filters change
  useGSAP(
    () => {
      if (!gridRef.current) return;
      const cards = gridRef.current.querySelectorAll("[data-gallery-card]");
      if (!cards.length) return;

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      if (prefersReducedMotion) {
        gsap.set(cards, { autoAlpha: 1, y: 0, scale: 1 });
        return;
      }

      gsap.fromTo(
        cards,
        { autoAlpha: 0, y: 20, scale: 0.985 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.48,
          stagger: 0.06,
          ease: "power3.out",
        }
      );
    },
    { dependencies: [vehicleFilter, serviceFilter], scope: gridRef }
  );

  // Lightbox keyboard navigation & scroll lock
  useEffect(() => {
    if (activeIndex === null) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setActiveIndex(null);
        lastTriggerRef.current?.focus();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex((prev) =>
          prev === null ? null : (prev + 1) % filteredItems.length
        );
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((prev) =>
          prev === null
            ? null
            : (prev - 1 + filteredItems.length) % filteredItems.length
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [activeIndex, filteredItems.length]);

  const openLightbox = (index: number, triggerEl: HTMLButtonElement) => {
    lastTriggerRef.current = triggerEl;
    setActiveIndex(index);
  };

  const closeLightbox = () => {
    setActiveIndex(null);
    lastTriggerRef.current?.focus();
  };

  return (
    <section
      aria-label="Project Gallery Directory"
      className="border-b border-[#292929] bg-[#090909] py-16 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Media Integrity Notice */}
        <div className="mb-10 flex items-start gap-3 border border-[#292929] bg-[#141414] p-5 text-xs leading-relaxed text-[#A3A3A3]">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-[#E11D2E]"
            aria-hidden="true"
          />
          <div>
            <p className="font-mono font-semibold tracking-wider text-white uppercase">
              Placeholder Portfolio Slots — Awaiting Client Photography
            </p>
            <p className="mt-1">
              None of the frames below represent actual customer vehicles or
              completed Manila Auto Pros projects. They are structured
              placeholder slots ready to be populated in{" "}
              <code className="font-mono text-white">
                src/lib/constants/gallery-data.ts
              </code>{" "}
              once client photography is supplied.
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col gap-6 border border-[#292929] bg-[#141414] p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Vehicle Category Filter */}
          <div>
            <p
              id="vehicle-filter-label"
              className="font-mono text-[11px] font-semibold tracking-[0.18em] text-[#A3A3A3] uppercase"
            >
              Vehicle Category
            </p>
            <div
              role="group"
              aria-labelledby="vehicle-filter-label"
              className="mt-2.5 flex flex-wrap gap-2"
            >
              {(["All", "Car", "Motorcycle"] as VehicleFilter[]).map((type) => {
                const isActive = vehicleFilter === type;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      setVehicleFilter(type);
                      setActiveIndex(null);
                    }}
                    className={`px-4 py-2 font-display text-sm font-bold tracking-[0.12em] uppercase transition-colors ${
                      isActive
                        ? "border border-[#E11D2E] bg-[#E11D2E] text-white"
                        : "border border-[#292929] bg-[#1C1C1C] text-[#A3A3A3] hover:border-white/40 hover:text-white"
                    }`}
                  >
                    {type === "All"
                      ? "All Vehicles"
                      : type === "Car"
                      ? "Cars"
                      : "Motorcycles (Moto Pros)"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service Category Filter */}
          <div className="lg:text-right">
            <p
              id="service-filter-label"
              className="font-mono text-[11px] font-semibold tracking-[0.18em] text-[#A3A3A3] uppercase"
            >
              Filter by Service Division
            </p>
            <div
              role="group"
              aria-labelledby="service-filter-label"
              className="mt-2.5 flex flex-wrap gap-2 lg:justify-end"
            >
              <button
                type="button"
                aria-pressed={serviceFilter === "all"}
                onClick={() => {
                  setServiceFilter("all");
                  setActiveIndex(null);
                }}
                className={`px-3.5 py-2 font-mono text-xs font-semibold tracking-wider uppercase transition-colors ${
                  serviceFilter === "all"
                    ? "border border-[#E11D2E] bg-[#E11D2E] text-white"
                    : "border border-[#292929] bg-[#1C1C1C] text-[#A3A3A3] hover:border-white/40 hover:text-white"
                }`}
              >
                All Services
              </button>
              {SERVICE_CATEGORIES.map((service) => {
                const isActive = serviceFilter === service.slug;
                return (
                  <button
                    key={service.slug}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      setServiceFilter(service.slug);
                      setActiveIndex(null);
                    }}
                    className={`px-3.5 py-2 font-mono text-xs font-semibold tracking-wider uppercase transition-colors ${
                      isActive
                        ? "border border-[#E11D2E] bg-[#E11D2E] text-white"
                        : "border border-[#292929] bg-[#1C1C1C] text-[#A3A3A3] hover:border-white/40 hover:text-white"
                    }`}
                  >
                    {service.title}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-6 flex items-center justify-between font-mono text-xs text-[#A3A3A3] uppercase">
          <p aria-live="polite">
            Showing <span className="text-white">{filteredItems.length}</span>{" "}
            of {GALLERY_ITEMS.length} gallery slots
          </p>
          {(vehicleFilter !== "All" || serviceFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setVehicleFilter("All");
                setServiceFilter("all");
              }}
              className="text-[#E11D2E] underline-offset-4 hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Gallery Grid */}
        <div
          ref={gridRef}
          className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {filteredItems.length === 0 ? (
            <div className="col-span-full border border-[#292929] bg-[#141414] p-12 text-center">
              <p className="font-display text-2xl font-bold tracking-wide text-white uppercase">
                No gallery slots match the selected filter combination.
              </p>
              <p className="mt-2 text-sm text-[#A3A3A3]">
                Try selecting &ldquo;All Vehicles&rdquo; or &ldquo;All
                Services&rdquo; to view all reserved portfolio slots.
              </p>
              <button
                type="button"
                onClick={() => {
                  setVehicleFilter("All");
                  setServiceFilter("all");
                }}
                className="mt-6 bg-[#E11D2E] px-6 py-3 font-display text-sm font-bold tracking-[0.14em] text-white uppercase transition-colors hover:bg-[#FF3045]"
              >
                Show All Slots
              </button>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const serviceName =
                serviceTitleBySlug.get(item.serviceSlug) ?? item.serviceSlug;

              return (
                <article
                  key={item.id}
                  data-gallery-card
                  className="group flex flex-col justify-between border border-[#292929] bg-[#1C1C1C] transition-colors hover:border-[#E11D2E]"
                >
                  <div>
                    <button
                      type="button"
                      onClick={(e) => openLightbox(idx, e.currentTarget)}
                      aria-label={`Open full-screen preview for ${item.title}`}
                      className="relative block w-full text-left"
                    >
                      <StudioImagePlaceholder
                        src={item.image.src}
                        alt={item.image.alt}
                        isTemporaryPlaceholder={item.isPlaceholder}
                        badgeText="PLACEHOLDER SLOT"
                        aspectClassName="aspect-[3/2]"
                        className="border-x-0 border-t-0"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      <span className="pointer-events-none absolute right-3 bottom-3 z-20 inline-flex items-center gap-1.5 border border-[#292929] bg-[#090909]/90 px-2.5 py-1 font-mono text-[10px] tracking-wider text-white uppercase transition-colors group-hover:border-[#E11D2E] group-hover:bg-[#E11D2E]">
                        <Expand className="h-3 w-3" aria-hidden="true" />
                        Inspect
                      </span>
                    </button>

                    <div className="p-6">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-semibold tracking-wider text-[#E11D2E] uppercase">
                          {serviceName}
                        </span>
                        <span className="border border-[#292929] bg-[#141414] px-2 py-0.5 font-mono text-[10px] text-[#A3A3A3] uppercase">
                          {item.vehicle}
                        </span>
                      </div>

                      <h2 className="mt-2.5 font-display text-2xl font-extrabold tracking-wide text-white uppercase">
                        {item.title}
                      </h2>

                      <p className="mt-2 text-sm leading-relaxed text-[#A3A3A3]">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#292929] bg-[#141414] px-6 py-3.5">
                    <button
                      type="button"
                      onClick={(e) => openLightbox(idx, e.currentTarget)}
                      className="font-mono text-xs font-semibold text-white uppercase transition-colors hover:text-[#E11D2E]"
                    >
                      Open Lightbox
                    </button>
                    <Link
                      href={`/booking?service=${item.serviceSlug}&vehicle=${item.vehicle}`}
                      className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[#A3A3A3] uppercase transition-colors hover:text-white"
                    >
                      <Calendar
                        className="h-3.5 w-3.5 text-[#E11D2E]"
                        aria-hidden="true"
                      />
                      Book Service
                    </Link>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      {/* Full-Screen Accessible Lightbox Modal */}
      {activeItem && activeIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lightbox-title"
          aria-describedby="lightbox-description"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#090909]/95 p-4 backdrop-blur-md sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLightbox();
          }}
        >
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-[#292929] bg-[#141414]">
            {/* Top Bar */}
            <div className="flex items-center justify-between border-b border-[#292929] bg-[#090909] px-5 py-3.5">
              <div className="flex items-center gap-3 font-mono text-xs uppercase">
                <span className="text-[#E11D2E]">
                  SLOT {activeIndex + 1} / {filteredItems.length}
                </span>
                <span className="text-[#292929]">|</span>
                <span className="text-white">{activeItem.vehicle}</span>
                {activeItem.isPlaceholder && (
                  <span className="border border-[#292929] bg-[#1C1C1C] px-2 py-0.5 text-[10px] text-[#A3A3A3]">
                    PLACEHOLDER GRAPHIC
                  </span>
                )}
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeLightbox}
                aria-label="Close lightbox (Escape)"
                className="inline-flex items-center gap-1.5 border border-[#292929] bg-[#1C1C1C] px-3 py-1.5 font-mono text-xs font-semibold text-white uppercase transition-colors hover:border-[#E11D2E] hover:bg-[#E11D2E]"
              >
                <span>Close</span>
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Image Stage */}
            <div className="relative aspect-[16/10] w-full bg-[#090909]">
              <Image
                src={activeItem.image.src}
                alt={activeItem.image.alt}
                fill
                sizes="(max-width: 1280px) 95vw, 1100px"
                className="object-contain"
              />

              {filteredItems.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveIndex(
                        (activeIndex - 1 + filteredItems.length) %
                          filteredItems.length
                      )
                    }
                    aria-label="Previous gallery item (Left arrow)"
                    className="absolute top-1/2 left-3 -translate-y-1/2 border border-[#292929] bg-[#090909]/90 p-3 text-white transition-colors hover:border-[#E11D2E] hover:bg-[#E11D2E]"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveIndex((activeIndex + 1) % filteredItems.length)
                    }
                    aria-label="Next gallery item (Right arrow)"
                    className="absolute top-1/2 right-3 -translate-y-1/2 border border-[#292929] bg-[#090909]/90 p-3 text-white transition-colors hover:border-[#E11D2E] hover:bg-[#E11D2E]"
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>

            {/* Caption & Actions Footer */}
            <div className="flex flex-col justify-between gap-4 border-t border-[#292929] bg-[#1C1C1C] p-5 sm:flex-row sm:items-center">
              <div>
                <p className="font-mono text-xs font-semibold tracking-wider text-[#E11D2E] uppercase">
                  {serviceTitleBySlug.get(activeItem.serviceSlug) ??
                    activeItem.serviceSlug}
                </p>
                <h3
                  id="lightbox-title"
                  className="mt-1 font-display text-2xl font-extrabold tracking-wide text-white uppercase"
                >
                  {activeItem.title}
                </h3>
                <p
                  id="lightbox-description"
                  className="mt-1 text-sm text-[#A3A3A3]"
                >
                  {activeItem.description}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <Link
                  href={`/services/${activeItem.serviceSlug}`}
                  onClick={closeLightbox}
                  className="border border-[#292929] bg-[#141414] px-4 py-2.5 font-display text-sm font-bold tracking-[0.12em] text-white uppercase transition-colors hover:border-white/40"
                >
                  Service Details
                </Link>
                <Link
                  href={`/booking?service=${activeItem.serviceSlug}&vehicle=${activeItem.vehicle}`}
                  onClick={closeLightbox}
                  className="bg-[#E11D2E] px-4 py-2.5 font-display text-sm font-bold tracking-[0.12em] text-white uppercase transition-colors hover:bg-[#FF3045]"
                >
                  Book This Service
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
