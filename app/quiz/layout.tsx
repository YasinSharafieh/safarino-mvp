import type { Metadata } from "next";
import { SITE_FACTS } from "@/lib/site-facts";

/**
 * «پیشنهاد مقصد با چند سؤال» — what this page is, in the address bar, in a search result
 * and in the preview of a shared link.
 */
export const metadata: Metadata = {
  title: "پیشنهاد مقصد با چند سؤال",
  description:
    "چند سؤال کوتاه و هر بار تازه دربارهٔ حال‌وهوای سفرت، و در پایان شهرهای ایرانی که به سلیقه‌ات می‌خورند — با جاذبه‌های واقعی، فصل مناسب و تعداد روز پیشنهادی.",
  alternates: { canonical: "/quiz" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
