export interface ServiceItem {
  id: string;
  name: string;
  shortDescription: string;
}

export interface ServiceCategory {
  slug: string;
  title: string;
  kicker: string;
  tagline: string;
  description: string;
  vehicleTypes: ("Car" | "Motorcycle")[];
  featuredHighlight: string;
  verificationNote?: string;
  placeholderAsset: {
    src: string;
    alt: string;
    aspectRatio: string;
    caption: string;
  };
  items: ServiceItem[];
}

export interface GalleryPlaceholderProject {
  id: string;
  title: string;
  category: string;
  vehicleCategory: "Car" | "Motorcycle";
  servicePerformed: string;
  scopeSummary: string;
  placeholderAsset: {
    src: string;
    alt: string;
    label: string;
  };
}

export const BRAND_CONFIG = {
  name: "MANILA AUTO PROS",
  shortName: "MAP",
  tagline: "Protect Your Investment. Preserve Your Vehicle's Beauty.",
  industry: "Premium Automotive Detailing & Paint Protection",
  location: {
    street: "Quiricada Street",
    city: "Manila",
    country: "Philippines",
    fullAddress: "Quiricada Street, Manila, Philippines",
    timezone: "Asia/Manila",
  },
  schedule: {
    operatingDays: "Monday – Saturday",
    closedDays: "Sunday: Closed",
    hoursDefaultLabel: "9:00 AM – 6:00 PM PHT (Development Default — Pending Final Client Confirmation)",
  },
  contact: {
    inquiryNote: "Direct phone and official email channels pending client finalization.",
    phonePlaceholder: "+63 (02) XXXX-XXXX [Dev Placeholder]",
    emailPlaceholder: "inquiries@manilaautopros.ph [Dev Placeholder]",
  },
  xpelClaim: {
    text: "Accredited XPEL Dealer & Authorized Installer",
    verificationNote: "Draft Claim — Client-supplied accreditation status; verify official certificate before final publication.",
  },
} as const;

