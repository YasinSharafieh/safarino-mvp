/**
 * Neshan Maps Platform client — server only.
 *
 * The key lives in the `NESHAN_API_KEY` environment variable and is never sent
 * to the browser, never logged and never written into the repository. When the
 * key is missing every helper answers with a typed `not_configured` status, so
 * the interface can say "Neshan is not connected yet" instead of inventing a
 * distance. Nothing in this file fabricates a place or a route.
 *
 * Docs: distance matrix /v1/distance-matrix, place search /v3/search.
 */

export type NeshanCoords = { latitude: number; longitude: number };

export type NeshanStatus =
  | "ok"
  | "not_configured"
  | "unauthorized"
  | "key_type"
  | "service_disabled"
  | "whitelist"
  | "quota"
  | "rate_limited"
  | "invalid"
  | "failed";

export type NeshanDistance = { distanceKm: number; durationMinutes: number };

export type NeshanPlace = {
  id: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  sourceUrl: string;
};

const API_BASE = "https://api.neshan.org";
/** Neshan documents 25 origins and 25 destinations per matrix request. */
export const NESHAN_MATRIX_CHUNK = 10;

export function neshanApiKey(): string {
  return (process.env.NESHAN_API_KEY || "").trim();
}

/**
 * A traveller can paste their own free Neshan key in the app; it is kept in
 * their browser and sent per request. The key from the environment always wins
 * so a deployment can also be configured once for everybody.
 */
export function resolveNeshanKey(candidate?: unknown): string {
  const fromEnv = neshanApiKey();
  if (fromEnv) return fromEnv;
  const raw = typeof candidate === "string" ? candidate.trim() : "";
  if (raw.length < 8 || raw.length > 200 || /\s/.test(raw)) return "";
  return raw;
}

export function neshanConfigured(): boolean {
  return neshanApiKey().length > 0;
}

/** True when Neshan can be used right now, from the environment or the request. */
export function neshanAvailable(key?: string): boolean {
  return Boolean(key && key.length > 0) || neshanConfigured();
}

export function neshanStatusFromHttp(status: number): Exclude<NeshanStatus, "ok"> {
  if (status === 400 || status === 470) return "invalid";
  if (status === 483) return "key_type";
  if (status === 484) return "whitelist";
  if (status === 485) return "service_disabled";
  if (status === 480) return "unauthorized";
  if (status === 481) return "quota";
  if (status === 482) return "rate_limited";
  return "failed";
}

export function neshanStatusNote(status: NeshanStatus): string {
  switch (status) {
    case "not_configured":
      return "کلید نشان هنوز وصل نشده است؛ فاصله‌ها با OpenStreetMap محاسبه می‌شوند.";
    case "unauthorized":
      return "کلید نشان پذیرفته نشد؛ فاصله‌ها با OpenStreetMap محاسبه می‌شوند.";
    case "quota":
      return "سهمیهٔ ماهانهٔ نشان تمام شد؛ فاصله‌ها با OpenStreetMap محاسبه می‌شوند.";
    case "rate_limited":
      return "تعداد درخواست‌های نشان در این دقیقه زیاد شد؛ فاصله‌ها با OpenStreetMap محاسبه می‌شوند.";
    case "invalid":
      return "مختصات برای نشان معتبر نبود؛ فاصله‌ها با OpenStreetMap محاسبه می‌شوند.";
    case "key_type":
      return "این کلید از نوع «سرویس» نیست؛ در پنل نشان کلید را از تب «سرویس‌ها» بسازید.";
    case "service_disabled":
      return "این کلید ساخته شده، ولی سرویس «مسیریابی/ماتریس فاصله» برایش تیک نخورده است؛ در پنل نشان همان سرویس را فعال کنید.";
    case "whitelist":
      return "کلید نشان به دامنه/آی‌پی محدود شده و از سرور سایت پذیرفته نشد؛ فهرست دامنه‌ها را خالی بگذارید یا دامنهٔ سایت را اضافه کنید.";
    case "failed":
      return "نشان پاسخ نداد؛ فاصله‌ها با OpenStreetMap محاسبه می‌شوند.";
    default:
      return "فاصله و زمان رانندگی از نشان خوانده شد.";
  }
}

function validCoords(point: NeshanCoords): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude !== 0 &&
    point.longitude !== 0 &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
  );
}

