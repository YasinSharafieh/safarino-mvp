import type { Metadata } from "next";
import { SITE_FACTS } from "@/lib/site-facts";

/**
 * «اقامتگاه در ایران» — what this page is, in the address bar, in a search result
 * and in the preview of a shared link.
 */
export const metadata: Metadata = {
  title: "اقامتگاه در ایران",
  description:
    "جست‌وجوی زنده در ۶ منبع اقامت: هتل، خانهٔ سنتی، ویلا و سوئیت. تکراری‌ها حذف می‌شوند و منبع هر کارت با لینک رزرو مشخص است.",
  alternates: { canonical: "/accommodation" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
