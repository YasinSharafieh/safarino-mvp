/**
 * A small, honest map of one day, drawn from the real coordinates.
 *
 * It is a plan, not a street map: numbered pins in real geographic positions,
 * the driving order as a line, a north arrow and a scale bar. It prints
 * perfectly, needs no tile server, and never shows a place that does not exist.
 */

export type MapPoint = { latitude: number; longitude: number; label: string };

export type DrawnMap = { svg: string; width: number; height: number };

const WIDTH = 640;
const HEIGHT = 360;
const PADDING = 44;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toPersian(value: string): string {
  return value.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

/**
 * Projects latitude/longitude onto the drawing with a simple equal-area-ish
 * scaling around the centre; good enough to show relative positions and order.
 */
export function drawDayMap(points: MapPoint[], options: { title?: string } = {}): DrawnMap | null {
  const clean = points.filter(
    (point) =>
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      Math.abs(point.latitude) <= 90 &&
      Math.abs(point.longitude) <= 180,
  );
  if (!clean.length) return null;

  const latitudes = clean.map((point) => point.latitude);
  const longitudes = clean.map((point) => point.longitude);
  let minLat = Math.min(...latitudes);
  let maxLat = Math.max(...latitudes);
  let minLng = Math.min(...longitudes);
  let maxLng = Math.max(...longitudes);

  // Keep a minimum span so a single point or two close points still look sane.
  const minSpan = 0.012;
  if (maxLat - minLat < minSpan) {
    const middle = (maxLat + minLat) / 2;
    minLat = middle - minSpan / 2;
    maxLat = middle + minSpan / 2;
  }
  if (maxLng - minLng < minSpan) {
    const middle = (maxLng + minLng) / 2;
    minLng = middle - minSpan / 2;
    maxLng = middle + minSpan / 2;
  }

  // Extra room so pins and labels never touch the border.
  const latPad = (maxLat - minLat) * 0.16;
  const lngPad = (maxLng - minLng) * 0.16;
  minLat -= latPad;
  maxLat += latPad;
  minLng -= lngPad;
  maxLng += lngPad;

  const scaleX = (WIDTH - PADDING * 2) / (maxLng - minLng);
  const scaleY = (HEIGHT - PADDING * 2) / (maxLat - minLat);
  const x = (longitude: number) => PADDING + (longitude - minLng) * scaleX;
  const y = (latitude: number) => PADDING + (maxLat - latitude) * scaleY;

  const path = clean.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.longitude).toFixed(1)} ${y(point.latitude).toFixed(1)}`).join(" ");
  const kmPerPx = (111.32 * Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180)) / scaleX;
  const barKm = kmPerPx * 90 < 1 ? 0.5 : kmPerPx * 90 < 3 ? 1 : 2;
  const barPx = (barKm / kmPerPx).toFixed(1);

  const pins = clean
    .map((point, index) => {
      const cx = x(point.longitude);
      const cy = y(point.latitude);
      const label = point.label.length > 26 ? `${point.label.slice(0, 25)}…` : point.label;
      const anchor = index === 0 ? "start" : "start";
      return `
    <g>
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="13" fill="#0e7490" stroke="#67e8f9" stroke-width="2" />
      <text x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#ecfeff">${toPersian(String(index + 1))}</text>
      <text x="${(cx + 18).toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="${anchor}" font-size="11" fill="#e2e8f0">${escapeXml(label)}</text>
    </g>`;
    })
    .join("");

  const title = options.title ? `<text x="${WIDTH - 16}" y="26" text-anchor="end" font-size="13" font-weight="700" fill="#a5f3fc">${escapeXml(options.title)}</text>` : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(options.title || "نقشهٔ روز")}">
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e3a4c" stroke-width="1" />
    </pattern>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#071521" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)" opacity="0.7" />
  <path d="${path}" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-dasharray="7 6" opacity="0.85" />
  ${pins}
  ${title}
  <g transform="translate(${WIDTH - 118} ${HEIGHT - 30})">
    <line x1="0" y1="0" x2="${barPx}" y2="0" stroke="#94a3b8" stroke-width="3" />
    <line x1="0" y1="-4" x2="0" y2="4" stroke="#94a3b8" stroke-width="2" />
    <line x1="${barPx}" y1="-4" x2="${barPx}" y2="4" stroke="#94a3b8" stroke-width="2" />
    <text x="${barPx}" y="-8" text-anchor="middle" font-size="10" fill="#94a3b8">${toPersian(String(barKm))} کیلومتر</text>
  </g>
  <g transform="translate(30 30)">
    <path d="M0 -11 L6 8 L0 4 L-6 8 Z" fill="#67e8f9" />
    <text x="0" y="22" text-anchor="middle" font-size="10" fill="#94a3b8">شمال</text>
  </g>
</svg>`;

  return { svg, width: WIDTH, height: HEIGHT };
}
