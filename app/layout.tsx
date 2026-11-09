import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { TravelProvider } from "./context/TravelContext";
import "./globals.css";

export const metadata: Metadata = {
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
  openGraph: {
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-night-900 text-slate-100 antialiased">
        <TravelProvider>{children}</TravelProvider>
      </body>
    </html>
  );
}
