import type { Metadata, Viewport } from "next";
import { siteUrl } from "@/lib/site";
import type { ReactNode } from "react";
import { TravelProvider } from "./context/TravelContext";
import "./globals.css";

export const metadata: Metadata = {
  // Everything below is relative to this address, so moving to the real domain
  // is one setting (NEXT_PUBLIC_SITE_URL) and nothing else changes.
  metadataBase: new URL(siteUrl()),
  title: {
    default: "سفرینو | همسفر هوشمند سفرهای ایرانی",
    template: "%s | سفرینو",
  },
  description:
    "سفرینو پلتفرم مدرن رزرو پرواز، هتل و تورهای ایرانی است؛ سریع، شفاف و بدون واسطه. برنامه‌ریزی سفر بعدی‌تان را به سفرینو بسپارید.",
  keywords: [
    "سفرینو",
    "رزرو پرواز",
    "رزرو هتل",
    "تور مسافرتی",
    "سفر ارزان",
    "آژانس مسافرتی ایرانی",
  ],
  authors: [{ name: "تیم سفرینو" }],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    url: "/",
    title: "سفرینو | همسفر هوشمند سفرهای ایرانی",
    description: "رزرو پرواز، هتل و تور با تجربه‌ای سریع، شفاف و مدرن.",
    type: "website",
    locale: "fa_IR",
    siteName: "سفرینو",
  },
  twitter: {
    card: "summary_large_image",
    title: "سفرینو | همسفر هوشمند سفرهای ایرانی",
    description: "رزرو پرواز، هتل و تور با تجربه‌ای سریع، شفاف و مدرن.",
  },
};

export const viewport: Viewport = {
  themeColor: "#071521",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
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
        <TravelProvider>{children}</TravelProvider>
      </body>
    </html>
  );
}
