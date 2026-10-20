import Image from "next/image";

interface StudioImagePlaceholderProps {
  src: string;
  alt: string;
  caption?: string;
  badgeText?: string;
  aspectClassName?: string;
  priority?: boolean;
  isTemporaryPlaceholder?: boolean;
  className?: string;
  imageClassName?: string;
}

/**
 * Reusable media container for Manila Auto Pros photography and clearly labeled
 * temporary studio placeholders until client photography is supplied.
 */
export function StudioImagePlaceholder({
  src,
  alt,
  caption,
  badgeText = "TEMPORARY STUDIO PLACEHOLDER",
  aspectClassName = "aspect-[16/10]",
  priority = false,
  isTemporaryPlaceholder = true,
  className = "",
  imageClassName = "",
}: StudioImagePlaceholderProps) {
  return (
    <figure
      className={`group relative overflow-hidden border border-[#292929] bg-[#141414] ${aspectClassName} ${className}`}
    >
      {/* Corner Precision Reticles */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 z-20 h-3 w-3 border-t-2 border-l-2 border-[#E11D2E]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 z-20 h-3 w-3 border-t-2 border-r-2 border-white/30"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 z-20 h-3 w-3 border-b-2 border-l-2 border-white/30"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 z-20 h-3 w-3 border-b-2 border-r-2 border-[#E11D2E]"
      />

      {isTemporaryPlaceholder && (
        <div className="pointer-events-none absolute top-3 left-3 z-20 flex items-center gap-2 border border-[#292929] bg-[#090909]/90 px-2.5 py-1 backdrop-blur-xs">
          <span className="h-1.5 w-1.5 bg-[#E11D2E]" aria-hidden="true" />
          <span className="font-mono text-[10px] font-medium tracking-[0.16em] uppercase text-[#A3A3A3]">
            {badgeText}
          </span>
        </div>
      )}

      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
        className={`object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] ${imageClassName}`}
      />

      {caption && (
        <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 z-20 border-t border-[#292929] bg-[#090909]/90 px-3.5 py-2 font-mono text-[11px] tracking-[0.12em] uppercase text-[#A3A3A3]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
