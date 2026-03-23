import {
  buildEventLeaderboard,
  buildOverallLeaderboard,
  buildTeamLeaderboard,
  buildFivesLinkedLeaderboard,
  MAX_GAME_COUNT,
  EventRankingInput,
  OverallRankingInput,
  TeamRankingInput,
  FivesLinkedInput,
} from "../scoring";
import type { Player, ScoreRow, Team, EventRankingRow, TeamRankingRow } from "../models";

// ── Test Helpers ──────────────────────────────────────────────

const makePlayer = (overrides: Partial<Player> & { id: string }): Player => ({
  tournamentId: "t1",
  divisionId: "d1",
  group: "A",
  region: "서울",
  affiliation: "테스트클럽",
  number: 1,
  name: "선수",
  hand: "right",
  createdAt: "2025-01-01",
  ...overrides,
});

const makeScore = (
  playerId: string,
  gameNumber: number,
  score: number,
  overrides?: Partial<ScoreRow>,
): ScoreRow => ({
  id: `${playerId}_${gameNumber}`,
  tournamentId: "t1",
  eventId: "e1",
  playerId,
  gameNumber,
  laneNumber: 1,
  score,
  createdAt: "2025-01-01",
  ...overrides,
});

const makeTeam = (overrides: Partial<Team> & { id: string; memberIds: string[] }): Team => ({
  tournamentId: "t1",
  divisionId: "d1",
  eventId: "e1",
  name: "팀",
  teamType: "NORMAL",
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
  ...overrides,
});

// ── buildEventLeaderboard ─────────────────────────────────────

