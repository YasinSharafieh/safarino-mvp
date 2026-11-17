import type { Metadata } from "next";
import { SITE_FACTS } from "@/lib/site-facts";

/**
 * «سفر بدون اینترنت» — what this page is, in the address bar, in a search result
 * and in the preview of a shared link.
 */
export const metadata: Metadata = {
  title: "سفر بدون اینترنت",
  description:
    "برنامهٔ ذخیره‌شده روی همین دستگاه: روزها، آدرس‌ها، رزروها و پول — بدون نیاز به شبکه.",
  // A page whose content only exists in the traveller's browser must not be
  // collected by a search engine — it would index an empty shell.
  robots: { index: false, follow: false },
  alternates: { canonical: "/offline" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
