"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlassButton, GlassSelect } from "@/components/ui";
import { GENDER_LABELS } from "@/lib/constants";

/* ── Types ── */
type Player = { id: string; number: number; name: string; affiliation: string };
type EventInfo = {
  id: string; title: string; kind: string; gameCount: number;
  scheduleDate: string; laneStart: number; laneEnd: number;
  tableShift: number; halfType?: "FIRST" | "SECOND";
};
type Assignment = { id: string; playerId: string; gameNumber: number; laneNumber: number; squadId?: string };
type Squad = { id: string; name: string };
type Team = { id: string; name: string; teamType: string; memberIds: string[] };
type ScoreColumn = { gameNumber: number; score: number | null };
type EventRankingRow = {
  playerId: string; number: number; name: string; affiliation: string;
  gameScores: ScoreColumn[]; total: number;
};
type DivisionMeta = { id: string; title: string; gender: string };
type EventMeta = { id: string; title: string; kind: string; divisionId: string };
type TournamentData = {
  tournament: { id: string; title: string; host: string; startsAt: string; endsAt: string };
  divisions: DivisionMeta[];
  eventsByDivision: Record<string, EventMeta[]>;
};

/* ── One sheet per lane ── */
type LaneSheet = {
  laneNumber: number;
  squadLabel: string;
  groups: {
    groupName: string;
    players: { playerId: string; number: number; name: string; gameScore: number | null }[];
  }[];
  totalPlayers: number;
};

/* ── Print CSS ── */
const printStyles = `
@media print {
  @page { size: A4 portrait; margin: 8mm; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body::before, body::after { display: none !important; }
  header, nav, .no-print { display: none !important; }
  main { max-width: none !important; margin: 0 !important; padding: 0 !important; }
  .score-print-container { padding: 0 !important; max-width: none !important; }
  .score-page {
    box-shadow: none !important; margin: 0 !important;
    page-break-after: always; page-break-inside: avoid;
  }
}
@media screen {
  .score-page { box-shadow: 0 2px 12px rgba(0,0,0,0.08); margin-bottom: 24px; background: #fff; }
}
`;

const th: React.CSSProperties = {
  padding: "5px 6px", fontWeight: 700, fontSize: 11, color: "#1a1a1a",
  border: "1.5px solid #333", background: "#f0f0f0", textAlign: "center", whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "5px 4px", fontSize: 11, color: "#1a1a1a",
  border: "1px solid #666", textAlign: "center", whiteSpace: "nowrap", verticalAlign: "middle",
  height: 24,
};

