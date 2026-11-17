import type { Metadata } from "next";
import { SITE_FACTS } from "@/lib/site-facts";

/**
 * «نسخهٔ چاپی سفر» — what this page is, in the address bar, in a search result
 * and in the preview of a shared link.
 */
export const metadata: Metadata = {
  title: "نسخهٔ چاپی سفر",
  description:
    "نسخهٔ چاپی و PDF برنامهٔ سفر، با نقشهٔ هر روز، زمان‌سنجی، بودجه و چک‌لیست.",
  // A page whose content only exists in the traveller's browser must not be
  // collected by a search engine — it would index an empty shell.
  robots: { index: false, follow: false },
  alternates: { canonical: "/itinerary/print" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
