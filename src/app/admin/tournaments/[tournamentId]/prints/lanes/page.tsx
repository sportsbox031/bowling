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
  scheduleDate: string; laneStart: number; laneEnd: number; tableShift: number;
};
type Assignment = { id: string; playerId: string; gameNumber: number; laneNumber: number; squadId?: string };
type Squad = { id: string; name: string };
type DivisionMeta = { id: string; title: string; gender: string };
type EventMeta = { id: string; title: string; kind: string; divisionId: string };
type TournamentData = {
  tournament: { id: string; title: string; host: string; startsAt: string; endsAt: string };
  divisions: DivisionMeta[];
  eventsByDivision: Record<string, EventMeta[]>;
};

/* ── Helpers ── */
const range = (s: number, e: number) => { const r: number[] = []; for (let i = s; i <= e; i++) r.push(i); return r; };

const buildGame1Board = (assignments: Assignment[], laneStart: number, laneEnd: number) => {
  const board: Record<number, string[]> = Object.fromEntries(range(laneStart, laneEnd).map((l) => [l, []]));
  for (const a of assignments) {
    if (a.gameNumber !== 1) continue;
    board[a.laneNumber] ??= [];
    board[a.laneNumber].push(a.playerId);
  }
  return board;
};

/* ── Print CSS ── */
const printStyles = `
@media print {
  @page { size: A4 landscape; margin: 8mm; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body::before, body::after { display: none !important; }
  header, nav, .no-print { display: none !important; }
  main { max-width: none !important; margin: 0 !important; padding: 0 !important; }
  .lane-print-container { padding: 0 !important; max-width: none !important; width: 100% !important; }
  .lane-print-page {
    box-shadow: none !important; margin: 0 !important;
    page-break-after: always; page-break-inside: avoid;
    width: 100% !important; padding: 6mm 8mm !important;
  }
}
@media screen {
  .lane-print-page { box-shadow: 0 2px 12px rgba(0,0,0,0.08); margin-bottom: 24px; background: #fff; }
}
`;

/* ── Styles ── */
const hCell: React.CSSProperties = {
  padding: "8px 4px", fontWeight: 700, fontSize: 13, color: "#1a1a1a",
  border: "1.5px solid #333", background: "#f0f0f0", textAlign: "center", whiteSpace: "nowrap",
};
const dCell: React.CSSProperties = {
  padding: "6px 4px", fontSize: 11, color: "#1a1a1a",
  border: "1px solid #888", textAlign: "center", whiteSpace: "nowrap", verticalAlign: "top",
};
const labelCell: React.CSSProperties = {
  ...dCell, fontWeight: 600, fontSize: 11, background: "#fafafa",
  border: "1px solid #666", width: 40, whiteSpace: "pre-line", verticalAlign: "middle",
};

