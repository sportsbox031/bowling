"use client";

import { ReactNode, useMemo } from "react";
import { GlassTable, glassTdStyle, glassTrHoverProps } from "@/components/ui";
import { getRankTextStyle } from "@/lib/constants";

type ScoreColumn = { gameNumber: number; score: number | null };

type RankingRow = {
  playerId: string;
  rank: number;
  region: string;
  affiliation: string;
  number: number;
  name: string;
  gameScores: ScoreColumn[];
  total: number;
  average: number;
  pinDiff: number;
  gameCount?: number;
};

type RankingTableProps = {
  rows: RankingRow[];
  emptyMessage: string;
  onSelectPlayer?: (playerName: string) => void;
  showOverallOnly?: boolean;
  footerSlot?: ReactNode;
};

export default function RankingTable({
  rows,
  emptyMessage,
  onSelectPlayer,
  showOverallOnly = false,
  footerSlot,
}: RankingTableProps) {
  const maxGameCount = useMemo(() => Math.max(0, ...rows.map((row) => row.gameScores.length)), [rows]);

  const headers = useMemo(() => {
    const base = ["순위", "시도", "소속", "번호", "성명"];
    const games = showOverallOnly ? [] : Array.from({ length: maxGameCount }, (_, index) => `${index + 1}G`);
    const tail = showOverallOnly ? ["합계", "평균", "핀차", "게임수"] : ["합계", "평균", "핀차"];
    return [...base, ...games, ...tail];
  }, [maxGameCount, showOverallOnly]);

  const headerAligns = useMemo(
    () => headers.map((header) => (header === "소속" || header === "성명" ? "left" : "center")) as ("left" | "center")[],
    [headers],
  );

  return (
    <>
      <GlassTable headers={headers} headerAligns={headerAligns} rowCount={rows.length} emptyMessage={emptyMessage}>
        {rows.map((row) => (
          <tr key={row.playerId} {...glassTrHoverProps}>
            <td style={{ ...glassTdStyle, ...getRankTextStyle(row.rank), textAlign: "center" }}>{row.rank}</td>
            <td style={{ ...glassTdStyle, textAlign: "center", color: "#64748b" }}>{row.region}</td>
            <td style={glassTdStyle}>{row.affiliation}</td>
            <td style={{ ...glassTdStyle, textAlign: "center" }}>{row.number}</td>
            <td
              style={{
                ...glassTdStyle,
                fontWeight: 600,
                color: onSelectPlayer ? "#6366f1" : "#1e293b",
                cursor: onSelectPlayer ? "pointer" : "default",
              }}
              onClick={() => onSelectPlayer?.(row.name)}
            >
              {row.name}
            </td>
            {!showOverallOnly &&
              Array.from({ length: maxGameCount }, (_, index) => (
                <td key={`${row.playerId}-${index}`} style={{ ...glassTdStyle, textAlign: "center" }}>
                  {row.gameScores[index]?.score ?? ""}
                </td>
              ))}
            <td style={{ ...glassTdStyle, textAlign: "center", fontWeight: 700 }}>{row.total}</td>
            <td style={{ ...glassTdStyle, textAlign: "center", color: "#6366f1", fontWeight: 600 }}>{row.average}</td>
            <td style={{ ...glassTdStyle, textAlign: "center", color: "#64748b" }}>{row.pinDiff}</td>
            {showOverallOnly && <td style={{ ...glassTdStyle, textAlign: "center" }}>{row.gameCount ?? row.gameScores.length}</td>}
          </tr>
        ))}
      </GlassTable>
      {footerSlot}
    </>
  );
}