describe("buildEventLeaderboard", () => {
  describe("기본 동작", () => {
    it("선수 없이 호출하면 빈 결과를 반환한다", () => {
      const result = buildEventLeaderboard({
        players: [],
        scores: [],
        gameCount: 3,
      });
      expect(result.rows).toEqual([]);
    });

    it("점수 없는 선수도 리더보드에 포함된다", () => {
      const players = [makePlayer({ id: "p1", name: "김철수" })];
      const result = buildEventLeaderboard({
        players,
        scores: [],
        gameCount: 3,
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].playerId).toBe("p1");
      expect(result.rows[0].total).toBe(0);
      expect(result.rows[0].average).toBe(0);
      expect(result.rows[0].attempts).toBe(0);
      expect(result.rows[0].gameScores).toHaveLength(3);
      expect(result.rows[0].gameScores.every((g) => g.score === null)).toBe(true);
    });

    it("단일 선수의 점수를 올바르게 집계한다", () => {
      const players = [makePlayer({ id: "p1" })];
      const scores = [
        makeScore("p1", 1, 200),
        makeScore("p1", 2, 180),
        makeScore("p1", 3, 220),
      ];

      const result = buildEventLeaderboard({ players, scores, gameCount: 3 });
      const row = result.rows[0];

      expect(row.total).toBe(600);
      expect(row.average).toBe(200);
      expect(row.attempts).toBe(3);
      expect(row.gameScores[0].score).toBe(200);
      expect(row.gameScores[1].score).toBe(180);
      expect(row.gameScores[2].score).toBe(220);
    });
  });

  describe("순위 산정", () => {
    it("총점 내림차순으로 순위를 매긴다", () => {
      const players = [
        makePlayer({ id: "p1", name: "3등" }),
        makePlayer({ id: "p2", name: "1등" }),
        makePlayer({ id: "p3", name: "2등" }),
      ];
      const scores = [
        makeScore("p1", 1, 100),
        makeScore("p2", 1, 300),
        makeScore("p3", 1, 200),
      ];

      const result = buildEventLeaderboard({ players, scores, gameCount: 1 });

      expect(result.rows[0].playerId).toBe("p2");
      expect(result.rows[0].rank).toBe(1);
      expect(result.rows[1].playerId).toBe("p3");
      expect(result.rows[1].rank).toBe(2);
      expect(result.rows[2].playerId).toBe("p1");
      expect(result.rows[2].rank).toBe(3);
    });

    it("동점자는 같은 순위를 받는다 (dense rank가 아닌 skip rank)", () => {
      const players = [
        makePlayer({ id: "p1", name: "A" }),
        makePlayer({ id: "p2", name: "B" }),
        makePlayer({ id: "p3", name: "C" }),
      ];
      const scores = [
        makeScore("p1", 1, 200),
        makeScore("p2", 1, 200),
        makeScore("p3", 1, 100),
      ];

      const result = buildEventLeaderboard({ players, scores, gameCount: 1 });

      // p1, p2 둘 다 1위, p3은 3위 (2위 건너뜀)
      expect(result.rows[0].rank).toBe(1);
      expect(result.rows[1].rank).toBe(1);
      expect(result.rows[2].rank).toBe(3);
    });
  });

  describe("타이브레이킹", () => {
    it("동점시 평균 높은 선수가 상위 순서에 온다", () => {
      const players = [
        makePlayer({ id: "p1" }),
        makePlayer({ id: "p2" }),
      ];
      // p1: 게임1=200, 게임2=미참 → total=200, avg=200, attempts=1
      // p2: 게임1=100, 게임2=100 → total=200, avg=100, attempts=2
      const scores = [
        makeScore("p1", 1, 200),
        makeScore("p2", 1, 100),
        makeScore("p2", 2, 100),
      ];

      const result = buildEventLeaderboard({ players, scores, gameCount: 2 });

      // 둘 다 total=200이지만 p1의 평균(200)이 p2(100)보다 높으므로 p1이 먼저
      expect(result.rows[0].playerId).toBe("p1");
      expect(result.rows[1].playerId).toBe("p2");
    });
  });

  describe("pinDiff 계산", () => {
    it("1위의 pinDiff는 0이다", () => {
      const players = [
        makePlayer({ id: "p1" }),
        makePlayer({ id: "p2" }),
      ];
      const scores = [
        makeScore("p1", 1, 300),
        makeScore("p2", 1, 200),
      ];

      const result = buildEventLeaderboard({ players, scores, gameCount: 1 });

      expect(result.rows[0].pinDiff).toBe(0);
      expect(result.rows[1].pinDiff).toBe(100);
    });

    it("모든 선수가 0점이면 pinDiff는 모두 0이다", () => {
      const players = [
        makePlayer({ id: "p1" }),
        makePlayer({ id: "p2" }),
      ];

      const result = buildEventLeaderboard({ players, scores: [], gameCount: 1 });

      expect(result.rows[0].pinDiff).toBe(0);
      expect(result.rows[1].pinDiff).toBe(0);
    });
  });

  describe("gameCount 정규화", () => {
    it("gameCount가 MAX_GAME_COUNT(6)를 초과하면 6으로 제한된다", () => {
      const players = [makePlayer({ id: "p1" })];
      const result = buildEventLeaderboard({ players, scores: [], gameCount: 10 });

      expect(result.rows[0].gameScores).toHaveLength(MAX_GAME_COUNT);
    });

    it("gameCount가 0 이하이면 1로 보정된다", () => {
      const players = [makePlayer({ id: "p1" })];
      const result = buildEventLeaderboard({ players, scores: [], gameCount: 0 });

      expect(result.rows[0].gameScores).toHaveLength(1);
    });

    it("gameCount가 NaN이면 1로 보정된다", () => {
      const players = [makePlayer({ id: "p1" })];
      const result = buildEventLeaderboard({ players, scores: [], gameCount: NaN });

      expect(result.rows[0].gameScores).toHaveLength(1);
    });

    it("gameCount가 소수이면 내림 처리된다", () => {
      const players = [makePlayer({ id: "p1" })];
      const result = buildEventLeaderboard({ players, scores: [], gameCount: 3.9 });

      expect(result.rows[0].gameScores).toHaveLength(3);
    });
  });

  describe("범위 밖 게임 번호 무시", () => {
    it("gameCount 범위를 벗어난 점수는 무시된다", () => {
      const players = [makePlayer({ id: "p1" })];
      const scores = [
        makeScore("p1", 1, 200),
        makeScore("p1", 4, 150), // gameCount=3이므로 무시
      ];

      const result = buildEventLeaderboard({ players, scores, gameCount: 3 });

      expect(result.rows[0].total).toBe(200);
      expect(result.rows[0].attempts).toBe(1);
    });

    it("gameNumber 0 이하의 점수는 무시된다", () => {
      const players = [makePlayer({ id: "p1" })];
      const scores = [
        makeScore("p1", 0, 100),
        makeScore("p1", -1, 100),
        makeScore("p1", 1, 200),
      ];

      const result = buildEventLeaderboard({ players, scores, gameCount: 3 });

      expect(result.rows[0].total).toBe(200);
      expect(result.rows[0].attempts).toBe(1);
    });
  });

  describe("선수 메타데이터 보존", () => {
    it("선수 정보(region, affiliation, group, number, name)가 결과에 포함된다", () => {
      const players = [
        makePlayer({
          id: "p1",
          region: "부산",
          affiliation: "부산볼링클럽",
          group: "B",
          number: 42,
          name: "박영희",
        }),
      ];

      const result = buildEventLeaderboard({ players, scores: [], gameCount: 1 });
      const row = result.rows[0];

      expect(row.region).toBe("부산");
      expect(row.affiliation).toBe("부산볼링클럽");
      expect(row.group).toBe("B");
      expect(row.number).toBe(42);
      expect(row.name).toBe("박영희");
    });
  });

  describe("평균 반올림", () => {
    it("평균을 소수점 첫째자리까지 반올림한다", () => {
      const players = [makePlayer({ id: "p1" })];
      // total=301, attempts=2 → avg=150.5
      const scores = [
        makeScore("p1", 1, 151),
        makeScore("p1", 2, 150),
      ];

      const result = buildEventLeaderboard({ players, scores, gameCount: 2 });

      expect(result.rows[0].average).toBe(150.5);
    });

    it("소수점 둘째자리에서 반올림한다 (예: 133.333→133.3)", () => {
      const players = [makePlayer({ id: "p1" })];
      const scores = [
        makeScore("p1", 1, 100),
        makeScore("p1", 2, 100),
        makeScore("p1", 3, 200),
      ];

      const result = buildEventLeaderboard({ players, scores, gameCount: 3 });

      // 400/3 = 133.333... → 133.3
      expect(result.rows[0].average).toBe(133.3);
    });
  });
});

