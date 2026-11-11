/**
 * The picture that goes into WhatsApp or Telegram.
 *
 * One 1200×630 card drawn in the browser: the same palette as the site, the
 * city, the days, the measured kilometres and the money — and a clear line
 * saying what is real and what is an estimate. No map tiles, no external
 * images, so it works offline and never fails to load.
 */

import type { ShareTrip } from "./share";

const WIDTH = 1200;
const HEIGHT = 630;

function fa(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function faDigits(value: string): string {
  return value.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function money(value: number): string {
  if (value >= 1_000_000) {
    const millions = Math.round((value / 1_000_000) * 10) / 10;
    return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(millions)} میلیون تومان`;
  }
  return `${fa(Math.round(value / 1000) * 1000)} تومان`;
}

/** Cuts a name so it never runs outside its column. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, max = 60): string {
  let value = text.length > max ? `${text.slice(0, max - 1)}…` : text;
  if (ctx.measureText(value).width <= maxWidth) return value;
  while (value.length > 3 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value.replace(/[\s·،-]+$/, "")}…`;
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawShareCard(trip: ShareTrip): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Sky of the Midnight Ocean palette.
  const sky = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  sky.addColorStop(0, "#0b2434");
  sky.addColorStop(0.55, "#071521");
  sky.addColorStop(1, "#04101a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Two soft glows, like the site's aurora.
  const glowA = ctx.createRadialGradient(1050, 40, 20, 1050, 40, 480);
  glowA.addColorStop(0, "rgba(45,212,191,0.28)");
  glowA.addColorStop(1, "rgba(45,212,191,0)");
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const glowB = ctx.createRadialGradient(120, 600, 20, 120, 600, 420);
  glowB.addColorStop(0, "rgba(56,189,248,0.18)");
  glowB.addColorStop(1, "rgba(56,189,248,0)");
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // A faint grid, the same idea as the page background.
  ctx.strokeStyle = "rgba(148,197,214,0.07)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";

  const right = WIDTH - 64;

  // Brand
  ctx.fillStyle = "#5eead4";
  ctx.font = "700 20px system-ui, 'Segoe UI', Tahoma, sans-serif";
  ctx.fillText("سفرینو · SAFARINO", right, 68);

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 62px system-ui, 'Segoe UI', Tahoma, sans-serif";
  ctx.fillText(fit(ctx, `برنامهٔ سفر ${trip.city}`, WIDTH - 128, 26), right, 150);

  ctx.fillStyle = "rgba(203,229,240,0.72)";
  ctx.font = "600 24px system-ui, 'Segoe UI', Tahoma, sans-serif";
  ctx.fillText(
    `${fa(trip.totals.days)} روز · ${fa(trip.totals.stops)} ایستگاه · ${fa(trip.totals.km)} کیلومتر رانندگی`,
    right,
    196,
  );

  // The days, side by side, right to left.
  const columns = trip.days.slice(0, 4);
  const gap = 18;
  const cardWidth = columns.length ? (WIDTH - 128 - gap * (columns.length - 1)) / columns.length : 0;
  columns.forEach((day, index) => {
    const x = right - cardWidth - index * (cardWidth + gap);
    const y = 216;
    const height = 228;
    ctx.fillStyle = "rgba(255,255,255,0.055)";
    rounded(ctx, x, y, cardWidth, height, 22);
    ctx.fill();
    ctx.strokeStyle = "rgba(148,197,214,0.18)";
    ctx.lineWidth = 1.5;
    rounded(ctx, x, y, cardWidth, height, 22);
    ctx.stroke();

    ctx.fillStyle = "#5eead4";
    ctx.font = "900 24px system-ui, 'Segoe UI', Tahoma, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`روز ${fa(day.d)}`, x + cardWidth - 20, y + 40);

    ctx.fillStyle = "rgba(203,229,240,0.62)";
    ctx.font = "600 16px system-ui, 'Segoe UI', Tahoma, sans-serif";
    ctx.fillText(`${fa(day.km)} کیلومتر · ${fa(day.mn)} دقیقه`, x + cardWidth - 20, y + 66);

    ctx.fillStyle = "#eaf6fb";
    ctx.font = "700 19px system-ui, 'Segoe UI', Tahoma, sans-serif";
    day.stops.slice(0, 4).forEach((stop, stopIndex) => {
      const lineY = y + 104 + stopIndex * 32;
      ctx.fillStyle = "rgba(94,234,212,0.85)";
      ctx.font = "900 16px system-ui, 'Segoe UI', Tahoma, sans-serif";
      ctx.fillText(faDigits(String(stopIndex + 1)), x + cardWidth - 20, lineY);
      ctx.fillStyle = "#eaf6fb";
      ctx.font = "700 19px system-ui, 'Segoe UI', Tahoma, sans-serif";
      ctx.fillText(fit(ctx, stop.n, cardWidth - 60, 22), x + cardWidth - 44, lineY);
    });
    if (day.stops.length > 4) {
      ctx.fillStyle = "rgba(203,229,240,0.5)";
      ctx.font = "600 15px system-ui, 'Segoe UI', Tahoma, sans-serif";
      ctx.fillText(`و ${fa(day.stops.length - 4)} جای دیگر`, x + cardWidth - 44, y + height - 18);
    }
  });

  // Money line, with its honesty label.
  const moneyY = 492;
  if (trip.money) {
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(203,229,240,0.66)";
    ctx.font = "600 20px system-ui, 'Segoe UI', Tahoma, sans-serif";
    ctx.fillText("هزینهٔ تقریبی این سفر", right, moneyY);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 38px system-ui, 'Segoe UI', Tahoma, sans-serif";
    ctx.fillText(money(trip.money.total), right, moneyY + 44);
    ctx.fillStyle = "rgba(148,197,214,0.7)";
    ctx.font = "600 17px system-ui, 'Segoe UI', Tahoma, sans-serif";
    ctx.fillText(
      "قیمت واقعی اقامتگاه و حمل‌ونقل + تخمین خوراک و بلیت",
      right,
      moneyY + 72,
    );
  }

  // Weather of the first day, if we know it.
  const firstWeather = trip.weather?.days?.[0];
  if (firstWeather) {
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(203,229,240,0.72)";
    ctx.font = "600 19px system-ui, 'Segoe UI', Tahoma, sans-serif";
    const shape = firstWeather.maxC !== null ? `${fa(firstWeather.maxC)}° ` : "";
    const rain = firstWeather.rainProbability !== null ? ` · باران ${fa(firstWeather.rainProbability)}٪` : "";
    ctx.fillText(`${firstWeather.label} ${shape}${rain}`.trim(), 64, moneyY + 6);
    ctx.fillStyle = "rgba(148,197,214,0.6)";
    ctx.font = "600 15px system-ui, 'Segoe UI', Tahoma, sans-serif";
    ctx.fillText(trip.weather?.mode === "forecast" ? "پیش‌بینی واقعی هوا" : "میانگین سال‌های گذشته — نه پیش‌بینی", 64, moneyY + 32);
  }

  // Footer
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(94,234,212,0.85)";
  ctx.font = "700 19px system-ui, 'Segoe UI', Tahoma, sans-serif";
  ctx.fillText("safarino-mvp.vercel.app", right, HEIGHT - 22);

  return canvas;
}

/** The card as a PNG file, ready to send or save. */
export async function shareCardBlob(trip: ShareTrip): Promise<Blob | null> {
  const canvas = drawShareCard(trip);
  if (!canvas) return null;
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch {
      resolve(null);
    }
  });
}
