import {
  computeEventAssignmentsAggregate,
  readEventAssignmentsAggregate,
  rebuildEventAssignmentsAggregate,
} from "@/lib/aggregates/event-assignments";

type DocData = Record<string, unknown>;

class FakeDocSnapshot {
  constructor(
    public readonly id: string,
    private readonly value: DocData | undefined,
  ) {}

  get exists() {
    return this.value !== undefined;
  }

  data() {
    return this.value;
  }
}

class FakeQueryDocumentSnapshot extends FakeDocSnapshot {
  override get exists() {
    return true;
  }

  override data() {
    return super.data() ?? {};
  }
}

class FakeQuerySnapshot {
  constructor(public readonly docs: FakeQueryDocumentSnapshot[]) {}

  get size() {
    return this.docs.length;
  }
}

class FakeCollectionRef {
  constructor(
    private readonly docs: Record<string, DocData>,
    private readonly orderedIds?: string[],
  ) {}

  async get() {
    const ids = this.orderedIds ?? Object.keys(this.docs);
    return new FakeQuerySnapshot(ids.map((id) => new FakeQueryDocumentSnapshot(id, this.docs[id])));
  }

  orderBy(_field: string) {
    return this;
  }
}

class FakeAggregateDocRef {
  constructor(private readonly store: Map<string, DocData>, private readonly path: string) {}

  async get() {
    return new FakeDocSnapshot("assignments", this.store.get(this.path));
  }

  async set(data: DocData) {
    this.store.set(this.path, data);
  }
}

class FakeEventDocRef {
  constructor(
    private readonly eventData: DocData | undefined,
    private readonly assignments: Record<string, DocData>,
    private readonly squads: Record<string, DocData>,
  ) {}

  async get() {
    return new FakeDocSnapshot("event", this.eventData);
  }

  collection(name: string) {
    if (name === "assignments") {
      return new FakeCollectionRef(this.assignments, ["a2", "a1", "a3"]);
    }
    if (name === "squads") {
      return new FakeCollectionRef(this.squads);
    }
    throw new Error(`Unknown event collection: ${name}`);
  }
}

class FakeDivisionDocRef {
  constructor(
    private readonly eventData: DocData | undefined,
    private readonly assignments: Record<string, DocData>,
    private readonly squads: Record<string, DocData>,
  ) {}

  collection(name: string) {
    if (name !== "events") {
      throw new Error(`Unknown division collection: ${name}`);
    }
    return {
      doc: (_eventId: string) => new FakeEventDocRef(this.eventData, this.assignments, this.squads),
    };
  }
}

class FakeTournamentDocRef {
  constructor(
    private readonly eventData: DocData | undefined,
    private readonly assignments: Record<string, DocData>,
    private readonly players: Record<string, DocData>,
    private readonly squads: Record<string, DocData>,
  ) {}

  collection(name: string) {
    if (name === "divisions") {
      return {
        doc: (_divisionId: string) => new FakeDivisionDocRef(this.eventData, this.assignments, this.squads),
      };
    }
    if (name === "players") {
      return {
        where: (_field: string, _op: string, _value: string) => new FakeCollectionRef(this.players),
      };
    }
    throw new Error(`Unknown tournament collection: ${name}`);
  }
}

class FakeFirestore {
  private readonly aggregateStore = new Map<string, DocData>();

  constructor(
    private readonly eventData: DocData | undefined,
    private readonly assignments: Record<string, DocData>,
    private readonly players: Record<string, DocData>,
    private readonly squads: Record<string, DocData>,
  ) {}

  collection(name: string) {
    if (name !== "tournaments") {
      throw new Error(`Unknown root collection: ${name}`);
    }
    return {
      doc: (_tournamentId: string) => new FakeTournamentDocRef(this.eventData, this.assignments, this.players, this.squads),
    };
  }

  doc(path: string) {
    return new FakeAggregateDocRef(this.aggregateStore, path);
  }
}

describe("event assignments aggregate", () => {
  const eventData = {
    title: "Singles",
    kind: "SINGLES",
    gameCount: 3,
    laneStart: 1,
    laneEnd: 8,
    tableShift: 2,
  };

  const assignments = {
    a1: { playerId: "p1", gameNumber: 1, laneNumber: 5, position: 2, squadId: "sq-2" },
    a2: { playerId: "p2", gameNumber: 1, laneNumber: 5, position: 1, squadId: "sq-1" },
    a3: { playerId: "missing", gameNumber: 2, laneNumber: 7, squadId: null },
  };

  const players = {
    p1: { name: "Kim", number: 11, affiliation: "Club A", region: "Seoul" },
    p2: { name: "Lee", number: 22, affiliation: "Club B", region: "Busan" },
  };

  const squads = {
    "sq-1": { name: "Morning" },
    "sq-2": {},
  };

  it("computes joined and position-sorted assignments with event metadata", async () => {
    const db = new FakeFirestore(eventData, assignments, players, squads);

    const payload = await computeEventAssignmentsAggregate(db as never, "t1", "d1", "e1");

    expect(payload.event).toEqual({
      id: "e1",
      title: "Singles",
      kind: "SINGLES",
      gameCount: 3,
      laneStart: 1,
      laneEnd: 8,
      tableShift: 2,
    });
    expect(payload.squads).toEqual([
      { id: "sq-1", name: "Morning" },
      { id: "sq-2", name: "sq-2" },
    ]);
    expect(payload.assignments).toEqual([
      {
        playerId: "p2",
        gameNumber: 1,
        laneNumber: 5,
        position: 1,
        squadId: "sq-1",
        playerName: "Lee",
        playerNumber: 22,
        affiliation: "Club B",
        region: "Busan",
      },
      {
        playerId: "p1",
        gameNumber: 1,
        laneNumber: 5,
        position: 2,
        squadId: "sq-2",
        playerName: "Kim",
        playerNumber: 11,
        affiliation: "Club A",
        region: "Seoul",
      },
      {
        playerId: "missing",
        gameNumber: 2,
        laneNumber: 7,
        position: null,
        squadId: null,
        playerName: "",
        playerNumber: 0,
        affiliation: "",
        region: "",
      },
    ]);
    expect(new Date(payload.updatedAt).toISOString()).toBe(payload.updatedAt);
  });

  it("rebuilds and then reads the aggregate document", async () => {
    const db = new FakeFirestore(eventData, assignments, players, squads);

    const written = await rebuildEventAssignmentsAggregate(db as never, "t1", "d1", "e1");
    const readBack = await readEventAssignmentsAggregate(db as never, "t1", "d1", "e1");

    expect(readBack).toEqual(written);
  });

  it("returns null when the aggregate document is absent", async () => {
    const db = new FakeFirestore(eventData, assignments, players, squads);

    const payload = await readEventAssignmentsAggregate(db as never, "t1", "d1", "e1");

    expect(payload).toBeNull();
  });
});
