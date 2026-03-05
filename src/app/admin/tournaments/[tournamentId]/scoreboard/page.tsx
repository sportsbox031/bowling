"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getLaneForGame } from "@/lib/lane";
import {
  GlassCard,
  GlassButton,
  GlassTable,
  GlassBadge,
  glassTdStyle,
  glassTrHoverProps,
} from "@/components/ui";

type ScoreColumn = { gameNumber: number; score: number | null };
type EventLeaderboardRow = {
  playerId: string;
  rank: number;
  tieRank: number;
  attempts: number;
  region: string;
  affiliation: string;
  number: number;
  name: string;
  gameScores: ScoreColumn[];
  total: number;
  average: number;
  pinDiff: number;
};

type OverallLeaderboardRow = EventLeaderboardRow & { gameCount: number };

type Player = {
  id: string;
  number: number;
  name: string;
  affiliation: string;
  region: string;
  divisionId: string;
  eventKinds?: string[];
};

type EventInfo = {
  id: string;
  title: string;
  kind: string;
  gameCount: number;
  scheduleDate: string;
  laneStart: number;
  laneEnd: number;
  tableShift: number;
};

type Assignment = {
  id: string;
  playerId: string;
  gameNumber: number;
  laneNumber: number;
};

type ApiList<T> = { items: T[] };
type ApiError = { message?: string };
type ScoreboardTab = "lane" | "score" | "event-rank" | "overall-rank";

const TAB_LABELS: Record<ScoreboardTab, string> = {
  lane: "🎳 레인 배정",
  score: "📝 점수 입력",
  "event-rank": "🏆 세부순위",
  "overall-rank": "📊 종합순위",
};

const KIND_LABELS: Record<string, string> = {
  SINGLE: "개인전", DOUBLES: "2인조", TRIPLES: "3인조",
  FOURS: "4인조", FIVES: "5인조", OVERALL: "개인종합",
};

const parseError = async (res: Response) => {
  const text = await res.text();
  try { return (JSON.parse(text) as ApiError).message || text || "요청이 실패했습니다."; }
  catch { return text || "요청이 실패했습니다."; }
};

const range = (start: number, end: number) => {
  const items: number[] = [];
  for (let i = start; i <= end; i++) items.push(i);
  return items;
};

type Board = Record<number, Record<number, string[]>>;
type GameBoard = Record<number, string[]>;

const buildBoards = (assignments: Assignment[], gameCount: number, laneStart: number, laneEnd: number): Board => {
  const board: Board = {};
  for (let g = 1; g <= gameCount; g++) {
    board[g] = Object.fromEntries(range(laneStart, laneEnd).map((l) => [l, [] as string[]]));
  }
  for (const item of assignments) {
    board[item.gameNumber] ??= {};
    board[item.gameNumber][item.laneNumber] ??= [];
    board[item.gameNumber][item.laneNumber].push(item.playerId);
  }
  return board;
};

const hasPlayerInBoard = (board: GameBoard, playerId: string) =>
  Object.values(board).some((players) => players.includes(playerId));

const getLaneForPlayerInBoard = (board: Board, gameNumber: number, playerId: string) => {
  for (const [lane, players] of Object.entries(board[gameNumber] ?? {})) {
    if (players.includes(playerId)) return Number(lane);
  }
  return 0;
};

const getLaneForPlayerInGameBoard = (board: GameBoard, playerId: string) => {
  for (const [lane, players] of Object.entries(board)) {
    if (players.includes(playerId)) return Number(lane);
  }
  return 0;
};

const buildBoardForGame = (board: Board, gameNumber: number, event: EventInfo | null): GameBoard => {
  const laneStart = event?.laneStart ?? 1;
  const laneEnd = event?.laneEnd ?? laneStart;
  const result: GameBoard = Object.fromEntries(range(laneStart, laneEnd).map((l) => [l, []]));
  const baseBoard = board[gameNumber] ?? {};
  const manualSet = new Set<string>();

  for (const [laneText, playerIds] of Object.entries(baseBoard)) {
    result[Number(laneText)] = [...playerIds];
    playerIds.forEach((id) => manualSet.add(id));
  }

  if (!event || gameNumber <= 1) return result;
  const firstGame = board[1] ?? {};
  if (!Object.keys(firstGame).length) return result;

  for (const [laneText, playerIds] of Object.entries(firstGame)) {
    const targetLane = getLaneForGame({
      initialLane: Number(laneText), gameNumber,
      shift: event.tableShift, range: { start: event.laneStart, end: event.laneEnd },
    });
    for (const id of playerIds) {
      if (!manualSet.has(id)) {
        result[targetLane] ??= [];
        result[targetLane].push(id);
      }
    }
  }
  return result;
};

