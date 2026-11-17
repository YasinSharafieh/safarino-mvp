import type { Metadata, Viewport } from "next";
import { siteUrl } from "@/lib/site";
import type { ReactNode } from "react";
import { TravelProvider } from "./context/TravelContext";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import TripCompanion from "@/components/TripCompanion";
import TripStatus from "@/components/TripStatus";
import "./globals.css";

export const metadata: Metadata = {
  // Everything below is relative to this address, so moving to the real domain
  // is one setting (NEXT_PUBLIC_SITE_URL) and nothing else changes.
  metadataBase: new URL(siteUrl()),
  title: {
    default: "سفرینو | همسفر هوشمند سفرهای ایرانی",
    template: "%s | سفرینو",
  },
  // The description must describe the product that exists. The site does not sell
  // tickets or tours and takes no payment — it plans the trip and sends the
  // traveller to the provider's own page. Saying «رزرو پرواز و تور» here contradicted
  // the FAQ on the very same site.
  description:
    "سفرینو برنامه‌ریز سفر ایران است: شهر و تاریخ را می‌گویی، مسیر و فاصلهٔ واقعی، بلیت از منابع رسمی، اقامتگاه از چند منبع و هزینهٔ کل سفر را یک‌جا می‌بینی — بدون ثبت‌نام و بدون پرداخت در سفرینو.",
  keywords: [
    "سفرینو",
    "برنامه‌ریز سفر ایران",
    "برنامه سفر",
    "بلیت قطار",
    "بلیت هواپیما",
    "اقامتگاه و هتل",
    "هزینه سفر با ماشین شخصی",
    "سفر ارزان در ایران",
  ],
  authors: [{ name: "تیم سفرینو" }],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    url: "/",
    title: "سفرینو | همسفر هوشمند سفرهای ایرانی",
    description: "برنامهٔ کامل سفر در ایران: مسیر و فاصلهٔ واقعی، بلیت، اقامتگاه، بودجهٔ شفاف و دفترچهٔ سفر — بدون ثبت‌نام.",
    type: "website",
    locale: "fa_IR",
    siteName: "سفرینو",
  },
  twitter: {
    card: "summary_large_image",
    title: "سفرینو | همسفر هوشمند سفرهای ایرانی",
    description: "برنامهٔ کامل سفر در ایران: مسیر و فاصلهٔ واقعی، بلیت، اقامتگاه، بودجهٔ شفاف و دفترچهٔ سفر — بدون ثبت‌نام.",
  },
};

export const viewport: Viewport = {
  themeColor: "#120a26",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* The theme is applied before the first paint, so the page never
            flashes the wrong colours on a slow connection. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('safarino-theme');document.documentElement.dataset.theme=(t==='light'?'light':'dark');}catch(e){}",
          }}
        />
        {/* The font is served by Safarino itself: no third-party font server, so
            Persian text is identical everywhere and never blocked inside Iran. */}
        <link
          rel="preload"
          href="/fonts/Vazirmatn-Variable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-night-900 text-slate-100 antialiased">
        <ServiceWorkerRegistrar />
        <TravelProvider>
          {/* «کجای سفری؟» — one bar, on every phase, built from the shared trip. */}
          <TripStatus />
          {children}
          {/* The orb lives outside every page, so it follows the traveller everywhere. */}
          <TripCompanion />
        </TravelProvider>
      </body>
    </html>
  );
}