// ── buildOverallLeaderboard ───────────────────────────────────

describe("buildOverallLeaderboard", () => {
  const makeEventRow = (
    playerId: string,
    scores: (number | null)[],
    overrides?: Partial<EventRankingRow>,
  ): EventRankingRow => {
    const gameScores = scores.map((s, i) => ({ gameNumber: i + 1, score: s }));
    const validScores = scores.filter((s): s is number => s !== null);
    const total = validScores.reduce((sum, s) => sum + s, 0);
    return {
      playerId,
      rank: 0,
      tieRank: 0,
      attempts: validScores.length,
      region: "서울",
      affiliation: "클럽",
      number: 1,
      name: "선수",
      gameScores,
      total,
      average: validScores.length > 0 ? Math.round((total / validScores.length) * 10) / 10 : 0,
      pinDiff: 0,
      ...overrides,
    };
  };

  it("빈 입력에 빈 결과를 반환한다", () => {
    const result = buildOverallLeaderboard({
      playerIds: [],
      eventRowsByEventId: {},
    });
    expect(result.rows).toEqual([]);
  });

  it("단일 이벤트의 점수를 그대로 종합한다", () => {
    const eventRows = [
      makeEventRow("p1", [200, 180]),
    ];

    const result = buildOverallLeaderboard({
      playerIds: ["p1"],
      eventRowsByEventId: { e1: eventRows },
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].total).toBe(380);
    expect(result.rows[0].rank).toBe(1);
  });

  it("여러 이벤트의 점수를 합산한다", () => {
    const result = buildOverallLeaderboard({
      playerIds: ["p1"],
      eventRowsByEventId: {
        e1: [makeEventRow("p1", [200])],
        e2: [makeEventRow("p1", [150])],
      },
    });

    expect(result.rows[0].total).toBe(350);
    expect(result.rows[0].eventTotals).toEqual({ e1: 200, e2: 150 });
  });

  it("이벤트별 게임 점수를 같은 인덱스끼리 합산한다", () => {
    const result = buildOverallLeaderboard({
      playerIds: ["p1"],
      eventRowsByEventId: {
        e1: [makeEventRow("p1", [200, 180])],
        e2: [makeEventRow("p1", [150, 170])],
      },
    });

    // gameScores[0] = 200+150=350, gameScores[1] = 180+170=350
    expect(result.rows[0].gameScores[0].score).toBe(350);
    expect(result.rows[0].gameScores[1].score).toBe(350);
  });

  it("총점으로 종합 순위를 매긴다", () => {
    const result = buildOverallLeaderboard({
      playerIds: ["p1", "p2", "p3"],
      eventRowsByEventId: {
        e1: [
          makeEventRow("p1", [100]),
          makeEventRow("p2", [300]),
          makeEventRow("p3", [200]),
        ],
      },
    });

    expect(result.rows[0].playerId).toBe("p2");
    expect(result.rows[0].rank).toBe(1);
    expect(result.rows[2].playerId).toBe("p1");
    expect(result.rows[2].rank).toBe(3);
  });

  it("이벤트에 없는 playerIds도 결과에 포함된다", () => {
    const result = buildOverallLeaderboard({
      playerIds: ["p1", "p2"],
      eventRowsByEventId: {
        e1: [makeEventRow("p1", [200])],
        // p2는 이벤트 데이터 없음
      },
    });

    expect(result.rows).toHaveLength(2);
    const p2Row = result.rows.find((r) => r.playerId === "p2");
    expect(p2Row).toBeDefined();
    expect(p2Row!.total).toBe(0);
  });

  it("평균은 전체 게임 수 기준으로 계산한다", () => {
    const result = buildOverallLeaderboard({
      playerIds: ["p1"],
      eventRowsByEventId: {
        e1: [makeEventRow("p1", [200, 100])],      // 2 games
        e2: [makeEventRow("p1", [150, null, null])], // 1 game
      },
    });

    // total=450, gameCount=3 → avg=150
    expect(result.rows[0].average).toBe(150);
    expect(result.rows[0].gameCount).toBe(3);
  });

  it("pinDiff를 1위 대비 차이로 계산한다", () => {
    const result = buildOverallLeaderboard({
      playerIds: ["p1", "p2"],
      eventRowsByEventId: {
        e1: [
          makeEventRow("p1", [300]),
          makeEventRow("p2", [200]),
        ],
      },
    });

    expect(result.rows[0].pinDiff).toBe(0);    // 1위
    expect(result.rows[1].pinDiff).toBe(100);   // 300-200
  });
});