const MAX_SCORE = 300;
const MAX_PER_LANE = 4;

const rankStyle = (rank: number) => {
  if (rank === 1) return { color: "#f59e0b", fontWeight: 800 as const };
  if (rank === 2) return { color: "#6366f1", fontWeight: 700 as const };
  if (rank === 3) return { color: "#8b5cf6", fontWeight: 600 as const };
  return {};
};

export default function AdminScoreboardPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const searchParams = useSearchParams();
  const divisionId = searchParams.get("divisionId") ?? "";
  const eventId = searchParams.get("eventId") ?? "";

  const [activeTab, setActiveTab] = useState<ScoreboardTab>("lane");
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [eventRows, setEventRows] = useState<EventLeaderboardRow[]>([]);
  const [overallRows, setOverallRows] = useState<OverallLeaderboardRow[]>([]);
  const [selectedGame, setSelectedGame] = useState(1);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);
  const [scoreDraft, setScoreDraft] = useState<Record<string, string>>({});
  const [selectedScoreLane, setSelectedScoreLane] = useState<number>(0);
  const pollerRef = useRef<number | null>(null);

  const showMsg = (msg: string, type: "success" | "error" = "success") => {
    setMessage(msg); setMessageType(type);
    setTimeout(() => setMessage(""), 4000);
  };

  const playerById = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  const lanes = useMemo(() => event ? range(event.laneStart, event.laneEnd) : [], [event]);

  const board = useMemo(
    () => buildBoards(assignments, event?.gameCount ?? 1, event?.laneStart ?? 1, event?.laneEnd ?? 1),
    [assignments, event],
  );

  const currentBoard = useMemo(() => buildBoardForGame(board, selectedGame, event), [board, event, selectedGame]);

  const unassignedPlayers = useMemo(
    () => players.filter((p) => !hasPlayerInBoard(currentBoard, p.id)),
    [currentBoard, players],
  );

  // --- API loaders ---
  const loadEvent = async (signal?: AbortSignal) => {
    if (!tournamentId || !divisionId || !eventId) return;
    const res = await fetch(`/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}`, { cache: "no-store", signal });
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json() as EventInfo;
    setEvent(data);
    setSelectedGame((prev) => (prev < 1 || prev > data.gameCount ? 1 : prev));
  };

  const loadPlayers = async (signal?: AbortSignal) => {
    if (!tournamentId || !divisionId) return;
    const res = await fetch(`/api/admin/tournaments/${tournamentId}/players?divisionId=${encodeURIComponent(divisionId)}`, { cache: "no-store", signal });
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json() as ApiList<Player>;
    const all = data.items ?? [];
    const kind = event?.kind;
    const filtered = kind
      ? all.filter((p) => !p.eventKinds || p.eventKinds.length === 0 || p.eventKinds.includes(kind))
      : all;
    setPlayers(filtered);
  };

  const loadAssignments = async (signal?: AbortSignal) => {
    if (!tournamentId || !divisionId || !eventId) return;
    const res = await fetch(`/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/assignments`, { cache: "no-store", signal });
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json() as ApiList<Assignment>;
    setAssignments(data.items ?? []);
  };

  const loadLeaderboard = async (signal?: AbortSignal) => {
    if (!tournamentId || !divisionId || !eventId) return;
    const res = await fetch(`/api/public/scoreboard?tournamentId=${encodeURIComponent(tournamentId)}&eventId=${encodeURIComponent(eventId)}&divisionId=${encodeURIComponent(divisionId)}`, { cache: "no-store", signal });
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json() as { rows: EventLeaderboardRow[] };
    setEventRows(data.rows ?? []);
    const next: Record<string, string> = {};
    data.rows?.forEach((row) => {
      const v = row.gameScores?.[selectedGame - 1]?.score;
      next[row.playerId] = typeof v === "number" ? String(v) : "";
    });
    setScoreDraft(next);
  };

  const loadOverall = async (signal?: AbortSignal) => {
    if (!tournamentId || !divisionId) return;
    const res = await fetch(`/api/public/scoreboard/overall?tournamentId=${encodeURIComponent(tournamentId)}&divisionId=${encodeURIComponent(divisionId)}`, { cache: "no-store", signal });
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json() as { rows: OverallLeaderboardRow[] };
    setOverallRows(data.rows ?? []);
  };

  const loadAll = async () => {
    if (!tournamentId || !divisionId || !eventId) return;
    setLoading(true);
    const controller = new AbortController();
    try {
      await Promise.all([loadEvent(controller.signal), loadPlayers(controller.signal), loadAssignments(controller.signal), loadLeaderboard(controller.signal), loadOverall(controller.signal)]);
    } catch (err) {
      if ((err as Error).name !== "AbortError") showMsg((err as Error).message || "조회 실패", "error");
    } finally { setLoading(false); }
    return controller;
  };

  useEffect(() => {
    let ctrl: AbortController | null = null;
    (async () => { ctrl = await loadAll() ?? null; })();
    if (pollerRef.current) clearInterval(pollerRef.current);
    pollerRef.current = window.setInterval(() => {
      void loadAssignments();
      void loadLeaderboard();
      void loadOverall();
    }, 4000) as unknown as number;
    return () => {
      ctrl?.abort();
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, [tournamentId, divisionId, eventId]);

  useEffect(() => { void loadLeaderboard(); }, [selectedGame]);

  // --- Lane assignment ---
  const encodeDrag = (playerId: string, sourceLane?: number) => JSON.stringify({ playerId, sourceLane });
  const decodeDrag = (raw: string): { playerId: string; sourceLane?: number } | null => {
    try { const p = JSON.parse(raw); return typeof p?.playerId === "string" ? p : null; }
    catch { return null; }
  };

  const movePlayer = (playerId: string, toLane?: number, sourceLane?: number) => {
    const actualSource = getLaneForPlayerInBoard(board, selectedGame, playerId);
    const source = actualSource > 0 ? actualSource : sourceLane ?? 0;
    const isAssigned = actualSource > 0;

    if (!toLane) {
      if (!isAssigned) return;
      setAssignments((cur) => cur.filter((a) => !(a.playerId === playerId && a.gameNumber === selectedGame)));
      return;
    }
    if (source === toLane) return;

    const targetPlayers = currentBoard[toLane] ?? [];
    const sourcePlayers = currentBoard[source] ?? [];
    const swapId = targetPlayers.find((id) => id !== playerId);

    if (!isAssigned) {
      if (targetPlayers.length >= MAX_PER_LANE) { showMsg("한 레인은 최대 4명까지만 배정할 수 있습니다.", "error"); return; }
      setAssignments((cur) => [...cur.filter((a) => !(a.playerId === playerId && a.gameNumber === selectedGame)), { id: `${playerId}_${selectedGame}_${toLane}`, playerId, gameNumber: selectedGame, laneNumber: toLane }]);
      return;
    }

    if (targetPlayers.length < MAX_PER_LANE) {
      setAssignments((cur) => [...cur.filter((a) => !(a.playerId === playerId && a.gameNumber === selectedGame)), { playerId, gameNumber: selectedGame, laneNumber: toLane, id: `${playerId}_${selectedGame}_${toLane}` }]);
      return;
    }

    if (!swapId || !sourcePlayers.length) { showMsg("스왑할 수 없는 상태입니다.", "error"); return; }
    setAssignments((cur) => [
      ...cur.filter((a) => a.gameNumber !== selectedGame || (a.playerId !== playerId && a.playerId !== swapId)),
      { playerId, gameNumber: selectedGame, laneNumber: toLane, id: `${playerId}_${selectedGame}_${toLane}` },
      { playerId: swapId, gameNumber: selectedGame, laneNumber: source, id: `${swapId}_${selectedGame}_${source}` },
    ]);
  };

  const handleRandomAssign = async () => {
    if (!tournamentId || !divisionId || !eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/assignments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "random" }) });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = body?.message ?? "랜덤 배정 실패";
        if (msg === "LANE_CAPACITY_EXCEEDED") {
          const d = body?.detail;
          throw new Error(`레인 수용 초과: 선수 ${d?.playerCount ?? "?"}명이지만 ${d?.laneCount ?? "?"}레인(최대 ${d?.maxCapacity ?? "?"}명)만 있습니다. 레인 범위를 넓혀주세요.`);
        }
        if (msg === "INVALID_EVENT_LANE_RANGE") throw new Error("이벤트의 레인 범위 설정이 올바르지 않습니다. 이벤트 설정을 확인해 주세요.");
        if (msg === "INVALID_EVENT_GAME_COUNT") throw new Error("이벤트의 게임 수 설정이 올바르지 않습니다. (1~20)");
        if (msg === "INVALID_EVENT_TABLE_SHIFT") throw new Error("이벤트의 테이블 이동값이 올바르지 않습니다.");
        throw new Error(msg);
      }
      await loadAssignments();
      showMsg("랜덤 배정이 완료되었습니다.");
    } catch (err) { showMsg((err as Error).message || "랜덤 배정 실패", "error"); }
    finally { setLoading(false); }
  };

  const handleSaveManual = async () => {
    if (!tournamentId || !divisionId || !eventId) return;
    setLoading(true);
    const items = assignments.map((a) => ({ playerId: a.playerId, gameNumber: a.gameNumber, laneNumber: a.laneNumber }));
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/assignments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "manual", items, replaceAll: true }) });
      if (!res.ok) throw new Error(await parseError(res));
      await loadAssignments();
      showMsg("수동 배정이 저장되었습니다.");
    } catch (err) { showMsg((err as Error).message || "수동 배정 저장 실패", "error"); }
    finally { setLoading(false); }
  };

  const handleSaveScore = async (playerId: string) => {
    if (!event || !tournamentId || !divisionId || !eventId) return;
    const draft = scoreDraft[playerId];
    if (!draft && draft !== "0") { showMsg("점수를 입력해 주세요.", "error"); return; }
    const score = Number(draft);
    if (!Number.isFinite(score) || !Number.isInteger(score) || score < 0 || score > MAX_SCORE) { showMsg("유효하지 않은 점수입니다. (0~300)", "error"); return; }
    const laneNumber = getLaneForPlayerInGameBoard(currentBoard, playerId);
    if (laneNumber <= 0) { showMsg("점수 입력 전 레인 배정이 필요합니다.", "error"); return; }
    try {
      const res = await fetch("/api/admin/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tournamentId, divisionId, eventId, playerId, gameNumber: selectedGame, score, laneNumber }) });
      if (!res.ok) throw new Error(await parseError(res));
      showMsg(`저장됨: ${playerById.get(playerId)?.name ?? playerId} - ${score}점`);
      await Promise.all([loadLeaderboard(), loadOverall()]);
    } catch (err) { showMsg((err as Error).message || "점수 저장 실패", "error"); }
  };

  const handleSaveAllInLane = async (laneNum: number) => {
    const playerIds = currentBoard[laneNum] ?? [];
    if (playerIds.length === 0) return;
    setLoading(true);
    let saved = 0;
    let failed = 0;
    for (const pid of playerIds) {
      const draft = scoreDraft[pid];
      if (draft === undefined || draft === "") continue;
      const score = Number(draft);
      if (!Number.isFinite(score) || !Number.isInteger(score) || score < 0 || score > MAX_SCORE) { failed++; continue; }
      if (!event || !tournamentId || !divisionId || !eventId) continue;
      try {
        const res = await fetch("/api/admin/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tournamentId, divisionId, eventId, playerId: pid, gameNumber: selectedGame, score, laneNumber: laneNum }) });
        if (res.ok) saved++;
        else failed++;
      } catch { failed++; }
    }
    setLoading(false);
    if (failed > 0) showMsg(`${saved}명 저장됨, ${failed}명 실패`, "error");
    else if (saved > 0) showMsg(`Lane ${laneNum} 전체 ${saved}명 저장 완료!`);
    else showMsg("입력된 점수가 없습니다.", "error");
    await Promise.all([loadLeaderboard(), loadOverall()]);
  };

  // 현재 게임에서 배정된 레인 목록 (선수 있는 레인만)
  const activeLanes = useMemo(
    () => lanes.filter((l) => (currentBoard[l] ?? []).length > 0),
    [lanes, currentBoard],
  );

  const tabStyle = (tab: ScoreboardTab) => ({
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: activeTab === tab ? 700 : 500,
    color: activeTab === tab ? "#6366f1" : "#64748b",
    background: activeTab === tab ? "rgba(99, 102, 241, 0.1)" : "transparent",
    border: "none",
    borderBottom: activeTab === tab ? "2px solid #6366f1" : "2px solid transparent",
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap" as const,
  });

  if (!divisionId || !eventId) {
    return (
      <main>
        <GlassCard style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "#94a3b8" }}>이벤트 접근에 필요한 파라미터가 없습니다.</p>
          <Link href={`/admin/tournaments/${tournamentId}`} style={{ color: "#6366f1" }}>← 대회 상세로 돌아가기</Link>
        </GlassCard>
      </main>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Header */}
      <div>
        <Link href={`/admin/tournaments/${tournamentId}`} style={{ color: "#94a3b8", fontSize: 13, textDecoration: "none" }}>
          ← 대회 상세로 돌아가기
        </Link>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 8, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
              {event?.title ?? "세부종목 관리"}
            </h1>
            <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
              {event && <GlassBadge variant="info">{KIND_LABELS[event.kind] ?? event.kind}</GlassBadge>}
              {event && <span style={{ color: "#64748b", fontSize: 13 }}>📅 {event.scheduleDate}</span>}
              {event && <span style={{ color: "#64748b", fontSize: 13 }}>🎳 레인 {event.laneStart}-{event.laneEnd}</span>}
              {loading && <span style={{ color: "#94a3b8", fontSize: 13 }}>갱신 중...</span>}
            </div>
          </div>
          {/* Game selector */}
          <GlassCard variant="subtle" style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>게임 선택</span>
            <div style={{ display: "flex", gap: 4 }}>
              {Array.from({ length: event?.gameCount ?? 1 }, (_, i) => i + 1).map((g) => (
                <button key={g} onClick={() => setSelectedGame(g)} style={{
                  padding: "5px 12px", borderRadius: 7, fontSize: 13, fontWeight: selectedGame === g ? 700 : 500,
                  color: selectedGame === g ? "#fff" : "#475569",
                  background: selectedGame === g ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.3)",
                  border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer", fontFamily: "inherit",
                }}>
                  {g}G
                </button>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Message */}
      {message && (
        <GlassCard variant="subtle" style={{
          padding: "10px 16px",
          color: messageType === "error" ? "#dc2626" : "#16a34a",
          background: messageType === "error" ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
          border: `1px solid ${messageType === "error" ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)"}`,
        }}>
          {message}
        </GlassCard>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.15)", borderRadius: "12px 12px 0 0", overflowX: "auto" }}>
        {(Object.keys(TAB_LABELS) as ScoreboardTab[]).map((tab) => (
          <button key={tab} style={tabStyle(tab)} onClick={() => setActiveTab(tab)}>
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* ===== Tab: 레인 배정 ===== */}
      {activeTab === "lane" && (
        <GlassCard>
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <GlassButton onClick={handleRandomAssign} disabled={loading}>
              🔀 랜덤 배정
            </GlassButton>
            <GlassButton variant="secondary" onClick={handleSaveManual} disabled={loading}>
              💾 수동 배정 저장
            </GlassButton>
            <span style={{ alignSelf: "center", fontSize: 13, color: "#64748b" }}>
              총 {players.length}명 · 미배정 {unassignedPlayers.length}명
            </span>
          </div>

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 280px" }}>
            {/* Lane board */}
            <div style={{ display: "grid", gap: 8 }}>
              {lanes.map((laneNum) => {
                const playerIds = currentBoard[laneNum] ?? [];
                return (
                  <div
                    key={laneNum}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const payload = decodeDrag(e.dataTransfer.getData("text/plain"));
                      if (payload) movePlayer(payload.playerId, laneNum, payload.sourceLane);
                    }}
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      border: "1.5px dashed rgba(99,102,241,0.25)",
                      borderRadius: 10,
                      padding: "10px 14px",
                      minHeight: 56,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: playerIds.length ? 8 : 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", background: "rgba(99,102,241,0.1)", padding: "2px 8px", borderRadius: 5 }}>
                        Lane {laneNum}
                      </span>
                      {playerIds.length === 0 && <span style={{ color: "#94a3b8", fontSize: 12 }}>비어 있음</span>}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {playerIds.map((pid) => {
                        const p = playerById.get(pid);
                        if (!p) return null;
                        return (
                          <div
                            key={pid}
                            draggable
                            onDragStart={(e: DragEvent<HTMLDivElement>) => e.dataTransfer.setData("text/plain", encodeDrag(pid, laneNum))}
                            style={{
                              padding: "5px 10px", borderRadius: 7, fontSize: 13,
                              background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)",
                              color: "#1e293b", cursor: "grab", fontWeight: 500,
                            }}
                          >
                            {p.number} {p.name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Unassigned pool */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const payload = decodeDrag(e.dataTransfer.getData("text/plain"));
                if (payload) movePlayer(payload.playerId, undefined, payload.sourceLane);
              }}
              style={{ background: "rgba(255,255,255,0.15)", border: "1.5px dashed rgba(203,213,225,0.5)", borderRadius: 10, padding: 12 }}
            >
              <p style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 10 }}>
                미배정 선수 ({unassignedPlayers.length})
              </p>
              {unassignedPlayers.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 13 }}>모든 선수 배정 완료 ✓</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {unassignedPlayers.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e: DragEvent<HTMLDivElement>) => e.dataTransfer.setData("text/plain", encodeDrag(p.id))}
                      style={{
                        padding: "7px 10px", borderRadius: 7, fontSize: 13,
                        background: "rgba(255,255,255,0.4)", border: "1px solid rgba(203,213,225,0.4)",
                        cursor: "grab", color: "#334155",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{p.number} {p.name}</span>
                      <span style={{ color: "#94a3b8", marginLeft: 6, fontSize: 12 }}>{p.affiliation}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {/* ===== Tab: 점수 입력 ===== */}
      {activeTab === "score" && (
        <GlassCard>
          {/* 헤더: 게임 + 테이블 이동 안내 */}
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", margin: 0 }}>
              📝 {selectedGame}게임 점수 입력
            </h2>
            {event && event.tableShift !== 0 && selectedGame > 1 && (
              <p style={{ fontSize: 12, color: "#6366f1", marginTop: 6, fontWeight: 500 }}>
                ℹ️ Table 이동 적용됨 ({event.tableShift >= 0 ? `+${event.tableShift}` : event.tableShift}) —
                {selectedGame}게임 레인 배치는 {selectedGame - 1}게임에서 이동된 위치입니다.
              </p>
            )}
          </div>

          {activeLanes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
              <p style={{ fontSize: 36, marginBottom: 8 }}>🎳</p>
              <p>먼저 레인 배정 탭에서 선수를 배정해 주세요.</p>
            </div>
          ) : (
            <>
              {/* 레인 서브탭 */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
                {activeLanes.map((laneNum) => {
                  const isActive = (selectedScoreLane || activeLanes[0]) === laneNum;
                  const lanePlayerIds = currentBoard[laneNum] ?? [];
                  const savedCount = lanePlayerIds.filter((pid) => {
                    const row = eventRows.find((r) => r.playerId === pid);
                    return row && row.gameScores[selectedGame - 1]?.score !== null;
                  }).length;
                  return (
                    <button
                      key={laneNum}
                      onClick={() => setSelectedScoreLane(laneNum)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? "#fff" : "#475569",
                        background: isActive
                          ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                          : "rgba(255,255,255,0.35)",
                        border: isActive
                          ? "1px solid rgba(255,255,255,0.3)"
                          : "1px solid rgba(203,213,225,0.4)",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        display: "flex",
                        flexDirection: "column" as const,
                        alignItems: "center",
                        gap: 2,
                        minWidth: 70,
                      }}
                    >
                      <span>Lane {laneNum}</span>
                      <span style={{ fontSize: 10, opacity: 0.8 }}>
                        {savedCount}/{lanePlayerIds.length}명 입력
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 선택된 레인의 점수 입력 패널 */}
              {(() => {
                const activeLane = selectedScoreLane || activeLanes[0];
                const lanePlayerIds = currentBoard[activeLane] ?? [];
                const laneRows = lanePlayerIds
                  .map((pid) => eventRows.find((r) => r.playerId === pid))
                  .filter((r): r is EventLeaderboardRow => r !== undefined)
                  .sort((a, b) => a.number - b.number);

                return (
                  <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 14, padding: "18px 16px", border: "1px solid rgba(99,102,241,0.15)" }}>
                    {/* 레인 헤더 */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{
                          fontSize: 20, fontWeight: 800, color: "#6366f1",
                          background: "rgba(99,102,241,0.1)", padding: "4px 14px",
                          borderRadius: 8, border: "1px solid rgba(99,102,241,0.2)",
                        }}>
                          Lane {activeLane}
                        </span>
                        <span style={{ fontSize: 13, color: "#64748b" }}>
                          선수 {laneRows.length}명
                        </span>
                        {event && event.tableShift !== 0 && selectedGame > 1 && (
                          <GlassBadge variant="info">
                            {selectedGame - 1}G Lane {(() => {
                              // 이전 게임에서 어느 레인에서 왔는지 역산
                              const shift = event.tableShift;
                              const laneCount = event.laneEnd - event.laneStart + 1;
                              const prevLane = ((activeLane - event.laneStart - shift) % laneCount + laneCount) % laneCount + event.laneStart;
                              return prevLane;
                            })()} 에서 이동
                          </GlassBadge>
                        )}
                      </div>
                      <GlassButton
                        size="sm"
                        onClick={() => void handleSaveAllInLane(activeLane)}
                        disabled={loading}
                      >
                        💾 레인 전체 저장
                      </GlassButton>
                    </div>

                    {/* 선수 점수 입력 rows */}
                    <div style={{ display: "grid", gap: 10 }}>
                      {laneRows.map((row, idx) => {
                        const savedScore = row.gameScores[selectedGame - 1]?.score;
                        const hasSaved = savedScore !== null && savedScore !== undefined;
                        return (
                          <div
                            key={row.playerId}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "36px 1fr auto auto auto",
                              alignItems: "center",
                              gap: 10,
                              padding: "12px 14px",
                              background: hasSaved ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.25)",
                              borderRadius: 10,
                              border: hasSaved
                                ? "1px solid rgba(34,197,94,0.2)"
                                : "1px solid rgba(255,255,255,0.3)",
                            }}
                          >
                            {/* 번호 */}
                            <span style={{
                              textAlign: "center", fontWeight: 800, fontSize: 15,
                              color: "#6366f1", background: "rgba(99,102,241,0.1)",
                              borderRadius: 6, padding: "2px 0",
                            }}>
                              {row.number}
                            </span>
                            {/* 이름 + 소속 */}
                            <div>
                              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{row.name}</p>
                              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{row.region} · {row.affiliation}</p>
                            </div>
                            {/* 기존 점수 뱃지 */}
                            {hasSaved ? (
                              <GlassBadge variant="success">{savedScore}점 ✓</GlassBadge>
                            ) : (
                              <span style={{ fontSize: 12, color: "#cbd5e1" }}>미입력</span>
                            )}
                            {/* 점수 입력 */}
                            <input
                              type="number"
                              min={0}
                              max={MAX_SCORE}
                              step={1}
                              value={scoreDraft[row.playerId] ?? ""}
                              onChange={(e) => setScoreDraft((prev) => ({ ...prev, [row.playerId]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  void handleSaveScore(row.playerId);
                                  // 다음 선수로 포커스 이동
                                  const inputs = document.querySelectorAll<HTMLInputElement>("input[type=number]");
                                  const currentIdx = Array.from(inputs).findIndex((el) => el === e.currentTarget);
                                  inputs[currentIdx + 1]?.focus();
                                }
                              }}
                              autoFocus={idx === 0}
                              placeholder="0~300"
                              style={{
                                width: 80, padding: "8px 10px", borderRadius: 8,
                                fontSize: 15, textAlign: "center", fontWeight: 600,
                                background: "rgba(255,255,255,0.7)",
                                border: "1.5px solid rgba(99,102,241,0.25)",
                                outline: "none", fontFamily: "inherit", color: "#1e293b",
                              }}
                            />
                            {/* 개별 저장 */}
                            <GlassButton size="sm" onClick={() => void handleSaveScore(row.playerId)}>
                              저장
                            </GlassButton>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* 미배정 선수 (하단 접이식) */}
              {eventRows.filter((row) => getLaneForPlayerInGameBoard(currentBoard, row.playerId) === 0).length > 0 && (
                <div style={{ marginTop: 12, background: "rgba(241,245,249,0.3)", borderRadius: 10, padding: "12px 14px", border: "1px dashed rgba(203,213,225,0.5)" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 10 }}>
                    ⚠️ 레인 미배정 선수
                  </p>
                  <div style={{ display: "grid", gap: 8 }}>
                    {eventRows.filter((row) => getLaneForPlayerInGameBoard(currentBoard, row.playerId) === 0).map((row) => (
                      <div key={row.playerId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, color: "#94a3b8", minWidth: 28 }}>{row.number}</span>
                        <span style={{ flex: 1, fontSize: 13, color: "#94a3b8" }}>{row.name}</span>
                        <input
                          type="number" min={0} max={MAX_SCORE}
                          value={scoreDraft[row.playerId] ?? ""}
                          onChange={(e) => setScoreDraft((prev) => ({ ...prev, [row.playerId]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") void handleSaveScore(row.playerId); }}
                          placeholder="점수"
                          style={{ width: 70, padding: "5px 8px", borderRadius: 7, fontSize: 13, textAlign: "center", background: "rgba(255,255,255,0.4)", border: "1px solid rgba(203,213,225,0.4)", outline: "none", fontFamily: "inherit" }}
                        />
                        <GlassButton size="sm" onClick={() => void handleSaveScore(row.playerId)}>저장</GlassButton>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </GlassCard>
      )}

      {/* ===== Tab: 세부순위 ===== */}
      {activeTab === "event-rank" && (
        <GlassCard>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>세부종목 순위</h2>
          <GlassTable
            headers={["순위", "시도", "소속", "번호", "성명", "1G", "2G", "3G", "4G", "5G", "6G", "합계", "평균", "핀차"]}
            rowCount={eventRows.length}
            emptyMessage="순위 데이터가 없습니다."
          >
            {eventRows.map((row) => (
              <tr key={row.playerId} {...glassTrHoverProps}>
                <td style={{ ...glassTdStyle, ...rankStyle(row.rank), textAlign: "center" }}>{row.rank}</td>
                <td style={{ ...glassTdStyle, color: "#64748b", textAlign: "center" }}>{row.region}</td>
                <td style={glassTdStyle}>{row.affiliation}</td>
                <td style={{ ...glassTdStyle, textAlign: "center" }}>{row.number}</td>
                <td style={{ ...glassTdStyle, fontWeight: 600 }}>{row.name}</td>
                {row.gameScores.map((g) => (
                  <td key={g.gameNumber} style={{ ...glassTdStyle, textAlign: "center" }}>{g.score ?? ""}</td>
                ))}
                <td style={{ ...glassTdStyle, textAlign: "center", fontWeight: 700 }}>{row.total}</td>
                <td style={{ ...glassTdStyle, textAlign: "center", color: "#6366f1", fontWeight: 600 }}>{row.average}</td>
                <td style={{ ...glassTdStyle, textAlign: "center", color: "#64748b" }}>{row.pinDiff}</td>
              </tr>
            ))}
          </GlassTable>
        </GlassCard>
      )}

      {/* ===== Tab: 종합순위 ===== */}
      {activeTab === "overall-rank" && (
        <GlassCard>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>전체 종합순위</h2>
          <GlassTable
            headers={["순위", "시도", "소속", "번호", "성명", "합계", "평균", "핀차", "게임수"]}
            rowCount={overallRows.length}
            emptyMessage="종합점수 데이터가 없습니다."
          >
            {overallRows.map((row) => (
              <tr key={row.playerId} {...glassTrHoverProps}>
                <td style={{ ...glassTdStyle, ...rankStyle(row.rank), textAlign: "center" }}>{row.rank}</td>
                <td style={{ ...glassTdStyle, color: "#64748b", textAlign: "center" }}>{row.region}</td>
                <td style={glassTdStyle}>{row.affiliation}</td>
                <td style={{ ...glassTdStyle, textAlign: "center" }}>{row.number}</td>
                <td style={{ ...glassTdStyle, fontWeight: 600 }}>{row.name}</td>
                <td style={{ ...glassTdStyle, textAlign: "center", fontWeight: 700 }}>{row.total}</td>
                <td style={{ ...glassTdStyle, textAlign: "center", color: "#6366f1", fontWeight: 600 }}>{row.average}</td>
                <td style={{ ...glassTdStyle, textAlign: "center", color: "#64748b" }}>{row.pinDiff}</td>
                <td style={{ ...glassTdStyle, textAlign: "center" }}>{row.gameCount}</td>
              </tr>
            ))}
          </GlassTable>
        </GlassCard>
      )}
    </div>
  );
}
