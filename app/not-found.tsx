import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Compass, Home as HomeIcon, LifeBuoy, Search } from "lucide-react";

/**
 * The page a traveller sees when an address does not exist.
 *
 * Before this, a wrong link (a typo, an old shared address, a city link that
 * changed) landed on Next's built-in English page: a bare «404: This page could
 * not be found» in a left-to-right layout with no way back. On a Persian site
 * that reads like a broken product, and it was the only screen in Safarino that
 * was not ours.
 *
 * This one is ours: right-to-left, uses the same glass language, says what
 * happened in one sentence, and gives four real ways forward — the four places
 * people actually want when they land on a dead end.
 */

export const metadata: Metadata = {
  title: "این صفحه پیدا نشد",
  description: "نشانی‌ای که باز کردی وجود ندارد. از این‌جا سفر را ادامه بده: مقصد و تاریخ، بلیت، اقامتگاه یا کشف مقصدها.",
  robots: { index: false, follow: true },
};

const WAYS = [
  { href: "/start/cities", label: "شروع یک سفر تازه", note: "مقصد، تاریخ و بودجه", Icon: Compass },
  { href: "/transport", label: "جست‌وجوی بلیت", note: "قطار، هواپیما و اتوبوس", Icon: Search },
  { href: "/accommodation", label: "جست‌وجوی اقامتگاه", note: "هتل، ویلا و اقامتگاه محلی", Icon: HomeIcon },
  { href: "/discover", label: "کشف مقصدها", note: "شهرها و دیدنی‌ها", Icon: Compass },
];

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-3xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-200">
        <LifeBuoy className="h-7 w-7" />
      </span>
      <p className="mt-5 text-[11px] font-black tracking-widest text-cyan-300/80">خطای ۴۰۴</p>
      <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">این صفحه پیدا نشد</h1>
      <p className="mt-3 max-w-md text-[12px] leading-7 text-slate-400">
        نشانی‌ای که باز کردی وجود ندارد یا جابه‌جا شده است. سفرت پاک نشده — از یکی از این راه‌ها ادامه بده.
      </p>

      <div className="mt-7 grid w-full gap-2.5 sm:grid-cols-2">
        {WAYS.map((way) => (
          <Link
            key={way.href}
            href={way.href}
            className="glass-soft flex items-center gap-3 p-3.5 text-right transition hover:border-cyan-300/40 hover:bg-white/[0.06]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200">
              <way.Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[11.5px] font-black text-white">{way.label}</b>
              <span className="block text-[9.5px] text-slate-500">{way.note}</span>
            </span>
            <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          </Link>
        ))}
      </div>

      <Link href="/" className="btn-primary mt-6 !px-5 !py-2.5 text-[11px]">
        <HomeIcon className="h-3.5 w-3.5" />
        بازگشت به صفحهٔ اول
      </Link>
    </main>
  );
}
