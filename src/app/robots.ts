import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env/flags";
import { readStagingDemoPolicy } from "@/lib/env/staging";

export default function robots(): MetadataRoute.Robots {
  if (readStagingDemoPolicy().demoMode) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/booking/manage"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
