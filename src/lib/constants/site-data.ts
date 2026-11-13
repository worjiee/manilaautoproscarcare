/**
 * MANILA AUTO PROS — Centralized public site content.
 *
 * Content rules:
 * - Only client-confirmed business facts are stated as fact.
 * - Unconfirmed values are `null` and rendered as "to be confirmed".
 * - Unverified claims carry `verified: false` and are gated by `<DraftClaim>`.
 * - Placeholder imagery is flagged with `isPlaceholder: true`.
 */

export type VehicleType = "Car" | "Motorcycle";

export interface MediaAsset {
  src: string;
  alt: string;
  /** True until the client supplies real photography for this slot. */
  isPlaceholder: boolean;
}

export interface ServiceItem {
  id: string;
  name: string;
  shortDescription: string;
}

export interface ProcessStep {
  title: string;
  description: string;
}

export interface ServiceCategory {
  slug: string;
  title: string;
  /** Numbered kicker shown above titles, e.g. "01 // PAINT PROTECTION FILM". */
  kicker: string;
  tagline: string;
  summary: string;
  description: string[];
  seoDescription: string;
  vehicleTypes: VehicleType[];
  benefits: string[];
  process: ProcessStep[];
  relatedSlugs: string[];
  image: MediaAsset;
  items: ServiceItem[];
}

/* -------------------------------------------------------------------------- */
/*                               BUSINESS CONFIG                              */
/* -------------------------------------------------------------------------- */

export const BRAND_CONFIG = {
  name: "MANILA AUTO PROS",
  displayName: "Manila Auto Pros",
  tagline: "Protect Your Investment. Preserve Your Vehicle's Beauty.",
  industry: "Premium Automotive Detailing & Paint Protection",
  location: {
    street: "Quiricada Street",
    city: "Manila",
    country: "Philippines",
    fullAddress: "Quiricada Street, Manila, Philippines",
    timezone: "Asia/Manila",
    mapSearchUrl:
      "https://www.google.com/maps/search/?api=1&query=Quiricada+Street+Manila+Philippines",
  },
  schedule: {
    operatingDays: "Monday – Saturday",
    closedDays: "Sunday: Closed",
    /** Not yet confirmed by the client. Keep `null` until supplied. */
    hours: null as string | null,
  },
  contact: {
    /** Not yet confirmed by the client. Keep `null` until supplied. */
    phone: null as string | null,
    email: null as string | null,
  },
  /**
   * Client-supplied accreditation claim. MUST be verified (certificate or
   * XPEL dealer locator listing) before `verified` is set to `true`.
   */
  xpelClaim: {
    text: "Accredited XPEL Dealer & Installer",
    verified: false,
  },
} as const;

/**
 * Official social profiles. Intentionally empty — do not add URLs until the
 * client confirms each account.
 */
export const SOCIAL_LINKS: { platform: string; href: string }[] = [];

export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Gallery", href: "/gallery" },
  { label: "Contact", href: "/contact" },
] as const;

/* -------------------------------------------------------------------------- */
/*                                  SERVICES                                  */
/* -------------------------------------------------------------------------- */

const STANDARD_CONSULT_STEP: ProcessStep = {
  title: "Consultation & Inspection",
  description:
    "We assess your vehicle's current condition, discuss how you drive and store it, and recommend the right scope. Pricing is provided per vehicle after inspection.",
};

