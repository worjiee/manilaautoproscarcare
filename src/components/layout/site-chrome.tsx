"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const isAdmin = usePathname().startsWith("/admin");
  return <>{!isAdmin && <Navbar />}<main id="main-content" className="flex-1">{children}</main>{!isAdmin && <Footer />}</>;
}