export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Gallery", href: "/gallery" },
  { label: "Contact", href: "/contact" },
] as const;

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    slug: "paint-protection-film",
    title: "Paint Protection Film",
    kicker: "01 // IMPACT & ABRASION ARMOR",
    tagline: "Self-healing urethane barrier engineered for Manila road conditions.",
    description:
      "Precision-fitted Paint Protection Film (PPF) shields high-impact automotive surfaces from stone chips, road debris, swirl marks, and environmental fallout while preserving factory depth or transforming your finish.",
    vehicleTypes: ["Car"],
    featuredHighlight: "Optical clarity or satin stealth finishes with edge-wrapped installation.",
    verificationNote:
      "Draft includes client-supplied claim as an accredited XPEL dealer/installer (pending final verification prior to launch).",
    placeholderAsset: {
      src: "/images/placeholders/service-ppf.svg",
      alt: "Temporary Studio Placeholder — Paint Protection Film Application",
      aspectRatio: "16/10",
      caption: "PLACEHOLDER ASSET // AWAITING CLIENT STUDIO PHOTOGRAPHY (PPF BAY)",
    },
    items: [
      {
        id: "xpel-ppf",
        name: "XPEL Paint Protection Film Installation",
        shortDescription: "Precision-plotted and hand-tucked XPEL urethane film installation for vulnerable or complete exterior panels.",
      },
      {
        id: "clear-ppf",
        name: "Clear PPF",
        shortDescription: "Optically transparent high-gloss film that defends factory paintwork without altering its original hue.",
      },
      {
        id: "black-ppf",
        name: "Black PPF",
        shortDescription: "Deep piano-black protective urethane film ideal for roofs, accents, or dramatic two-tone styling with real impact resistance.",
      },
      {
        id: "matte-ppf",
        name: "Matte PPF",
        shortDescription: "Satin/matte conversion film that mutedly transforms gloss paint into a stealth finish or protects factory matte paint.",
      },
      {
        id: "full-body-ppf",
        name: "Full Body PPF",
        shortDescription: "Comprehensive bumper-to-bumper coverage encapsulating every painted exterior surface for uncompromising preservation.",
      },
      {
        id: "partial-ppf",
        name: "Partial PPF",
        shortDescription: "Targeted high-impact coverage for front bumpers, hoods, fenders, side mirrors, door cups, and rocker panels.",
      },
    ],
  },
  {
    slug: "ceramic-graphene-coating",
    title: "Ceramic & Graphene Coating",
    kicker: "02 // CHEMICAL & UV SHIELDING",
    tagline: "Hydrophobic molecular bonding for extreme gloss and effortless maintenance.",
    description:
      "Advanced liquid polymer and graphene-matrix coatings that chemically bond to your vehicle's clear coat, creating a slick, UV-resistant barrier against acid rain, bird droppings, and tropical humidity.",
    vehicleTypes: ["Car"],
    featuredHighlight: "Deep candy-like gloss retention paired with meticulous pre-coating preparation.",
    placeholderAsset: {
      src: "/images/placeholders/service-coating.svg",
      alt: "Temporary Studio Placeholder — Ceramic and Graphene Coating",
      aspectRatio: "16/10",
      caption: "PLACEHOLDER ASSET // AWAITING CLIENT STUDIO PHOTOGRAPHY (COATING CURING BAY)",
    },
    items: [
      {
        id: "premium-ceramic-coating",
        name: "Premium Ceramic Coating",
        shortDescription: "High-solids SiO2 ceramic layer delivering intense water beading, chemical resistance, and lasting optical depth.",
      },
      {
        id: "graphene-coating",
        name: "Graphene Coating",
        shortDescription: "Graphene-reinforced protective matrix engineered for lower surface heat retention and enhanced water-spot resistance.",
      },
      {
        id: "multi-layer-coating",
        name: "Multi-Layer Coating Packages",
        shortDescription: "Stacked base and top-coat architectures tailored for discerning owners seeking maximum film build and longevity.",
      },
      {
        id: "paint-enhancement-protection",
        name: "Paint Enhancement and Protection",
        shortDescription: "Single-stage refinement polish to restore clarity and gloss before locking in the finish with a dedicated protective coating.",
      },
    ],
  },
  {
    slug: "auto-detailing",
    title: "Auto Detailing",
    kicker: "03 // CORRECTION & RESTORATION",
    tagline: "Surgical surface decontamination, multi-stage paint correction, and cabin renewal.",
    description:
      "True protection begins with an immaculate substrate. Our detailing division utilizes calibrated lighting, safe chemical decontamination, and rotary/dual-action machine polishing to eliminate defects inside and out.",
    vehicleTypes: ["Car"],
    featuredHighlight: "Inspection-grade lighting and paint thickness measurement before every correction pass.",
    placeholderAsset: {
      src: "/images/placeholders/service-detailing.svg",
      alt: "Temporary Studio Placeholder — Paint Correction and Auto Detailing",
      aspectRatio: "16/10",
      caption: "PLACEHOLDER ASSET // AWAITING CLIENT STUDIO PHOTOGRAPHY (CORRECTION BAY)",
    },
    items: [
      {
        id: "full-detailing",
        name: "Full Detailing",
        shortDescription: "Complete bumper-to-bumper interior and exterior rejuvenation addressing every trim, crevice, wheel well, and cabin surface.",
      },
      {
        id: "paint-correction",
        name: "Paint Correction",
        shortDescription: "Multi-step compounding and finishing to safely level swirl marks, holograms, oxidation, and random deep scratches.",
      },
      {
        id: "machine-polishing",
        name: "Machine Polishing",
        shortDescription: "Precision machine refinement to remove micro-marring and maximize specular reflection across clear-coated panels.",
      },
      {
        id: "paint-decontamination",
        name: "Paint Decontamination",
        shortDescription: "Chemical iron fallout removal, tar extraction, and fine-grade clay treatment to restore glass-smooth paint texture.",
      },
      {
        id: "interior-detailing",
        name: "Interior Detailing",
        shortDescription: "Deep cleaning, steam sanitization, leather conditioning, and fabric extraction for a factory-fresh cockpit environment.",
      },
      {
        id: "exterior-detailing",
        name: "Exterior Detailing",
        shortDescription: "pH-neutral snow foam wash, intricate emblem and grille brush work, wheel barrel cleaning, and trim dressing.",
      },
    ],
  },
  {
    slug: "automotive-window-tint",
    title: "Automotive Window Tint",
    kicker: "04 // THERMAL & UV REJECTION",
    tagline: "High-clarity solar control films built for Philippine heat and cabin privacy.",
    description:
      "Combat harsh tropical infrared heat and harmful UV radiation without sacrificing night-time visibility. Installed in a dust-controlled environment for clean edges and zero signal interference.",
    vehicleTypes: ["Car"],
    featuredHighlight: "Infrared heat rejection and UV protection for leather, dash components, and passengers.",
    placeholderAsset: {
      src: "/images/placeholders/service-tint.svg",
      alt: "Temporary Studio Placeholder — Automotive Window Tint Installation",
      aspectRatio: "16/10",
      caption: "PLACEHOLDER ASSET // AWAITING CLIENT STUDIO PHOTOGRAPHY (TINT STUDIO)",
    },
    items: [
      {
        id: "premium-window-tint",
        name: "Premium Window Tint Installation",
        shortDescription: "Custom-fitted window film application across windshields, side glass, and rear quarters with clean micro-edged borders.",
      },
      {
        id: "heat-rejection-window-films",
        name: "Heat-Rejection Window Films",
        shortDescription: "Advanced spectrally selective films engineered to reject solar heat load and block UV rays while maintaining crisp optical clarity.",
      },
    ],
  },
  {
    slug: "moto-pros",
    title: "Moto Pros",
    kicker: "05 // TWO-WHEEL PROTECTION DIVISION",
    tagline: "Dedicated detailing, PPF armor, and ceramic coatings for high-performance motorcycles.",
    description:
      "Motorcycles face direct exposure to road grit, knee friction on fuel tanks, and intricate engine grime. Moto Pros brings our studio-grade surface care directly to sportbikes, cruisers, adventure bikes, and scooters.",
    vehicleTypes: ["Motorcycle"],
    featuredHighlight: "Intricate fairing, tank, visor, and exposed mechanical assembly protection.",
    placeholderAsset: {
      src: "/images/placeholders/service-moto.svg",
      alt: "Temporary Studio Placeholder — Moto Pros Motorcycle Detailing & Protection",
      aspectRatio: "16/10",
      caption: "PLACEHOLDER ASSET // AWAITING CLIENT STUDIO PHOTOGRAPHY (MOTO PROS BAY)",
    },
    items: [
      {
        id: "motorcycle-ceramic-coating",
        name: "Motorcycle Ceramic Coating",
        shortDescription: "High-temperature and chemical-resistant ceramic protection for fairings, fuel tanks, wheels, and matte/gloss frames.",
      },
      {
        id: "motorcycle-graphene-coating",
        name: "Motorcycle Graphene Coating",
        shortDescription: "Graphene-infused barrier offering superior slickness, heat dissipation, and water-spotting defense for daily or weekend riders.",
      },
      {
        id: "motorcycle-ppf-installation",
        name: "Motorcycle PPF Installation",
        shortDescription: "Tailored urethane film protection for high-wear tank sides, front cowls, headlights, and painted fenders.",
      },
      {
        id: "motorcycle-detailing",
        name: "Motorcycle Detailing",
        shortDescription: "Delicate hand washing, chain and sprocket degreasing, metal polishing, and multi-tool correction for compact panels.",
      },
      {
        id: "motorcycle-paint-protection",
        name: "Motorcycle Paint Protection",
        shortDescription: "Comprehensive combination packages blending impact film on strike zones with ceramic/graphene coatings on complex bodywork.",
      },
    ],
  },
];