/* ── Component ── */
export default function LanePrintPage() {
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
  const [squadId, setSquadId] = useState("__all__");
  const [loading, setLoading] = useState(true);

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
    if (events.length > 0 && !events.find((e) => e.id === evtId)) {
      setEvtId(events[0].id);
    }
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
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tournamentId, divId, evtId]);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const filtered = useMemo(
    () => squadId === "__all__" ? assignments : assignments.filter((a) => a.squadId === squadId),
    [assignments, squadId],
  );

  const board = useMemo(
    () => event ? buildGame1Board(filtered, event.laneStart, event.laneEnd) : {},
    [filtered, event],
  );

  const lanes = useMemo(() => event ? range(event.laneStart, event.laneEnd) : [], [event]);

  const maxPerLane = useMemo(() => {
    let m = 0;
    for (const pids of Object.values(board)) m = Math.max(m, pids.length);
    return Math.max(m, 4);
  }, [board]);

  const div = data?.divisions.find((d) => d.id === divId);
  const divLabel = div ? `${div.title} ${GENDER_LABELS[div.gender] ?? ""}` : "";
  const events = data?.eventsByDivision[divId] ?? [];
  const sqLabel = squadId !== "__all__" ? squads.find((s) => s.id === squadId)?.name ?? "" : "";

  const shiftLabel = event
    ? event.tableShift !== 0
      ? `${Math.abs(event.tableShift)}레인씩 ${event.tableShift > 0 ? "오른쪽" : "왼쪽"}으로 이동`
      : ""
    : "";

  // A4 landscape fits ~10 lanes well
  const LANES_PER_PAGE = 10;
  const lanePages = useMemo(() => {
    const pages: number[][] = [];
    for (let i = 0; i < lanes.length; i += LANES_PER_PAGE) {
      pages.push(lanes.slice(i, i + LANES_PER_PAGE));
    }
    return pages;
  }, [lanes]);

  // Calculate row height to fill A4 landscape vertical space
  // A4 landscape usable height ~194mm. Header ~28mm, shift label ~8mm → table area ~158mm
  // Table header row ~10mm → data rows area ~148mm
  // Divide by maxPerLane for row height
  const rowMinHeight = Math.max(Math.floor(560 / maxPerLane), 36);

  return (
    <>
      <style>{printStyles}</style>
      <div className="lane-print-container" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
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
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            {data && data.divisions.length > 1 && (
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 4 }}>종별</label>
                <GlassSelect value={divId} onChange={(e) => { setDivId(e.target.value); setEvtId(""); }}>
                  {data.divisions.map((d) => (
                    <option key={d.id} value={d.id}>{d.title} {GENDER_LABELS[d.gender] ?? ""}</option>
                  ))}
                </GlassSelect>
              </div>
            )}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 4 }}>종목</label>
              <GlassSelect value={evtId} onChange={(e) => setEvtId(e.target.value)}>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.title}</option>
                ))}
              </GlassSelect>
            </div>
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
          <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>종목을 선택해 주세요.</div>
        ) : (
          lanePages.map((pageLanes, pageIdx) => (
            <div
              key={pageIdx}
              className="lane-print-page"
              style={{
                padding: "6mm 8mm", boxSizing: "border-box",
                fontFamily: "'Noto Sans KR', sans-serif", width: "100%",
              }}
            >
              {/* Page header */}
              <div style={{ textAlign: "center", marginBottom: 10 }}>
                <h1 style={{ fontSize: 18, fontWeight: 800, color: "#1a1a1a", margin: "0 0 6px" }}>
                  {data?.tournament.title}
                </h1>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#333" }}>
                  <span>{event.scheduleDate}</span>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{divLabel} {event.title} {sqLabel}</span>
                  <span>{data?.tournament.host ?? ""}</span>
                </div>
              </div>

              {/* Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", border: "2px solid #333", tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    <th style={{ ...hCell, width: 44 }}>레인</th>
                    {pageLanes.map((l) => (<th key={l} style={hCell}>{l}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxPerLane }, (_, slot) => (
                    <tr key={slot} style={{ height: rowMinHeight }}>
                      <td style={{ ...labelCell, height: rowMinHeight }}>소속{"\n"}{slot + 1}</td>
                      {pageLanes.map((laneNum) => {
                        const pids = board[laneNum] ?? [];
                        const pid = pids[slot];
                        const p = pid ? playerMap.get(pid) : null;
                        return (
                          <td key={laneNum} style={{ ...dCell, height: rowMinHeight, verticalAlign: "middle" }}>
                            {p && (
                              <>
                                <div style={{ fontSize: 10, color: "#555", lineHeight: 1.3, marginBottom: 1 }}>{p.affiliation}</div>
                                <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.3 }}>
                                  {p.name}
                                  <span style={{ color: "#e11d48", marginLeft: 3, fontSize: 10, fontWeight: 700 }}>{p.number}</span>
                                </div>
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Table shift note */}
              {shiftLabel && (
                <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: "#333", marginTop: 8 }}>
                  {shiftLabel}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
