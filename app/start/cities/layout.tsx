import type { Metadata } from "next";
import { SITE_FACTS } from "@/lib/site-facts";

/**
 * «مبدأ، مقصد، تاریخ و بودجه» — what this page is, in the address bar, in a search result
 * and in the preview of a shared link.
 */
export const metadata: Metadata = {
  title: "مبدأ، مقصد، تاریخ و بودجه",
  // The city count is read from the real list, so this sentence cannot go stale.
  description: `شهر را از میان ${SITE_FACTS.citiesLabel} شهر ایران انتخاب کن، تاریخ و تعداد نفرات را بگذار و بودجهٔ کل سفر را مشخص کن؛ سفرینو بلیت، اقامتگاه و برنامه را با همین عددها می‌چیند.`,
  alternates: { canonical: "/start/cities" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
