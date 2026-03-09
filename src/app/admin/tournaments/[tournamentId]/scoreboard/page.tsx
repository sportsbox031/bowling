"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getLaneForGame } from "@/lib/lane";
import { parseParticipantNumberInput } from "@/lib/participant-range";
import {
  GlassCard,
  GlassButton,
  GlassTable,
  GlassBadge,
  glassTdStyle,
  glassTrHoverProps,
} from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";
import RankingTable from "@/components/scoreboard/RankingTable";
import PlayerProfileModal from "@/components/PlayerProfileModal";
import { KIND_LABELS } from "@/lib/constants";
import { clearScoreDraft, readScoreDraft, writeScoreDraft } from "@/lib/score-draft";
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
  squadId?: string;
};

type Squad = {
  id: string;
  name: string;
  createdAt: string;
};

type Participant = {
  id: string;
  playerId: string;
  squadId?: string;
};

type ApiList<T> = { items: T[] };
type ApiError = { message?: string };
type ScoreboardTab = "participants" | "lane" | "score" | "event-rank" | "overall-rank";
const PARTICIPANT_VIEW_ALL = "ALL";

const TAB_LABELS: Record<ScoreboardTab, string> = {
  participants: "📋 출전선수등록",
  lane: "🎳 레인 배정",
  score: "📝 점수 입력",
  "event-rank": "🏆 세부순위",
  "overall-rank": "📊 종합순위",
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

  for (const [laneText, playerIds] of Object.entries(baseBoard)) {
    result[Number(laneText)] = [...playerIds];
  }

  return result;
};

const MAX_SCORE = 300;
const MAX_PER_LANE = 4;


