"use client";

import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Snowflake, Sun } from "lucide-react";

/**
 * A weather symbol drawn with the app's own icons, so it looks identical on
 * every phone and never turns into an empty box.
 */
export function WeatherGlyph({ code, className = "h-4 w-4" }: { code: number; className?: string }) {
  if (code === 0) return <Sun className={`${className} text-amber-300`} aria-hidden />;
  if (code === 1 || code === 2) return <CloudSun className={`${className} text-amber-200`} aria-hidden />;
  if (code === 3) return <Cloud className={`${className} text-slate-300`} aria-hidden />;
  if (code === 45 || code === 48) return <CloudFog className={`${className} text-slate-300`} aria-hidden />;
  if ((code >= 51 && code <= 57) || code === 80) return <CloudDrizzle className={`${className} text-sky-300`} aria-hidden />;
  if (code >= 61 && code <= 67) return <CloudRain className={`${className} text-sky-300`} aria-hidden />;
  if (code === 81 || code === 82) return <CloudRain className={`${className} text-sky-200`} aria-hidden />;
  if (code >= 71 && code <= 77) return <CloudSnow className={`${className} text-cyan-200`} aria-hidden />;
  if (code === 85 || code === 86) return <Snowflake className={`${className} text-cyan-200`} aria-hidden />;
  if (code >= 95) return <CloudLightning className={`${className} text-amber-300`} aria-hidden />;
  return <CloudSun className={`${className} text-slate-300`} aria-hidden />;
}

export default WeatherGlyph;
