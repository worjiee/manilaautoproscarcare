import type { ReactNode } from "react";

interface SectionHeadingProps {
  kicker: string;
  title: ReactNode;
  description?: string;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeading({
  kicker,
  title,
  description,
  align = "left",
  className = "",
}: SectionHeadingProps) {
  const alignmentClasses =
    align === "center"
      ? "mx-auto max-w-3xl text-center items-center"
      : "max-w-3xl text-left items-start";

  return (
    <div className={`flex flex-col ${alignmentClasses} ${className}`}>
      <div className="mb-3 inline-flex items-center gap-2.5">
        <span className="h-0.5 w-6 bg-[#E11D2E]" aria-hidden="true" />
        <span className="font-mono text-[13px] font-semibold tracking-[0.1em] uppercase text-[#E11D2E]">
          {kicker}
        </span>
      </div>
      <h2 className="font-display text-[clamp(2.25rem,5vw,3.25rem)] leading-[1.02] font-extrabold tracking-[0.025em] uppercase text-white">
        {title}
      </h2>
      {description && (
        <p className="mt-5 max-w-[68ch] text-base leading-[1.75] text-[#A3A3A3] sm:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}
