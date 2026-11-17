import type { Metadata } from "next";
import { SITE_FACTS } from "@/lib/site-facts";

/**
 * «بلیت قطار، هواپیما و اتوبوس» — what this page is, in the address bar, in a search result
 * and in the preview of a shared link.
 */
export const metadata: Metadata = {
  title: "بلیت قطار، هواپیما و اتوبوس",
  description:
    "قیمت و ساعت بلیت از منابع زندهٔ فروش بلیت، یا محاسبهٔ کامل هزینهٔ ماشین شخصی با فرض‌های خودت — بنزین، عوارض، پارکینگ و استهلاک.",
  alternates: { canonical: "/transport" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