// ── buildTeamLeaderboard ──────────────────────────────────────

describe("buildTeamLeaderboard", () => {
  const makeIndividualRow = (
    playerId: string,
    total: number,
  ): EventRankingRow => ({
    playerId,
    rank: 0,
    tieRank: 0,
    attempts: 1,
    region: "서울",
    affiliation: "클럽",
    number: 1,
    name: "선수",
    gameScores: [{ gameNumber: 1, score: total }],
    total,
    average: total,
    pinDiff: 0,
  });

  it("팀 멤버 점수를 합산한다", () => {
    const teams = [
      makeTeam({ id: "t1", name: "A팀", memberIds: ["p1", "p2"] }),
    ];
    const playerMap = new Map<string, Player>([
      ["p1", makePlayer({ id: "p1", name: "선수1" })],
      ["p2", makePlayer({ id: "p2", name: "선수2" })],
    ]);
    const individualRows = [
      makeIndividualRow("p1", 200),
      makeIndividualRow("p2", 180),
    ];

    const result = buildTeamLeaderboard({ teams, playerMap, individualRows });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].teamTotal).toBe(380);
    expect(result.rows[0].members).toHaveLength(2);
  });

  it("MAKEUP 팀은 teamTotal이 0이다", () => {
    const teams = [
      makeTeam({ id: "t1", name: "혼성팀", teamType: "MAKEUP", memberIds: ["p1", "p2"] }),
    ];
    const playerMap = new Map<string, Player>([
      ["p1", makePlayer({ id: "p1" })],
      ["p2", makePlayer({ id: "p2" })],
    ]);
    const individualRows = [
      makeIndividualRow("p1", 200),
      makeIndividualRow("p2", 180),
    ];

    const result = buildTeamLeaderboard({ teams, playerMap, individualRows });

    expect(result.rows[0].teamTotal).toBe(0);
    expect(result.rows[0].rank).toBe(0);
  });

  it("NORMAL 팀만 순위를 매기고 MAKEUP 팀은 뒤에 배치한다", () => {
    const teams = [
      makeTeam({ id: "t1", name: "A팀", teamType: "NORMAL", memberIds: ["p1"] }),
      makeTeam({ id: "t2", name: "혼성팀", teamType: "MAKEUP", memberIds: ["p2"] }),
      makeTeam({ id: "t3", name: "B팀", teamType: "NORMAL", memberIds: ["p3"] }),
    ];
    const playerMap = new Map<string, Player>([
      ["p1", makePlayer({ id: "p1" })],
      ["p2", makePlayer({ id: "p2" })],
      ["p3", makePlayer({ id: "p3" })],
    ]);
    const individualRows = [
      makeIndividualRow("p1", 100),
      makeIndividualRow("p2", 300),
      makeIndividualRow("p3", 200),
    ];

    const result = buildTeamLeaderboard({ teams, playerMap, individualRows });

    // B팀(200) → A팀(100) → 혼성팀(0, MAKEUP)
    expect(result.rows[0].teamName).toBe("B팀");
    expect(result.rows[0].rank).toBe(1);
    expect(result.rows[1].teamName).toBe("A팀");
    expect(result.rows[1].rank).toBe(2);
    expect(result.rows[2].teamName).toBe("혼성팀");
    expect(result.rows[2].rank).toBe(0);
  });

  it("동점 팀은 같은 순위를 받는다", () => {
    const teams = [
      makeTeam({ id: "t1", name: "A팀", memberIds: ["p1"] }),
      makeTeam({ id: "t2", name: "B팀", memberIds: ["p2"] }),
    ];
    const playerMap = new Map<string, Player>([
      ["p1", makePlayer({ id: "p1" })],
      ["p2", makePlayer({ id: "p2" })],
    ]);
    const individualRows = [
      makeIndividualRow("p1", 200),
      makeIndividualRow("p2", 200),
    ];

    const result = buildTeamLeaderboard({ teams, playerMap, individualRows });

    expect(result.rows[0].rank).toBe(1);
    expect(result.rows[1].rank).toBe(1);
  });
});

