import { buildPlayerRankingRows } from "../src/lib/aggregates/player-rankings.ts";

const agg = new Map([
  [
    "P0001",
    {
      shortId: "P0001",
      name: "김철수",
      regions: new Set(["서울", "경기"]),
      affiliations: new Set(["A중", "A고"]),
      totalScore: 600,
      totalGames: 3,
      highGame: 240,
      tournamentIds: new Set(["t1", "t2"]),
    },
  ],
  [
    "P0002",
    {
      shortId: "P0002",
      name: "박영희",
      regions: new Set(["부산"]),
      affiliations: new Set(["B중"]),
      totalScore: 590,
      totalGames: 3,
      highGame: 250,
      tournamentIds: new Set(["t1"]),
    },
  ],
]);

const rows = buildPlayerRankingRows(agg);

if (rows.length !== 2) {
  throw new Error(`Expected 2 rows, got ${rows.length}`);
}

if (rows[0]?.name !== "김철수" || rows[0]?.rank !== 1 || rows[0]?.average !== 200) {
  throw new Error(`Unexpected first row: ${JSON.stringify(rows[0])}`);
}

if (rows[1]?.name !== "박영희" || rows[1]?.rank !== 2) {
  throw new Error(`Unexpected second row: ${JSON.stringify(rows[1])}`);
}

console.log("player-rankings aggregate test passed");

