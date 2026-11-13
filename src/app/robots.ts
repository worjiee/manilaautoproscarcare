import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env/flags";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/booking/manage"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
