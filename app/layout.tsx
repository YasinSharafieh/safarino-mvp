import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "سفرینو | برنامه‌ریزی هوشمند سفر با هوش مصنوعی",
  description:
    "سفرینو با هوش مصنوعی، بهترین مسیر، اقامتگاه و بودجه سفرت را طراحی می‌کند؛ سریع، دقیق و کاملاً فارسی.",
  keywords: ["سفرینو", "برنامه سفر", "هوش مصنوعی", "گردشگری", "بودجه سفر"],
  authors: [{ name: "Safarino" }],
  openGraph: {
    title: "سفرینو | برنامه‌ریزی هوشمند سفر",
    description: "سفرت رو با هوش مصنوعی، بی‌نقص برنامه‌ریزی کن!",
    locale: "fa_IR",
    type: "website",
    siteName: "سفرینو",
  },
};

export const viewport: Viewport = {
  themeColor: "#070713",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-night-900 font-sans text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
