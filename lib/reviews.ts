/**
 * Real traveller reviews.
 *
 * Nothing here is written by hand: the list only ever contains what visitors
 * actually submitted through the form on the home page. There is no seed data
 * and no placeholder, so an empty store means an empty (and honestly labelled)
 * section instead of invented testimonials.
 *
 * Privacy: we keep a display name (optional), the Iranian city the trip was
 * about, a 1–5 rating and the text. No email, no phone, no IP address is
 * stored with the review, and the text is cleaned of links and contact details
 * before it is kept.
 */

import { getProviderCache, setProviderCache } from "./provider-cache";
import { isIranianTravelCity } from "./start-flow";

export type Review = {
  id: string;
  /** Display name as the traveller typed it, or «مسافر سفرینو». */
  name: string;
  city: string;
  rating: number;
  text: string;
  createdAt: string;
};

export type ReviewInput = {
  name?: unknown;
  city?: unknown;
  rating?: unknown;
  text?: unknown;
};

export type ReviewSummary = {
  reviews: Review[];
  total: number;
  average: number | null;
  /** True when the durable store could not be read (never shown as "no reviews"). */
  storageUnavailable: boolean;
};

const LIST_KEY = "safarino:reviews:v1";
const MAX_KEPT = 300;
const MAX_SHOWN = 6;
const KEEP_SECONDS = 60 * 60 * 24 * 120;

/** Removes anything that looks like markup, a link or a contact detail. */
export function cleanReviewText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/www\.\S+/gi, " ")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, " ")
    .replace(/\+?[\d۰-۹][\d۰-۹\s-]{8,}[\d۰-۹]/g, " ")
    .replace(/[<>{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function validRating(value: unknown): number | null {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

export function parseReviewInput(body: ReviewInput): { ok: true; review: Omit<Review, "id" | "createdAt"> } | { ok: false; error: string } {
  const city = String(body.city || "").trim();
  if (!isIranianTravelCity(city)) return { ok: false, error: "شهر سفر را از فهرست شهرهای ایران انتخاب کنید." };

  const rating = validRating(body.rating);
  if (!rating) return { ok: false, error: "امتیاز سفر را بین ۱ تا ۵ انتخاب کنید." };

  const text = cleanReviewText(String(body.text || ""));
  if (text.length < 15) return { ok: false, error: "کمی بیشتر بنویسید (حداقل ۱۵ حرف) تا برای بقیه مفید باشد." };
  if (text.length > 600) return { ok: false, error: "متن نظر حداکثر ۶۰۰ حرف می‌تواند باشد." };

  const rawName = cleanReviewText(String(body.name || ""));
  const name = rawName.length >= 2 ? rawName.slice(0, 24) : "مسافر سفرینو";

  return { ok: true, review: { name, city, rating, text } };
}

function normalise(value: unknown): Review[] {
  if (!Array.isArray(value)) return [];
  const result: Review[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const text = typeof entry.text === "string" ? entry.text : "";
    const city = typeof entry.city === "string" ? entry.city : "";
    const rating = validRating(entry.rating);
    if (!text || !city || !rating) continue;
    result.push({
      id: typeof entry.id === "string" ? entry.id : `${entry.createdAt ?? ""}-${result.length}`,
      name: typeof entry.name === "string" && entry.name ? entry.name : "مسافر سفرینو",
      city,
      rating,
      text,
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
    });
  }
  return result;
}

async function readAll(): Promise<{ reviews: Review[]; storageUnavailable: boolean }> {
  const stored = await getProviderCache<{ reviews?: unknown }>(LIST_KEY);
  if (stored === null) {
    // Either nothing has ever been submitted, or the store is unreachable.
    // An explicit probe tells the two apart, so the site never claims "no
    // reviews yet" when it simply could not read them.
    const probe = await getProviderCache<unknown>("safarino:reviews:probe");
    return { reviews: [], storageUnavailable: probe === null && !(await storeIsReachable()) };
  }
  return { reviews: normalise(stored.reviews), storageUnavailable: false };
}

async function storeIsReachable(): Promise<boolean> {
  try {
    await setProviderCache("safarino:reviews:probe", { at: new Date().toISOString() }, 60);
    const back = await getProviderCache<{ at?: string }>("safarino:reviews:probe");
    return Boolean(back && back.at);
  } catch {
    return false;
  }
}

export async function listReviews(limit = MAX_SHOWN): Promise<ReviewSummary> {
  const { reviews, storageUnavailable } = await readAll();
  const sorted = reviews.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = sorted.length;
  const average = total ? Math.round((sorted.reduce((sum, review) => sum + review.rating, 0) / total) * 10) / 10 : null;
  return { reviews: sorted.slice(0, Math.max(1, limit)), total, average, storageUnavailable };
}

export async function addReview(input: ReviewInput): Promise<{ ok: true; review: Review; total: number } | { ok: false; error: string }> {
  const parsed = parseReviewInput(input);
  if (!parsed.ok) return parsed;

  const { reviews } = await readAll();
  const review: Review = {
    ...parsed.review,
    id: `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const next = [review, ...reviews].slice(0, MAX_KEPT);

  try {
    await setProviderCache(LIST_KEY, { reviews: next }, KEEP_SECONDS);
  } catch {
    return { ok: false, error: "ذخیرهٔ نظر الان ممکن نشد. چند دقیقهٔ دیگر دوباره تلاش کنید." };
  }

  const verify = await getProviderCache<{ reviews?: unknown }>(LIST_KEY);
  const saved = normalise(verify?.reviews).some((item) => item.id === review.id);
  if (!saved) return { ok: false, error: "نظر ذخیره نشد. چند دقیقهٔ دیگر دوباره تلاش کنید." };

  return { ok: true, review, total: next.length };
}
