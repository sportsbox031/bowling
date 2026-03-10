export function isFirestoreQuotaExceededError(error: unknown): boolean {
  if (typeof error === "string") {
    const normalized = error.toLowerCase();
    return normalized.includes("resource_exhausted") || normalized.includes("quota exceeded");
  }

  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown; details?: unknown };
  const code = candidate.code;
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const details = typeof candidate.details === "string" ? candidate.details : "";
  const combined = `${message} ${details}`.toLowerCase();

  return code === 8 || code === "8" || combined.includes("resource_exhausted") || combined.includes("quota exceeded");
}

export function getQuotaExceededMessage(action: string): string {
  const normalizedAction = action.trim().replace(/\s*중$/, "");
  return `${normalizedAction} 요청이 많아 잠시 후 다시 시도해 주세요.`;
}
