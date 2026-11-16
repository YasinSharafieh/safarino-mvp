"use client";

import type { ReactNode } from "react";
import { Compass, Home, Sparkles } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import AmbientTheme from "@/components/AmbientTheme";
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
 */
export default function SiteHeader({ actions, minimal = false }: Props) {
  return (
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
      <a href="/" className="group flex items-center gap-2.5" aria-label="سفرینو — صفحه اصلی">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-teal-500 text-white shadow-glow transition group-hover:scale-105">
          <Compass className="h-5 w-5" strokeWidth={2.4} />
        </span>
        <span className="flex flex-col leading-none">
          <b className="text-base font-black text-white">سفرینو</b>
          <small className="text-[9px] tracking-[0.28em] text-cyan-200/70">SAFARINO</small>
        </span>
      </a>

      <div className="flex flex-wrap items-center gap-1.5">
        <OriginSwitch />
        {!minimal ? (
          <>
            <a href="/discover" className="btn-ghost !px-2.5 !py-2 text-[11px]">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">کشف مقصد</span>
            </a>
            <a href="/start" className="btn-ghost !px-2.5 !py-2 text-[11px]">
              <Compass className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">شروع برنامه‌ریزی</span>
            </a>
          </>
        ) : null}
        {actions}
        <AmbientTheme />
        <a href="/" className="btn-ghost !px-2.5 !py-2 text-[11px]" aria-label="بازگشت به صفحهٔ اصلی">
          <Home className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">صفحهٔ اصلی</span>
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
