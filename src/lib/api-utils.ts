import { NextResponse } from "next/server";

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) {
    return "unknown";
  }

  const ip = forwardedFor.split(",")[0]?.trim();
  return ip || "unknown";
}

export function rateLimitResponse(remaining: number, resetMs: number): NextResponse {
  const retryAfterSeconds = Math.max(1, Math.ceil(resetMs / 1000));

  return NextResponse.json(
    { message: "TOO_MANY_REQUESTS" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Remaining": String(Math.max(0, remaining)),
      },
    },
  );
}
