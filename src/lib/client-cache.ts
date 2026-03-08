/**
 * Client-side cache using sessionStorage + memory.
 * Eliminates redundant API calls by storing fetched data locally.
 *
 * Usage:
 *   const data = await cachedFetch<MyType>(url, ttlMs);
 *   // First call → real fetch + store. Subsequent calls within TTL → instant, no API call.
 */

type CacheEntry = { data: unknown; ts: number };

const mem = new Map<string, CacheEntry>();

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? sessionStorage : null;
  } catch {
    return null;
  }
}

export function getClientCache<T>(key: string, maxAge: number): T | null {
  // Memory first (fastest)
  const m = mem.get(key);
  if (m && Date.now() - m.ts < maxAge) return m.data as T;

  // SessionStorage fallback (survives page navigations)
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(`cc:${key}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts < maxAge) {
      mem.set(key, entry); // promote to memory
      return entry.data as T;
    }
  } catch { /* corrupted or quota exceeded */ }
  return null;
}

export function setClientCache<T>(key: string, data: T): void {
  const entry: CacheEntry = { data, ts: Date.now() };
  mem.set(key, entry);
  const s = storage();
  if (!s) return;
  try {
    s.setItem(`cc:${key}`, JSON.stringify(entry));
  } catch {
    // Storage quota exceeded — memory cache still works
  }
}

export function invalidateClientCache(prefix: string): void {
  // Memory
  for (const key of mem.keys()) {
    if (key.startsWith(prefix)) mem.delete(key);
  }
  // SessionStorage
  const s = storage();
  if (!s) return;
  const toRemove: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k?.startsWith(`cc:${prefix}`)) toRemove.push(k);
  }
  for (const k of toRemove) s.removeItem(k);
}

/**
 * Fetch with client-side caching.
 * If cached data exists within maxAge, returns it instantly (no API call).
 */
export async function cachedFetch<T>(
  url: string,
  maxAge: number,
  key?: string,
): Promise<T> {
  const cacheKey = key ?? url;

  const cached = getClientCache<T>(cacheKey, maxAge);
  if (cached !== null) return cached;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = (await res.json()) as T;

  setClientCache(cacheKey, data);
  return data;
}
