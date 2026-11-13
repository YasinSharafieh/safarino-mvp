import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * Search engines may read the public pages, not the personal ones.
 * A shared plan belongs to a traveller, so /s/ stays out of the index forever.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/plan", "/accommodation", "/transport", "/itinerary", "/quiz", "/discover"],
        disallow: ["/s/", "/api/"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
