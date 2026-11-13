import type { ReactNode } from "react";
import { Wrench } from "lucide-react";
import { IS_DEV_PREVIEW } from "@/lib/env/flags";
import { BRAND_CONFIG } from "@/lib/constants/site-data";

/**
 * Development-only notice. Renders nothing in production builds unless
 * `NEXT_PUBLIC_SHOW_DEV_NOTICES=true`.
 */
export function DevNotice({
  title = "Development note",
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  if (!IS_DEV_PREVIEW) return null;
  return (
    <aside
      className={`flex items-start gap-3 border border-dashed border-amber-500/50 bg-amber-500/5 p-4 text-xs leading-relaxed text-amber-100/90 ${className}`}
    >
      <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
      <div>
        <p className="font-mono font-semibold tracking-wider text-amber-300 uppercase">
          {title} <span className="text-amber-500/70">(dev preview only)</span>
        </p>
        <div className="mt-1">{children}</div>
      </div>
    </aside>
  );
}

/**
 * Gate for client-supplied claims that are not yet verified.
 * - Verified: renders children normally.
 * - Unverified + dev preview: renders children with a DRAFT badge.
 * - Unverified + production: renders nothing.
 */
export function DraftClaim({
  verified,
  children,
  badgeClassName = "",
}: {
  verified: boolean;
  children: ReactNode;
  badgeClassName?: string;
}) {
  if (verified) return <>{children}</>;
  if (!IS_DEV_PREVIEW) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {children}
      <span
        className={`border border-dashed border-amber-500/60 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-amber-300 uppercase ${badgeClassName}`}
        title="Client-supplied claim pending verification. Hidden in production until verified."
      >
        Draft · Unverified
      </span>
    </span>
  );
}

/** Convenience wrapper for the XPEL accreditation claim. */
export function XpelClaim({ className = "" }: { className?: string }) {
  return (
    <DraftClaim verified={BRAND_CONFIG.xpelClaim.verified}>
      <span className={className}>{BRAND_CONFIG.xpelClaim.text}</span>
    </DraftClaim>
  );
}

/** Displays a business value or a neutral "to be confirmed" label when missing. */
export function PendingValue({
  value,
  fallback = "To be confirmed",
}: {
  value: string | null | undefined;
  fallback?: string;
}) {
  if (value) return <>{value}</>;
  return (
    <span className="text-[#A3A3A3] italic">
      {fallback}
      {IS_DEV_PREVIEW && (
        <span className="ml-2 border border-dashed border-amber-500/60 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-amber-300 uppercase not-italic">
          Missing client info
        </span>
      )}
    </span>
  );
}
