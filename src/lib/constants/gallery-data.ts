import type { VehicleType } from "./site-data";

/**
 * Project gallery data.
 *
 * HOW TO ADD REAL CLIENT PHOTOS
 * 1. Place optimized images in `/public/images/gallery/` (JPG/WebP, ~2000px wide).
 * 2. Add an entry below with accurate `width`/`height`, a descriptive `alt`,
 *    the correct `vehicle` and `serviceSlug`, and `isPlaceholder: false`.
 * 3. Remove placeholder entries once enough real projects are available.
 *
 * Never describe placeholder slots as completed customer projects.
 */
export interface GalleryItem {
  id: string;
  title: string;
  vehicle: VehicleType;
  /** Must match a `ServiceCategory.slug` in site-data.ts. */
  serviceSlug: string;
  description: string;
  image: {
    src: string;
    width: number;
    height: number;
    alt: string;
  };
  isPlaceholder: boolean;
}

export const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: "slot-01",
    title: "Reserved Slot — Paint Protection Film",
    vehicle: "Car",
    serviceSlug: "paint-protection-film",
    description: "Reserved for client photography of a PPF installation.",
    image: {
      src: "/images/placeholders/gallery-01.svg",
      width: 900,
      height: 600,
      alt: "Labeled placeholder frame reserved for a paint protection film project photo",
    },
    isPlaceholder: true,
  },
  {
    id: "slot-02",
    title: "Reserved Slot — Ceramic & Graphene Coating",
    vehicle: "Car",
    serviceSlug: "ceramic-graphene-coating",
    description: "Reserved for client photography of a coating project.",
    image: {
      src: "/images/placeholders/gallery-02.svg",
      width: 900,
      height: 600,
      alt: "Labeled placeholder frame reserved for a ceramic or graphene coating project photo",
    },
    isPlaceholder: true,
  },
  {
    id: "slot-03",
    title: "Reserved Slot — Matte PPF",
    vehicle: "Car",
    serviceSlug: "paint-protection-film",
    description: "Reserved for client photography of a matte film project.",
    image: {
      src: "/images/placeholders/gallery-03.svg",
      width: 900,
      height: 600,
      alt: "Labeled placeholder frame reserved for a matte PPF project photo",
    },
    isPlaceholder: true,
  },
  {
    id: "slot-04",
    title: "Reserved Slot — Moto Pros",
    vehicle: "Motorcycle",
    serviceSlug: "moto-pros",
    description: "Reserved for client photography of a motorcycle project.",
    image: {
      src: "/images/placeholders/gallery-04.svg",
      width: 900,
      height: 600,
      alt: "Labeled placeholder frame reserved for a Moto Pros motorcycle project photo",
    },
    isPlaceholder: true,
  },
  {
    id: "slot-05",
    title: "Reserved Slot — Auto Detailing",
    vehicle: "Car",
    serviceSlug: "auto-detailing",
    description: "Reserved for client photography of a detailing or paint correction project.",
    image: {
      src: "/images/placeholders/gallery-05.svg",
      width: 900,
      height: 600,
      alt: "Labeled placeholder frame reserved for an auto detailing project photo",
    },
    isPlaceholder: true,
  },
  {
    id: "slot-06",
    title: "Reserved Slot — Window Tint",
    vehicle: "Car",
    serviceSlug: "automotive-window-tint",
    description: "Reserved for client photography of a window tint installation.",
    image: {
      src: "/images/placeholders/gallery-06.svg",
      width: 900,
      height: 600,
      alt: "Labeled placeholder frame reserved for a window tint project photo",
    },
    isPlaceholder: true,
  },
  {
    id: "slot-07",
    title: "Reserved Slot — Motorcycle Coating",
    vehicle: "Motorcycle",
    serviceSlug: "moto-pros",
    description: "Reserved for client photography of a motorcycle coating project.",
    image: {
      src: "/images/placeholders/gallery-07.svg",
      width: 900,
      height: 600,
      alt: "Labeled placeholder frame reserved for a motorcycle coating project photo",
    },
    isPlaceholder: true,
  },
];