function pair(point: NeshanCoords): string {
  return `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
}

export type NeshanMatrixResult =
  | { status: "ok"; items: (NeshanDistance | null)[] }
  | { status: Exclude<NeshanStatus, "ok"> };

/**
 * Driving distance + travel time from one origin to many destinations
 * (traffic aware, as Neshan computes it). Returns `null` for any pair Neshan
 * reports as `NoRoute` instead of guessing.
 */
export async function neshanDistanceMatrix(
  origin: NeshanCoords,
  destinations: NeshanCoords[],
  options: { key?: string; timeoutMs?: number } = {},
): Promise<NeshanMatrixResult> {
  const key = resolveNeshanKey(options.key);
  const timeoutMs = options.timeoutMs ?? 12_000;
  if (!key) return { status: "not_configured" };
  if (!validCoords(origin)) return { status: "invalid" };
  const targets = destinations.filter(validCoords);
  if (!targets.length) return { status: "ok", items: [] };

  const items: (NeshanDistance | null)[] = [];
  for (let index = 0; index < targets.length; index += NESHAN_MATRIX_CHUNK) {
    const chunk = targets.slice(index, index + NESHAN_MATRIX_CHUNK);
    const url =
      `${API_BASE}/v1/distance-matrix?type=car` +
      `&origins=${encodeURIComponent(pair(origin))}` +
      `&destinations=${encodeURIComponent(chunk.map(pair).join("|"))}`;
    try {
      const response = await fetch(url, {
        headers: { "Api-Key": key, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return { status: neshanStatusFromHttp(response.status) };
      const payload = (await response.json()) as {
        status?: string;
        rows?: { elements?: { status?: string; distance?: { value?: number }; duration?: { value?: number } }[] }[];
      };
      const elements = payload?.rows?.[0]?.elements;
      if (!Array.isArray(elements)) return { status: "failed" };
      for (let position = 0; position < chunk.length; position += 1) {
        const element = elements[position];
        const meters = Number(element?.distance?.value);
        const seconds = Number(element?.duration?.value);
        if (element?.status === "Ok" && Number.isFinite(meters) && meters > 0) {
          items.push({
            distanceKm: Math.round(meters / 100) / 10,
            durationMinutes: Number.isFinite(seconds) ? Math.max(1, Math.round(seconds / 60)) : 0,
          });
        } else {
          items.push(null);
        }
      }
    } catch {
      return { status: "failed" };
    }
  }
  return { status: "ok", items };
}

export type NeshanSearchResult =
  | { status: "ok"; places: NeshanPlace[] }
  | { status: Exclude<NeshanStatus, "ok"> };

/** Real place search around one point: names, categories and coordinates come from Neshan itself. */
export async function neshanSearch(
  term: string,
  center: NeshanCoords,
  options: { key?: string; timeoutMs?: number } = {},
): Promise<NeshanSearchResult> {
  const key = resolveNeshanKey(options.key);
  const timeoutMs = options.timeoutMs ?? 12_000;
  if (!key) return { status: "not_configured" };
  if (!validCoords(center)) return { status: "invalid" };
  const query = encodeURIComponent(JSON.stringify({ term, center: { latitude: center.latitude, longitude: center.longitude } }));
  try {
    const response = await fetch(`${API_BASE}/v3/search?q=${query}`, {
      headers: { "Api-Key": key, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { status: neshanStatusFromHttp(response.status) };
    const payload = (await response.json()) as {
      items?: {
        title?: string;
        address?: string;
        address_norm?: string;
        neighbourhood?: string;
        type?: string;
        location?: { x?: number; y?: number };
      }[];
    };
    const places: NeshanPlace[] = [];
    (payload?.items || []).forEach((item, index) => {
      const latitude = Number(item?.location?.y);
      const longitude = Number(item?.location?.x);
      const name = typeof item?.title === "string" ? item.title.trim() : "";
      if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      if (latitude === 0 || longitude === 0) return;
      places.push({
        id: `neshan-${latitude.toFixed(5)}-${longitude.toFixed(5)}-${index}`,
        name,
        category: typeof item?.type === "string" && item.type.trim() ? item.type.trim() : "مکان",
        address: typeof item?.address === "string" ? item.address.trim() : typeof item?.neighbourhood === "string" ? item.neighbourhood.trim() : "",
        latitude,
        longitude,
        sourceUrl: `https://neshan.org/maps/@${latitude},${longitude},16z`,
      });
    });
    return { status: "ok", places };
  } catch {
    return { status: "failed" };
  }
}
