function config() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { token, url } : null;
}

async function command(parts: string[]) {
  const redis = config();
  if (!redis) throw new Error("Provider cache is not configured");
  const response = await fetch(redis.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redis.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parts),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Provider cache returned ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(String(payload.error));
  return payload.result;
}

export async function getProviderCache<T>(key: string): Promise<T | null> {
  try {
    const value = await command(["GET", key]);
    return typeof value === "string" ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export async function setProviderCache(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  try {
    await command(["SET", key, JSON.stringify(value), "EX", String(ttlSeconds)]);
  } catch {
    // A live provider result is still valid when optional caching is unavailable.
  }
}

export async function assertProviderRateLimit(ip: string, provider: string): Promise<void> {
  const key = `safarino:provider-rate:${provider}:${ip}`;
  const windowSeconds = 60;
  const limit = 10;
  let count: number;
  try {
    count = Number(await command(["INCR", key]));
    if (count === 1) await command(["EXPIRE", key, String(windowSeconds)]);
  } catch {
    throw new Error("PROVIDER_RATE_LIMIT_UNAVAILABLE");
  }
  if (count > limit) throw new Error("PROVIDER_RATE_LIMIT_EXCEEDED");
}
