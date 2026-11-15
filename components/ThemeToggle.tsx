"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Dark / light switch.
 *
 * The choice is remembered on the device and applied to <html data-theme>, so
 * every page — including the parts rendered before the toggle is visible — comes
 * up in the same theme. The first paint is handled by a tiny inline script in
 * the layout, so the page never flashes the wrong colours.
 */
export const THEME_KEY = "safarino-theme";

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = (document.documentElement.dataset.theme || localStorage.getItem(THEME_KEY) || "dark") as "dark" | "light";
    setTheme(current === "light" ? "light" : "dark");
    setReady(true);
  }, []);

  const apply = (next: "dark" | "light") => {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private mode: the theme still changes for this visit.
    }
  };

  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => apply(next)}
      aria-label={next === "light" ? "تغییر به حالت روشن" : "تغییر به حالت تاریک"}
      title={next === "light" ? "حالت روشن" : "حالت تاریک"}
      className={`group inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 font-bold text-slate-200 transition hover:border-cyan-400/50 hover:bg-white/10 ${
        compact ? "h-9 w-9 justify-center" : "px-2.5 py-2 text-[11px]"
      }`}
    >
      {/* The icon shows what you will get, not what you have. */}
      {ready && next === "light" ? <Sun className="h-4 w-4 text-turquoise-300" /> : <Moon className="h-4 w-4 text-cyan-300" />}
      {compact ? null : <span className="hidden sm:inline">{ready && next === "light" ? "روشن" : "تاریک"}</span>}
    </button>
  );
}