// ── buildFivesLinkedLeaderboard ───────────────────────────────

describe("buildFivesLinkedLeaderboard", () => {
  const makeTeamRow = (
    teamName: string,
    teamTotal: number,
    overrides?: Partial<TeamRankingRow>,
  ): TeamRankingRow => ({
    teamId: teamName,
    teamName,
    teamType: "NORMAL",
    rank: 0,
    tieRank: 0,
    members: [],
    teamTotal,
    pinDiff: 0,
    ...overrides,
  });

  it("전반+후반 점수를 팀명으로 매칭하여 합산한다", () => {
    const result = buildFivesLinkedLeaderboard({
      firstHalfRows: [makeTeamRow("A팀", 500)],
      secondHalfRows: [makeTeamRow("A팀", 400)],
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].teamTotal).toBe(900);
  });

  it("후반에 매칭되지 않으면 전반 점수만 사용한다", () => {
    const result = buildFivesLinkedLeaderboard({
      firstHalfRows: [makeTeamRow("A팀", 500)],
      secondHalfRows: [], // 후반 데이터 없음
    });

    expect(result.rows[0].teamTotal).toBe(500);
  });

  it("MAKEUP 팀은 결과에서 제외된다", () => {
    const result = buildFivesLinkedLeaderboard({
      firstHalfRows: [
        makeTeamRow("A팀", 500),
        makeTeamRow("혼성팀", 300, { teamType: "MAKEUP" }),
      ],
      secondHalfRows: [makeTeamRow("A팀", 400)],
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].teamName).toBe("A팀");
  });

  it("후반 팀명이 바뀌어도 linkedTeamId로 전반 팀과 합산한다", () => {
    const result = buildFivesLinkedLeaderboard({
      firstHalfRows: [makeTeamRow("원소속A", 500, { teamId: "first-team-1" })],
      secondHalfRows: [makeTeamRow("원소속", 400, { teamId: "second-team-1", linkedTeamId: "first-team-1" })],
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].teamName).toBe("원소속A");
    expect(result.rows[0].teamTotal).toBe(900);
  });

  it("합산 후 순위를 올바르게 매긴다", () => {
    const result = buildFivesLinkedLeaderboard({
      firstHalfRows: [
        makeTeamRow("A팀", 500),
        makeTeamRow("B팀", 600),
      ],
      secondHalfRows: [
        makeTeamRow("A팀", 400),
        makeTeamRow("B팀", 300),
      ],
    });

    // A팀=900, B팀=900 → 둘 다 1위 (동점)
    expect(result.rows[0].rank).toBe(1);
    expect(result.rows[1].rank).toBe(1);
    expect(result.rows[0].teamTotal).toBe(900);
  });

  it("pinDiff를 1위 대비 차이로 계산한다", () => {
    const result = buildFivesLinkedLeaderboard({
      firstHalfRows: [
        makeTeamRow("A팀", 500),
        makeTeamRow("B팀", 300),
      ],
      secondHalfRows: [
        makeTeamRow("A팀", 400),
        makeTeamRow("B팀", 200),
      ],
    });

    // A팀=900(1위), B팀=500(2위)
    expect(result.rows[0].pinDiff).toBe(0);
    expect(result.rows[1].pinDiff).toBe(400);
  });
});
