import type { Metadata } from "next";
import { SITE_FACTS } from "@/lib/site-facts";

/**
 * «جزئیات اقامتگاه» — what this page is, in the address bar, in a search result
 * and in the preview of a shared link.
 */
export const metadata: Metadata = {
  title: "جزئیات اقامتگاه",
  description:
    "اتاق‌ها، قیمت شبانه و امکانات همین اقامتگاه، با لینک رزرو در منبع اصلی.",
  // A page whose content only exists in the traveller's browser must not be
  // collected by a search engine — it would index an empty shell.
  robots: { index: false, follow: false },
  alternates: { canonical: "/accommodation/[id]" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