const STANDARD_HANDOVER_STEP: ProcessStep = {
  title: "Handover & Aftercare Guidance",
  description:
    "We walk you through the finished work and explain how to wash and maintain the surface so the protection performs as intended.",
};

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    slug: "paint-protection-film",
    title: "Paint Protection Film",
    kicker: "01 // PAINT PROTECTION FILM",
    tagline: "A physical barrier against chips, scratches, and road debris.",
    summary:
      "Transparent or tinted urethane film applied over painted panels to absorb the impacts that coatings alone cannot stop.",
    description: [
      "Paint Protection Film (PPF) is a thin, durable urethane layer installed directly over your vehicle's paint. It takes the abuse of daily driving — stone chips, light scratches, bug and tar contamination — so the factory finish underneath stays intact.",
      "Coverage can be tailored to how you use your vehicle: high-impact zones such as the front bumper, hood, fenders, and mirrors, or complete full-body coverage. Film is available in clear gloss, black, and matte finishes, allowing you to preserve or restyle your paint.",
    ],
    seoDescription:
      "XPEL Paint Protection Film installation in Manila — clear, black, and matte PPF with full-body or partial coverage at Manila Auto Pros, Quiricada Street.",
    vehicleTypes: ["Car"],
    benefits: [
      "Physical protection against stone chips and road debris",
      "Helps preserve factory paint and resale presentation",
      "Clear, black, and matte finish options",
      "Full-body or targeted partial coverage",
      "Can be combined with ceramic or graphene coating",
    ],
    process: [
      STANDARD_CONSULT_STEP,
      {
        title: "Surface Preparation",
        description:
          "Panels are washed and decontaminated, and paint correction is recommended where needed, so the film is applied over a clean surface.",
      },
      {
        title: "Film Installation",
        description:
          "Film is fitted panel by panel to the agreed coverage, with careful attention to edges and contours.",
      },
      STANDARD_HANDOVER_STEP,
    ],
    relatedSlugs: ["ceramic-graphene-coating", "auto-detailing", "automotive-window-tint"],
    image: {
      src: "/images/dev-placeholders/service-ppf.jpg",
      alt: "Development placeholder photo: paint protection film being applied with a squeegee",
      isPlaceholder: true,
    },
    items: [
      {
        id: "xpel-ppf",
        name: "XPEL Paint Protection Film Installation",
        shortDescription:
          "Installation of XPEL paint protection film on selected panels or the full vehicle.",
      },
      {
        id: "clear-ppf",
        name: "Clear PPF",
        shortDescription:
          "Transparent gloss film that protects paint without changing its original color.",
      },
      {
        id: "black-ppf",
        name: "Black PPF",
        shortDescription:
          "Black film for roofs, trim, and accents — styling and protection in one layer.",
      },
      {
        id: "matte-ppf",
        name: "Matte PPF",
        shortDescription:
          "Satin/matte film that gives gloss paint a stealth finish or protects factory matte paint.",
      },
      {
        id: "full-body-ppf",
        name: "Full Body PPF",
        shortDescription: "Coverage across all painted exterior panels.",
      },
      {
        id: "partial-ppf",
        name: "Partial PPF",
        shortDescription:
          "Targeted coverage for high-impact areas such as bumpers, hoods, fenders, and mirrors.",
      },
    ],
  },
  {
    slug: "ceramic-graphene-coating",
    title: "Ceramic & Graphene Coating",
    kicker: "02 // CERAMIC & GRAPHENE COATING",
    tagline: "Deep gloss and hydrophobic protection that makes washing easier.",
    summary:
      "Liquid coatings that bond to your clear coat, adding gloss, water repellency, and resistance to everyday contamination.",
    description: [
      "Ceramic and graphene coatings form a hard, slick layer on top of your vehicle's clear coat. Water and grime have a harder time sticking, so routine washing is quicker and safer for the paint.",
      "Coatings are applied after the paint has been properly cleaned and, where needed, enhanced by machine polishing. Multi-layer packages are available for owners who want additional coating build.",
    ],
    seoDescription:
      "Ceramic coating and graphene coating in Manila — gloss enhancement, hydrophobic protection, and multi-layer packages at Manila Auto Pros.",
    vehicleTypes: ["Car"],
    benefits: [
      "Enhanced gloss and depth of color",
      "Hydrophobic surface that sheds water and dirt",
      "Easier, safer routine washing",
      "Added resistance to environmental contamination",
      "Single or multi-layer options",
    ],
    process: [
      STANDARD_CONSULT_STEP,
      {
        title: "Decontamination & Paint Enhancement",
        description:
          "The vehicle is washed and decontaminated, then machine polished as required so the coating locks in a refined finish.",
      },
      {
        title: "Coating Application",
        description:
          "The selected ceramic or graphene coating is applied panel by panel and allowed to cure.",
      },
      STANDARD_HANDOVER_STEP,
    ],
    relatedSlugs: ["paint-protection-film", "auto-detailing", "moto-pros"],
    image: {
      src: "/images/dev-placeholders/service-coating.jpg",
      alt: "Development placeholder photo: water beading on glossy coated paint",
      isPlaceholder: true,
    },
    items: [
      {
        id: "premium-ceramic-coating",
        name: "Premium Ceramic Coating",
        shortDescription:
          "Ceramic protection for gloss, water repellency, and easier maintenance.",
      },
      {
        id: "graphene-coating",
        name: "Graphene Coating",
        shortDescription:
          "Graphene-enhanced coating for a slick, protective, high-gloss finish.",
      },
      {
        id: "multi-layer-coating",
        name: "Multi-Layer Coating Packages",
        shortDescription: "Multiple coating layers for added build and protection.",
      },
      {
        id: "paint-enhancement-protection",
        name: "Paint Enhancement and Protection",
        shortDescription:
          "Polishing to restore clarity and gloss, followed by a protective coating.",
      },
    ],
  },
  {
    slug: "auto-detailing",
    title: "Auto Detailing",
    kicker: "03 // AUTO DETAILING",
    tagline: "Correction and restoration, inside and out.",
    summary:
      "From paint correction and machine polishing to full interior and exterior detailing — resetting your vehicle's finish and cabin.",
    description: [
      "Detailing goes well beyond a car wash. Paint decontamination removes bonded contaminants, while machine polishing and paint correction reduce swirl marks and light scratches to restore clarity and gloss.",
      "Inside the cabin, interior detailing cleans and refreshes surfaces, upholstery, and trim. Detailing is also the ideal preparation step before applying a coating or paint protection film.",
    ],
    seoDescription:
      "Auto detailing in Manila — full detailing, paint correction, machine polishing, decontamination, interior and exterior detailing at Manila Auto Pros.",
    vehicleTypes: ["Car"],
    benefits: [
      "Reduces swirl marks and light scratches",
      "Restores gloss and paint clarity",
      "Thorough interior cleaning and refresh",
      "Removes bonded surface contamination",
      "Ideal preparation for coatings and PPF",
    ],
    process: [
      STANDARD_CONSULT_STEP,
      {
        title: "Wash & Decontamination",
        description:
          "A careful wash followed by chemical and mechanical decontamination to remove bonded contaminants.",
      },
      {
        title: "Correction & Detailing",
        description:
          "Machine polishing and correction as agreed, plus interior and exterior detailing within the selected scope.",
      },
      STANDARD_HANDOVER_STEP,
    ],
    relatedSlugs: ["ceramic-graphene-coating", "paint-protection-film", "automotive-window-tint"],
    image: {
      src: "/images/placeholders/service-detailing.svg",
      alt: "Labeled placeholder graphic reserved for an auto detailing photo",
      isPlaceholder: true,
    },
    items: [
      {
        id: "full-detailing",
        name: "Full Detailing",
        shortDescription: "Complete interior and exterior detailing.",
      },
      {
        id: "paint-correction",
        name: "Paint Correction",
        shortDescription:
          "Multi-step polishing to reduce swirl marks, haze, and light scratches.",
      },
      {
        id: "machine-polishing",
        name: "Machine Polishing",
        shortDescription: "Machine refinement to enhance gloss and clarity.",
      },
      {
        id: "paint-decontamination",
        name: "Paint Decontamination",
        shortDescription:
          "Removal of iron fallout, tar, and bonded contaminants from the paint.",
      },
      {
        id: "interior-detailing",
        name: "Interior Detailing",
        shortDescription: "Deep cleaning and refresh of cabin surfaces and upholstery.",
      },
      {
        id: "exterior-detailing",
        name: "Exterior Detailing",
        shortDescription: "Detailed cleaning of paint, wheels, glass, and trim.",
      },
    ],
  },
  {
    slug: "automotive-window-tint",
    title: "Automotive Window Tint",
    kicker: "04 // AUTOMOTIVE WINDOW TINT",
    tagline: "Cooler cabins, added privacy, and UV protection.",
    summary:
      "Premium window film installation with heat-rejection options for comfort and interior protection.",
    description: [
      "Quality window tint helps reduce heat build-up inside the cabin, cuts glare, and adds privacy — a meaningful upgrade for everyday driving in Manila's climate.",
      "Heat-rejection films are designed to block a significant portion of solar heat and UV rays while maintaining clear visibility. We'll help you choose a film and shade that suits your vehicle and preferences.",
    ],
    seoDescription:
      "Automotive window tint in Manila — premium tint installation and heat-rejection window films at Manila Auto Pros, Quiricada Street.",
    vehicleTypes: ["Car"],
    benefits: [
      "Helps reduce cabin heat build-up",
      "Reduces glare for more comfortable driving",
      "Added privacy for passengers and belongings",
      "Helps protect interior surfaces from UV exposure",
      "Heat-rejection film options",
    ],
    process: [
      STANDARD_CONSULT_STEP,
      {
        title: "Film & Shade Selection",
        description:
          "We help you choose the film type and shade that balance heat rejection, appearance, and visibility.",
      },
      {
        title: "Glass Preparation & Installation",
        description:
          "Glass is thoroughly cleaned, then film is cut and fitted to each window.",
      },
      STANDARD_HANDOVER_STEP,
    ],
    relatedSlugs: ["paint-protection-film", "ceramic-graphene-coating", "auto-detailing"],
    image: {
      src: "/images/placeholders/service-tint.svg",
      alt: "Labeled placeholder graphic reserved for a window tint photo",
      isPlaceholder: true,
    },
    items: [
      {
        id: "premium-window-tint",
        name: "Premium Window Tint Installation",
        shortDescription: "Professional installation of premium automotive window film.",
      },
      {
        id: "heat-rejection-window-films",
        name: "Heat-Rejection Window Films",
        shortDescription:
          "Films designed to reduce solar heat and UV while maintaining visibility.",
      },
    ],
  },
  {
    slug: "moto-pros",
    title: "Moto Pros",
    kicker: "05 // MOTO PROS",
    tagline: "Dedicated protection and detailing for motorcycles.",
    summary:
      "Our motorcycle division — ceramic and graphene coatings, PPF, detailing, and paint protection for two-wheel machines.",
    description: [
      "Motorcycles face direct exposure to road grit, weather, and wear on tanks and fairings. Moto Pros brings the same protection and detailing services we offer for cars to motorcycles.",
      "From coating fairings and wheels to applying film on high-wear areas like the tank, we tailor the scope to your bike and how you ride.",
    ],
    seoDescription:
      "Motorcycle ceramic coating, graphene coating, PPF, and detailing in Manila — Moto Pros by Manila Auto Pros.",
    vehicleTypes: ["Motorcycle"],
    benefits: [
      "Protection for tanks, fairings, and painted parts",
      "Gloss and hydrophobic coating options",
      "Film protection for high-wear areas",
      "Detailing for intricate components",
      "Scope tailored to your motorcycle",
    ],
    process: [
      STANDARD_CONSULT_STEP,
      {
        title: "Cleaning & Preparation",
        description:
          "The motorcycle is carefully cleaned and prepared, with attention to intricate components and finishes.",
      },
      {
        title: "Protection or Detailing",
        description:
          "Coating, film, or detailing work is completed according to the agreed scope.",
      },
      STANDARD_HANDOVER_STEP,
    ],
    relatedSlugs: ["ceramic-graphene-coating", "paint-protection-film", "auto-detailing"],
    image: {
      src: "/images/placeholders/service-moto.svg",
      alt: "Labeled placeholder graphic reserved for a Moto Pros photo",
      isPlaceholder: true,
    },
    items: [
      {
        id: "motorcycle-ceramic-coating",
        name: "Motorcycle Ceramic Coating",
        shortDescription: "Ceramic protection for fairings, tanks, wheels, and frames.",
      },
      {
        id: "motorcycle-graphene-coating",
        name: "Motorcycle Graphene Coating",
        shortDescription: "Graphene-enhanced coating for a slick, protective finish.",
      },
      {
        id: "motorcycle-ppf-installation",
        name: "Motorcycle PPF Installation",
        shortDescription: "Film protection for tanks, fairings, and other high-wear areas.",
      },
      {
        id: "motorcycle-detailing",
        name: "Motorcycle Detailing",
        shortDescription: "Careful cleaning and detailing of paint, metal, and components.",
      },
      {
        id: "motorcycle-paint-protection",
        name: "Motorcycle Paint Protection",
        shortDescription:
          "Combined protection packages using film and coatings for your bike.",
      },
    ],
  },
];

