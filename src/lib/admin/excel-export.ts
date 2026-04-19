import * as XLSX from "xlsx";

export interface ExportEventRow {
  rank: number;
  tieRank: number;
  attempts: number;
  region: string;
  affiliation: string;
  group?: string;
  number: number;
  name: string;
  gameScores: Array<{ gameNumber: number; score: number | null }>;
  total: number;
  average: number;
  pinDiff: number;
}

export interface ExportPlayer {
  group: string;
  region: string;
  affiliation: string;
  number: number;
  name: string;
  hand: string;
  divisionTitle?: string;
}

export interface ExportWinner {
  rank: number;
  name: string;
  affiliation: string;
  region: string;
  total: number;
}

export interface ExportEventMedal {
  eventTitle: string;
  eventKind: string;
  halfType?: string;
  winners: ExportWinner[];
}

export interface ExportDivisionSummary {
  divisionTitle: string;
  gender: string;
  eventMedals: ExportEventMedal[];
}

export interface ExportSummaryData {
  tournament: { title: string; host: string; startsAt: string; endsAt: string };
  divisions: ExportDivisionSummary[];
}

const GENDER_LABELS: Record<string, string> = { M: "남자", F: "여자", MIXED: "혼합" };
const HALF_TYPE_LABELS: Record<string, string> = { FIRST: "전반", SECOND: "후반" };
const HAND_LABELS: Record<string, string> = { left: "왼손", right: "오른손" };
const RANK_LABELS = ["우승", "준우승", "3위", "4위"];

/** 이벤트 성적표 엑셀 내보내기 */
export function exportEventScoreboard(rows: ExportEventRow[], eventTitle: string, tournamentTitle: string): void {
  const gameCount = rows[0]?.gameScores.length ?? 0;
  const gameHeaders = Array.from({ length: gameCount }, (_, i) => `${i + 1}G`);

  const headers = ["순위", "시도", "소속", "조", "번호", "성명", ...gameHeaders, "합계", "평균", "핀차이"];

  const dataRows = rows.map((r) => [
    r.rank,
    r.attempts,
    r.affiliation,
    r.group ?? "",
    r.number,
    r.name,
    ...r.gameScores.map((g) => g.score ?? ""),
    r.total,
    r.average,
    r.pinDiff,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

  // 컬럼 너비 설정
  ws["!cols"] = [
    { wch: 6 },  // 순위
    { wch: 6 },  // 시도
    { wch: 18 }, // 소속
    { wch: 5 },  // 조
    { wch: 7 },  // 번호
    { wch: 12 }, // 성명
    ...gameHeaders.map(() => ({ wch: 8 })),
    { wch: 8 },  // 합계
    { wch: 8 },  // 평균
    { wch: 8 },  // 핀차이
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "성적표");
  XLSX.writeFile(wb, `${tournamentTitle}_${eventTitle}_성적표.xlsx`);
}

/** 선수 명단 엑셀 내보내기 */
export function exportPlayerList(players: ExportPlayer[], tournamentTitle: string): void {
  const hasDivision = players.some((p) => p.divisionTitle);
  const headers = hasDivision
    ? ["조", "종별", "시도", "소속", "번호", "성명", "손"]
    : ["조", "시도", "소속", "번호", "성명", "손"];

  const dataRows = players.map((p) => {
    const hand = HAND_LABELS[p.hand] ?? p.hand;
    return hasDivision
      ? [p.group, p.divisionTitle ?? "", p.region, p.affiliation, p.number, p.name, hand]
      : [p.group, p.region, p.affiliation, p.number, p.name, hand];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  ws["!cols"] = hasDivision
    ? [{ wch: 5 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 7 }, { wch: 12 }, { wch: 8 }]
    : [{ wch: 5 }, { wch: 12 }, { wch: 18 }, { wch: 7 }, { wch: 12 }, { wch: 8 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "선수명단");
  XLSX.writeFile(wb, `${tournamentTitle}_선수명단.xlsx`);
}

/** 종합집계표 엑셀 내보내기 */
export function exportTournamentSummary(data: ExportSummaryData): void {
  const { tournament, divisions } = data;
  const wb = XLSX.utils.book_new();

  for (const div of divisions) {
    const genderLabel = GENDER_LABELS[div.gender] ?? div.gender;
    const sheetName = `${div.divisionTitle} ${genderLabel}`.slice(0, 31); // Excel sheet name max 31 chars

    const allRows: (string | number)[][] = [];

    // 대회 헤더
    allRows.push([`${tournament.title} 종합집계표`]);
    allRows.push([`주최: ${tournament.host}`, "", `${tournament.startsAt} ~ ${tournament.endsAt}`]);
    allRows.push([]);

    for (const ev of div.eventMedals) {
      const halfLabel = ev.halfType ? ` (${HALF_TYPE_LABELS[ev.halfType] ?? ev.halfType})` : "";
      allRows.push([`■ ${ev.eventTitle}${halfLabel}`]);
      allRows.push(["순위", "성명", "소속", "시도", "합계"]);

      for (const w of ev.winners) {
        const rankLabel = RANK_LABELS[w.rank - 1] ?? `${w.rank}위`;
        allRows.push([rankLabel, w.name, w.affiliation, w.region, w.total]);
      }
      allRows.push([]);
    }

    // 종합 메달 집계
    const tallyMap = new Map<string, { gold: number; silver: number; bronze: number; fourth: number }>();
    for (const ev of div.eventMedals) {
      for (const w of ev.winners) {
        const key = w.affiliation || "(미소속)";
        if (!tallyMap.has(key)) tallyMap.set(key, { gold: 0, silver: 0, bronze: 0, fourth: 0 });
        const t = tallyMap.get(key)!;
        if (w.rank === 1) t.gold++;
        else if (w.rank === 2) t.silver++;
        else if (w.rank === 3) t.bronze++;
        else if (w.rank === 4) t.fourth++;
      }
    }
    const tally = [...tallyMap.entries()].sort(([, a], [, b]) => {
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      return b.fourth - a.fourth;
    });

    if (tally.length > 0) {
      allRows.push(["■ 소속별 메달 집계"]);
      allRows.push(["순위", "소속", "금", "은", "동", "4위"]);
      tally.forEach(([affiliation, counts], idx) => {
        allRows.push([idx + 1, affiliation, counts.gold, counts.silver, counts.bronze, counts.fourth]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(allRows);
    ws["!cols"] = [{ wch: 8 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 8 }, { wch: 6 }];
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  XLSX.writeFile(wb, `${tournament.title}_종합집계표.xlsx`);
}
