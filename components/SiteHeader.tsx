"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Compass, Home, Sparkles } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import OriginSwitch from "@/components/OriginSwitch";

type Props = {
  /** Extra buttons for the page (they sit next to the theme switch). */
  actions?: ReactNode;
  /** Hide the shortcuts on very busy pages. */
  minimal?: boolean;
};

/**
 * The same top bar on every page.
 *
 * Two things are always reachable from here — «صفحه اصلی» and the theme switch —
 * so a traveller can never get stuck in the middle of the flow.
 *
 * The shortcuts are `next/link`, not plain anchors: an anchor throws the whole
 * app away and downloads it again (measured: the full trip status, the header and
 * the page had to be rebuilt on every tap), while `Link` keeps the shell and
 * fetches only the screen that changed. It is also what makes «داخل سایت قدم زدی»
 * a real, observable event rather than a page load that looks exactly like F5.
 */
export default function SiteHeader({ actions, minimal = false }: Props) {
  return (
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
      <Link href="/" className="group flex items-center gap-2.5" aria-label="سفرینو — صفحه اصلی">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-teal-500 text-white shadow-glow transition group-hover:scale-105">
          <Compass className="h-5 w-5" strokeWidth={2.4} />
        </span>
        <span className="flex flex-col leading-none">
          <b className="text-base font-black text-white">سفرینو</b>
          <small className="text-[9px] tracking-[0.28em] text-cyan-200/70">SAFARINO</small>
        </span>
      </Link>

      <div className="flex flex-wrap items-center gap-1.5">
        <OriginSwitch />
        {!minimal ? (
          <>
            <Link href="/discover" className="btn-ghost !px-2.5 !py-2 text-[11px]">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">کشف مقصد</span>
            </Link>
            <Link href="/start" className="btn-ghost !px-2.5 !py-2 text-[11px]">
              <Compass className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">شروع برنامه‌ریزی</span>
            </Link>
          </>
        ) : null}
        {actions}
        <Link href="/" className="btn-ghost !px-2.5 !py-2 text-[11px]" aria-label="بازگشت به صفحهٔ اصلی">
          <Home className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">صفحهٔ اصلی</span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
