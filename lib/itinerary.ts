/**
 * Turning a list of real attractions into a day-by-day plan.
 *
 * The rules are simple and honest:
 *  - each day gets places that are close to each other (so the traveller
 *    drives less and sees more),
 *  - inside a day the stops are ordered by nearest-neighbour from the
 *    accommodation, so the route never zig-zags,
 *  - a museum is given more time than a small shrine, and lunch is not skipped,
 *  - nothing is invented: every stop is a real place with real coordinates.
 *
 * Everything here is pure arithmetic on real coordinates, so it can be tested.
 */

export type ItineraryPlace = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  distanceKm?: number | null;
  notability?: number;
  address?: string;
  source?: string;
  sourceUrl?: string;
  wikipediaUrl?: string | null;
  description?: string;
  imageUrl?: string | null;
  imageKind?: "photo" | "map" | "none";
  imageCrediUrl?: string | null;
  imageCreditUrl?: string | null;
};

export type Coordinates = { latitude: number; longitude: number };

export type ItineraryStop = {
  place: ItineraryPlace;
  order: number;
  /** e.g. «۰۹:۰۰» */
  startTime: string;
  /** How long the visit is planned for. */
  visitMinutes: number;
  /** Driving leg from the previous point (accommodation for the first stop). */
  legKm: number | null;
  legMinutes: number | null;
  legEngine: string;
};

export type ItineraryDay = {
  day: number;
  title: string;
  theme: string;
  stops: ItineraryStop[];
  totalKm: number;
  totalDriveMinutes: number;
  /** The area this day covers, named by its first stop, for orientation. */
  area: string;
  lunchAfter: number;
};

export type Itinerary = {
  days: ItineraryDay[];
  unused: ItineraryPlace[];
  stopsPerDay: number;
  note: string;
};

const EARTH_KM = 6371;

export function distanceKm(a: Coordinates, b: Coordinates): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function isUsable(place: ItineraryPlace): boolean {
  return (
    Boolean(place?.id && place?.name) &&
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude) &&
    Math.abs(place.latitude) <= 90 &&
    Math.abs(place.longitude) <= 180 &&
    !(place.latitude === 0 && place.longitude === 0)
  );
}

/** How long a traveller normally spends in this kind of place. */
export function visitMinutes(category: string): number {
  const label = (category || "").toLowerCase();
  if (/(موزه|museum)/.test(label)) return 90;
  if (/(بازار|مرکز خرید|bazaar|market)/.test(label)) return 60;
  if (/(باغ|پارک|بوستان|garden|park)/.test(label)) return 75;
  if (/(حرم|آستان|زیارتی|shrine)/.test(label)) return 60;
  if (/(مسجد|mosque|مدرسه|school)/.test(label)) return 40;
  if (/(آرامگاه|مقبره|tomb|cemetery|گورستان)/.test(label)) return 35;
  if (/(پل|bridge|میدان|square)/.test(label)) return 30;
  return 50;
}