export function getServiceBySlug(slug: string): ServiceCategory | undefined {
  return SERVICE_CATEGORIES.find((service) => service.slug === slug);
}

export function getRelatedServices(service: ServiceCategory): ServiceCategory[] {
  return service.relatedSlugs
    .map((slug) => getServiceBySlug(slug))
    .filter((s): s is ServiceCategory => Boolean(s));
}

/* -------------------------------------------------------------------------- */
/*                             WHY CHOOSE (CONFIRMED)                         */
/* -------------------------------------------------------------------------- */

/** Pillars are derived strictly from client-confirmed services and policies. */
export const WHY_CHOOSE_PILLARS = [
  {
    code: "01",
    title: "Protection Specialists",
    description:
      "Paint protection film, ceramic and graphene coatings, detailing, and window tint — complementary services under one roof on Quiricada Street.",
  },
  {
    code: "02",
    title: "Preparation Before Protection",
    description:
      "Coatings and film perform best on properly prepared paint, which is why detailing and paint correction are offered alongside every protection service.",
  },
  {
    code: "03",
    title: "Cars & Motorcycles",
    description:
      "Our Moto Pros division brings coatings, PPF, and detailing to motorcycles, alongside our full automotive services.",
  },
  {
    code: "04",
    title: "Vehicle-Specific Recommendations",
    description:
      "Every vehicle is different. We recommend scope and provide pricing after understanding your vehicle — no one-size-fits-all packages.",
  },
] as const;