export default function ScoreSignaturePrintPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const searchParams = useSearchParams();
  const qDiv = searchParams.get("divisionId") ?? "";
  const qEvt = searchParams.get("eventId") ?? "";

  const [data, setData] = useState<TournamentData | null>(null);
  const [divId, setDivId] = useState(qDiv);
  const [evtId, setEvtId] = useState(qEvt);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [eventRows, setEventRows] = useState<EventRankingRow[]>([]);
  const [squadId, setSquadId] = useState("__all__");
  const [gameNum, setGameNum] = useState(1);
  const [loading, setLoading] = useState(true);

  // Load tournament metadata
  useEffect(() => {
    if (!tournamentId) return;
    fetch(`/api/public/tournaments/${tournamentId}`)
      .then((r) => r.json())
      .then((d: TournamentData) => {
        setData(d);
        if (!divId && d.divisions.length > 0) setDivId(d.divisions[0].id);
      })
      .catch(() => {});
  }, [tournamentId]);

  useEffect(() => {
    if (!data || !divId) return;
    const events = data.eventsByDivision[divId] ?? [];
    if (events.length > 0 && !events.find((e) => e.id === evtId)) setEvtId(events[0].id);
  }, [data, divId]);

  useEffect(() => {
    if (!tournamentId || !divId || !evtId) return;
    setLoading(true);
    fetch(`/api/admin/tournaments/${tournamentId}/divisions/${divId}/events/${evtId}/bundle`)
      .then((r) => r.json())
      .then((d) => {
        setEvent(d.event ?? null);
        setPlayers(d.players ?? []);
        setAssignments(d.assignments ?? []);
        setSquads(d.squads ?? []);
        setTeams(d.teams ?? []);
        setEventRows(d.eventRows ?? []);
        // Default game to gameCount (last game)
        if (d.event?.gameCount) setGameNum(d.event.gameCount);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tournamentId, divId, evtId]);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const scoreMap = useMemo(() => new Map(eventRows.map((r) => [r.playerId, r])), [eventRows]);

  const div = data?.divisions.find((d) => d.id === divId);
  const divLabel = div ? `${div.title} ${GENDER_LABELS[div.gender] ?? ""}` : "";
  const halfLabel = event?.halfType === "FIRST" ? "전반" : event?.halfType === "SECOND" ? "후반" : "";
  const isTeamEvent = event ? ["DOUBLES", "TRIPLES", "FIVES"].includes(event.kind) : false;

  // Build one sheet per lane
  const sheets = useMemo((): LaneSheet[] => {
    if (!event) return [];

    // Filter assignments for the selected game number
    const relevant = squadId === "__all__"
      ? assignments.filter((a) => a.gameNumber === gameNum)
      : assignments.filter((a) => a.gameNumber === gameNum && a.squadId === squadId);

    // Group by lane
    const laneMap = new Map<number, Assignment[]>();
    for (const a of relevant) {
      if (!laneMap.has(a.laneNumber)) laneMap.set(a.laneNumber, []);
      laneMap.get(a.laneNumber)!.push(a);
    }

    const sqName = (sid?: string) => sid ? squads.find((s) => s.id === sid)?.name ?? "" : "";
    const getGameScore = (pid: string) => {
      const row = scoreMap.get(pid);
      if (!row) return null;
      const gs = row.gameScores.find((g) => g.gameNumber === gameNum);
      return gs?.score ?? null;
    };

    const result: LaneSheet[] = [];

    for (const laneNum of [...laneMap.keys()].sort((a, b) => a - b)) {
      const laneAssigns = laneMap.get(laneNum)!;
      const groups: LaneSheet["groups"] = [];

      if (isTeamEvent && teams.length > 0) {
        // Group by team within this lane
        const teamGroups = new Map<string, string[]>();
        const noTeam: string[] = [];
        for (const a of laneAssigns) {
          const team = teams.find((t) => t.memberIds.includes(a.playerId));
          if (team) {
            if (!teamGroups.has(team.id)) teamGroups.set(team.id, []);
            teamGroups.get(team.id)!.push(a.playerId);
          } else {
            noTeam.push(a.playerId);
          }
        }
        for (const [teamId, pids] of teamGroups) {
          const team = teams.find((t) => t.id === teamId)!;
          groups.push({
            groupName: team.name,
            players: pids.map((pid) => {
              const p = playerMap.get(pid);
              return { playerId: pid, number: p?.number ?? 0, name: p?.name ?? "", gameScore: getGameScore(pid) };
            }),
          });
        }
        if (noTeam.length > 0) {
          groups.push({
            groupName: "",
            players: noTeam.map((pid) => {
              const p = playerMap.get(pid);
              return { playerId: pid, number: p?.number ?? 0, name: p?.name ?? "", gameScore: getGameScore(pid) };
            }),
          });
        }
      } else {
        // Individual: group by affiliation
        const affGroups = new Map<string, string[]>();
        for (const a of laneAssigns) {
          const p = playerMap.get(a.playerId);
          const aff = p?.affiliation || "(미소속)";
          if (!affGroups.has(aff)) affGroups.set(aff, []);
          affGroups.get(aff)!.push(a.playerId);
        }
        for (const [aff, pids] of affGroups) {
          groups.push({
            groupName: aff,
            players: pids.map((pid) => {
              const p = playerMap.get(pid);
              return { playerId: pid, number: p?.number ?? 0, name: p?.name ?? "", gameScore: getGameScore(pid) };
            }),
          });
        }
      }

      const totalPlayers = groups.reduce((sum, g) => sum + g.players.length, 0);
      result.push({
        laneNumber: laneNum,
        squadLabel: sqName(laneAssigns[0]?.squadId),
        groups,
        totalPlayers,
      });
    }

    return result;
  }, [event, assignments, gameNum, squadId, squads, teams, playerMap, scoreMap, isTeamEvent]);

  // Pack sheets onto A4 pages in 2-column grid
  // A4 portrait usable: ~190mm x 277mm (with 8mm margins + extra)
  // Each sheet height estimate in mm: header(14) + rows*6.5 + footer(8) + gap(4)
  const COL_PAGE_H_MM = 270; // usable height per column in mm
  const sheetHeightMm = (s: LaneSheet) => 14 + s.totalPlayers * 6.5 + 8 + 4;

  const pages = useMemo(() => {
    // Fill 2 columns per page greedily
    const result: LaneSheet[][] = [];
    let colHeights = [0, 0]; // height of each column
    let page: LaneSheet[] = [];

    for (const s of sheets) {
      const h = sheetHeightMm(s);
      // Find shortest column
      const col = colHeights[0] <= colHeights[1] ? 0 : 1;
      if (colHeights[col] + h > COL_PAGE_H_MM && page.length > 0) {
        // Both columns full, start new page
        if (colHeights[0] + h > COL_PAGE_H_MM && colHeights[1] + h > COL_PAGE_H_MM) {
          result.push(page);
          page = [];
          colHeights = [0, 0];
        }
      }
      const insertCol = colHeights[0] <= colHeights[1] ? 0 : 1;
      colHeights[insertCol] += h;
      page.push(s);
    }
    if (page.length > 0) result.push(page);
    return result;
  }, [sheets]);

  return (
    <>
      <style>{printStyles}</style>
      <div className="score-print-container" style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
        {/* Controls */}
        <div className="no-print" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
            <Link href={`/admin/tournaments/${tournamentId}`}>
              <GlassButton size="sm">← 대회관리</GlassButton>
            </Link>
            <Link href={`/admin/tournaments/${tournamentId}/scoreboard?divisionId=${divId}&eventId=${evtId}`}>
              <GlassButton size="sm" variant="secondary">📋 점수판</GlassButton>
            </Link>
            <GlassButton size="sm" variant="secondary" onClick={() => window.print()}>
              🖨️ 인쇄
            </GlassButton>
            <span style={{ fontSize: 13, color: "#64748b" }}>
              총 <strong style={{ color: "#6366f1" }}>{sheets.length}</strong>장 ·
              <strong style={{ color: "#6366f1" }}> {pages.length}</strong>페이지
            </span>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            {/* Game number selector */}
            {event && (
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 4 }}>게임</label>
                <GlassSelect value={String(gameNum)} onChange={(e) => setGameNum(Number(e.target.value))}>
                  {Array.from({ length: event.gameCount }, (_, i) => (
                    <option key={i + 1} value={String(i + 1)}>{i + 1}G</option>
                  ))}
                </GlassSelect>
              </div>
            )}
            {squads.length > 0 && (
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 4 }}>스쿼드</label>
                <GlassSelect value={squadId} onChange={(e) => setSquadId(e.target.value)}>
                  <option value="__all__">전체</option>
                  {squads.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </GlassSelect>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>로딩 중...</div>
        ) : !event ? (
          <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>데이터를 불러올 수 없습니다.</div>
        ) : sheets.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>
            레인 배정 데이터가 없습니다.
          </div>
        ) : (
          pages.map((pageSheets, pi) => (
            <div key={pi} className="score-page" style={{
              padding: "8mm 10mm", boxSizing: "border-box",
              fontFamily: "'Noto Sans KR', sans-serif",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px 16px",
              alignContent: "start",
            }}>
              {pageSheets.map((sheet, si) => (
                <div key={`${pi}-${si}`}>
                  {/* Sheet header */}
                  <div style={{ textAlign: "center", marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>
                      {divLabel} {event.title} {halfLabel} {sheet.squadLabel && ` ${sheet.squadLabel}`}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#333" }}>
                      <span>{event.scheduleDate}</span>
                      <span style={{ fontWeight: 700 }}>레인번호 &nbsp; {sheet.laneNumber}</span>
                    </div>
                  </div>

                  {/* Score table */}
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1.5px solid #333" }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, width: 60 }}>소속</th>
                        <th style={{ ...th, width: 34 }}>번호</th>
                        <th style={th}>성명</th>
                        <th style={{ ...th, width: 40 }}>{gameNum}G</th>
                        <th style={{ ...th, width: 56 }}>서명</th>
                        <th style={{ ...th, width: 30 }}>비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.groups.map((group, gi) =>
                        group.players.map((p, idx) => (
                          <tr key={p.playerId}>
                            {idx === 0 && (
                              <td
                                rowSpan={group.players.length}
                                style={{ ...td, fontWeight: 700, fontSize: 10, verticalAlign: "middle" }}
                              >
                                {group.groupName}
                              </td>
                            )}
                            <td style={td}>{p.number}</td>
                            <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                            <td style={td}>{p.gameScore ?? ""}</td>
                            <td style={{ ...td, minWidth: 40 }}></td>
                            <td style={td}></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Footer */}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "#555" }}>
                    <span>점수확인후 서명하세요</span>
                    <span>{data?.tournament.host ?? ""}</span>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}
