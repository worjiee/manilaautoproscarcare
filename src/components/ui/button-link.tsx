import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-[#E11D2E] text-white hover:bg-[#FF3045] border border-[#E11D2E] hover:border-[#FF3045]",
  secondary:
    "border border-[#292929] bg-[#141414] text-white hover:border-white/40 hover:bg-[#1C1C1C]",
  ghost: "text-white hover:text-[#E11D2E] px-0!",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "min-h-11 px-4 py-2.5 text-sm",
  md: "min-h-12 px-6 py-3 text-[15px]",
  lg: "min-h-13 px-7 py-3.5 text-base",
};

export const buttonClasses = (variant: Variant = "primary", size: Size = "md", extra = "") =>
  `group inline-flex items-center justify-center gap-2.5 font-sans font-bold tracking-[0.08em] uppercase transition-[color,background-color,border-color,transform] duration-200 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#FF5262] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${extra}`;

interface ButtonLinkProps extends Omit<ComponentProps<typeof Link>, "className"> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  showArrow?: boolean;
  className?: string;
}

/** Brand CTA link with consistent variants across the public site. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  icon,
  showArrow = false,
  className = "",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {icon}
      <span>{children}</span>
      {showArrow && (
        <ArrowUpRight
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}
