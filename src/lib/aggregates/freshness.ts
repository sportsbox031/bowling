export function isAggregateFresh(updatedAt: string | undefined, maxAgeMs: number, now = Date.now()): boolean {
  if (!updatedAt) return false;
  const parsed = Date.parse(updatedAt);
  if (!Number.isFinite(parsed)) return false;
  return now - parsed <= maxAgeMs;
}