export const WHY_CHOOSE_PILLARS = [
  {
    code: "01",
    title: "Controlled Studio Environment",
    description:
      "Film installation, paint correction, and ceramic curing require dust control and calibrated inspection lighting. Every vehicle is prepped inside our dedicated Quiricada Street facility.",
  },
  {
    code: "02",
    title: "Preparation Before Protection",
    description:
      "We never seal in paint defects. Every PPF or coating commission begins with thorough chemical and mechanical decontamination so the bond is clean, durable, and optically pure.",
  },
  {
    code: "03",
    title: "Bespoke Fitment & Edge Care",
    description:
      "Where panel geometry allows, edges are carefully tucked and wrapped to minimize visible seams and resist lifting during high-pressure washes and daily Manila driving.",
  },
  {
    code: "04",
    title: "Four-Wheel & Two-Wheel Specialists",
    description:
      "Through our dedicated automotive bays and Moto Pros division, both flagship cars and motorcycles receive specialized tooling, pad sizes, and surface-specific chemistry.",
  },
] as const;

export const FEATURED_GALLERY_PLACEHOLDERS: GalleryPlaceholderProject[] = [
  {
    id: "placeholder-proj-01",
    title: "Full Body PPF & Multi-Stage Prep",
    category: "Paint Protection Film",
    vehicleCategory: "Car",
    servicePerformed: "Full Body PPF + Paint Decontamination",
    scopeSummary:
      "Reserved slot for client project photography showing edge-wrapped urethane film installation and gloss inspection.",
    placeholderAsset: {
      src: "/images/placeholders/gallery-01.svg",
      alt: "Temporary Placeholder — Full Body PPF Project Slot",
      label: "CLIENT PHOTO SLOT 01 // FULL BODY PPF",
    },
  },
  {
    id: "placeholder-proj-02",
    title: "Multi-Stage Paint Correction & Graphene Matrix",
    category: "Ceramic & Graphene Coating",
    vehicleCategory: "Car",
    servicePerformed: "Paint Correction + Graphene Coating",
    scopeSummary:
      "Reserved slot for before/after defect removal under scangrip inspection lights and final cured reflection.",
    placeholderAsset: {
      src: "/images/placeholders/gallery-02.svg",
      alt: "Temporary Placeholder — Paint Correction & Graphene Project Slot",
      label: "CLIENT PHOTO SLOT 02 // GRAPHENE & CORRECTION",
    },
  },
  {
    id: "placeholder-proj-03",
    title: "Stealth Matte PPF Conversion & Heat-Rejection Tint",
    category: "Paint Protection Film",
    vehicleCategory: "Car",
    servicePerformed: "Matte PPF + Heat-Rejection Window Films",
    scopeSummary:
      "Reserved slot for satin/matte film transformation paired with solar-control window film installation.",
    placeholderAsset: {
      src: "/images/placeholders/gallery-03.svg",
      alt: "Temporary Placeholder — Matte PPF & Window Tint Slot",
      label: "CLIENT PHOTO SLOT 03 // MATTE PPF & TINT",
    },
  },
  {
    id: "placeholder-proj-04",
    title: "Moto Pros Sportbike Tank PPF & Ceramic Package",
    category: "Moto Pros",
    vehicleCategory: "Motorcycle",
    servicePerformed: "Motorcycle PPF Installation + Motorcycle Ceramic Coating",
    scopeSummary:
      "Reserved slot for two-wheel fairing correction, tank grip zone PPF, and wheel/frame ceramic protection.",
    placeholderAsset: {
      src: "/images/placeholders/gallery-04.svg",
      alt: "Temporary Placeholder — Moto Pros Protection Slot",
      label: "CLIENT PHOTO SLOT 04 // MOTO PROS DIVISION",
    },
  },
];