export default function AdminScoreboardPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const searchParams = useSearchParams();
  const divisionId = searchParams.get("divisionId") ?? "";
  const eventId = searchParams.get("eventId") ?? "";

  const [activeTab, setActiveTab] = useState<ScoreboardTab>("participants");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [participantList, setParticipantList] = useState<Participant[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(null);
  const [participantViewSquadId, setParticipantViewSquadId] = useState<string>(PARTICIPANT_VIEW_ALL);
  const [newSquadName, setNewSquadName] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantNumberInput, setParticipantNumberInput] = useState("");
  const [eventRows, setEventRows] = useState<EventLeaderboardRow[]>([]);
  const [overallRows, setOverallRows] = useState<OverallLeaderboardRow[]>([]);
  const [selectedGame, setSelectedGame] = useState(1);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);
  const [scoreDraft, setScoreDraft] = useState<Record<string, string>>({});
  const [selectedScoreLane, setSelectedScoreLane] = useState<number>(0);
  const [draftRecoveredCount, setDraftRecoveredCount] = useState(0);
  const msgTimerRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const scoreDirtyRef = useRef<Set<string>>(new Set());
  const scoreInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const showMsg = (msg: string, type: "success" | "error" = "success") => {
    setMessage(msg); setMessageType(type);
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    msgTimerRef.current = window.setTimeout(() => setMessage(""), 4000);
  };

  const hasSquads = squads.length > 0;
  useEffect(() => {
    if (!hasSquads) {
      if (selectedSquadId !== null) setSelectedSquadId(null);
      if (participantViewSquadId !== PARTICIPANT_VIEW_ALL) setParticipantViewSquadId(PARTICIPANT_VIEW_ALL);
      return;
    }

    if (!selectedSquadId || !squads.some((sq) => sq.id === selectedSquadId)) {
      setSelectedSquadId(squads[0]?.id ?? null);
    }

    if (participantViewSquadId !== PARTICIPANT_VIEW_ALL && !squads.some((sq) => sq.id === participantViewSquadId)) {
      setParticipantViewSquadId(PARTICIPANT_VIEW_ALL);
    }
  }, [hasSquads, squads, selectedSquadId, participantViewSquadId]);

  const participantIds = useMemo(
    () => new Set(participantList.map((p) => p.id)),
    [participantList],
  );

  const participantMap = useMemo(
    () => new Map(participantList.map((p) => [p.id, p])),
    [participantList],
  );
  const participantViewIds = useMemo(() => {
    if (!hasSquads || participantViewSquadId === PARTICIPANT_VIEW_ALL) return null;
    return new Set(participantList.filter((p) => p.squadId === participantViewSquadId).map((p) => p.id));
  }, [hasSquads, participantList, participantViewSquadId]);

  const squadParticipantIds = useMemo(() => {
    if (!hasSquads || !selectedSquadId) return participantIds;
    return new Set(participantList.filter((p) => p.squadId === selectedSquadId).map((p) => p.id));
  }, [participantList, selectedSquadId, hasSquads, participantIds]);

  const players = useMemo(
    () => allPlayers.filter((p) => squadParticipantIds.has(p.id)),
    [allPlayers, squadParticipantIds],
  );

  const participantTabPlayers = useMemo(() => {
    const keyword = participantSearch.trim().toLowerCase();
    return allPlayers.filter((player) => {
      if (participantViewIds && !participantViewIds.has(player.id)) {
        return false;
      }

      if (!keyword) return true;
      return player.name.toLowerCase().includes(keyword) || player.affiliation.toLowerCase().includes(keyword) || String(player.number).includes(keyword);
    });
  }, [allPlayers, participantSearch, participantViewIds]);

  const playerById = useMemo(() => {
    const m = new Map<string, Player>();
    allPlayers.forEach((p) => m.set(p.id, p));
    return m;
  }, [allPlayers]);

  const lanes = useMemo(() => event ? range(event.laneStart, event.laneEnd) : [], [event]);
  const visibleAssignments = useMemo(
    () => hasSquads && selectedSquadId
      ? assignments.filter((a) => a.squadId === selectedSquadId)
      : assignments,
    [assignments, hasSquads, selectedSquadId],
  );

  const board = useMemo(
    () => buildBoards(visibleAssignments, event?.gameCount ?? 1, event?.laneStart ?? 1, event?.laneEnd ?? 1),
    [visibleAssignments, event],
  );

  const currentBoard = useMemo(() => buildBoardForGame(board, selectedGame, event), [board, event, selectedGame]);

  const unassignedPlayers = useMemo(
    () => players.filter((p) => !hasPlayerInBoard(currentBoard, p.id)),
    [currentBoard, players],
  );

  const bundleUrl = `/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/bundle`;
  const draftStorageKey = `${tournamentId}:${divisionId}:${eventId}:game-${selectedGame}:lane-${selectedScoreLane}`;

  // --- API loaders ---
  const participantsUrl = `/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/participants`;

  const handleAddParticipant = async (playerId: string, options?: { silent?: boolean }) => {
    try {
      const res = await fetch(participantsUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: [playerId], squadId: hasSquads ? selectedSquadId : undefined }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      setParticipantList((prev) => [...prev, { id: playerId, playerId, squadId: hasSquads ? selectedSquadId ?? undefined : undefined }]);
      return true;
    } catch (err) { if (!options?.silent) showMsg((err as Error).message || "등록 실패", "error"); return false; }
  };

  const handleParticipantNumberSubmit = async () => {
    const numbers = parseParticipantNumberInput(participantNumberInput);
    if (!numbers) {
      showMsg("선수번호 또는 범위를 7 또는 1-30 형식으로 입력해 주세요.", "error");
      return;
    }

    const queuedIds = new Set<string>();
    let added = 0;
    let alreadyRegistered = 0;
    let missing = 0;
    let failed = 0;

    for (const number of numbers) {
      const player = allPlayers.find((item) => item.number === number);
      if (!player) {
        missing += 1;
        continue;
      }

      if (participantIds.has(player.id) || queuedIds.has(player.id)) {
        alreadyRegistered += 1;
        continue;
      }

      const success = await handleAddParticipant(player.id, { silent: true });
      if (success) {
        queuedIds.add(player.id);
        added += 1;
      } else {
        failed += 1;
      }
    }

    const messageParts: string[] = [];
    if (added > 0) messageParts.push(`${added}명 등록`);
    if (alreadyRegistered > 0) messageParts.push(`${alreadyRegistered}명 이미 등록됨`);
    if (missing > 0) messageParts.push(`${missing}명 번호 없음`);
    if (failed > 0) messageParts.push(`${failed}명 등록 실패`);

    if (added > 0) {
      setParticipantNumberInput("");
    }

    const squadLabel = hasSquads ? `${squads.find((item) => item.id === selectedSquadId)?.name ?? "현재 스쿼드"} 등록 결과` : "출전선수 등록 결과";
    showMsg(`${squadLabel}: ${messageParts.join(", ") || "처리된 선수가 없습니다."}`, added > 0 ? "success" : "error");
  };

  const handleRemoveParticipant = async (playerId: string) => {
    try {
      const res = await fetch(participantsUrl, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      setParticipantList((prev) => prev.filter((pt) => pt.id !== playerId));
      return true;
    } catch (err) { showMsg((err as Error).message || "해제 실패", "error"); return false; }
  };

  const handleCreateSquad = async () => {
    const name = newSquadName.trim();
    if (!name) return;
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/squads`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      const created = await res.json();
      setSquads((prev) => [...prev, created]);
      setNewSquadName("");
      if (!selectedSquadId) setSelectedSquadId(created.id);
      showMsg(`스쿼드 "${created.name}" 생성됨`);
    } catch (err) { showMsg((err as Error).message || "스쿼드 생성 실패", "error"); }
  };

  // Consolidated loaders using bundle API
  const loadAssignments = async (signal?: AbortSignal) => {
    if (!tournamentId || !divisionId || !eventId) return;
    const res = await fetch(`${bundleUrl}?only=assignments`, { cache: "no-store", signal });
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json() as { assignments: Assignment[] };
    setAssignments(data.assignments ?? []);
  };

  const loadScores = async (signal?: AbortSignal) => {
    if (!tournamentId || !divisionId || !eventId) return;
    const res = await fetch(`${bundleUrl}?only=scores`, { cache: "no-store", signal });
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json() as { eventRows: EventLeaderboardRow[]; overallRows: OverallLeaderboardRow[] };
    setEventRows(data.eventRows ?? []);
    setOverallRows(data.overallRows ?? []);
  };

  const loadAll = async () => {
    if (!tournamentId || !divisionId || !eventId) return;
    setLoading(true);
    const controller = new AbortController();
    try {
      const res = await fetch(bundleUrl, { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error(await parseError(res));
      const data = await res.json();
      setEvent(data.event ?? null);
      setAllPlayers(data.players ?? []);
      setParticipantList(data.participants ?? []);
      setSquads(data.squads ?? []);
      setAssignments(data.assignments ?? []);
      setEventRows(data.eventRows ?? []);
      setOverallRows(data.overallRows ?? []);
      if (data.event) {
        setSelectedGame((prev) => (prev < 1 || prev > data.event.gameCount ? 1 : prev));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") showMsg((err as Error).message || "조회 실패", "error");
    } finally { setLoading(false); }
    return controller;
  };

  useEffect(() => {
    let ctrl: AbortController | null = null;
    (async () => { ctrl = await loadAll() ?? null; })();
    return () => { ctrl?.abort(); };
  }, [tournamentId, divisionId, eventId]);

  // Derive scoreDraft from existing eventRows and restore temporary drafts.
  const prevGameRef = useRef(selectedGame);
  useEffect(() => {
    const gameChanged = prevGameRef.current !== selectedGame;
    prevGameRef.current = selectedGame;

    const storedDraft = readScoreDraft(draftStorageKey);
    const restoredIds = Object.keys(storedDraft);

    setScoreDraft(() => {
      const next: Record<string, string> = {};
      eventRows.forEach((row) => {
        const serverValue = row.gameScores?.[selectedGame - 1]?.score;
        const normalizedServerValue = typeof serverValue === "number" ? String(serverValue) : "";
        next[row.playerId] = storedDraft[row.playerId] ?? normalizedServerValue;
      });
      return next;
    });

    scoreDirtyRef.current = new Set(restoredIds);
    setDraftRecoveredCount(restoredIds.length);

    if (gameChanged && restoredIds.length === 0) {
      clearScoreDraft(draftStorageKey);
    }
  }, [draftStorageKey, eventRows, selectedGame]);

  useEffect(() => {
    const dirtyEntries = Object.fromEntries(
      Object.entries(scoreDraft).filter(([playerId, value]) => scoreDirtyRef.current.has(playerId) && value !== ""),
    );
    writeScoreDraft(draftStorageKey, dirtyEntries);
    setDraftRecoveredCount(Object.keys(dirtyEntries).length);
  }, [draftStorageKey, scoreDraft]);

  // --- Lane assignment ---
  const encodeDrag = (playerId: string, sourceLane?: number) => JSON.stringify({ playerId, sourceLane });
  const decodeDrag = (raw: string): { playerId: string; sourceLane?: number } | null => {
    try { const p = JSON.parse(raw); return typeof p?.playerId === "string" ? p : null; }
    catch { return null; }
  };

  // 1G 배정 기준으로 나머지 게임 배정을 table shift로 재생성
  const rebuildAllGames = (cur: Assignment[]): Assignment[] => {
    if (!event || event.gameCount <= 1) return cur;
    const game1 = cur.filter((a) => a.gameNumber === 1);
    const nonLane = cur.filter((a) => a.gameNumber < 1); // 혹시 있을 수 있는 기타
    const generated: Assignment[] = [];
    for (let g = 2; g <= event.gameCount; g++) {
      for (const a of game1) {
        const newLane = getLaneForGame({
          initialLane: a.laneNumber,
          gameNumber: g,
          shift: event.tableShift,
          range: { start: event.laneStart, end: event.laneEnd },
        });
        generated.push({ ...a, gameNumber: g, laneNumber: newLane, id: `${a.playerId}_${g}_${newLane}` });
      }
    }
    return [...game1, ...nonLane, ...generated];
  };

  const mergeVisibleAssignments = (currentAll: Assignment[], nextVisible: Assignment[]) => {
    const normalizedVisible = hasSquads && selectedSquadId
      ? nextVisible.map((item) => ({ ...item, squadId: selectedSquadId }))
      : nextVisible;

    if (!hasSquads || !selectedSquadId) {
      return normalizedVisible;
    }

    return [
      ...currentAll.filter((item) => item.squadId !== selectedSquadId),
      ...normalizedVisible,
    ];
  };

  const movePlayer = (playerId: string, toLane?: number, sourceLane?: number, swapTargetId?: string) => {
    const actualSource = getLaneForPlayerInBoard(board, selectedGame, playerId);
    const source = actualSource > 0 ? actualSource : sourceLane ?? 0;
    const isAssigned = actualSource > 0;

    if (!toLane) {
      if (!isAssigned) return;
      dirtyRef.current = true;
      setAssignments((cur) => {
        const currentVisible = hasSquads && selectedSquadId ? cur.filter((a) => a.squadId === selectedSquadId) : cur;
        const nextVisible = currentVisible.filter((a) => !(a.playerId === playerId && a.gameNumber === selectedGame));
        const rebuilt = selectedGame === 1 ? rebuildAllGames(nextVisible) : nextVisible;
        return mergeVisibleAssignments(cur, rebuilt);
      });
      return;
    }
    if (source === toLane && !swapTargetId) return;

    // 선수 위에 드롭 → 스왑
    if (swapTargetId && swapTargetId !== playerId) {
      const swapSource = getLaneForPlayerInBoard(board, selectedGame, swapTargetId);
      if (swapSource <= 0) return;
      dirtyRef.current = true;
      setAssignments((cur) => {
        const currentVisible = hasSquads && selectedSquadId ? cur.filter((a) => a.squadId === selectedSquadId) : cur;
        const nextVisible = [
          ...currentVisible.filter((a) => a.gameNumber !== selectedGame || (a.playerId !== playerId && a.playerId !== swapTargetId)),
          { playerId, gameNumber: selectedGame, laneNumber: swapSource, id: `${playerId}_${selectedGame}_${swapSource}` } as Assignment,
          { playerId: swapTargetId, gameNumber: selectedGame, laneNumber: source, id: `${swapTargetId}_${selectedGame}_${source}` } as Assignment,
        ];
        const rebuilt = selectedGame === 1 ? rebuildAllGames(nextVisible) : nextVisible;
        return mergeVisibleAssignments(cur, rebuilt);
      });
      return;
    }

    const targetPlayers = currentBoard[toLane] ?? [];

    if (!isAssigned) {
      if (targetPlayers.length >= MAX_PER_LANE) { showMsg("한 레인은 최대 4명까지만 배정할 수 있습니다.", "error"); return; }
      dirtyRef.current = true;
      setAssignments((cur) => {
        const currentVisible = hasSquads && selectedSquadId ? cur.filter((a) => a.squadId === selectedSquadId) : cur;
        const nextVisible = [...currentVisible.filter((a) => !(a.playerId === playerId && a.gameNumber === selectedGame)), { id: `${playerId}_${selectedGame}_${toLane}`, playerId, gameNumber: selectedGame, laneNumber: toLane } as Assignment];
        const rebuilt = selectedGame === 1 ? rebuildAllGames(nextVisible) : nextVisible;
        return mergeVisibleAssignments(cur, rebuilt);
      });
      return;
    }

    if (targetPlayers.length < MAX_PER_LANE) {
      dirtyRef.current = true;
      setAssignments((cur) => {
        const currentVisible = hasSquads && selectedSquadId ? cur.filter((a) => a.squadId === selectedSquadId) : cur;
        const nextVisible = [...currentVisible.filter((a) => !(a.playerId === playerId && a.gameNumber === selectedGame)), { playerId, gameNumber: selectedGame, laneNumber: toLane, id: `${playerId}_${selectedGame}_${toLane}` } as Assignment];
        const rebuilt = selectedGame === 1 ? rebuildAllGames(nextVisible) : nextVisible;
        return mergeVisibleAssignments(cur, rebuilt);
      });
      return;
    }

    showMsg("레인이 가득 찼습니다. 교환하려면 선수 위에 드롭하세요.", "error");
  };

  const handleRandomAssign = async () => {
    if (!tournamentId || !divisionId || !eventId) return;
    if (hasSquads && !selectedSquadId) {
      showMsg("스쿼드를 선택한 후 랜덤 배정해 주세요.", "error");
      return;
    }
    const currentSquadAssignments = hasSquads && selectedSquadId
      ? assignments.filter((a) => a.squadId === selectedSquadId)
      : assignments;
    if (currentSquadAssignments.length > 0) {
      const ok = window.confirm("이미 레인 배정이 되어 있습니다. 기존 배정을 삭제하고 새로 랜덤 배정하시겠습니까?");
      if (!ok) return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/assignments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "random", squadId: hasSquads ? selectedSquadId : undefined }) });
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
      dirtyRef.current = false;
      await loadAssignments();
      showMsg("랜덤 배정이 완료되었습니다.");
    } catch (err) { showMsg((err as Error).message || "랜덤 배정 실패", "error"); }
    finally { setLoading(false); }
  };

  const handleSaveManual = async () => {
    if (!tournamentId || !divisionId || !eventId) return;
    setLoading(true);
    const items = visibleAssignments.map((a) => ({ playerId: a.playerId, gameNumber: a.gameNumber, laneNumber: a.laneNumber }));
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/assignments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "manual", items, replaceAll: true, squadId: hasSquads ? selectedSquadId : undefined }) });
      if (!res.ok) throw new Error(await parseError(res));
      dirtyRef.current = false;
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
      scoreDirtyRef.current.delete(playerId);
      showMsg(`저장됨: ${playerById.get(playerId)?.name ?? playerId} - ${score}점`);
      await loadScores();
    } catch (err) { showMsg((err as Error).message || "점수 저장 실패", "error"); }
  };

  const handleSaveAllInLane = async (laneNum: number) => {
    const playerIds = currentBoard[laneNum] ?? [];
    if (playerIds.length === 0 || !event || !tournamentId || !divisionId || !eventId) return;
    setLoading(true);
    const tasks: Promise<boolean>[] = [];
    for (const pid of playerIds) {
      const draft = scoreDraft[pid];
      if (draft === undefined || draft === "") continue;
      const score = Number(draft);
      if (!Number.isFinite(score) || !Number.isInteger(score) || score < 0 || score > MAX_SCORE) continue;
      tasks.push(
        fetch("/api/admin/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tournamentId, divisionId, eventId, playerId: pid, gameNumber: selectedGame, score, laneNumber: laneNum }) })
          .then((res) => res.ok)
          .catch(() => false),
      );
    }
    if (tasks.length === 0) { setLoading(false); showMsg("입력된 점수가 없습니다.", "error"); return; }
    const results = await Promise.all(tasks);
    const saved = results.filter(Boolean).length;
    const failed = results.length - saved;
    // Clear dirty flags for all players in this lane
    for (const pid of playerIds) scoreDirtyRef.current.delete(pid);
    clearScoreDraft(draftStorageKey, playerIds);
    setLoading(false);
    if (failed > 0) showMsg(`${saved}명 저장됨, ${failed}명 실패`, "error");
    else showMsg(`Lane ${laneNum} 전체 ${saved}명 저장 완료!`);
    await loadScores();
  };

  // 현재 게임에서 배정된 레인 목록 (선수 있는 레인만)
  const activeLanes = useMemo(
    () => lanes.filter((l) => (currentBoard[l] ?? []).length > 0),
    [lanes, currentBoard],
  );

  // 스쿼드 필터링된 점수입력용 데이터
  const scoreFilteredEventRows = useMemo(
    () => hasSquads && selectedSquadId
      ? eventRows.filter((r) => squadParticipantIds.has(r.playerId))
      : eventRows,
    [eventRows, hasSquads, selectedSquadId, squadParticipantIds],
  );

  const scoreFilteredBoard = useMemo(() => {
    if (!hasSquads || !selectedSquadId) return currentBoard;
    const filtered: GameBoard = {};
    for (const [lane, pids] of Object.entries(currentBoard)) {
      const kept = pids.filter((pid) => squadParticipantIds.has(pid));
      filtered[Number(lane)] = kept;
    }
    return filtered;
  }, [currentBoard, hasSquads, selectedSquadId, squadParticipantIds]);

  const scoreActiveLanes = useMemo(
    () => lanes.filter((l) => (scoreFilteredBoard[l] ?? []).length > 0),
    [lanes, scoreFilteredBoard],
  );

  const activeScoreLane = selectedScoreLane || scoreActiveLanes[0] || 0;
  const activeLaneRows = useMemo(() => {
    const lanePlayerIds = scoreFilteredBoard[activeScoreLane] ?? [];
    return lanePlayerIds
      .map((pid) => scoreFilteredEventRows.find((row) => row.playerId === pid))
      .filter((row): row is EventLeaderboardRow => row !== undefined)
      .sort((a, b) => a.number - b.number);
  }, [activeScoreLane, scoreFilteredBoard, scoreFilteredEventRows]);

  const focusAdjacentScoreInput = (playerIds: string[], currentPlayerId: string, delta: number) => {
    const currentIndex = playerIds.indexOf(currentPlayerId);
    if (currentIndex < 0) return;
    const targetPlayerId = playerIds[currentIndex + delta];
    if (!targetPlayerId) return;
    const input = scoreInputRefs.current[targetPlayerId];
    input?.focus();
    input?.select();
  };

  const resetDraftToSavedScores = () => {
    clearScoreDraft(draftStorageKey);
    scoreDirtyRef.current.clear();
    setDraftRecoveredCount(0);
    setScoreDraft(() => {
      const next: Record<string, string> = {};
      eventRows.forEach((row) => {
        const saved = row.gameScores?.[selectedGame - 1]?.score;
        next[row.playerId] = typeof saved === "number" ? String(saved) : "";
      });
      return next;
    });
  };

  useEffect(() => {
    if (activeTab !== "score") return;
    const firstTarget = activeLaneRows.find((row) => {
      const saved = row.gameScores[selectedGame - 1]?.score;
      return saved === null || scoreDirtyRef.current.has(row.playerId);
    })?.playerId ?? activeLaneRows[0]?.playerId;
    if (!firstTarget) return;
    const timer = window.setTimeout(() => {
      const input = scoreInputRefs.current[firstTarget];
      input?.focus();
      input?.select();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [activeLaneRows, activeTab, selectedGame]);
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

  const renderSquadSelector = (opts?: { onSelect?: (id: string) => void; showCount?: boolean; selectedId?: string }) => (
    <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginRight: 4 }}>스쿼드:</span>
      {squads.map((sq) => {
        const currentSelectedId = opts?.selectedId ?? selectedSquadId ?? "";
        const isSelected = currentSelectedId === sq.id;
        const label = opts?.showCount
          ? `${sq.name} (${participantList.filter((p) => p.squadId === sq.id).length}명)`
          : sq.name;
        return (
          <button
            key={sq.id}
            onClick={() => (opts?.onSelect ? opts.onSelect(sq.id) : setSelectedSquadId(sq.id))}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: isSelected ? 700 : 500,
              color: isSelected ? "#fff" : "#475569",
              background: isSelected ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.4)",
              border: isSelected ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(203,213,225,0.4)",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

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

      {/* ===== Tab: 출전선수등록 ===== */}
      {activeTab === "participants" && (
        <GlassCard>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", margin: 0 }}>
              출전선수 등록
            </h2>
            <GlassBadge variant="info">등록됨: {participantIds.size}명 / 전체: {allPlayers.length}명</GlassBadge>
          </div>

          {/* 스쿼드 관리 */}
          <div style={{ marginBottom: 18, padding: "14px 16px", background: "rgba(255,255,255,0.15)", borderRadius: 12, border: "1px solid rgba(99,102,241,0.1)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: hasSquads ? 10 : 0, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>스쿼드 (조 편성)</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="스쿼드명 (예: A조)"
                  value={newSquadName}
                  onChange={(e) => setNewSquadName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleCreateSquad(); }}
                  style={{
                    width: 130, padding: "6px 10px", borderRadius: 7, fontSize: 13,
                    background: "rgba(255,255,255,0.6)", border: "1px solid rgba(99,102,241,0.2)",
                    outline: "none", fontFamily: "inherit", color: "#1e293b",
                  }}
                />
                <GlassButton size="sm" onClick={() => void handleCreateSquad()}>+ 추가</GlassButton>
              </div>
            </div>
            {hasSquads && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {squads.map((sq) => {
                  const isSelected = selectedSquadId === sq.id;
                  const count = participantList.filter((p) => p.squadId === sq.id).length;
                  return (
                    <div key={sq.id} style={{ display: "flex", alignItems: "center", gap: 0 }}>
                      <button
                        onClick={() => setSelectedSquadId(sq.id)}
                        style={{
                          padding: "7px 14px", borderRadius: "8px 0 0 8px", fontSize: 13, fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? "#fff" : "#475569",
                          background: isSelected ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.4)",
                          border: isSelected ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(203,213,225,0.4)",
                          borderRight: "none", cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        {sq.name} ({count}명)
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm(`"${sq.name}" 스쿼드를 삭제하시겠습니까?`)) return;
                          void (async () => {
                            try {
                              const res = await fetch(`/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/squads/${sq.id}`, { method: "DELETE" });
                              if (!res.ok) throw new Error(await parseError(res));
                              setSquads((prev) => prev.filter((s) => s.id !== sq.id));
                              if (selectedSquadId === sq.id) setSelectedSquadId(squads.find((s) => s.id !== sq.id)?.id ?? null);
                              showMsg(`스쿼드 "${sq.name}" 삭제됨`);
                            } catch (err) { showMsg((err as Error).message || "삭제 실패", "error"); }
                          })();
                        }}
                        style={{
                          padding: "7px 8px", borderRadius: "0 8px 8px 0", fontSize: 11,
                          color: "#94a3b8", background: "rgba(255,255,255,0.3)",
                          border: "1px solid rgba(203,213,225,0.4)", cursor: "pointer", fontFamily: "inherit",
                        }}
                        title="스쿼드 삭제"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {hasSquads && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginRight: 4 }}>목록 보기:</span>
                  <button
                    type="button"
                    onClick={() => setParticipantViewSquadId(PARTICIPANT_VIEW_ALL)}
                    style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: participantViewSquadId === PARTICIPANT_VIEW_ALL ? 700 : 500,
                      color: participantViewSquadId === PARTICIPANT_VIEW_ALL ? "#fff" : "#475569",
                      background: participantViewSquadId === PARTICIPANT_VIEW_ALL ? "linear-gradient(135deg, #0f766e, #14b8a6)" : "rgba(255,255,255,0.4)",
                      border: participantViewSquadId === PARTICIPANT_VIEW_ALL ? "1px solid rgba(20,184,166,0.35)" : "1px solid rgba(203,213,225,0.4)",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    전체 ({allPlayers.length}명)
                  </button>
                  {squads.map((sq) => {
                    const count = participantList.filter((p) => p.squadId === sq.id).length;
                    const isSelected = participantViewSquadId === sq.id;
                    return (
                      <button
                        key={`participant-view-${sq.id}`}
                        type="button"
                        onClick={() => setParticipantViewSquadId(sq.id)}
                        style={{
                          padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? "#fff" : "#475569",
                          background: isSelected ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.4)",
                          border: isSelected ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(203,213,225,0.4)",
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        {sq.name} ({count}명)
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {!hasSquads && (
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "8px 0 0" }}>
                스쿼드 없이 운영하면 모든 출전선수가 동일 레인 배정에 포함됩니다. 선수가 레인 수용량을 초과하면 스쿼드를 추가하세요.
              </p>
            )}
          </div>

          {/* 선수번호로 빠른 등록 */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="선수번호 또는 범위 (예: 7, 1-30)"
              value={participantNumberInput}
              onChange={(e) => setParticipantNumberInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleParticipantNumberSubmit();
                }
              }}
              style={{
                width: 240, padding: "8px 12px", borderRadius: 8, fontSize: 14,
                background: "rgba(255,255,255,0.7)", border: "1.5px solid rgba(99,102,241,0.25)",
                outline: "none", fontFamily: "inherit", color: "#1e293b",
              }}
            />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>번호 입력 후 Enter{hasSquads && selectedSquadId ? ` → ${squads.find((s) => s.id === selectedSquadId)?.name}` : ""}</span>
          </div>

          {/* 검색 */}
          <input
            type="text"
            placeholder="선수 이름 또는 소속으로 검색..."
            value={participantSearch}
            onChange={(e) => setParticipantSearch(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14,
              background: "rgba(255,255,255,0.5)", border: "1.5px solid rgba(99,102,241,0.15)",
              outline: "none", fontFamily: "inherit", color: "#1e293b", marginBottom: 16,
              boxSizing: "border-box",
            }}
          />

          {/* 선수 목록 */}
          <div style={{ display: "grid", gap: 6, maxHeight: 500, overflowY: "auto" }}>
            {participantTabPlayers
              .map((p) => {
                const isRegistered = participantIds.has(p.id);
                const participant = participantMap.get(p.id);
                const playerSquad = participant?.squadId ? squads.find((s) => s.id === participant.squadId) : null;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (isRegistered) {
                        if (!confirm(`${p.name}님을 등록해제하시겠습니까?`)) return;
                        void handleRemoveParticipant(p.id);
                        return;
                      }
                      void handleAddParticipant(p.id);
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                      background: isRegistered ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.25)",
                      border: isRegistered ? "1.5px solid rgba(99,102,241,0.3)" : "1.5px solid rgba(203,213,225,0.3)",
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{
                      width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 8, fontSize: 13, fontWeight: 700,
                      background: isRegistered ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(203,213,225,0.3)",
                      color: isRegistered ? "#fff" : "#64748b",
                    }}>
                      {p.number}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#1e293b" }}>{p.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{p.region} · {p.affiliation}</p>
                    </div>
                    {hasSquads && isRegistered && playerSquad && (
                      <span style={{
                        padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: "rgba(99,102,241,0.08)", color: "#6366f1",
                      }}>
                        {playerSquad.name}
                      </span>
                    )}
                    <span style={{
                      padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: isRegistered ? "rgba(99,102,241,0.15)" : "rgba(203,213,225,0.2)",
                      color: isRegistered ? "#6366f1" : "#94a3b8",
                    }}>
                      {isRegistered ? "등록됨 ✓" : "미등록"}
                    </span>
                  </div>
                );
              })}
          </div>
        </GlassCard>
      )}

      {/* ===== Tab: 레인 배정 ===== */}
      {activeTab === "lane" && (
        <GlassCard>
          {/* 스쿼드 선택 (스쿼드 있을 때만) */}
          {hasSquads && renderSquadSelector()}
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <GlassButton onClick={handleRandomAssign} disabled={loading}>
              🔀 랜덤 배정{hasSquads && selectedSquadId ? ` (${squads.find((s) => s.id === selectedSquadId)?.name})` : ""}
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
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const payload = decodeDrag(e.dataTransfer.getData("text/plain"));
                              if (payload && payload.playerId !== pid) movePlayer(payload.playerId, laneNum, payload.sourceLane, pid);
                            }}
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

          {/* 스쿼드 선택 */}
          {hasSquads && renderSquadSelector({
            onSelect: (id) => { setSelectedSquadId(id); setSelectedScoreLane(0); },
            showCount: true,
          })}

          {scoreActiveLanes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
              <p style={{ fontSize: 36, marginBottom: 8 }}>🎳</p>
              <p>먼저 레인 배정 탭에서 선수를 배정해 주세요.</p>
            </div>
          ) : (
            <>
              {/* 레인 서브탭 */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
                {scoreActiveLanes.map((laneNum) => {
                  const isActive = (selectedScoreLane || scoreActiveLanes[0]) === laneNum;
                  const lanePlayerIds = scoreFilteredBoard[laneNum] ?? [];
                  const savedCount = lanePlayerIds.filter((pid) => {
                    const row = scoreFilteredEventRows.find((r) => r.playerId === pid);
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
              {draftRecoveredCount > 0 && (
                <StatusBanner tone="info" style={{ marginBottom: 12 }}>
                  임시저장된 점수 {draftRecoveredCount}건을 복원했습니다.
                  <button
                    type="button"
                    onClick={resetDraftToSavedScores}
                    style={{ marginLeft: 10, background: "none", border: "none", color: "#6366f1", fontWeight: 700, cursor: "pointer" }}
                  >
                    임시저장 초기화
                  </button>
                </StatusBanner>
              )}

              <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 14, padding: "18px 16px", border: "1px solid rgba(99,102,241,0.15)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: "#6366f1", background: "rgba(99,102,241,0.1)", padding: "4px 14px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.2)" }}>
                      Lane {activeScoreLane}
                    </span>
                    <span style={{ fontSize: 13, color: "#64748b" }}>선수 {activeLaneRows.length}명</span>
                    {event && event.tableShift !== 0 && selectedGame > 1 && (
                      <GlassBadge variant="info">
                        {selectedGame - 1}G Lane {(() => {
                          const shift = event.tableShift;
                          const laneCount = event.laneEnd - event.laneStart + 1;
                          const prevLane = ((activeScoreLane - event.laneStart - shift) % laneCount + laneCount) % laneCount + event.laneStart;
                          return prevLane;
                        })()} 에서 이동
                      </GlassBadge>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <GlassButton size="sm" variant="secondary" onClick={resetDraftToSavedScores}>초안 초기화</GlassButton>
                    <GlassButton size="sm" onClick={() => void handleSaveAllInLane(activeScoreLane)} disabled={loading}>💾 레인 전체 저장</GlassButton>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {activeLaneRows.map((row) => {
                    const savedScore = row.gameScores[selectedGame - 1]?.score;
                    const hasSaved = savedScore !== null && savedScore !== undefined;
                    const lanePlayerIds = activeLaneRows.map((laneRow) => laneRow.playerId);
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
                          border: hasSaved ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(255,255,255,0.3)",
                        }}
                      >
                        <span style={{ textAlign: "center", fontWeight: 800, fontSize: 15, color: "#6366f1", background: "rgba(99,102,241,0.1)", borderRadius: 6, padding: "2px 0" }}>{row.number}</span>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{row.name}</p>
                          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{row.region} · {row.affiliation}</p>
                        </div>
                        {hasSaved ? <GlassBadge variant="success">{savedScore}점 ✓</GlassBadge> : <span style={{ fontSize: 12, color: "#cbd5e1" }}>미입력</span>}
                        <input
                          ref={(node) => {
                            scoreInputRefs.current[row.playerId] = node;
                          }}
                          type="text"
                          min={0}
                          max={MAX_SCORE}
                          step={1}
                          value={scoreDraft[row.playerId] ?? ""}
                          onChange={(e) => {
                            scoreDirtyRef.current.add(row.playerId);
                            setScoreDraft((prev) => ({ ...prev, [row.playerId]: e.target.value }));
                          }}
                          onFocus={(e) => e.currentTarget.select()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleSaveScore(row.playerId).then(() => focusAdjacentScoreInput(lanePlayerIds, row.playerId, 1));
                              return;
                            }
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              focusAdjacentScoreInput(lanePlayerIds, row.playerId, 1);
                              return;
                            }
                            if (e.key === "ArrowUp") {
                              e.preventDefault();
                              focusAdjacentScoreInput(lanePlayerIds, row.playerId, -1);
                            }
                          }}
                          placeholder="0~300"
                          style={{ width: 80, padding: "8px 10px", borderRadius: 8, fontSize: 15, textAlign: "center", fontWeight: 600, background: "rgba(255,255,255,0.7)", border: "1.5px solid rgba(99,102,241,0.25)", outline: "none", fontFamily: "inherit", color: "#1e293b" }}
                        />
                        <GlassButton size="sm" onClick={() => void handleSaveScore(row.playerId)}>저장</GlassButton>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* 미배정 선수 (하단 접이식) */}
              {scoreFilteredEventRows.filter((row) => getLaneForPlayerInGameBoard(currentBoard, row.playerId) === 0).length > 0 && (
                <div style={{ marginTop: 12, background: "rgba(241,245,249,0.3)", borderRadius: 10, padding: "12px 14px", border: "1px dashed rgba(203,213,225,0.5)" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 10 }}>
                    ⚠️ 레인 미배정 선수
                  </p>
                  <div style={{ display: "grid", gap: 8 }}>
                    {scoreFilteredEventRows.filter((row) => getLaneForPlayerInGameBoard(currentBoard, row.playerId) === 0).map((row) => (
                      <div key={row.playerId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, color: "#94a3b8", minWidth: 28 }}>{row.number}</span>
                        <span style={{ flex: 1, fontSize: 13, color: "#94a3b8" }}>{row.name}</span>
                        <input
                          type="text" min={0} max={MAX_SCORE}
                          value={scoreDraft[row.playerId] ?? ""}
                          onChange={(e) => { scoreDirtyRef.current.add(row.playerId); setScoreDraft((prev) => ({ ...prev, [row.playerId]: e.target.value })); }}
                          onKeyDown={(e) => { if (e.key === "Enter") { scoreDirtyRef.current.delete(row.playerId); void handleSaveScore(row.playerId); } }}
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
          <RankingTable rows={eventRows} emptyMessage="순위 데이터가 없습니다." onSelectPlayer={(playerName) => setSelectedPlayer(playerName)} />
        </GlassCard>
      )}

      {/* ===== Tab: 종합순위 ===== */}
      {activeTab === "overall-rank" && (
        <GlassCard>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>전체 종합순위</h2>
          <RankingTable rows={overallRows} emptyMessage="종합점수 데이터가 없습니다." onSelectPlayer={(playerName) => setSelectedPlayer(playerName)} showOverallOnly />
        </GlassCard>
      )}
      {selectedPlayer && (
        <PlayerProfileModal
          playerName={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}



























