import { NextResponse } from "next/server";
import { GET } from "../route";
import { adminDb } from "@/lib/firebase/admin";
import { getCached } from "@/lib/api-cache";
import {
  readEventAssignmentsAggregate,
  rebuildEventAssignmentsAggregate,
} from "@/lib/aggregates/event-assignments";

jest.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: jest.fn(),
  },
}));

jest.mock("@/lib/api-cache", () => ({
  getCached: jest.fn(),
  jsonCached: jest.fn((payload: unknown, maxAge: number) =>
    NextResponse.json(payload, { headers: { "Cache-Control": `public, max-age=${maxAge}` } }),
  ),
  setCache: jest.fn(),
}));

jest.mock("@/lib/aggregates/event-assignments", () => ({
  readEventAssignmentsAggregate: jest.fn(),
  rebuildEventAssignmentsAggregate: jest.fn(),
}));

jest.mock("@/lib/firebase/quota", () => ({
  getQuotaExceededMessage: jest.fn(),
  isFirestoreQuotaExceededError: jest.fn(() => false),
}));

jest.mock("@/lib/api-utils", () => ({
  getClientIp: jest.fn(() => "127.0.0.1"),
  rateLimitResponse: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  publicRateLimiter: {
    check: jest.fn(() => ({ allowed: true, remaining: 59, resetMs: 60_000 })),
  },
}));

describe("public assignments route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCached as jest.Mock).mockReturnValue(null);
  });

  it("returns DIVISION_ID_REQUIRED when divisionId is missing", async () => {
    const response = await GET({
      headers: {
        get: jest.fn(() => null),
      },
      url: "https://example.test/api/public/assignments?tournamentId=t1&eventId=e1",
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "DIVISION_ID_REQUIRED" });
    expect(adminDb.collection).not.toHaveBeenCalled();
    expect(getCached).not.toHaveBeenCalled();
    expect(readEventAssignmentsAggregate).not.toHaveBeenCalled();
    expect(rebuildEventAssignmentsAggregate).not.toHaveBeenCalled();
  });
});
