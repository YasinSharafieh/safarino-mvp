import type { MetadataRoute } from "next";

/**
 * The installable app version of Safarino. On a phone it can be added to the
 * home screen and opened like an app, which is also what makes the offline
 * copy of the plan available.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "سفرینو — برنامه‌ریز سفر",
    short_name: "سفرینو",
    description: "برنامهٔ روزبه‌روز سفر، اقامتگاه، حمل‌ونقل و هزینه‌ها — با دادهٔ واقعی.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#071521",
    theme_color: "#071521",
    lang: "fa",
    dir: "rtl",
    categories: ["travel", "navigation", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
