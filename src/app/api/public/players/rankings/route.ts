import { NextRequest, NextResponse } from "next/server";
import { getClientIp, rateLimitResponse } from "@/lib/api-utils";
import { publicRateLimiter } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const rateLimit = publicRateLimiter.check(getClientIp(req));
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.remaining, rateLimit.resetMs);

  return NextResponse.json({ message: "NOT_FOUND" }, { status: 404 });
}
