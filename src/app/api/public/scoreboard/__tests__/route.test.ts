import { NextResponse } from "next/server";
import { GET } from "../route";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, jsonCached, setCache } from "@/lib/api-cache";
import { readEventScoreboardAggregate, rebuildEventScoreboardAggregate } from "@/lib/aggregates/event-scoreboard";

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

jest.mock("@/lib/aggregates/event-scoreboard", () => ({
  readEventScoreboardAggregate: jest.fn(),
  rebuildEventScoreboardAggregate: jest.fn(),
}));

jest.mock("@/lib/firebase/quota", () => ({
  getQuotaExceededMessage: jest.fn(),
  isFirestoreQuotaExceededError: jest.fn(() => false),
}));

jest.mock("@/lib/api-utils", () => ({
  getClientIp: jest.fn(() => "127.0.0.1"),
  rateLimitResponse: jest.fn(() => NextResponse.json({ message: "TOO_MANY_REQUESTS" }, { status: 429 })),
}));

jest.mock("@/lib/rate-limit", () => ({
  publicRateLimiter: {
    check: jest.fn(() => ({ allowed: true, remaining: 59, resetMs: 60_000 })),
  },
}));

type MockedAdminDb = {
  collection: jest.Mock;
};

describe("public scoreboard route", () => {
  const mockedAdminDb = adminDb as unknown as MockedAdminDb;

  beforeEach(() => {
    jest.clearAllMocks();
    (getCached as jest.Mock).mockReturnValue(null);
  });

  it("returns DIVISION_ID_REQUIRED when divisionId is missing", async () => {
    const response = await GET({
      url: "https://example.test/api/public/scoreboard?tournamentId=t1&eventId=e1",
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "DIVISION_ID_REQUIRED" });
    expect(getCached).not.toHaveBeenCalled();
    expect(readEventScoreboardAggregate).not.toHaveBeenCalled();
    expect(rebuildEventScoreboardAggregate).not.toHaveBeenCalled();
  });

  it("returns EVENT_NOT_FOUND when the direct event document is absent", async () => {
    const get = jest.fn().mockResolvedValue({ exists: false });
    const eventDoc = { get };
    const eventsCollection = { doc: jest.fn(() => eventDoc) };
    const divisionDoc = { collection: jest.fn(() => eventsCollection) };
    const divisionsCollection = { doc: jest.fn(() => divisionDoc) };
    const tournamentDoc = { collection: jest.fn(() => divisionsCollection) };
    mockedAdminDb.collection.mockReturnValue({ doc: jest.fn(() => tournamentDoc) });
    (readEventScoreboardAggregate as jest.Mock).mockResolvedValue(null);

    const response = await GET({
      url: "https://example.test/api/public/scoreboard?tournamentId=t1&divisionId=d1&eventId=e1",
    } as never);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ message: "EVENT_NOT_FOUND" });
    expect(readEventScoreboardAggregate).toHaveBeenCalledWith(adminDb, "t1", "d1", "e1");
    expect(get).toHaveBeenCalledTimes(1);
    expect(rebuildEventScoreboardAggregate).not.toHaveBeenCalled();
    expect(setCache).not.toHaveBeenCalled();
    expect(jsonCached).not.toHaveBeenCalled();
  });

  it("returns stored aggregate data without fetching the event document", async () => {
    const get = jest.fn();
    const eventDoc = { get };
    const eventsCollection = { doc: jest.fn(() => eventDoc) };
    const divisionDoc = { collection: jest.fn(() => eventsCollection) };
    const divisionsCollection = { doc: jest.fn(() => divisionDoc) };
    const tournamentDoc = { collection: jest.fn(() => divisionsCollection) };
    mockedAdminDb.collection.mockReturnValue({ doc: jest.fn(() => tournamentDoc) });
    (readEventScoreboardAggregate as jest.Mock).mockResolvedValue({
      eventRows: [{ playerId: "p1" }],
      teamRows: null,
      fivesCombinedRows: null,
      event: { id: "e1" },
    });

    const response = await GET({
      url: "https://example.test/api/public/scoreboard?tournamentId=t1&divisionId=d1&eventId=e1",
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      rows: [{ playerId: "p1" }],
      event: { id: "e1" },
    });
    expect(readEventScoreboardAggregate).toHaveBeenCalledWith(adminDb, "t1", "d1", "e1");
    expect(get).not.toHaveBeenCalled();
    expect(rebuildEventScoreboardAggregate).not.toHaveBeenCalled();
  });

  it("adds X-RateLimit-Remaining to successful responses", async () => {
    const get = jest.fn().mockResolvedValue({ exists: true });
    const eventDoc = { get };
    const eventsCollection = { doc: jest.fn(() => eventDoc) };
    const divisionDoc = { collection: jest.fn(() => eventsCollection) };
    const divisionsCollection = { doc: jest.fn(() => divisionDoc) };
    const tournamentDoc = { collection: jest.fn(() => divisionsCollection) };
    mockedAdminDb.collection.mockReturnValue({ doc: jest.fn(() => tournamentDoc) });
    (readEventScoreboardAggregate as jest.Mock).mockResolvedValue({
      eventRows: [{ playerId: "p1" }],
      teamRows: null,
      fivesCombinedRows: null,
      event: { id: "e1" },
    });

    const response = await GET({
      url: "https://example.test/api/public/scoreboard?tournamentId=t1&divisionId=d1&eventId=e1",
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("59");
  });
});
