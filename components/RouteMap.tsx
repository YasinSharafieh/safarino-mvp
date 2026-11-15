"use client";

import { ExternalLink, Navigation, Route as RouteIcon } from "lucide-react";
import { openNeshanNavigation } from "@/lib/neshan-deeplink";

export type RouteMapPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** 0 is the accommodation / starting point; visits are 1, 2, 3 … */
  order: number;
  kind: "stay" | "stop";
};

const fa = new Intl.NumberFormat("fa-IR");

/**
 * The day's route, drawn from the real coordinates of the places themselves.
 *
 * This is not a decorative picture: the pins sit where the places actually are,
 * the line follows the day's real visit order, and the map is scaled to the
 * stops of the selected day. The full road navigation (turn-by-turn, live
 * traffic) opens in Neshan with one tap, from the accommodation to any stop and
 * from stop to stop.
 *
 * Neshan's own map tiles need a server key that this deployment does not hold,
 * so the drawing is done here instead of pretending to be a tile map.
 */
export default function RouteMap({
  points,
  title,
  note,
}: {
  points: RouteMapPoint[];
  title?: string;
  note?: string;
}) {
  const usable = points.filter(
    (point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && !(point.latitude === 0 && point.longitude === 0),
  );
  if (usable.length < 2) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-black text-white">
          <RouteIcon className="h-4 w-4 text-cyan-300" />
          {title || "نقشهٔ مسیر"}
        </p>
        <p className="mt-2 text-[10.5px] leading-6 text-slate-400">
          برای رسم مسیر به دست‌کم دو مکان با مختصات واقعی نیاز است؛ برای این روز هنوز مکان کافی ثبت نشده است.
        </p>
      </div>
    );
  }

  // Equirectangular projection, padded, longitude scaled by latitude so the
  // shape of the city is not stretched.
  const middleLat = usable.reduce((sum, point) => sum + point.latitude, 0) / usable.length;
  const scaleLng = Math.cos((middleLat * Math.PI) / 180) || 1;
  const xs = usable.map((point) => point.longitude * scaleLng);
  const ys = usable.map((point) => point.latitude);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-4);
  const spanY = Math.max(maxY - minY, 1e-4);
  const span = Math.max(spanX, spanY);
  const project = (point: RouteMapPoint) => {
    const x = ((point.longitude * scaleLng - minX) / span) * 100 + (1 - spanX / span) * 50;
    const y = (1 - (point.latitude - minY) / span) * 100 + ((span - spanY) / span) * 50;
    return { x, y };
  };

  const projected = usable.map((point) => ({ point, ...project(point) }));
  const path = projected.map((item, index) => `${index === 0 ? "M" : "L"}${item.x.toFixed(2)},${item.y.toFixed(2)}`).join(" ");
  const stay = usable.find((point) => point.kind === "stay");
  const firstStop = usable.find((point) => point.kind === "stop");

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-black text-white">
          <RouteIcon className="h-4 w-4 text-cyan-300" />
          {title || "نقشهٔ مسیر روز"}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {stay && firstStop ? (
            <button
              type="button"
              onClick={() =>
                openNeshanNavigation(
                  { latitude: stay.latitude, longitude: stay.longitude },
                  { latitude: firstStop.latitude, longitude: firstStop.longitude },
                )
              }
              className="flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/15 px-2 py-1 text-[9.5px] font-extrabold text-cyan-100 transition hover:bg-cyan-400/25"
            >
              <Navigation className="h-3 w-3" />
              مسیریابی از اقامتگاه
            </button>
          ) : null}
          <a
            href="https://neshan.org/maps"
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[9.5px] font-bold text-slate-300 transition hover:text-cyan-200"
          >
            نشان
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="relative mt-2 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_30%_20%,#22123f,#0e0820_70%)]">
        <svg viewBox="0 0 100 100" className="h-56 w-full" role="img" aria-label={title || "نقشهٔ مسیر روز"}>
          <defs>
            <pattern id="route-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M10 0H0V10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" />
            </pattern>
            <linearGradient id="route-line" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a97dff" />
              <stop offset="100%" stopColor="#ff6f98" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill="url(#route-grid)" />
          <path d={path} fill="none" stroke="url(#route-line)" strokeWidth="1.1" strokeDasharray="2.5 1.8" strokeLinecap="round" />
          {projected.map((item) => (
            <g key={item.point.id}>
              <circle
                cx={item.x}
                cy={item.y}
                r={item.point.kind === "stay" ? 2.6 : 2.1}
                fill={item.point.kind === "stay" ? "#ff6f98" : "#a97dff"}
                stroke="#0e0820"
                strokeWidth="0.7"
              />
              <text
                x={item.x}
                y={item.y + 0.9}
                textAnchor="middle"
                fontSize="2.1"
                fontWeight="700"
                fill="#0e0820"
              >
                {item.point.kind === "stay" ? "★" : item.point.order}
              </text>
            </g>
          ))}
        </svg>
        <span className="absolute bottom-1.5 left-2 rounded-md bg-slate-950/70 px-1.5 py-0.5 text-[8px] text-slate-300">
          مختصات واقعی مکان‌ها · ترتیب بازدید روز
        </span>
      </div>

      <ol className="mt-2 flex flex-wrap gap-1.5">
        {usable
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((point) => (
            <li
              key={`legend-${point.id}`}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${
                point.kind === "stay" ? "border-rose-400/40 bg-rose-400/10 text-rose-100" : "border-cyan-400/25 bg-cyan-400/10 text-cyan-100"
              }`}
            >
              <span className="font-black">{point.kind === "stay" ? "★" : fa.format(point.order)}</span>
              {point.name}
            </li>
          ))}
      </ol>
      <p className="mt-2 text-[9px] leading-5 text-slate-500">
        {note || "مسیر جاده‌ای، ترافیک زنده و راهنمای گام‌به‌گام با دکمهٔ «مسیریابی» در نشان باز می‌شود."}
      </p>
    </div>
  );
}
