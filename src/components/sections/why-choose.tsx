import { WHY_CHOOSE_PILLARS } from "@/lib/constants/site-data";
import { SectionHeading } from "@/components/ui/section-heading";

interface WhyChooseProps {
  kicker?: string;
  title?: string;
  description?: string;
  tone?: "primary" | "secondary";
}

/** "Why Choose Manila Auto Pros" pillars. Place inside a `MotionScope`. */
export function WhyChoose({
  kicker = "Why Manila Auto Pros",
  title = "Why owners choose Manila Auto Pros.",
  description = "A focused set of protection and detailing services, delivered with a preparation-first approach for both cars and motorcycles.",
  tone = "secondary",
}: WhyChooseProps) {
  return (
    <section
      className={`border-b border-[#292929] py-20 lg:py-28 ${tone === "secondary" ? "bg-[#141414]" : "bg-[#090909]"}`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div data-animate="fade-up">
          <SectionHeading kicker={kicker} title={title} description={description} />
        </div>

        <ul data-animate="stagger" className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WHY_CHOOSE_PILLARS.map((pillar) => (
            <li
              key={pillar.code}
              data-animate-item
              className="flex flex-col justify-between border border-[#292929] bg-[#1C1C1C] p-6 transition-colors hover:border-[#E11D2E]/70"
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#292929] pb-4">
                  <span className="font-mono text-2xl font-bold text-[#E11D2E]">{pillar.code}</span>
                  <span aria-hidden="true" className="h-0.5 w-8 bg-[#292929]" />
                </div>
                <h3 className="mt-5 font-display text-2xl font-bold tracking-[0.03em] text-white uppercase">
                  {pillar.title}
                </h3>
                <p className="mt-3 text-base leading-[1.7] text-[#A3A3A3]">{pillar.description}</p>
              </div>
              <div className="mt-6 h-0.5 w-10 bg-[#E11D2E]" aria-hidden="true" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
