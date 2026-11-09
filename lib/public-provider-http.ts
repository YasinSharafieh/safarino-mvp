const ALLOWED_HOSTS = new Set([
  "api.jajiga.com",
  "gw.jabama.com",
  "core.otaghak.com",
  "hapi.snapptrip.com",
  "www.eghamat24.com",
]);

type QueryValue = string | number | boolean | null | undefined | readonly (string | number | boolean)[];

export type PublicProviderRequest = {
  method?: "GET" | "POST";
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export class PublicProviderError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
    this.name = "PublicProviderError";
  }
}

export function providerUrl(url: string, query: Record<string, QueryValue> = {}): string {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname) || parsed.username || parsed.password || parsed.port) {
    throw new PublicProviderError("PROVIDER_HOST_NOT_ALLOWED");
  }
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) for (const entry of value) parsed.searchParams.append(key, String(entry));
    else parsed.searchParams.set(key, String(value));
  }
  return parsed.toString();
}

export async function publicProviderJson(url: string, request: PublicProviderRequest = {}): Promise<unknown> {
  const fullUrl = providerUrl(url, request.query);
  const timeoutMs = request.timeoutMs ?? 15_000;
  let response: Response;
  try {
    response = await fetch(fullUrl, {
      method: request.method || "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.6",
        ...(request.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...request.headers,
      },
      body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new PublicProviderError(error instanceof Error && error.name === "TimeoutError" ? "PROVIDER_TIMEOUT" : "PROVIDER_NETWORK_ERROR");
  }
  const raw = await response.text();
  if (raw.length > 10_000_000) throw new PublicProviderError("PROVIDER_RESPONSE_TOO_LARGE", response.status);
  if (!response.ok) throw new PublicProviderError(`PROVIDER_HTTP_${response.status}`, response.status);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new PublicProviderError("PROVIDER_INVALID_JSON", response.status);
  }
}
