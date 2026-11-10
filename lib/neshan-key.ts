/**
 * The Neshan web-service key belongs to the traveller, not to the repository.
 * It is kept in this browser's localStorage and sent only to Safarino's own
 * server routes, which use it for Neshan's distance matrix. It is never put in
 * a URL, never rendered and never written into the code.
 */

export const NESHAN_KEY_STORAGE = "safarino-neshan-key-v1";

export function readNeshanKey(): string {
  try {
    return (window.localStorage.getItem(NESHAN_KEY_STORAGE) || "").trim();
  } catch {
    return "";
  }
}

export function saveNeshanKey(value: string): boolean {
  const key = value.trim();
  if (!key) return false;
  try {
    window.localStorage.setItem(NESHAN_KEY_STORAGE, key);
    return true;
  } catch {
    return false;
  }
}

export function clearNeshanKey(): void {
  try {
    window.localStorage.removeItem(NESHAN_KEY_STORAGE);
  } catch {
    /* nothing to clean up */
  }
}

/** Only ever shows the last four characters, so a shoulder-surfer sees nothing useful. */
export function maskNeshanKey(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.min(12, value.length - 4))}${value.slice(-4)}`;
}
