import type { Metadata } from "next";
import { SITE_FACTS } from "@/lib/site-facts";

/**
 * «برنامهٔ روزها» — what this page is, in the address bar, in a search result
 * and in the preview of a shared link.
 */
export const metadata: Metadata = {
  title: "برنامهٔ روزها",
  description:
    "برنامهٔ ساعت‌به‌ساعت هر روز از جاذبه‌های واقعی مقصد، با فاصله و زمان رانندگی اندازه‌گیری‌شده و هوای همان روزها.",
  alternates: { canonical: "/plan" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
