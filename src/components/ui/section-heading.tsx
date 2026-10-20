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
        <span className="font-mono text-xs font-semibold tracking-[0.22em] uppercase text-[#E11D2E]">
          {kicker}
        </span>
      </div>
      <h2 className="font-display text-3xl font-extrabold tracking-[0.03em] uppercase text-white sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-[#A3A3A3] sm:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}
