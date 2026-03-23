import { resolveEventRef } from "@/lib/firebase/eventPath";
import { readPublicTournamentAggregate } from "@/lib/aggregates/public-tournament";

jest.mock("@/lib/aggregates/public-tournament", () => ({
  readPublicTournamentAggregate: jest.fn(),
}));

describe("resolveEventRef", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the direct event path without scanning divisions when divisionId is provided", async () => {
    const directGet = jest.fn().mockResolvedValue({ exists: true });
    const directRef = { get: directGet };
    const eventsCollection = { doc: jest.fn(() => directRef) };
    const divisionDoc = { collection: jest.fn(() => eventsCollection) };
    const divisionsCollection = {
      doc: jest.fn(() => divisionDoc),
      get: jest.fn(),
    };
    const tournamentDoc = {
      collection: jest.fn(() => divisionsCollection),
    };
    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => tournamentDoc),
      })),
    };

    const resolved = await resolveEventRef(db as never, "t1", "e1", "d1");

    expect(resolved).toEqual({ divisionId: "d1", ref: directRef });
    expect(directGet).toHaveBeenCalledTimes(1);
    expect(readPublicTournamentAggregate).not.toHaveBeenCalled();
    expect(divisionsCollection.get).not.toHaveBeenCalled();
  });

  it("falls back to the division scan when divisionId is omitted", async () => {
    (readPublicTournamentAggregate as jest.Mock).mockResolvedValue(null);

    const missingEventRef = { get: jest.fn().mockResolvedValue({ exists: false }) };
    const foundEventRef = { get: jest.fn().mockResolvedValue({ exists: true }) };
    const eventsByDivision: Record<string, { doc: jest.Mock }> = {
      d1: { doc: jest.fn(() => missingEventRef) },
      d2: { doc: jest.fn(() => foundEventRef) },
    };
    const divisionDocs = [{ id: "d1" }, { id: "d2" }];
    const divisionsCollection = {
      doc: jest.fn((divisionId: string) => ({
        collection: jest.fn(() => eventsByDivision[divisionId]),
      })),
      get: jest.fn().mockResolvedValue({ docs: divisionDocs }),
    };
    const tournamentDoc = {
      collection: jest.fn(() => divisionsCollection),
    };
    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => tournamentDoc),
      })),
    };

    const resolved = await resolveEventRef(db as never, "t1", "e1");

    expect(readPublicTournamentAggregate).toHaveBeenCalledTimes(1);
    expect(divisionsCollection.get).toHaveBeenCalledTimes(1);
    expect(missingEventRef.get).toHaveBeenCalledTimes(1);
    expect(foundEventRef.get).toHaveBeenCalledTimes(1);
    expect(resolved).toEqual({ divisionId: "d2", ref: foundEventRef });
  });
});
