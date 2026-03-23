import { NextRequest } from "next/server";
import { getClientIp, rateLimitResponse } from "@/lib/api-utils";
import { RateLimiter } from "@/lib/rate-limit";

describe("RateLimiter", () => {
  it("blocks requests after the configured limit within the window", () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 2 });
    const key = `limit-${Date.now()}`;

    expect(limiter.check(key)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.check(key)).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.check(key)).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("resets after the sliding window expires", async () => {
    const limiter = new RateLimiter({ windowMs: 5, maxRequests: 1 });
    const key = `reset-${Date.now()}`;

    expect(limiter.check(key)).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.check(key)).toMatchObject({ allowed: false, remaining: 0 });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(limiter.check(key)).toMatchObject({ allowed: true, remaining: 0 });
  });
});

describe("getClientIp", () => {
  it("returns the first x-forwarded-for address", () => {
    const request = new NextRequest("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.2" },
    });

    expect(getClientIp(request)).toBe("203.0.113.10");
  });

  it("falls back to unknown when x-forwarded-for is absent", () => {
    const request = new NextRequest("https://example.com");

    expect(getClientIp(request)).toBe("unknown");
  });
});

describe("rateLimitResponse", () => {
  it("returns a 429 response with retry metadata", async () => {
    const response = rateLimitResponse(0, 60_000);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    await expect(response.json()).resolves.toEqual({ message: "TOO_MANY_REQUESTS" });
  });
});
