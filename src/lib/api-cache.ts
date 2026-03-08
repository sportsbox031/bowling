import { NextResponse } from "next/server";

const MAX_CACHE_SIZE = 200;
const cache = new Map<string, { data: unknown; expires: number }>();

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expires) cache.delete(key);
  }
}

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache(key: string, data: unknown, ttlMs = 5000): void {
  if (cache.size >= MAX_CACHE_SIZE) evictExpired();
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

export function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * NextResponse.json with HTTP Cache-Control headers for CDN edge caching.
 * s-maxage: CDN cache duration, stale-while-revalidate: serve stale while refreshing.
 */
export function jsonCached<T>(data: T, maxAgeSec: number): NextResponse {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${maxAgeSec}, stale-while-revalidate=${maxAgeSec * 2}`,
    },
  });
}
