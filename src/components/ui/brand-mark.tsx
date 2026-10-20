import Link from "next/link";

interface BrandMarkProps {
  className?: string;
  showSubline?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Original text-based brand identity designed as a temporary placeholder
 * until the client approves an official Manila Auto Pros logo.
 */
export function BrandMark({
  className = "",
  showSubline = true,
  size = "md",
}: BrandMarkProps) {
  const titleSize =
    size === "lg"
      ? "text-2xl sm:text-3xl"
      : size === "sm"
      ? "text-lg"
      : "text-xl sm:text-2xl";

  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E11D2E] ${className}`}
      aria-label="Manila Auto Pros — Home"
    >
      {/* Geometric Motorsport Speed-Slash Emblem */}
      <span
        aria-hidden="true"
        className="relative flex h-9 w-8 shrink-0 items-center justify-center border border-[#292929] bg-[#141414] transition-colors duration-200 group-hover:border-[#E11D2E]"
      >
        <span className="h-5 w-1 -skew-x-18 bg-[#E11D2E] transition-transform duration-200 group-hover:scale-y-110" />
        <span className="ml-1 h-5 w-0.5 -skew-x-18 bg-white/80" />
        <span className="absolute top-0 left-0 h-1.5 w-1.5 bg-[#E11D2E]" />
      </span>

      <span className="flex flex-col leading-none">
        <span
          className={`font-display font-extrabold tracking-[0.08em] uppercase text-white ${titleSize}`}
        >
          MANILA <span className="text-[#E11D2E]">AUTO PROS</span>
        </span>
        {showSubline && (
          <span className="mt-1 font-mono text-[10px] tracking-[0.22em] uppercase text-[#A3A3A3]">
            PAINT PROTECTION &amp; DETAILING STUDIO
          </span>
        )}
      </span>
    </Link>
  );
}
