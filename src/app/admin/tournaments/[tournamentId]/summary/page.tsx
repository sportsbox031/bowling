"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { GlassCard, GlassButton } from "@/components/ui";

type Winner = {
  rank: number;
  playerId: string;
  name: string;
  affiliation: string;
  region: string;
  total: number;
};

type EventMedal = {
  eventId: string;
  eventTitle: string;
  eventKind: string;
  winners: Winner[];
};

type DivisionSummary = {
  divisionId: string;
  divisionTitle: string;
  gender: string;
  eventMedals: EventMedal[];
};

type TournamentInfo = {
  id: string;
  title: string;
  host: string;
  startsAt: string;
  endsAt: string;
};

type SummaryData = {
  tournament: TournamentInfo;
  divisions: DivisionSummary[];
};

const MEDAL_LABELS = ["금", "은", "동", "4위"];

const GENDER_LABELS: Record<string, string> = {
  M: "남자",
  F: "여자",
  MIXED: "혼합",
};

// 종합순위 산출: 금>은>동>4위 순 정렬
type TeamTally = {
  affiliation: string;
  gold: number;
  silver: number;
  bronze: number;
  fourth: number;
};

const buildTeamTally = (events: EventMedal[]): TeamTally[] => {
  const map = new Map<string, TeamTally>();
  for (const ev of events) {
    for (const w of ev.winners) {
      const key = w.affiliation || "(미소속)";
      if (!map.has(key)) {
        map.set(key, { affiliation: key, gold: 0, silver: 0, bronze: 0, fourth: 0 });
      }
      const t = map.get(key)!;
      if (w.rank === 1) t.gold++;
      else if (w.rank === 2) t.silver++;
      else if (w.rank === 3) t.bronze++;
      else if (w.rank === 4) t.fourth++;
    }
  }
  return [...map.values()].sort((a, b) => {
    if (b.gold !== a.gold) return b.gold - a.gold;
    if (b.silver !== a.silver) return b.silver - a.silver;
    if (b.bronze !== a.bronze) return b.bronze - a.bronze;
    return b.fourth - a.fourth;
  });
};

const RANK_LABELS = ["우 승", "준우승", "3 위", "4 위"];

const divisionLabel = (div: DivisionSummary) => {
  const g = GENDER_LABELS[div.gender] ?? "";
  return g ? `${div.divisionTitle} ${g}` : div.divisionTitle;
};

const printStyles = `
@media print {
  @page { size: A4 portrait; margin: 10mm; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body::before, body::after { display: none !important; }
  /* 레이아웃 전체 숨기기: 헤더 등 */
  header, nav, .no-print { display: none !important; }
  /* admin layout main 래퍼 padding 제거 */
  main { max-width: none !important; margin: 0 !important; padding: 0 !important; }
  .print-break { page-break-before: always; }
  .summary-container { padding: 0 !important; max-width: none !important; }
  .summary-card { box-shadow: none !important; border: none !important; background: #fff !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; padding: 0 !important; }
  table { page-break-inside: avoid; }
}
`;