function toPersianDigits(value: string): string {
  return value.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function clock(minutesFromMidnight: number): string {
  const hours = Math.floor(minutesFromMidnight / 60) % 24;
  const minutes = minutesFromMidnight % 60;
  return toPersianDigits(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
}

function popularity(place: ItineraryPlace): number {
  let score = 0;
  if (typeof place.notability === "number") score += place.notability;
  if (place.wikipediaUrl) score += 3;
  if (place.description) score += 1;
  if (typeof place.distanceKm === "number") score -= Math.min(3, place.distanceKm / 5);
  return score;
}

/**
 * Picks `count` spread-out starting points, so each day covers one corner of
 * the city instead of criss-crossing it.
 */
function pickSeeds(places: ItineraryPlace[], count: number): ItineraryPlace[] {
  if (!places.length) return [];
  const seeds: ItineraryPlace[] = [places[0]];
  while (seeds.length < Math.min(count, places.length)) {
    let best: ItineraryPlace | null = null;
    let bestScore = -1;
    places.forEach((place) => {
      if (seeds.some((seed) => seed.id === place.id)) return;
      const nearest = Math.min(...seeds.map((seed) => distanceKm(seed, place)));
      const score = nearest + popularity(place) * 0.15;
      if (score > bestScore) {
        bestScore = score;
        best = place;
      }
    });
    if (!best) break;
    seeds.push(best);
  }
  return seeds;
}

/** Nearest-neighbour order from the accommodation, so the day never zig-zags. */
function orderStops(places: ItineraryPlace[], origin: Coordinates | null): ItineraryPlace[] {
  const remaining = [...places];
  const ordered: ItineraryPlace[] = [];
  let current: Coordinates | null = origin;
  while (remaining.length) {
    let index = 0;
    if (current) {
      let best = Infinity;
      remaining.forEach((place, position) => {
        const cost = distanceKm(current as Coordinates, place);
        if (cost < best) {
          best = cost;
          index = position;
        }
      });
    } else {
      // Without a start point we begin from the most notable place.
      let best = -Infinity;
      remaining.forEach((place, position) => {
        const score = popularity(place);
        if (score > best) {
          best = score;
          index = position;
        }
      });
    }
    const [next] = remaining.splice(index, 1);
    ordered.push(next);
    current = next;
  }
  return ordered;
}

export function buildItinerary(
  places: ItineraryPlace[],
  options: {
    days: number;
    stopsPerDay?: number;
    origin?: Coordinates | null;
    /** Earliest the day starts, in minutes from midnight (default 9:00). */
    dayStartMinutes?: number;
  },
): Itinerary {
  const days = Math.max(1, Math.min(14, Math.round(options.days) || 1));
  const stopsPerDay = Math.max(1, Math.min(6, Math.round(options.stopsPerDay || 4)));
  const usableOrigin = (point: Coordinates | null | undefined): point is Coordinates =>
    Boolean(point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180 && !(point.latitude === 0 && point.longitude === 0));
  const origin = usableOrigin(options.origin) ? { latitude: options.origin.latitude, longitude: options.origin.longitude } : null;
  const startMinutes = options.dayStartMinutes ?? 9 * 60;

  const unique = new Map<string, ItineraryPlace>();
  places.filter(isUsable).forEach((place) => {
    if (!unique.has(place.id)) unique.set(place.id, place);
  });
  const clean = Array.from(unique.values());
  if (!clean.length) {
    return { days: [], unused: [], stopsPerDay, note: "برای ساختن برنامهٔ روزبه‌روز، اول باید جاذبه‌های واقعی مقصد پیدا شوند." };
  }

  const ranked = [...clean].sort((a, b) => popularity(b) - popularity(a));
  const dayCount = Math.max(1, Math.min(days, Math.ceil(ranked.length / 2)));
  const seeds = pickSeeds(ranked, dayCount);

  // Every place goes to the nearest starting point.
  const buckets: ItineraryPlace[][] = seeds.map(() => []);
  ranked.forEach((place) => {
    let target = 0;
    let best = Infinity;
    seeds.forEach((seed, index) => {
      const cost = distanceKm(seed, place);
      if (cost < best) {
        best = cost;
        target = index;
      }
    });
    buckets[target].push(place);
  });

  // Balance: no day may hold more than `stopsPerDay`, and none may stay empty
  // while another day overflows.
  const leftovers: ItineraryPlace[] = [];
  buckets.forEach((bucket) => {
    if (bucket.length > stopsPerDay) leftovers.push(...bucket.splice(stopsPerDay));
  });
  leftovers.forEach((place) => {
    let target = -1;
    let smallest = stopsPerDay;
    buckets.forEach((bucket, index) => {
      if (bucket.length < smallest) {
        smallest = bucket.length;
        target = index;
      }
    });
    if (target >= 0) buckets[target].push(place);
    else if (buckets.length) buckets[0].push(place);
  });

  const usedIds = new Set<string>();
  const itineraryDays: ItineraryDay[] = buckets
    .filter((bucket) => bucket.length)
    .map((bucket, index) => {
      const ordered = orderStops(bucket, origin);
      ordered.forEach((place) => usedIds.add(place.id));
      let cursor = startMinutes;
      const stops: ItineraryStop[] = ordered.map((place, position) => {
        const minutes = visitMinutes(place.category);
        const stop: ItineraryStop = {
          place,
          order: position + 1,
          startTime: clock(cursor),
          visitMinutes: minutes,
          legKm: null,
          legMinutes: null,
          legEngine: "",
        };
        cursor += minutes + 20; // a little walking/settling time between stops
        if (position === 1) cursor += 60; // lunch after the second stop
        return stop;
      });
      const categories = Array.from(new Set(ordered.map((place) => place.category).filter(Boolean)));
      return {
        day: index + 1,
        title: `روز ${toPersianDigits(String(index + 1))} · ${ordered[0]?.name || ""}`,
        theme: categories.slice(0, 2).join(" و ") || "گشت شهری",
        stops,
        totalKm: 0,
        totalDriveMinutes: 0,
        area: ordered[0]?.name || "",
        lunchAfter: Math.min(2, stops.length),
      };
    });

  return {
    days: itineraryDays,
    unused: clean.filter((place) => !usedIds.has(place.id)),
    stopsPerDay,
    note: "چینش روزها بر اساس نزدیکی واقعی مکان‌ها و ترتیب بازدید از نزدیک به دور از اقامتگاه است؛ فاصله و زمان هر مسیر با نشان حساب می‌شود.",
  };
}

/** Recomputes the clock once the real driving times are known. */
export function rescheduleDay(day: ItineraryDay, startMinutes = 9 * 60): ItineraryDay {
  let cursor = startMinutes;
  const stops = day.stops.map((stop) => {
    const startTime = clock(cursor);
    cursor += (stop.legMinutes || 0) + stop.visitMinutes + 10;
    if (stop.order === day.lunchAfter) cursor += 60;
    return { ...stop, startTime };
  });
  return {
    ...day,
    stops,
    totalKm: Math.round(day.stops.reduce((sum, stop) => sum + (stop.legKm || 0), 0) * 10) / 10,
    totalDriveMinutes: day.stops.reduce((sum, stop) => sum + (stop.legMinutes || 0), 0),
  };
}

export { clock as itineraryClock };
