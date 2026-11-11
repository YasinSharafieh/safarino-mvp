/**
 * Places the traveller liked, kept on their own device.
 * Nothing is uploaded anywhere: it is a personal shortlist.
 */

export const FAVORITES_KEY = "safarino-favorite-places-v1";
export const FAVORITES_EVENT = "safarino-favorites-changed";

export type FavoritePlace = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  address?: string;
  description?: string;
  imageUrl?: string | null;
  imageKind?: "photo" | "map" | "none";
  wikipediaUrl?: string | null;
  sourceUrl?: string | null;
  savedAt: string;
};

function isFavorite(value: unknown): value is FavoritePlace {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    Number.isFinite(Number(item.latitude)) &&
    Number.isFinite(Number(item.longitude))
  );
}

export function readFavorites(): FavoritePlace[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isFavorite) : [];
  } catch {
    return [];
  }
}

function write(favorites: FavoritePlace[]): void {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites.slice(0, 200)));
    window.dispatchEvent(new Event(FAVORITES_EVENT));
  } catch {
    /* a full or blocked storage must not break the page */
  }
}

export function isFavoritePlace(id: string): boolean {
  return readFavorites().some((place) => place.id === id);
}

export function toggleFavorite(place: Omit<FavoritePlace, "savedAt">): { added: boolean; favorites: FavoritePlace[] } {
  const current = readFavorites();
  const exists = current.some((item) => item.id === place.id);
  const next = exists
    ? current.filter((item) => item.id !== place.id)
    : [{ ...place, savedAt: new Date().toISOString() }, ...current];
  write(next);
  return { added: !exists, favorites: next };
}

export function removeFavorite(id: string): FavoritePlace[] {
  const next = readFavorites().filter((item) => item.id !== id);
  write(next);
  return next;
}

export function favoriteIds(): string[] {
  return readFavorites().map((place) => place.id);
}