export default function SummaryPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDivisionId, setSelectedDivisionId] = useState("");

  useEffect(() => {
    if (!tournamentId) return;
    setLoading(true);
    fetch(`/api/admin/tournaments/${tournamentId}/summary`)
      .then((r) => r.json())
      .then((d: SummaryData) => {
        setData(d);
        if (d.divisions.length > 0) setSelectedDivisionId(d.divisions[0].divisionId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tournamentId]);

  const selectedDivision = useMemo(
    () => data?.divisions.find((d) => d.divisionId === selectedDivisionId) ?? null,
    [data, selectedDivisionId],
  );

  const teamTally = useMemo(
    () => (selectedDivision ? buildTeamTally(selectedDivision.eventMedals) : []),
    [selectedDivision],
  );

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <div className="skeleton" style={{ width: 200, height: 24, margin: "0 auto 16px" }} />
        <div className="skeleton" style={{ width: 400, height: 300, margin: "0 auto" }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
        데이터를 불러올 수 없습니다.
      </div>
    );
  }

  const th: React.CSSProperties = {
    padding: "10px 14px",
    fontWeight: 700,
    fontSize: 14,
    color: "#1e293b",
    borderBottom: "2px solid #e2e8f0",
    background: "#f1f5f9",
    textAlign: "center",
    whiteSpace: "nowrap",
  };

  const td: React.CSSProperties = {
    padding: "10px 14px",
    fontSize: 14,
    color: "#334155",
    borderBottom: "1px solid #e2e8f0",
    textAlign: "center",
    whiteSpace: "nowrap",
  };

  return (
    <>
      <style>{printStyles}</style>
      <div className="summary-container" style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>
        {/* Navigation */}
        <div className="no-print" style={{ marginBottom: 24, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Link href={`/admin/tournaments/${tournamentId}`}>
            <GlassButton size="sm">← 대회관리</GlassButton>
          </Link>
          <Link href={`/admin/tournaments/${tournamentId}/certificates`}>
            <GlassButton size="sm" variant="secondary">🏅 상장 생성</GlassButton>
          </Link>
          <GlassButton size="sm" variant="secondary" onClick={() => window.print()}>
            🖨️ 인쇄
          </GlassButton>
        </div>

        {/* Division tabs */}
        {data.divisions.length > 1 && (
          <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {data.divisions.map((div) => (
              <GlassButton
                key={div.divisionId}
                size="sm"
                variant={selectedDivisionId === div.divisionId ? "primary" : "secondary"}
                onClick={() => setSelectedDivisionId(div.divisionId)}
              >
                {divisionLabel(div)}
              </GlassButton>
            ))}
          </div>
        )}

        {selectedDivision && (
          <GlassCard className="summary-card">
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", marginBottom: 6 }}>
                {data.tournament.title}
              </h1>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                {divisionLabel(selectedDivision)} 종합집계표
              </p>
              <p style={{ fontSize: 13, color: "#94a3b8" }}>
                {data.tournament.startsAt && data.tournament.endsAt
                  ? `${data.tournament.startsAt} ~ ${data.tournament.endsAt}`
                  : ""}
              </p>
            </div>

            {/* 종목별 메달현황 */}
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 12, textAlign: "center" }}>
              종목별 메달현황
            </h2>
            <div style={{ overflowX: "auto", marginBottom: 32 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e2e8f0" }}>
                <thead>
                  <tr>
                    <th style={th}>순 위</th>
                    <th style={th}>금</th>
                    <th style={th}>은</th>
                    <th style={th}>동</th>
                    <th style={th}>4위</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDivision.eventMedals.map((ev) => (
                    <tr key={ev.eventId}>
                      <td style={{ ...td, fontWeight: 700, background: "#f8fafc" }}>{ev.eventTitle}</td>
                      {[1, 2, 3, 4].map((rank) => {
                        const w = ev.winners.find((r) => r.rank === rank);
                        return (
                          <td key={rank} style={td}>
                            {w ? w.affiliation : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {selectedDivision.eventMedals.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ ...td, color: "#94a3b8", padding: 24 }}>
                        등록된 종목이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 종합순위 */}
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 12, textAlign: "center" }}>
              종합 순위
            </h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e2e8f0" }}>
                <thead>
                  <tr>
                    <th style={th}></th>
                    <th style={th}>팀 명</th>
                    <th style={th}>금</th>
                    <th style={th}>은</th>
                    <th style={th}>동</th>
                    <th style={th}>4위</th>
                  </tr>
                </thead>
                <tbody>
                  {teamTally.map((team, idx) => (
                    <tr key={team.affiliation}>
                      <td style={{ ...td, fontWeight: 700, background: "#f8fafc" }}>
                        {RANK_LABELS[idx] ?? `${idx + 1} 위`}
                      </td>
                      <td style={{ ...td, fontWeight: 600 }}>{team.affiliation}</td>
                      <td style={{ ...td, color: team.gold > 0 ? "#f59e0b" : undefined, fontWeight: team.gold > 0 ? 700 : 400 }}>
                        {team.gold || ""}
                      </td>
                      <td style={{ ...td, color: team.silver > 0 ? "#6366f1" : undefined, fontWeight: team.silver > 0 ? 700 : 400 }}>
                        {team.silver || ""}
                      </td>
                      <td style={{ ...td, color: team.bronze > 0 ? "#8b5cf6" : undefined, fontWeight: team.bronze > 0 ? 700 : 400 }}>
                        {team.bronze || ""}
                      </td>
                      <td style={td}>{team.fourth || ""}</td>
                    </tr>
                  ))}
                  {teamTally.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ ...td, color: "#94a3b8", padding: 24 }}>
                        집계할 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}
      </div>
    </>
  );
}
