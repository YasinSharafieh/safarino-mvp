import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** The public pages of Safarino, always relative to the configured address. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  const pages: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/plan", priority: 0.9, changeFrequency: "daily" },
    { path: "/accommodation", priority: 0.9, changeFrequency: "daily" },
    { path: "/transport", priority: 0.9, changeFrequency: "daily" },
    { path: "/itinerary", priority: 0.8, changeFrequency: "weekly" },
    { path: "/quiz", priority: 0.6, changeFrequency: "monthly" },
    { path: "/discover", priority: 0.95, changeFrequency: "weekly" },
  ];
  return pages.map((page) => ({
    url: `${base}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
