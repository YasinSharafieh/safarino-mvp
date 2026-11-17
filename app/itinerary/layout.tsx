import type { Metadata } from "next";
import { SITE_FACTS } from "@/lib/site-facts";

/**
 * «دفترچهٔ سفر» — what this page is, in the address bar, in a search result
 * and in the preview of a shared link.
 */
export const metadata: Metadata = {
  title: "دفترچهٔ سفر",
  description:
    "همهٔ سفر در یک صفحه: خرج واقعی، چک‌لیست، بستهٔ آفلاین، سهم هر نفر از هزینه و نسخهٔ PDF برای جاده.",
  alternates: { canonical: "/itinerary" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
