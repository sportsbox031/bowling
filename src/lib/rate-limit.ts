type RateLimiterOptions = {
  windowMs?: number;
  maxRequests?: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetMs: number;
};

type SlidingWindowEntry = {
  timestamps: number[];
};

const CLEANUP_INTERVAL_MS = 60_000;

export class RateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly store = new Map<string, SlidingWindowEntry>();
  private lastCleanupAt = 0;

  constructor({ windowMs = 60_000, maxRequests = 60 }: RateLimiterOptions = {}) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    this.cleanupExpiredEntries(now);

    const entry = this.store.get(key);
    const timestamps = (entry?.timestamps ?? []).filter((timestamp) => now - timestamp < this.windowMs);
    const allowed = timestamps.length < this.maxRequests;

    if (allowed) {
      timestamps.push(now);
    }

    if (timestamps.length > 0) {
      this.store.set(key, { timestamps });
    } else {
      this.store.delete(key);
    }

    const oldestTimestamp = timestamps[0] ?? now;
    const resetMs = Math.max(0, this.windowMs - (now - oldestTimestamp));

    return {
      allowed,
      remaining: allowed ? Math.max(0, this.maxRequests - timestamps.length) : 0,
      resetMs,
    };
  }

  private cleanupExpiredEntries(now: number) {
    if (now - this.lastCleanupAt < CLEANUP_INTERVAL_MS) {
      return;
    }

    for (const [key, entry] of this.store.entries()) {
      const timestamps = entry.timestamps.filter((timestamp) => now - timestamp < this.windowMs);
      if (timestamps.length === 0) {
        this.store.delete(key);
        continue;
      }
      entry.timestamps = timestamps;
    }

    this.lastCleanupAt = now;
  }
}

export const publicRateLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 60 });
