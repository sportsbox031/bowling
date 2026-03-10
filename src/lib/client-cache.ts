/**
 * Client-side cache using sessionStorage + memory.
 * Eliminates redundant API calls by storing fetched data locally.
 *
 * Usage:
 *   const data = await cachedFetch<MyType>(url, ttlMs);
 *   // First call -> real fetch + store. Subsequent calls within TTL -> instant, no API call.
 */

type CacheEntry = { data: unknown; ts: number };

const MAX_MEM_SIZE = 100;
const mem = new Map<string, CacheEntry>();

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? sessionStorage : null;
  } catch {
    return null;
  }
}

export function getClientCache<T>(key: string, maxAge: number): T | null {
  const m = mem.get(key);
  if (m && Date.now() - m.ts < maxAge) return m.data as T;

  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(`cc:${key}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts < maxAge) {
      mem.set(key, entry);
      return entry.data as T;
    }
  } catch {}
  return null;
}

export function setClientCache<T>(key: string, data: T): void {
  const entry: CacheEntry = { data, ts: Date.now() };
  if (mem.size >= MAX_MEM_SIZE) {
    const oldest = mem.keys().next().value;
    if (oldest) mem.delete(oldest);
  }
  mem.set(key, entry);
  const s = storage();
  if (!s) return;
  try {
    s.setItem(`cc:${key}`, JSON.stringify(entry));
  } catch {
  }
}

export function invalidateClientCache(prefix: string): void {
  for (const key of mem.keys()) {
    if (key.startsWith(prefix)) mem.delete(key);
  }
  const s = storage();
  if (!s) return;
  const toRemove: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k?.startsWith(`cc:${prefix}`)) toRemove.push(k);
  }
  for (const k of toRemove) s.removeItem(k);
}

export async function cachedFetch<T>(
  url: string,
  maxAge: number,
  key?: string,
): Promise<T> {
  const cacheKey = key ?? url;

  const cached = getClientCache<T>(cacheKey, maxAge);
  if (cached !== null) return cached;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    let message = `API error: ${res.status}`;
    try {
      const payload = await res.json() as { message?: unknown; error?: unknown };
      if (typeof payload.message === "string" && payload.message.trim()) {
        message = payload.message;
      } else if (typeof payload.error === "string" && payload.error.trim()) {
        message = payload.error;
      }
    } catch {}
    throw new Error(message);
  }
  const data = (await res.json()) as T;

  setClientCache(cacheKey, data);
  return data;
}
