"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getLaneForGame } from "@/lib/lane";
import { reorderAssignmentsWithinLane } from "@/lib/lane-reorder";
import { applyScoreToEventRows, markRankRefreshComplete, markRankRefreshPending } from "@/lib/scoreboard-rank-state";
import { buildTeamSquadCards } from "@/lib/admin/team-squad";
import { getTeamActiveMemberIdsForGame, getTeamBenchMemberIdsForGame, getTeamRosterIds } from "@/lib/team-lineup";
import { buildFivesAssignmentSegments } from "@/lib/services/competitionService";
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
import { applySavedDraftEntries } from "@/lib/score-save-state";
import { createLoadedScoreboardSections, markSectionLoaded, markSectionStale, needsSectionLoad } from "@/lib/admin-scoreboard-sections";
import { exportEventScoreboard } from "@/lib/admin/excel-export";
type ScoreColumn = { gameNumber: number; score: number | null };
type EventLeaderboardRow = {
  playerId: string;
  rank: number;
  tieRank: number;
  attempts: number;
  region: string;
  affiliation: string;
  group?: string;
  number: number;
  name: string;
  gameScores: ScoreColumn[];
  total: number;
  average: number;
  pinDiff: number;
};

type OverallLeaderboardRow = EventLeaderboardRow & { gameCount: number; eventTotals?: Record<string, number> };

type Player = {
  id: string;
  number: number;
  name: string;
  affiliation: string;
  region: string;
  group: string;
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
  fivesConfig?: {
    firstHalfGameCount: number;
    secondHalfGameCount: number;
  };
  linkedEventId?: string;
  halfType?: "FIRST" | "SECOND";
  rankRefreshPending?: boolean;
  rankRefreshedAt?: string | null;
};

type Assignment = {
  id: string;
  playerId: string;
  gameNumber: number;
  laneNumber: number;
  position?: number;
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

type Team = {
  id: string;
  name: string;
  teamType: "NORMAL" | "MAKEUP" | "PARTIAL";
  memberIds: string[];
  rosterIds?: string[];
  firstHalfMemberIds?: string[];
  secondHalfMemberIds?: string[];
  createdAt: string;
  updatedAt: string;
};

type TeamMemberRow = {
  playerId: string;
  name: string;
  affiliation: string;
  region: string;
  number: number;
  gameScores: ScoreColumn[];
  total: number;
};

type TeamRankingRow = {
  teamId: string;
  teamName: string;
  teamType: "NORMAL" | "MAKEUP" | "PARTIAL";
  rank: number;
  tieRank: number;
  members: (TeamMemberRow & { average?: number; playsFirstHalf?: boolean; playsSecondHalf?: boolean })[];
  teamGameTotals?: Array<number | null>;
  teamTotal: number;
  pinDiff: number;
};

const TEAM_EVENT_KINDS = ["DOUBLES", "TRIPLES", "FIVES"] as const;
type TeamEventKind = typeof TEAM_EVENT_KINDS[number];

const TEAM_SIZE_MAP: Record<TeamEventKind, number> = {
  DOUBLES: 2,
  TRIPLES: 3,
  FIVES: 5,
};

type ApiList<T> = { items: T[] };
type ApiError = { message?: string };
type ScoreboardTab = "participants" | "lane" | "score" | "event-rank" | "overall-rank" | "teams";
const PARTICIPANT_VIEW_ALL = "ALL";

const TAB_LABELS: Record<ScoreboardTab, string> = {
  participants: "📋 조편성",
  teams: "👥 팀 편성",
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
const BASE_MAX_PER_LANE = 4;
const FIVES_MAX_PER_LANE = 5;
const TEAM_COLORS = [
  { bg: "rgba(99,102,241,0.10)", border: "rgba(99,102,241,0.35)", text: "#4f46e5" },
  { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.35)", text: "#059669" },
  { bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.35)", text: "#d97706" },
  { bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.35)", text: "#dc2626" },
  { bg: "rgba(168,85,247,0.10)", border: "rgba(168,85,247,0.35)", text: "#7c3aed" },
  { bg: "rgba(6,182,212,0.10)", border: "rgba(6,182,212,0.35)", text: "#0891b2" },
  { bg: "rgba(236,72,153,0.10)", border: "rgba(236,72,153,0.35)", text: "#db2777" },
  { bg: "rgba(101,163,13,0.10)", border: "rgba(101,163,13,0.35)", text: "#65a30d" },
] as const;

const getTeamTypeLabel = (teamType: "NORMAL" | "MAKEUP" | "PARTIAL") => {
  if (teamType === "NORMAL") return "정상팀";
  if (teamType === "PARTIAL") return "개인기록";
  return "혼성팀";
};


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
  const [teamsViewSquadId, setTeamsViewSquadId] = useState<string>(PARTICIPANT_VIEW_ALL);
  const [newSquadName, setNewSquadName] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");
  const [eventRows, setEventRows] = useState<EventLeaderboardRow[]>([]);
  const [overallRows, setOverallRows] = useState<OverallLeaderboardRow[]>([]);
  const [eventTitleMap, setEventTitleMap] = useState<Record<string, string>>({});
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamRows, setTeamRows] = useState<TeamRankingRow[]>([]);
  const [fivesCombinedRows, setFivesCombinedRows] = useState<TeamRankingRow[]>([]);
  const [selectedTeamMemberIds, setSelectedTeamMemberIds] = useState<Set<string>>(new Set());
  // 5인조 로스터 편집: { teamId, rosterIds, firstHalfMemberIds, secondHalfMemberIds }
  const [editingRoster, setEditingRoster] = useState<{
    teamId: string;
    rosterIds: string[];
    firstHalfMemberIds: string[];
    secondHalfMemberIds: string[];
  } | null>(null);
  const [selectedGame, setSelectedGame] = useState(1);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);
  const [scoreDraft, setScoreDraft] = useState<Record<string, string>>({});
  const [selectedScoreLane, setSelectedScoreLane] = useState<number>(0);
  const [draftRecoveredCount, setDraftRecoveredCount] = useState(0);
  const [loadedSections, setLoadedSections] = useState(createLoadedScoreboardSections);
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
    () => new Set(
      (event?.kind === "SINGLE" ? allPlayers.map((player) => ({ id: player.id })) : participantList).map((p) => p.id),
    ),
    [allPlayers, event?.kind, participantList],
  );

  const effectiveParticipantList = useMemo(
    () => event?.kind === "SINGLE"
      ? allPlayers.map((player) => {
          const existing = participantList.find((participant) => (participant.playerId ?? participant.id) === player.id);
          return {
            id: player.id,
            playerId: player.id,
            ...(existing?.squadId ? { squadId: existing.squadId } : {}),
          };
        })
      : participantList,
    [allPlayers, event?.kind, participantList],
  );

  const participantMap = useMemo(
    () => new Map(effectiveParticipantList.map((p) => [p.id, p])),
    [effectiveParticipantList],
  );
  const participantViewIds = useMemo(() => {
    if (!hasSquads || participantViewSquadId === PARTICIPANT_VIEW_ALL) return null;
    return new Set(effectiveParticipantList.filter((p) => p.squadId === participantViewSquadId).map((p) => p.id));
  }, [effectiveParticipantList, hasSquads, participantViewSquadId]);

  const squadParticipantIds = useMemo(() => {
    if (!hasSquads || !selectedSquadId) return participantIds;
    return new Set(effectiveParticipantList.filter((p) => p.squadId === selectedSquadId).map((p) => p.id));
  }, [effectiveParticipantList, selectedSquadId, hasSquads, participantIds]);

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

  const isTeamEvent = useMemo(
    () => TEAM_EVENT_KINDS.includes(event?.kind as TeamEventKind),
    [event],
  );
  const isSingleEvent = event?.kind === "SINGLE";
  const participantTabLabel = isSingleEvent ? "📋 조편성" : "👥 팀 조편성";
  const teamSquadCards = useMemo(
    () => buildTeamSquadCards(
      teams,
      allPlayers,
      effectiveParticipantList,
      participantViewSquadId === PARTICIPANT_VIEW_ALL ? null : participantViewSquadId,
    ).filter((team) => {
      const keyword = participantSearch.trim().toLowerCase();
      if (!keyword) return true;
      return (
        team.name.toLowerCase().includes(keyword)
        || team.members.some((member) =>
          member.name.toLowerCase().includes(keyword)
          || member.affiliation.toLowerCase().includes(keyword)
          || String(member.number).includes(keyword))
      );
    }),
    [allPlayers, effectiveParticipantList, participantSearch, participantViewSquadId, teams],
  );
  const assignedTeamCount = useMemo(
    () => buildTeamSquadCards(teams, allPlayers, effectiveParticipantList).filter((team) => team.status === "assigned").length,
    [allPlayers, effectiveParticipantList, teams],
  );

  const teamSize = useMemo(
    () => isTeamEvent ? TEAM_SIZE_MAP[event!.kind as TeamEventKind] : 0,
    [isTeamEvent, event],
  );

  const firstHalfGameCount = event?.fivesConfig?.firstHalfGameCount ?? Math.floor((event?.gameCount ?? 0) / 2);
  const secondHalfGameCount = event?.fivesConfig?.secondHalfGameCount ?? Math.max(0, (event?.gameCount ?? 0) - firstHalfGameCount);
  const isSingleEventFives = event?.kind === "FIVES" && Boolean(event?.fivesConfig);
  const assignmentSegments = useMemo(
    () => event
      ? (isSingleEventFives && event.fivesConfig
          ? buildFivesAssignmentSegments(event.gameCount, event.fivesConfig)
          : [{ startGame: 1, endGame: event.gameCount }])
      : [],
    [event, isSingleEventFives],
  );
  const fivesDisplayRows = useMemo(
    () => (event?.kind === "FIVES" && (event?.halfType === "SECOND" || isSingleEventFives) && fivesCombinedRows.length > 0
      ? fivesCombinedRows
      : teamRows),
    [event, fivesCombinedRows, isSingleEventFives, teamRows],
  );

  const maxPerLane = event?.kind === "FIVES" ? FIVES_MAX_PER_LANE : BASE_MAX_PER_LANE;

  const getActiveTeamMemberIds = useCallback((team: Team, gameNumber = selectedGame) => (
    getTeamActiveMemberIdsForGame(team, {
      kind: event?.kind,
      gameNumber,
      gameCount: event?.gameCount,
      fivesConfig: event?.fivesConfig,
    })
  ), [event, selectedGame]);

  const getTeamRoster = useCallback((team: Team) => getTeamRosterIds(team), []);

  // 출전선수 중 아직 팀에 배정되지 않은 선수
  const assignedToTeamIds = useMemo(
    () => new Set(teams.flatMap((team) => event?.kind === "FIVES" ? getTeamRoster(team) : team.memberIds)),
    [event?.kind, getTeamRoster, teams],
  );

  // 출전선수 ID Set (participantList 기반)
  const participantPlayerIds = useMemo(
    () => new Set(effectiveParticipantList.map((p) => p.playerId ?? p.id)),
    [effectiveParticipantList],
  );
  const laneSquadPlayerIds = useMemo(
    () => new Set(players.map((player) => player.id)),
    [players],
  );
  const currentSquadTeams = useMemo(
    () => teams.filter((team) => getTeamRoster(team).some((playerId) => laneSquadPlayerIds.has(playerId))),
    [getTeamRoster, laneSquadPlayerIds, teams],
  );
  // 5인조: 현재 스쿼드 로스터에 속하지만 이번 게임 라인업에는 없는 대기 선수
  const benchPlayerIds = useMemo(() => {
    if (!isTeamEvent || event?.kind !== "FIVES") return new Set<string>();
    const bench = new Set<string>();
    for (const team of currentSquadTeams) {
      for (const playerId of getTeamBenchMemberIdsForGame(team, {
        kind: event.kind,
        gameNumber: selectedGame,
        gameCount: event.gameCount,
        fivesConfig: event.fivesConfig,
      })) {
        if (laneSquadPlayerIds.has(playerId)) {
          bench.add(playerId);
        }
      }
    }
    return bench;
  }, [currentSquadTeams, event, getTeamBenchMemberIdsForGame, isTeamEvent, laneSquadPlayerIds, selectedGame]);

  const unteamedParticipants = useMemo(
    () => allPlayers.filter(
      (p) => participantPlayerIds.has(p.id) && !assignedToTeamIds.has(p.id) && !benchPlayerIds.has(p.id),
    ),
    [allPlayers, participantPlayerIds, assignedToTeamIds, benchPlayerIds],
  );

  // 팀 탭 스쿼드 필터
  const teamsViewSquadPlayerIds = useMemo(() => {
    if (!hasSquads || teamsViewSquadId === PARTICIPANT_VIEW_ALL) return null;
    return new Set(effectiveParticipantList.filter((p) => p.squadId === teamsViewSquadId).map((p) => p.playerId ?? p.id));
  }, [effectiveParticipantList, hasSquads, teamsViewSquadId]);

  const squadFilteredUnteamedParticipants = useMemo(
    () => teamsViewSquadPlayerIds
      ? unteamedParticipants.filter((p) => teamsViewSquadPlayerIds.has(p.id))
      : unteamedParticipants,
    [unteamedParticipants, teamsViewSquadPlayerIds],
  );

  const squadFilteredTeams = useMemo(
    () => teamsViewSquadPlayerIds
      ? teams.filter((team) => getTeamRoster(team).some((playerId) => teamsViewSquadPlayerIds.has(playerId)))
      : teams,
    [getTeamRoster, teams, teamsViewSquadPlayerIds],
  );
  const teamEditorEligiblePlayerIds = useMemo(
    () => teamsViewSquadPlayerIds ?? participantPlayerIds,
    [participantPlayerIds, teamsViewSquadPlayerIds],
  );

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

  // 팀 이벤트: 레인 미배정 팀 (출전 멤버 전원 미배정인 팀)
  const unassignedTeams = useMemo(() => {
    if (!isTeamEvent) return [];
    return teams.filter((team) => {
      const activeMembers = getActiveTeamMemberIds(team).filter((pid) => laneSquadPlayerIds.has(pid));
      return activeMembers.length > 0 && activeMembers.every((pid) => !hasPlayerInBoard(currentBoard, pid));
    });
  }, [currentBoard, getActiveTeamMemberIds, isTeamEvent, laneSquadPlayerIds, teams]);

  // 팀에 속하지 않거나 팀이 부분배정된 미배정 선수 (대기선수 제외)
  const unassignedNonTeamPlayers = useMemo(() => {
    if (!isTeamEvent || teams.length === 0) return unassignedPlayers.filter((p) => !benchPlayerIds.has(p.id));
    const fullyUnassignedTeamMemberIds = new Set(
      unassignedTeams.flatMap((team) => getActiveTeamMemberIds(team).filter((playerId) => laneSquadPlayerIds.has(playerId))),
    );
    return unassignedPlayers.filter((p) => !fullyUnassignedTeamMemberIds.has(p.id) && !benchPlayerIds.has(p.id));
  }, [benchPlayerIds, getActiveTeamMemberIds, isTeamEvent, laneSquadPlayerIds, teams, unassignedPlayers, unassignedTeams]);

  // 플레이어 ID → 팀 이름 맵 (레인 보드 표시용)
  const playerTeamNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const team of teams) {
      for (const pid of getActiveTeamMemberIds(team)) m.set(pid, team.name);
    }
    return m;
  }, [getActiveTeamMemberIds, teams]);

  // 팀 ID → 색상 맵 (점수입력 등에서 팀 구분용)
  const playerTeamColorMap = useMemo(() => {
    const teamIdToIdx = new Map<string, number>();
    teams.forEach((t, i) => teamIdToIdx.set(t.id, i % TEAM_COLORS.length));
    const m = new Map<string, { bg: string; border: string; text: string; teamName: string }>();
    for (const team of teams) {
      const color = TEAM_COLORS[teamIdToIdx.get(team.id)!];
      for (const pid of getActiveTeamMemberIds(team)) m.set(pid, { ...color, teamName: team.name });
    }
    return m;
  }, [getActiveTeamMemberIds, teams]);

  const bundleUrl = `/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/bundle`;
  const rankRefreshUrl = `/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/rank-refresh`;
  const draftStorageKey = `${tournamentId}:${divisionId}:${eventId}:game-${selectedGame}:lane-${selectedScoreLane}`;

  // --- API loaders ---
  const participantsUrl = `/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/participants`;

  const handleAddParticipant = async (playerId: string, options?: { silent?: boolean }) => {
    try {
      if (isSingleEvent && hasSquads && !selectedSquadId) {
        throw new Error("먼저 배정할 스쿼드를 선택해 주세요.");
      }
      const res = await fetch(participantsUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: [playerId], squadId: hasSquads ? selectedSquadId : undefined }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      setParticipantList((prev) => {
        const next = prev.filter((pt) => (pt.playerId ?? pt.id) !== playerId);
        next.push({ id: playerId, playerId, squadId: hasSquads ? selectedSquadId ?? undefined : undefined });
        return next;
      });
      return true;
    } catch (err) { if (!options?.silent) showMsg((err as Error).message || "등록 실패", "error"); return false; }
  };

  const handleRemoveParticipant = async (playerId: string) => {
    try {
      const res = await fetch(participantsUrl, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      setParticipantList((prev) => prev.filter((pt) => (pt.playerId ?? pt.id) !== playerId));
      return true;
    } catch (err) { showMsg((err as Error).message || "해제 실패", "error"); return false; }
  };

  const handleAssignTeamToSquad = async (team: Team, squadId: string | null) => {
    const rosterIds = getTeamRoster(team);
    if (rosterIds.length === 0) {
      return;
    }

    try {
      const res = await fetch(participantsUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: rosterIds, squadId }),
      });
      if (!res.ok) throw new Error(await parseError(res));

      setParticipantList((prev) => {
        const prevByPlayerId = new Map(prev.map((participant) => [participant.playerId ?? participant.id, participant]));
        return rosterIds.map((playerId) => {
          const existing = prevByPlayerId.get(playerId);
          return {
            id: existing?.id ?? playerId,
            playerId,
            ...(squadId ? { squadId } : {}),
          };
        }).concat(prev.filter((participant) => !rosterIds.includes(participant.playerId ?? participant.id)));
      });

      if (squadId) {
        const squadName = squads.find((squad) => squad.id === squadId)?.name ?? "선택 스쿼드";
        showMsg(`팀 "${team.name}"을 ${squadName}에 배정했습니다.`);
      } else {
        showMsg(`팀 "${team.name}"의 스쿼드 배정을 해제했습니다.`);
      }
    } catch (err) {
      showMsg((err as Error).message || "팀 조편성 저장 실패", "error");
    }
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

  const teamsUrl = `/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/teams`;

  const toggleTeamMemberSelection = (playerId: string) => {
    setSelectedTeamMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  };

  const handleCreateTeam = async () => {
    if (selectedTeamMemberIds.size === 0) return;
    try {
      const memberIds = [...selectedTeamMemberIds];
      const body = event?.kind === "FIVES"
        ? {
            memberIds,
            rosterIds: memberIds,
            firstHalfMemberIds: memberIds,
            secondHalfMemberIds: memberIds,
          }
        : { memberIds };

      const res = await fetch(teamsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = body?.message;
        if (msg === "MEMBER_ALREADY_IN_TEAM") throw new Error("이미 다른 팀에 속한 선수가 포함되어 있습니다.");
        if (msg === "INVALID_PAYLOAD") throw new Error("팀 생성에 필요한 최소 인원(2명)이 필요합니다.");
        throw new Error(msg || "팀 생성 실패");
      }
      const created: Team = await res.json();
      setTeams((prev) => [...prev, created]);
      setSelectedTeamMemberIds(new Set());
      setLoadedSections((prev) => markSectionStale(prev, "scores"));
      showMsg(`팀 "${created.name}" 생성됨 (${getTeamTypeLabel(created.teamType)})`);
    } catch (err) { showMsg((err as Error).message || "팀 생성 실패", "error"); }
  };

  const handleSaveRoster = async () => {
    if (!editingRoster) return;
    const { teamId, rosterIds, firstHalfMemberIds, secondHalfMemberIds } = editingRoster;
    if (firstHalfMemberIds.length !== teamSize || secondHalfMemberIds.length !== teamSize) {
      showMsg(`전반/후반 출전 선수는 각각 정확히 ${teamSize}명이어야 합니다.`, "error");
      return;
    }

    const originalTeam = teams.find((t) => t.id === teamId);
    const originalRosterIds = originalTeam?.rosterIds ?? originalTeam?.memberIds ?? [];
    const removedPlayerIds = originalRosterIds.filter((id) => !rosterIds.includes(id));

    try {
      const res = await fetch(`${teamsUrl}/${teamId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rosterIds,
          firstHalfMemberIds,
          secondHalfMemberIds,
          memberIds: firstHalfMemberIds,
        }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      const updatedTeam: Team = await res.json();
      let shouldReloadTeams = false;

      if (removedPlayerIds.length > 0) {
        const removedNames = removedPlayerIds
          .map((id) => playerById.get(id))
          .filter(Boolean)
          .map((p) => `${p!.number} ${p!.name}`)
          .join(", ");
        if (window.confirm(`${removedNames} 선수를 혼성(make-up) 팀으로 구성할까요?`)) {
          shouldReloadTeams = true;
          const optimisticTeams = teams.map((team) => (team.id === teamId ? { ...team, ...updatedTeam } : team));
          const existingMakeup = optimisticTeams.find(
            (t) => t.teamType === "MAKEUP" && t.memberIds.length < teamSize
          );

          if (existingMakeup) {
            const newMids = [...existingMakeup.memberIds, ...removedPlayerIds];
            const newRids = [...(existingMakeup.rosterIds ?? existingMakeup.memberIds), ...removedPlayerIds];
            await fetch(`${teamsUrl}/${existingMakeup.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                memberIds: newMids,
                rosterIds: newRids,
                firstHalfMemberIds: existingMakeup.firstHalfMemberIds ?? newMids,
                secondHalfMemberIds: existingMakeup.secondHalfMemberIds ?? newMids,
              }),
            });
          } else {
            await fetch(teamsUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                memberIds: removedPlayerIds,
                rosterIds: removedPlayerIds,
                firstHalfMemberIds: removedPlayerIds,
                secondHalfMemberIds: removedPlayerIds,
              }),
            });
          }
        }
      }

      if (shouldReloadTeams) {
        if (!needsSectionLoad(loadedSections, "teams")) {
          await loadTeams();
        }
      } else {
        setTeams((prev) => prev.map((team) => (team.id === teamId ? { ...team, ...updatedTeam } : team)));
      }
      setLoadedSections((prev) => markSectionStale(prev, "scores"));
      setEditingRoster(null);
      showMsg("로스터가 저장되었습니다.");
    } catch (err) { showMsg((err as Error).message || "로스터 저장 실패", "error"); }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!window.confirm("팀을 삭제하시겠습니까? 선수 점수는 유지됩니다.")) return;
    try {
      const res = await fetch(`${teamsUrl}/${teamId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await parseError(res));
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      setTeamRows((prev) => prev.filter((r) => r.teamId !== teamId));
      setLoadedSections((prev) => markSectionStale(prev, "scores"));
      showMsg("팀이 삭제되었습니다.");
    } catch (err) { showMsg((err as Error).message || "팀 삭제 실패", "error"); }
  };
  // Section loaders with local-state reuse
  const loadAssignments = useCallback(async (signal?: AbortSignal) => {
    if (!tournamentId || !divisionId || !eventId) return;
    const res = await fetch(`${bundleUrl}?only=assignments`, { cache: "no-store", signal });
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json() as { assignments: Assignment[] };
    setAssignments(data.assignments ?? []);
    setLoadedSections((prev) => markSectionLoaded(prev, "assignments"));
  }, [bundleUrl, divisionId, eventId, tournamentId]);

  const loadSetup = useCallback(async (signal?: AbortSignal) => {
    if (!tournamentId || !divisionId || !eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`${bundleUrl}?only=setup`, { cache: "no-store", signal });
      if (!res.ok) throw new Error(await parseError(res));
      const data = await res.json() as { event: EventInfo | null; players: Player[]; participants: Participant[]; squads: Squad[] };
      setEvent(data.event ?? null);
      setAllPlayers(data.players ?? []);
      setParticipantList(data.participants ?? []);
      setSquads(data.squads ?? []);
      setLoadedSections((prev) => markSectionLoaded(prev, "setup"));
      const nextEvent = data.event;
      if (nextEvent) {
        setSelectedGame((prev) => (prev < 1 || prev > nextEvent.gameCount ? 1 : prev));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") showMsg((err as Error).message || "조회 실패", "error");
    } finally { setLoading(false); }
  }, [bundleUrl, divisionId, eventId, tournamentId]);

  const loadScores = useCallback(async (signal?: AbortSignal) => {
    if (!tournamentId || !divisionId || !eventId) return;
    const res = await fetch(`${bundleUrl}?only=scores`, { cache: "no-store", signal });
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json() as { eventRows: EventLeaderboardRow[]; overallRows: OverallLeaderboardRow[]; teamRows?: TeamRankingRow[]; fivesCombinedRows?: TeamRankingRow[]; eventTitleMap?: Record<string, string> };
    setEventRows(data.eventRows ?? []);
    setOverallRows(data.overallRows ?? []);
    if (data.eventTitleMap) setEventTitleMap(data.eventTitleMap);
    if (data.teamRows) setTeamRows(data.teamRows);
    if (data.fivesCombinedRows) setFivesCombinedRows(data.fivesCombinedRows);
    setLoadedSections((prev) => markSectionLoaded(prev, "scores"));
  }, [bundleUrl, divisionId, eventId, tournamentId]);

  const loadTeams = useCallback(async (signal?: AbortSignal) => {
    if (!tournamentId || !divisionId || !eventId) return;
    const res = await fetch(teamsUrl, { cache: "no-store", signal });
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json() as { teams: Team[] };
    setTeams(data.teams ?? []);
    setLoadedSections((prev) => markSectionLoaded(prev, "teams"));
  }, [divisionId, eventId, teamsUrl, tournamentId]);

  const applySavedScoreLocally = useCallback((playerId: string, gameNumber: number, score: number) => {
    setEventRows((prev) => applyScoreToEventRows(prev, { playerId, gameNumber, score }));
    setEvent((prev) => (prev ? markRankRefreshPending(prev) : prev));
  }, []);

  const handleRefreshRanks = async () => {
    if (!event || !tournamentId || !divisionId || !eventId) return;
    setLoading(true);
    try {
      const res = await fetch(rankRefreshUrl, { method: "POST" });
      if (!res.ok) throw new Error(await parseError(res));
      const data = await res.json() as { eventRows: EventLeaderboardRow[]; overallRows: OverallLeaderboardRow[]; teamRows?: TeamRankingRow[]; fivesCombinedRows?: TeamRankingRow[]; eventTitleMap?: Record<string, string>; rankRefreshedAt?: string };
      setEventRows(data.eventRows ?? []);
      setOverallRows(data.overallRows ?? []);
      setTeamRows(data.teamRows ?? []);
      setFivesCombinedRows(data.fivesCombinedRows ?? []);
      if (data.eventTitleMap) setEventTitleMap(data.eventTitleMap);
      setLoadedSections((prev) => markSectionLoaded(prev, "scores"));
      if (data.rankRefreshedAt) {
        setEvent((prev) => (prev ? markRankRefreshComplete(prev, data.rankRefreshedAt!) : prev));
      }
      showMsg("순위가 반영되었습니다.");
    } catch (err) {
      showMsg((err as Error).message || "순위 반영 실패", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoadedSections(createLoadedScoreboardSections());
    setEventRows([]);
    setOverallRows([]);
    setTeamRows([]);
    setFivesCombinedRows([]);
    setTeams([]);
    setAssignments([]);
    void loadSetup(controller.signal);
    return () => { controller.abort(); };
  }, [loadSetup]);

  useEffect(() => {
    if (needsSectionLoad(loadedSections, "setup")) return;
    if (activeTab !== "score" && activeTab !== "event-rank" && activeTab !== "overall-rank") return;
    if (!needsSectionLoad(loadedSections, "scores")) return;
    const controller = new AbortController();
    void loadScores(controller.signal).catch((err) => { if ((err as Error).name !== "AbortError") showMsg((err as Error).message || "점수 조회 실패", "error"); });
    return () => { controller.abort(); };
  }, [activeTab, loadScores, loadedSections]);

  useEffect(() => {
    if (needsSectionLoad(loadedSections, "setup")) return;
    if (activeTab !== "lane" && activeTab !== "score") return;
    if (!needsSectionLoad(loadedSections, "assignments")) return;
    const controller = new AbortController();
    void loadAssignments(controller.signal).catch((err) => {
      if ((err as Error).name !== "AbortError") showMsg((err as Error).message || "배정 조회 실패", "error");
    });
    return () => { controller.abort(); };
  }, [activeTab, loadAssignments, loadedSections]);

  useEffect(() => {
    const needsTeamsForTab = activeTab === "participants" || activeTab === "teams" || activeTab === "lane" || activeTab === "score";
    if (!isTeamEvent || !needsTeamsForTab) return;
    if (!needsSectionLoad(loadedSections, "teams")) return;
    const controller = new AbortController();
    void loadTeams(controller.signal).catch((err) => { if ((err as Error).name !== "AbortError") showMsg((err as Error).message || "팀 조회 실패", "error"); });
    return () => { controller.abort(); };
  }, [activeTab, isTeamEvent, loadTeams, loadedSections]);

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
  // 드래그 중 화면 가장자리 자동 스크롤
  const autoScrollRef = useRef<number | null>(null);
  const handleDragAutoScroll = useCallback((e: React.DragEvent) => {
    const EDGE = 80; // 가장자리 감지 영역 (px)
    const SPEED = 18; // 스크롤 속도 (px/frame)
    const y = e.clientY;
    const h = window.innerHeight;

    if (autoScrollRef.current) { cancelAnimationFrame(autoScrollRef.current); autoScrollRef.current = null; }

    if (y < EDGE) {
      const tick = () => { window.scrollBy(0, -SPEED); autoScrollRef.current = requestAnimationFrame(tick); };
      autoScrollRef.current = requestAnimationFrame(tick);
    } else if (y > h - EDGE) {
      const tick = () => { window.scrollBy(0, SPEED); autoScrollRef.current = requestAnimationFrame(tick); };
      autoScrollRef.current = requestAnimationFrame(tick);
    }
  }, []);
  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current) { cancelAnimationFrame(autoScrollRef.current); autoScrollRef.current = null; }
  }, []);

  const encodeDrag = (playerId: string, sourceLane?: number) => JSON.stringify({ playerId, sourceLane });
  const encodeTeamDrag = (teamId: string, memberIds: string[]) => JSON.stringify({ teamId, memberIds });
  const decodeDrag = (raw: string): { playerId: string; sourceLane?: number } | null => {
    try { const p = JSON.parse(raw); return typeof p?.playerId === "string" ? p : null; }
    catch { return null; }
  };
  const decodeTeamDrag = (raw: string): { teamId: string; memberIds: string[] } | null => {
    try { const p = JSON.parse(raw); return typeof p?.teamId === "string" && Array.isArray(p.memberIds) ? p : null; }
    catch { return null; }
  };

  // 팀 전체를 레인에 배정 (수용 인원 초과 시 경고)
  const moveTeam = (memberIds: string[], toLane?: number) => {
    if (!toLane) {
      // 레인 해제: 팀 멤버 전체 해제
      for (const pid of memberIds) movePlayer(pid, undefined);
      return;
    }
    const targetPlayers = currentBoard[toLane] ?? [];
    const unassigned = memberIds.filter((pid) => !hasPlayerInBoard(currentBoard, pid));
    if (targetPlayers.length + unassigned.length > maxPerLane) {
      showMsg(`레인 수용 초과: ${toLane}번 레인에 최대 ${maxPerLane}명까지 배정 가능합니다.`, "error");
      return;
    }
    // 팀 멤버 전체를 한번에 배정 (순서 보장)
    dirtyRef.current = true;
    setAssignments((cur) => {
      const currentVisible = hasSquads && selectedSquadId ? cur.filter((a) => a.squadId === selectedSquadId) : cur;
      let nextVisible = currentVisible;
      for (const pid of unassigned) {
        nextVisible = [...nextVisible.filter((a) => !(a.playerId === pid && a.gameNumber === selectedGame)),
          { id: `${pid}_${selectedGame}_${toLane}`, playerId: pid, gameNumber: selectedGame, laneNumber: toLane } as Assignment,
        ];
      }
      const rebuilt = rebuildSegmentGames(nextVisible, selectedGame);
      return mergeVisibleAssignments(cur, rebuilt);
    });
  };

  // 같은 레인 내 팀 멤버 순서 정렬: 같은 팀끼리 묶고, 팀 내 memberIds 순서 유지
  const groupLaneByTeam = (assigns: Assignment[], gameNumber = selectedGame): Assignment[] => {
    if (!isTeamEvent || teams.length === 0) return assigns;

    // 레인별로 그룹화
    const byLane = new Map<number, Assignment[]>();
    const others: Assignment[] = [];
    for (const a of assigns) {
      if (a.gameNumber === gameNumber) {
        if (!byLane.has(a.laneNumber)) byLane.set(a.laneNumber, []);
        byLane.get(a.laneNumber)!.push(a);
      } else {
        others.push(a);
      }
    }

    const sorted: Assignment[] = [];
    for (const [, laneAssigns] of byLane) {
      laneAssigns.sort((a, b) => {
        const tA = teams.find((team) => getActiveTeamMemberIds(team, gameNumber).includes(a.playerId));
        const tB = teams.find((team) => getActiveTeamMemberIds(team, gameNumber).includes(b.playerId));
        if (!tA && !tB) return 0;
        if (tA && !tB) return -1;
        if (!tA && tB) return 1;
        if (tA!.id !== tB!.id) return tA!.id < tB!.id ? -1 : 1;
        // 같은 팀: memberIds 내 순서 유지
        return getActiveTeamMemberIds(tA!, gameNumber).indexOf(a.playerId) - getActiveTeamMemberIds(tA!, gameNumber).indexOf(b.playerId);
      });
      sorted.push(...laneAssigns);
    }
    return [...sorted, ...others];
  };

  const rebuildSegmentGames = (cur: Assignment[], anchorGame = selectedGame): Assignment[] => {
    if (!event || event.gameCount <= 1) return groupLaneByTeam(cur, anchorGame);

    const targetSegment = assignmentSegments.find((segment) => segment.startGame <= anchorGame && anchorGame <= segment.endGame);
    if (!targetSegment || targetSegment.startGame !== anchorGame) {
      return groupLaneByTeam(cur, anchorGame);
    }

    const anchorAssignments = groupLaneByTeam(cur.filter((a) => a.gameNumber === anchorGame), anchorGame);
    const preserved = cur.filter((a) => a.gameNumber < targetSegment.startGame || a.gameNumber > targetSegment.endGame);
    const generated: Assignment[] = [...anchorAssignments];

    for (let g = targetSegment.startGame + 1; g <= targetSegment.endGame; g++) {
      for (const a of anchorAssignments) {
        const newLane = getLaneForGame({
          initialLane: a.laneNumber,
          gameNumber: g - targetSegment.startGame + 1,
          shift: event.tableShift,
          range: { start: event.laneStart, end: event.laneEnd },
        });
        generated.push({ ...a, gameNumber: g, laneNumber: newLane, id: `${a.playerId}_${g}_${newLane}` });
      }
    }

    return [...preserved, ...generated].sort((a, b) => a.gameNumber - b.gameNumber || a.laneNumber - b.laneNumber);
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
        const rebuilt = rebuildSegmentGames(nextVisible, selectedGame);
        return mergeVisibleAssignments(cur, rebuilt);
      });
      return;
    }
    if (source === toLane && !swapTargetId) return;

    // 선수 위에 드롭 → 스왑 (다른 레인) 또는 순서 변경 (같은 레인)
    if (swapTargetId && swapTargetId !== playerId) {
      const swapSource = getLaneForPlayerInBoard(board, selectedGame, swapTargetId);
      if (swapSource <= 0) return;

      // 같은 레인 내 드롭: 배열 내 위치(순서)를 교환
      if (source === swapSource) {
        dirtyRef.current = true;
        setAssignments((cur) => {
          const currentVisible = hasSquads && selectedSquadId ? cur.filter((a) => a.squadId === selectedSquadId) : cur;
          const nextVisible = reorderAssignmentsWithinLane(currentVisible, {
            gameNumber: selectedGame,
            laneNumber: source,
            draggedPlayerId: playerId,
            targetPlayerId: swapTargetId,
          });
          const rebuilt = rebuildSegmentGames(nextVisible, selectedGame);
          return mergeVisibleAssignments(cur, rebuilt);
        });
        return;
      }

      // 다른 레인 간 스왑
      dirtyRef.current = true;
      setAssignments((cur) => {
        const currentVisible = hasSquads && selectedSquadId ? cur.filter((a) => a.squadId === selectedSquadId) : cur;
        const nextVisible = [
          ...currentVisible.filter((a) => a.gameNumber !== selectedGame || (a.playerId !== playerId && a.playerId !== swapTargetId)),
          { playerId, gameNumber: selectedGame, laneNumber: swapSource, id: `${playerId}_${selectedGame}_${swapSource}` } as Assignment,
          { playerId: swapTargetId, gameNumber: selectedGame, laneNumber: source, id: `${swapTargetId}_${selectedGame}_${source}` } as Assignment,
        ];
        const rebuilt = rebuildSegmentGames(nextVisible, selectedGame);
        return mergeVisibleAssignments(cur, rebuilt);
      });
      return;
    }

    const targetPlayers = currentBoard[toLane] ?? [];

    if (!isAssigned) {
      if (targetPlayers.length >= maxPerLane) { showMsg(`한 레인은 최대 ${maxPerLane}명까지만 배정할 수 있습니다.`, "error"); return; }
      dirtyRef.current = true;
      setAssignments((cur) => {
        const currentVisible = hasSquads && selectedSquadId ? cur.filter((a) => a.squadId === selectedSquadId) : cur;
        const nextVisible = [...currentVisible.filter((a) => !(a.playerId === playerId && a.gameNumber === selectedGame)), { id: `${playerId}_${selectedGame}_${toLane}`, playerId, gameNumber: selectedGame, laneNumber: toLane } as Assignment];
        const rebuilt = rebuildSegmentGames(nextVisible, selectedGame);
        return mergeVisibleAssignments(cur, rebuilt);
      });
      return;
    }

    if (targetPlayers.length < maxPerLane) {
      dirtyRef.current = true;
      setAssignments((cur) => {
        const currentVisible = hasSquads && selectedSquadId ? cur.filter((a) => a.squadId === selectedSquadId) : cur;
        const nextVisible = [...currentVisible.filter((a) => !(a.playerId === playerId && a.gameNumber === selectedGame)), { playerId, gameNumber: selectedGame, laneNumber: toLane, id: `${playerId}_${selectedGame}_${toLane}` } as Assignment];
        const rebuilt = rebuildSegmentGames(nextVisible, selectedGame);
        return mergeVisibleAssignments(cur, rebuilt);
      });
      return;
    }

    showMsg("레인이 가득 찼습니다. 교환하려면 선수 위에 드롭하세요.", "error");
  };

  const handleAssignedPlayerClick = (playerId: string) => {
    const player = playerById.get(playerId);
    if (!player) return;
    const ok = window.confirm(`${player.name} 선수를 배정취소하시겠습니까?`);
    if (!ok) return;
    movePlayer(playerId, undefined);
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
    const items = visibleAssignments.map((a) => ({ playerId: a.playerId, gameNumber: a.gameNumber, laneNumber: a.laneNumber, position: a.position }));
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
      applySavedScoreLocally(playerId, selectedGame, score);
      showMsg(`저장됨: ${playerById.get(playerId)?.name ?? playerId} - ${score}점`);
    } catch (err) { showMsg((err as Error).message || "점수 저장 실패", "error"); }
  };

  const handleSaveAllInLane = async (laneNum: number) => {
    const playerIds = currentBoard[laneNum] ?? [];
    if (playerIds.length === 0 || !event || !tournamentId || !divisionId || !eventId) return;
    setLoading(true);
    const payloads = playerIds.flatMap((pid) => {
      const draft = scoreDraft[pid];
      if (draft === undefined || draft === "") return [] as { playerId: string; score: number }[];
      const score = Number(draft);
      if (!Number.isFinite(score) || !Number.isInteger(score) || score < 0 || score > MAX_SCORE) return [] as { playerId: string; score: number }[];
      return [{ playerId: pid, score }];
    });
    if (payloads.length === 0) { setLoading(false); showMsg("입력된 점수가 없습니다.", "error"); return; }
    const results = await Promise.all(payloads.map(async ({ playerId, score }) => {
      try {
        const res = await fetch("/api/admin/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tournamentId, divisionId, eventId, playerId, gameNumber: selectedGame, score, laneNumber: laneNum }) });
        if (!res.ok) return { playerId, score, ok: false };
        return { playerId, score, ok: true };
      } catch {
        return { playerId, score, ok: false };
      }
    }));
    const succeeded = results.filter((result) => result.ok);
    const failed = results.length - succeeded.length;
    for (const { playerId, score } of succeeded) {
      scoreDirtyRef.current.delete(playerId);
      applySavedScoreLocally(playerId, selectedGame, score);
    }
    if (succeeded.length > 0) {
      clearScoreDraft(draftStorageKey, succeeded.map((item) => item.playerId));
    }
    setLoading(false);
    if (failed > 0) showMsg(`${succeeded.length}명 저장됨, ${failed}명 실패`, "error");
    else showMsg(`Lane ${laneNum} 전체 ${succeeded.length}명 저장 완료!`);
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
          ? `${sq.name} (${effectiveParticipantList.filter((p) => p.squadId === sq.id).length}명)`
          : sq.name;
        return (
          <GlassButton
            key={sq.id}
            size="sm"
            variant={isSelected ? "primary" : "secondary"}
            onClick={() => (opts?.onSelect ? opts.onSelect(sq.id) : setSelectedSquadId(sq.id))}
          >
            {label}
          </GlassButton>
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
              {event && (
                <>
                  <Link href={`/admin/tournaments/${tournamentId}/prints/lanes?divisionId=${divisionId}&eventId=${eventId}`}>
                    <GlassButton size="sm" variant="ghost" style={{ fontSize: 12, padding: "3px 10px" }}>🖨️ 레인배정표</GlassButton>
                  </Link>
                  <Link href={`/admin/tournaments/${tournamentId}/prints/scores?divisionId=${divisionId}&eventId=${eventId}`}>
                    <GlassButton size="sm" variant="ghost" style={{ fontSize: 12, padding: "3px 10px" }}>🖨️ 점수서명표</GlassButton>
                  </Link>
                  {eventRows.length > 0 && (
                    <GlassButton
                      size="sm"
                      variant="ghost"
                      style={{ fontSize: 12, padding: "3px 10px" }}
                      onClick={() => exportEventScoreboard(eventRows, event?.title ?? "성적표", "")}
                    >
                      📥 엑셀
                    </GlassButton>
                  )}
                </>
              )}
            </div>
          </div>
          {/* Game selector */}
          <GlassCard variant="subtle" style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>게임 선택</span>
            <div style={{ display: "flex", gap: 4 }}>
              {Array.from({ length: event?.gameCount ?? 1 }, (_, i) => i + 1).map((g) => (
                <GlassButton key={g} size="sm" variant={selectedGame === g ? "primary" : "secondary"} onClick={() => setSelectedGame(g)}>
                  {g}G
                </GlassButton>
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
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.15)", borderRadius: "12px 12px 0 0", overflowX: "auto", padding: "6px 8px 0" }}>
        {(Object.keys(TAB_LABELS) as ScoreboardTab[]).filter((tab) => tab !== "teams").map((tab) => (
          <GlassButton key={tab} size="sm" variant={activeTab === tab ? "primary" : "secondary"} onClick={() => setActiveTab(tab)}>
            {tab === "participants" ? participantTabLabel : TAB_LABELS[tab]}
          </GlassButton>
        ))}
      </div>

      {/* ===== Tab: 출전선수등록 ===== */}
      {activeTab === "participants" && (
        <GlassCard>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", margin: 0 }}>
              {isSingleEvent ? "조편성" : "팀 조편성"}
            </h2>
            <GlassBadge variant="info">
              {isSingleEvent
                ? `자동 참가: ${participantIds.size}명`
                : `승인 팀 ${teams.length}팀 · 스쿼드 배정 완료 ${assignedTeamCount}팀`}
            </GlassBadge>
          </div>

          {isSingleEvent ? (
            <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)", color: "#0f766e", fontSize: 13, lineHeight: 1.7 }}>
              개인전은 선수등록 승인된 전체 선수가 자동으로 출전합니다. 이 탭에서는 출전선수 등록 대신 스쿼드 편성만 관리합니다.
            </div>
          ) : null}

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
                  const count = effectiveParticipantList.filter((p) => p.squadId === sq.id).length;
                  return (
                    <div key={sq.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <GlassButton
                        size="sm"
                        variant={isSelected ? "primary" : "secondary"}
                        onClick={() => setSelectedSquadId(sq.id)}
                      >
                        {sq.name} ({count}명)
                      </GlassButton>
                      <GlassButton
                        size="sm"
                        variant="ghost"
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
                        title="스쿼드 삭제"
                      >
                        ✕
                      </GlassButton>
                    </div>
                  );
                })}
              </div>
            )}
            {hasSquads && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginRight: 4 }}>목록 보기:</span>
                  <GlassButton
                    size="sm"
                    variant={participantViewSquadId === PARTICIPANT_VIEW_ALL ? "primary" : "secondary"}
                    onClick={() => setParticipantViewSquadId(PARTICIPANT_VIEW_ALL)}
                  >
                    전체 ({allPlayers.length}명)
                  </GlassButton>
                  {squads.map((sq) => {
                    const count = effectiveParticipantList.filter((p) => p.squadId === sq.id).length;
                    const isSelected = participantViewSquadId === sq.id;
                    return (
                      <GlassButton
                        key={`participant-view-${sq.id}`}
                        size="sm"
                        variant={isSelected ? "primary" : "secondary"}
                        onClick={() => setParticipantViewSquadId(sq.id)}
                      >
                        {sq.name} ({count}명)
                      </GlassButton>
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

          {/* 검색 */}
          <input
            type="text"
            placeholder={isSingleEvent ? "선수 이름 또는 소속으로 검색..." : "팀명, 선수 이름, 소속으로 검색..."}
            value={participantSearch}
            onChange={(e) => setParticipantSearch(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14,
              background: "rgba(255,255,255,0.5)", border: "1.5px solid rgba(99,102,241,0.15)",
              outline: "none", fontFamily: "inherit", color: "#1e293b", marginBottom: 16,
              boxSizing: "border-box",
            }}
          />

          {isSingleEvent ? (
            <div style={{ display: "grid", gap: 6, maxHeight: 500, overflowY: "auto" }}>
              {participantTabPlayers.map((p) => {
                const participant = participantMap.get(p.id);
                const playerSquad = participant?.squadId ? squads.find((s) => s.id === participant.squadId) : null;
                const isHighlighted = Boolean(playerSquad);
                const statusLabel = playerSquad ? `${playerSquad.name} 배정됨` : "스쿼드 미배정";
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (!hasSquads) return;
                      if (playerSquad?.id === selectedSquadId) {
                        void handleRemoveParticipant(p.id);
                        return;
                      }
                      void handleAddParticipant(p.id);
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                      background: isHighlighted ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.25)",
                      border: isHighlighted ? "1.5px solid rgba(99,102,241,0.3)" : "1.5px solid rgba(203,213,225,0.3)",
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{
                      width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 8, fontSize: 13, fontWeight: 700,
                      background: isHighlighted ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(203,213,225,0.3)",
                      color: isHighlighted ? "#fff" : "#64748b",
                    }}>
                      {p.number}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#1e293b" }}>{p.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{p.region} · {p.affiliation}</p>
                    </div>
                    {hasSquads && playerSquad && (
                      <span style={{
                        padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: "rgba(99,102,241,0.08)", color: "#6366f1",
                      }}>
                        {playerSquad.name}
                      </span>
                    )}
                    <span style={{
                      padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: isHighlighted ? "rgba(99,102,241,0.15)" : "rgba(203,213,225,0.2)",
                      color: isHighlighted ? "#6366f1" : "#94a3b8",
                    }}>
                      {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.14)",
                color: "#475569",
                fontSize: 13,
                lineHeight: 1.7,
              }}>
                팀전은 사용자 제출 후 승인된 팀만 조편성합니다. 관리자는 팀 전체를 같은 스쿼드로 배치하고, 개별 선수는 이 화면에서 따로 등록하거나 빼지 않습니다.
              </div>

              {teamSquadCards.length === 0 ? (
                <div style={{
                  padding: "28px 16px",
                  borderRadius: 12,
                  textAlign: "center",
                  color: "#94a3b8",
                  background: "rgba(255,255,255,0.2)",
                  border: "1px dashed rgba(148,163,184,0.35)",
                }}>
                  승인된 팀이 아직 없거나, 현재 필터에 맞는 팀이 없습니다.
                </div>
              ) : (
                teamSquadCards.map((team) => {
                  const statusTone = team.status === "assigned"
                    ? { bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.22)", text: "#15803d", label: "스쿼드 배정 완료" }
                    : team.status === "mixed"
                      ? { bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.24)", text: "#b45309", label: "스쿼드 혼재" }
                      : { bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.24)", text: "#64748b", label: "스쿼드 미배정" };
                  return (
                    <div
                      key={team.id}
                      style={{
                        padding: "16px",
                        borderRadius: 14,
                        background: "rgba(255,255,255,0.28)",
                        border: `1px solid ${statusTone.border}`,
                        boxShadow: "0 12px 32px rgba(15,23,42,0.06)",
                        display: "grid",
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: "#1e293b" }}>{team.name}</span>
                          <GlassBadge variant={team.teamType === "NORMAL" ? "success" : "warning"}>{getTeamTypeLabel(team.teamType)}</GlassBadge>
                          <span style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: statusTone.bg,
                            color: statusTone.text,
                            border: `1px solid ${statusTone.border}`,
                            fontSize: 12,
                            fontWeight: 700,
                          }}>
                            {statusTone.label}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          현재 스쿼드: {team.currentSquadId ? squads.find((squad) => squad.id === team.currentSquadId)?.name ?? team.currentSquadId : "미배정"}
                        </span>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {team.members.map((member) => (
                          <span
                            key={member.id}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              color: "#334155",
                              background: "rgba(255,255,255,0.5)",
                              border: "1px solid rgba(203,213,225,0.45)",
                            }}
                          >
                            #{member.number} {member.name} · {member.affiliation}
                          </span>
                        ))}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {squads.map((squad) => {
                          const isAssigned = team.currentSquadId === squad.id;
                          return (
                            <button
                              key={`${team.id}-${squad.id}`}
                              type="button"
                              onClick={() => void handleAssignTeamToSquad(teams.find((item) => item.id === team.id) ?? {
                                id: team.id,
                                name: team.name,
                                teamType: team.teamType,
                                memberIds: team.rosterIds,
                                rosterIds: team.rosterIds,
                                createdAt: "",
                                updatedAt: "",
                              }, isAssigned ? null : squad.id)}
                              style={{
                                padding: "7px 14px",
                                borderRadius: 9,
                                fontSize: 13,
                                fontWeight: isAssigned ? 700 : 600,
                                color: isAssigned ? "#fff" : "#475569",
                                background: isAssigned ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.45)",
                                border: isAssigned ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(203,213,225,0.45)",
                                cursor: "pointer",
                                fontFamily: "inherit",
                              }}
                            >
                              {isAssigned ? `${squad.name} 해제` : squad.name}
                            </button>
                          );
                        })}
                      </div>

                      {team.status === "mixed" && (
                        <div style={{
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: "rgba(245,158,11,0.10)",
                          border: "1px solid rgba(245,158,11,0.18)",
                          color: "#b45309",
                          fontSize: 12,
                        }}>
                          같은 팀 선수들이 서로 다른 스쿼드에 나뉘어 있습니다. 한 스쿼드 버튼을 눌러 팀 전체를 다시 맞춰주세요.
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
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
              {isTeamEvent && teams.length > 0 && ` · 미배정 팀 ${unassignedTeams.length}팀`}
            </span>
          </div>

          <div
            style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 280px" }}
            onDragOver={(e) => { e.preventDefault(); handleDragAutoScroll(e); }}
            onDragEnd={stopAutoScroll}
            onDrop={stopAutoScroll}
          >
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
                      const raw = e.dataTransfer.getData("text/plain");
                      const teamPayload = decodeTeamDrag(raw);
                      if (teamPayload) { moveTeam(teamPayload.memberIds, laneNum); return; }
                      const payload = decodeDrag(raw);
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
                        const teamName = playerTeamNameMap.get(pid);
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
                            onClick={() => handleAssignedPlayerClick(pid)}
                            title="클릭하면 미배정으로 이동합니다"
                            style={{
                              padding: "5px 10px", borderRadius: 7, fontSize: 13,
                              background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)",
                              color: "#1e293b", cursor: "pointer", fontWeight: 500,
                              display: "flex", alignItems: "center", gap: 5,
                            }}
                          >
                            <span>{p.number} {p.name}</span>
                            {teamName && (
                              <span style={{ fontSize: 10, color: "#6366f1", background: "rgba(99,102,241,0.15)", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>
                                {teamName}
                              </span>
                            )}
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
                const raw = e.dataTransfer.getData("text/plain");
                const teamPayload = decodeTeamDrag(raw);
                if (teamPayload) { moveTeam(teamPayload.memberIds, undefined); return; }
                const payload = decodeDrag(raw);
                if (payload) movePlayer(payload.playerId, undefined, payload.sourceLane);
              }}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              {/* 미배정 팀 */}
              {isTeamEvent && teams.length > 0 && (
                <div style={{ background: "rgba(99,102,241,0.06)", border: "1.5px dashed rgba(99,102,241,0.25)", borderRadius: 10, padding: 12 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 10 }}>
                    미배정 팀 ({unassignedTeams.length})
                  </p>
                  {unassignedTeams.length === 0 ? (
                    <p style={{ color: "#94a3b8", fontSize: 13 }}>모든 팀 배정 완료 ✓</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {unassignedTeams.map((team) => {
                        const activeMemberIds = getActiveTeamMemberIds(team);
                        const memberPlayers = activeMemberIds.map((mid) => playerById.get(mid)).filter(Boolean) as typeof players;
                        return (
                          <div
                            key={team.id}
                            draggable
                            onDragStart={(e: DragEvent<HTMLDivElement>) => e.dataTransfer.setData("text/plain", encodeTeamDrag(team.id, activeMemberIds))}
                            style={{
                              padding: "8px 10px", borderRadius: 8, fontSize: 13,
                              background: "rgba(255,255,255,0.5)", border: "1px solid rgba(99,102,241,0.2)",
                              cursor: "grab", color: "#334155",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontWeight: 700, color: "#4f46e5" }}>{team.name}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {team.teamType !== "NORMAL" && (
                                  <span style={{ fontSize: 10, color: "#f97316", background: "rgba(249,115,22,0.1)", padding: "1px 5px", borderRadius: 4 }}>{getTeamTypeLabel(team.teamType)}</span>
                                )}
                                <GlassButton size="sm" variant="ghost" onClick={() => moveTeam(activeMemberIds, lanes[0])}>
                                  배정
                                </GlassButton>
                              </div>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {memberPlayers.map((mp) => (
                                <span key={mp.id} style={{ fontSize: 11, color: "#64748b", background: "rgba(100,116,139,0.1)", padding: "1px 6px", borderRadius: 4 }}>
                                  {mp.number} {mp.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 미배정 선수 */}
              <div style={{ background: "rgba(255,255,255,0.15)", border: "1.5px dashed rgba(203,213,225,0.5)", borderRadius: 10, padding: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 10 }}>
                  {isTeamEvent && teams.length > 0 ? `미배정 선수 (팀 미편성, ${unassignedNonTeamPlayers.length})` : `미배정 선수 (${unassignedPlayers.length})`}
                </p>
                {(isTeamEvent && teams.length > 0 ? unassignedNonTeamPlayers : unassignedPlayers).length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: 13 }}>모든 선수 배정 완료 ✓</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {(isTeamEvent && teams.length > 0 ? unassignedNonTeamPlayers : unassignedPlayers).map((p) => (
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

              {/* 5인조 대기 선수 (로스터 등록, 이번 출전 아님) */}
              {event?.kind === "FIVES" && benchPlayerIds.size > 0 && (
                <div style={{ background: "rgba(148,163,184,0.08)", border: "1.5px dashed rgba(148,163,184,0.4)", borderRadius: 10, padding: 12, marginTop: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 10 }}>
                    🪑 대기 선수 — 로스터 등록, 이번 출전 아님 ({benchPlayerIds.size}명)
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {players.filter((p) => benchPlayerIds.has(p.id)).map((p) => {
                        const teamName = playerTeamNameMap.get(p.id) ??
                          currentSquadTeams.find((t) => (t.rosterIds ?? []).includes(p.id))?.name ?? "";
                        return (
                        <div
                          key={p.id}
                          style={{
                            padding: "5px 10px", borderRadius: 7, fontSize: 12,
                            background: "rgba(148,163,184,0.12)", border: "1px solid rgba(148,163,184,0.25)",
                            color: "#94a3b8", cursor: "default",
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{p.number} {p.name}</span>
                          <span style={{ marginLeft: 4, fontSize: 11 }}>{p.affiliation}</span>
                          {teamName && <span style={{ marginLeft: 4, fontSize: 10, color: "#a1a1aa" }}>({teamName})</span>}
                        </div>
                      );
                    })}
                  </div>
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {event?.rankRefreshPending ? (
                <GlassBadge variant="warning">순위 미반영</GlassBadge>
              ) : (
                <GlassBadge variant="success">순위 반영 완료</GlassBadge>
              )}
              {event?.rankRefreshedAt && (
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  마지막 반영 {new Date(event.rankRefreshedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            <GlassButton size="sm" variant="secondary" onClick={() => void handleRefreshRanks()} disabled={loading || !event?.rankRefreshPending}>순위 반영</GlassButton>
          </div>

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
                    <GlassButton
                      key={laneNum}
                      size="sm"
                      variant={isActive ? "primary" : "secondary"}
                      onClick={() => setSelectedScoreLane(laneNum)}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 70 }}
                    >
                      <span>Lane {laneNum}</span>
                      <span style={{ fontSize: 10, opacity: 0.8 }}>
                        {savedCount}/{lanePlayerIds.length}명 입력
                      </span>
                    </GlassButton>
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
                    style={{
                      marginLeft: 8,
                      border: "none",
                      background: "transparent",
                      color: "#1d4ed8",
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    저장값으로 되돌리기
                  </button>
                </StatusBanner>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <GlassButton size="sm" variant="secondary" onClick={resetDraftToSavedScores}>초안 초기화</GlassButton>
                <GlassButton size="sm" onClick={() => void handleSaveAllInLane(activeScoreLane)} disabled={loading}>💾 레인 전체 저장</GlassButton>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                  {activeLaneRows.map((row) => {
                    const savedScore = row.gameScores[selectedGame - 1]?.score;
                    const hasSaved = savedScore !== null && savedScore !== undefined;
                    const lanePlayerIds = activeLaneRows.map((laneRow) => laneRow.playerId);
                    const teamColor = playerTeamColorMap.get(row.playerId);
                    return (
                      <div
                        key={row.playerId}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "36px 1fr auto auto auto",
                          alignItems: "center",
                          gap: 10,
                          padding: "12px 14px",
                          background: teamColor ? teamColor.bg : (hasSaved ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.25)"),
                          borderRadius: 10,
                          border: teamColor ? `2px solid ${teamColor.border}` : (hasSaved ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(255,255,255,0.3)"),
                          borderLeft: teamColor ? `4px solid ${teamColor.text}` : undefined,
                        }}
                      >
                        <span style={{ textAlign: "center", fontWeight: 800, fontSize: 15, color: "#6366f1", background: "rgba(99,102,241,0.1)", borderRadius: 6, padding: "2px 0" }}>{row.number}</span>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
                            {row.name}
                            {teamColor && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: teamColor.text, background: teamColor.bg, padding: "1px 6px", borderRadius: 4, border: `1px solid ${teamColor.border}` }}>{teamColor.teamName}</span>}
                          </p>
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
              {/* 미배정 선수 (하단 접이식, 대기선수 제외) */}
              {scoreFilteredEventRows.filter((row) => getLaneForPlayerInGameBoard(currentBoard, row.playerId) === 0 && !benchPlayerIds.has(row.playerId)).length > 0 && (
                <div style={{ marginTop: 12, background: "rgba(241,245,249,0.3)", borderRadius: 10, padding: "12px 14px", border: "1px dashed rgba(203,213,225,0.5)" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 10 }}>
                    ⚠️ 레인 미배정 선수
                  </p>
                  <div style={{ display: "grid", gap: 8 }}>
                    {scoreFilteredEventRows.filter((row) => getLaneForPlayerInGameBoard(currentBoard, row.playerId) === 0 && !benchPlayerIds.has(row.playerId)).map((row) => (
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

      {/* ===== Tab: 팀 편성 ===== */}
      {activeTab === "teams" && isTeamEvent && (
        <GlassCard>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: hasSquads ? 10 : 18, flexWrap: "wrap", gap: 10 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", margin: 0 }}>
              팀 편성 ({teamSize}인조)
            </h2>
            <GlassBadge variant="info">
              {teams.length}팀 편성됨 / 미배정 {unteamedParticipants.length}명
            </GlassBadge>
          </div>

          {/* 스쿼드 필터 */}
          {hasSquads && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginRight: 4 }}>스쿼드:</span>
                <GlassButton
                  size="sm"
                  variant={teamsViewSquadId === PARTICIPANT_VIEW_ALL ? "primary" : "secondary"}
                  onClick={() => setTeamsViewSquadId(PARTICIPANT_VIEW_ALL)}
                >
                  전체
                </GlassButton>
                {squads.map((sq) => {
                  const isSelected = teamsViewSquadId === sq.id;
                  const sqTeamCount = teams.filter((team) => getTeamRoster(team).some((playerId) => effectiveParticipantList.some((p) => (p.playerId ?? p.id) === playerId && p.squadId === sq.id))).length;
                  const sqUnteamedCount = unteamedParticipants.filter((p) => effectiveParticipantList.some((pt) => (pt.playerId ?? pt.id) === p.id && pt.squadId === sq.id)).length;
                  return (
                    <GlassButton
                      key={`teams-squad-${sq.id}`}
                      size="sm"
                      variant={isSelected ? "primary" : "secondary"}
                      onClick={() => setTeamsViewSquadId(sq.id)}
                    >
                      {sq.name} ({sqTeamCount}팀 · 미배정 {sqUnteamedCount}명)
                    </GlassButton>
                  );
                })}
              </div>
            </div>
          )}

          {/* 팀 생성 UI */}
          <div style={{ marginBottom: 20, padding: "16px", background: "rgba(255,255,255,0.15)", borderRadius: 12, border: "1px solid rgba(99,102,241,0.15)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 10 }}>
              팀 생성 — {hasSquads && teamsViewSquadId !== PARTICIPANT_VIEW_ALL ? `${squads.find((s) => s.id === teamsViewSquadId)?.name ?? "선택 스쿼드"} ` : ""}출전선수 1명 이상 선택 후 생성 (1명 선택 시 혼성팀)
              {selectedTeamMemberIds.size > 0 && (
                <span style={{ marginLeft: 8, color: selectedTeamMemberIds.size >= teamSize ? "#16a34a" : "#6366f1" }}>
                  ({selectedTeamMemberIds.size}명 선택됨)
                </span>
              )}
            </div>

            {squadFilteredUnteamedParticipants.length === 0 ? (
              <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>미배정 출전선수가 없습니다.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {squadFilteredUnteamedParticipants.map((player) => {
                  const isSelected = selectedTeamMemberIds.has(player.id);
                  return (
                    <GlassButton
                      key={player.id}
                      size="sm"
                      variant={isSelected ? "primary" : "ghost"}
                      onClick={() => toggleTeamMemberSelection(player.id)}
                    >
                      #{player.number} {player.name}
                      <span style={{ fontSize: 11, opacity: 0.75, marginLeft: 4 }}>({player.affiliation})</span>
                    </GlassButton>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <GlassButton
                onClick={handleCreateTeam}
                disabled={selectedTeamMemberIds.size === 0 || loading}
                variant="primary"
                size="sm"
              >
                팀 생성
              </GlassButton>
              {selectedTeamMemberIds.size > 0 && (
                <GlassButton
                  onClick={() => setSelectedTeamMemberIds(new Set())}
                  variant="ghost"
                  size="sm"
                >
                  선택 해제
                </GlassButton>
              )}
            </div>
          </div>

          {/* 편성된 팀 목록 */}
          {squadFilteredTeams.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", padding: "20px 0" }}>
              {teams.length === 0 ? "편성된 팀이 없습니다. 위에서 선수를 선택하여 팀을 생성해 주세요." : "해당 스쿼드에 편성된 팀이 없습니다."}
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {squadFilteredTeams.map((team) => {
                const isNormal = team.teamType === "NORMAL";
                const teamRosterIds = getTeamRoster(team);
                const activeMemberIds = getActiveTeamMemberIds(team);
                return (
                  <div key={team.id}>
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: 10,
                      background: isNormal ? "rgba(99,102,241,0.06)" : "rgba(251,146,60,0.06)",
                      border: `1px solid ${isNormal ? "rgba(99,102,241,0.2)" : "rgba(251,146,60,0.2)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                      <GlassBadge variant={isNormal ? "success" : "warning"}>
                        {getTeamTypeLabel(team.teamType)}
                      </GlassBadge>
                      <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 14 }}>{team.name}</span>
                      <span style={{ color: "#64748b", fontSize: 13 }}>
                        {activeMemberIds.map((pid) => {
                          const p = playerById.get(pid);
                          return p ? `[${p.number}] ${p.name}(${p.affiliation}${p.group ? p.group : ""})` : pid;
                        }).join(" · ")}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {/* 5인조: 로스터/선수교체 버튼 */}
                      {event?.kind === "FIVES" && (
                        <GlassButton
                          onClick={() => setEditingRoster({
                            teamId: team.id,
                            rosterIds: teamRosterIds,
                            firstHalfMemberIds: team.firstHalfMemberIds ?? [...team.memberIds],
                            secondHalfMemberIds: team.secondHalfMemberIds ?? team.firstHalfMemberIds ?? [...team.memberIds],
                          })}
                          variant="secondary"
                          size="sm"
                        >
                          선수교체
                        </GlassButton>
                      )}
                      <GlassButton
                        onClick={() => handleDeleteTeam(team.id)}
                        variant="danger"
                        size="sm"
                      >
                        삭제
                      </GlassButton>
                    </div>
                  </div>

                  {/* 5인조 로스터 편집 패널 */}
                  {event?.kind === "FIVES" && editingRoster?.teamId === team.id && (
                    <div style={{ marginTop: 12, padding: "14px", background: "rgba(255,255,255,0.2)", borderRadius: 10, border: "1px solid rgba(99,102,241,0.2)" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 10 }}>
                        로스터 관리 — 전체 엔트리에 추가/제거 후 전반/후반 출전 선수 {teamSize}명씩 선택
                      </div>

                      {/* 로스터에 추가 가능한 선수 (같은 소속, NORMAL팀 미소속 — MAKEUP팀 선수는 교체 가능) */}
                      <div style={{ marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: "#64748b", marginBottom: 6, display: "block" }}>로스터 추가 가능 선수 (같은 소속):</span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {(() => {
                            const teamAffs = new Set(
                              teamRosterIds.map((pid) => playerById.get(pid)?.affiliation).filter(Boolean)
                            );
                            // 다른 NORMAL팀에 속한 선수만 제외 (MAKEUP팀 선수는 소속팀 복귀 허용)
                            const otherNormalTeamPlayerIds = new Set<string>();
                            for (const t of teams) {
                              if (t.id === team.id) continue;
                              if (t.teamType === "MAKEUP") continue; // MAKEUP팀은 제외하지 않음
                              getTeamRoster(t).forEach((id) => otherNormalTeamPlayerIds.add(id));
                            }
                            return allPlayers.filter((p) =>
                              teamEditorEligiblePlayerIds.has(p.id) &&
                              !editingRoster.rosterIds.includes(p.id) &&
                              !otherNormalTeamPlayerIds.has(p.id) &&
                              teamAffs.has(p.affiliation)
                            );
                          })()
                            .map((p) => {
                              const inMakeup = teams.some((t) => t.id !== team.id && t.teamType === "MAKEUP" && getTeamRoster(t).includes(p.id));
                              return (
                                <GlassButton
                                  key={p.id}
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setEditingRoster((prev) => prev ? {
                                    ...prev,
                                    rosterIds: [...prev.rosterIds, p.id],
                                    firstHalfMemberIds: prev.firstHalfMemberIds.length < teamSize ? [...prev.firstHalfMemberIds, p.id] : prev.firstHalfMemberIds,
                                    secondHalfMemberIds: prev.secondHalfMemberIds.length < teamSize ? [...prev.secondHalfMemberIds, p.id] : prev.secondHalfMemberIds,
                                  } : prev)}
                                  style={inMakeup ? { color: "#d97706" } : undefined}
                                >
                                  {p.number} {p.name}{inMakeup ? " (혼성)" : ""}
                                </GlassButton>
                              );
                            })
                          }
                        </div>
                      </div>

                      {/* 전반 라인업 선택 */}
                      <div style={{ marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: "#64748b", marginBottom: 6, display: "block" }}>
                          전반 라인업 ({firstHalfGameCount}게임) — {teamSize}명 선택:
                          <span style={{ marginLeft: 6, color: editingRoster.firstHalfMemberIds.length === teamSize ? "#16a34a" : "#f59e0b" }}>
                            {editingRoster.firstHalfMemberIds.length}/{teamSize}명 선택됨
                          </span>
                        </span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {editingRoster.rosterIds.map((pid) => {
                            const p = playerById.get(pid);
                            const isSelected = editingRoster.firstHalfMemberIds.includes(pid);
                            return (
                              <GlassButton
                                key={`${pid}-first`}
                                size="sm"
                                variant={isSelected ? "primary" : "secondary"}
                                onClick={() => setEditingRoster((prev) => {
                                  if (!prev) return prev;
                                  if (isSelected) {
                                    return { ...prev, firstHalfMemberIds: prev.firstHalfMemberIds.filter((id) => id !== pid) };
                                  } else {
                                    return prev.firstHalfMemberIds.length >= teamSize
                                      ? prev
                                      : { ...prev, firstHalfMemberIds: [...prev.firstHalfMemberIds, pid] };
                                  }
                                })}
                              >
                                {isSelected ? "✓ " : ""}{p ? `${p.number} ${p.name}` : pid}
                              </GlassButton>
                            );
                          })}
                        </div>
                      </div>

                      {/* 후반 라인업 선택 */}
                      <div style={{ marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: "#64748b", marginBottom: 6, display: "block" }}>
                          후반 라인업 ({secondHalfGameCount}게임) — {teamSize}명 선택:
                          <span style={{ marginLeft: 6, color: editingRoster.secondHalfMemberIds.length === teamSize ? "#16a34a" : "#f59e0b" }}>
                            {editingRoster.secondHalfMemberIds.length}/{teamSize}명 선택됨
                          </span>
                        </span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {editingRoster.rosterIds.map((pid) => {
                            const p = playerById.get(pid);
                            const isSelected = editingRoster.secondHalfMemberIds.includes(pid);
                            return (
                              <GlassButton
                                key={`${pid}-second`}
                                size="sm"
                                variant={isSelected ? "primary" : "secondary"}
                                onClick={() => setEditingRoster((prev) => {
                                  if (!prev) return prev;
                                  if (isSelected) {
                                    return { ...prev, secondHalfMemberIds: prev.secondHalfMemberIds.filter((id) => id !== pid) };
                                  }
                                  return prev.secondHalfMemberIds.length >= teamSize
                                    ? prev
                                    : { ...prev, secondHalfMemberIds: [...prev.secondHalfMemberIds, pid] };
                                })}
                              >
                                {isSelected ? "✓ " : ""}{p ? `${p.number} ${p.name}` : pid}
                              </GlassButton>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <GlassButton
                          onClick={handleSaveRoster}
                          variant="primary"
                          size="sm"
                          disabled={editingRoster.firstHalfMemberIds.length !== teamSize || editingRoster.secondHalfMemberIds.length !== teamSize}
                        >
                          저장
                        </GlassButton>
                        <GlassButton onClick={() => setEditingRoster(null)} variant="ghost" size="sm">취소</GlassButton>
                      </div>
                    </div>
                  )}
                  </div>
                );
            })}
            </div>
          )}
        </GlassCard>
      )}

      {/* ===== Tab: 세부순위 ===== */}
      {activeTab === "event-rank" && (
        <GlassCard>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>세부종목 순위</h2>
          {event?.kind === "FIVES" && isSingleEventFives && fivesDisplayRows.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#6366f1", marginBottom: 12 }}>
                5인조 전반+후반 합계 팀 순위
              </h3>
              <div style={{ marginBottom: 10, fontSize: 12, color: "#6366f1", fontWeight: 600 }}>
                전후반 전체 출전 선수 기록과 게임별 팀 누적합계를 한 표에서 표시합니다.
              </div>
              <div style={{ display: "grid", gap: 16 }}>
                {fivesDisplayRows.map((row) => (
                  <div
                    key={row.teamId}
                    style={{
                      border: "1px solid rgba(99,102,241,0.18)",
                      borderRadius: 12,
                      overflow: "hidden",
                      background: "rgba(255,255,255,0.5)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "72px 1fr 90px 84px 84px",
                        gap: 0,
                        background: "rgba(99,102,241,0.10)",
                        borderBottom: "1px solid rgba(99,102,241,0.14)",
                      }}
                    >
                      <div style={{ ...glassTdStyle, fontWeight: 800, textAlign: "center", color: row.rank === 1 ? "#f59e0b" : "#1e293b" }}>
                        {row.rank > 0 ? `${row.rank}위` : "—"}
                      </div>
                      <div style={{ ...glassTdStyle, fontWeight: 800, color: "#1e293b" }}>{row.teamName}</div>
                      <div style={{ ...glassTdStyle, textAlign: "center" }}>
                    <GlassBadge variant={row.teamType === "NORMAL" ? "success" : "warning"} style={{ fontSize: 11 }}>
                      {getTeamTypeLabel(row.teamType)}
                    </GlassBadge>
                      </div>
                      <div style={{ ...glassTdStyle, textAlign: "right", fontWeight: 800, color: "#4f46e5" }}>
                    {row.teamType === "NORMAL" ? row.teamTotal.toLocaleString() : "—"}
                      </div>
                      <div style={{ ...glassTdStyle, textAlign: "right", color: "#64748b", fontWeight: 700 }}>
                    {row.teamType === "NORMAL" ? row.pinDiff.toLocaleString() : "—"}
                      </div>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "rgba(148,163,184,0.08)" }}>
                            <th style={{ ...glassTdStyle, fontWeight: 700, textAlign: "center", width: 64 }}>구분</th>
                            <th style={{ ...glassTdStyle, fontWeight: 700, textAlign: "center", width: 72 }}>번호</th>
                            <th style={{ ...glassTdStyle, fontWeight: 700, textAlign: "left", minWidth: 140 }}>성명</th>
                            {Array.from({ length: event.gameCount }, (_, index) => (
                              <th key={`${row.teamId}-g${index + 1}`} style={{ ...glassTdStyle, fontWeight: 700, textAlign: "right", width: 72 }}>
                                {index + 1}G
                              </th>
                            ))}
                            <th style={{ ...glassTdStyle, fontWeight: 700, textAlign: "right", width: 84 }}>합계</th>
                            <th style={{ ...glassTdStyle, fontWeight: 700, textAlign: "right", width: 84 }}>평균</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.members.map((member) => {
                            const label = member.playsFirstHalf && member.playsSecondHalf
                              ? "전후반"
                              : member.playsFirstHalf
                                ? "전반"
                                : member.playsSecondHalf
                                  ? "후반"
                                  : "대기";
                            const labelStyle = member.playsFirstHalf && member.playsSecondHalf
                              ? { bg: "rgba(99,102,241,0.12)", text: "#4f46e5" }
                              : member.playsFirstHalf
                                ? { bg: "rgba(59,130,246,0.12)", text: "#2563eb" }
                                : member.playsSecondHalf
                                  ? { bg: "rgba(16,185,129,0.12)", text: "#059669" }
                                  : { bg: "rgba(148,163,184,0.12)", text: "#64748b" };
                            return (
                              <tr key={`${row.teamId}-${member.playerId}`} {...glassTrHoverProps}>
                                <td style={{ ...glassTdStyle, textAlign: "center" }}>
                                  <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: labelStyle.bg, color: labelStyle.text }}>
                                    {label}
                                  </span>
                                </td>
                                <td style={{ ...glassTdStyle, textAlign: "center" }}>{member.number || "—"}</td>
                                <td style={{ ...glassTdStyle, fontWeight: 600, color: "#334155" }}>{member.name}</td>
                                {Array.from({ length: event.gameCount }, (_, index) => {
                                  const score = member.gameScores[index]?.score;
                                  const gameNumber = index + 1;
                                  const isActiveScore = (gameNumber <= firstHalfGameCount && member.playsFirstHalf)
                                    || (gameNumber > firstHalfGameCount && member.playsSecondHalf);
                                  return (
                                    <td
                                      key={`${member.playerId}-g${gameNumber}`}
                                      style={{
                                        ...glassTdStyle,
                                        textAlign: "right",
                                        color: typeof score === "number" ? (isActiveScore ? "#dc2626" : "#94a3b8") : "#cbd5e1",
                                        fontWeight: typeof score === "number" ? (isActiveScore ? 800 : 500) : 500,
                                      }}
                                    >
                                      {typeof score === "number" ? score : "—"}
                                    </td>
                                  );
                                })}
                                <td style={{ ...glassTdStyle, textAlign: "right", fontWeight: 700 }}>{member.total ? member.total.toLocaleString() : "—"}</td>
                                <td style={{ ...glassTdStyle, textAlign: "right", color: "#64748b" }}>
                                  {member.total > 0 ? (member.average ?? 0).toFixed(1) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                          <tr style={{ background: "rgba(99,102,241,0.08)" }}>
                            <td style={{ ...glassTdStyle, textAlign: "center", fontWeight: 800 }} colSpan={3}>
                              팀 합계
                            </td>
                            {Array.from({ length: event.gameCount }, (_, index) => (
                              <td key={`${row.teamId}-team-total-${index}`} style={{ ...glassTdStyle, textAlign: "right", fontWeight: 800, color: "#4f46e5" }}>
                                {typeof row.teamGameTotals?.[index] === "number" ? row.teamGameTotals[index]?.toLocaleString() : "—"}
                              </td>
                            ))}
                            <td style={{ ...glassTdStyle, textAlign: "right", fontWeight: 800, color: "#4f46e5" }}>
                              {row.teamType === "NORMAL" ? row.teamTotal.toLocaleString() : "—"}
                            </td>
                            <td style={{ ...glassTdStyle, textAlign: "right", fontWeight: 700, color: "#64748b" }}>
                              {row.teamType === "NORMAL" && row.teamGameTotals?.length
                                ? (row.teamTotal / (row.teamGameTotals.filter((score) => typeof score === "number").length * 5)).toFixed(1)
                                : "—"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {isTeamEvent && !(event?.kind === "FIVES" && isSingleEventFives) && (teamRows.length > 0 || (event?.kind === "FIVES" && fivesCombinedRows.length > 0)) && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: event?.kind === "FIVES" && (event?.halfType === "SECOND" || isSingleEventFives) ? "#6366f1" : "#475569", marginBottom: 12 }}>
                {event?.kind === "FIVES" && (event?.halfType === "SECOND" || isSingleEventFives)
                  ? "5인조 전반+후반 합계 팀 순위"
                  : "팀 순위"}
              </h3>
              {event?.kind === "FIVES" && (event?.halfType === "SECOND" || isSingleEventFives) && fivesCombinedRows.length > 0 && (
                <div style={{ marginBottom: 10, fontSize: 12, color: "#6366f1", fontWeight: 600 }}>
                  5인조 전반+후반 합계 기준으로 순위를 표시합니다.
                </div>
              )}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "rgba(99,102,241,0.08)" }}>
                      <th style={{ ...glassTdStyle, fontWeight: 700, textAlign: "center", width: 48 }}>순위</th>
                      <th style={{ ...glassTdStyle, fontWeight: 700, textAlign: "left" }}>팀명</th>
                      <th style={{ ...glassTdStyle, fontWeight: 700, textAlign: "center", width: 56 }}>구분</th>
                      <th style={{ ...glassTdStyle, fontWeight: 700, textAlign: "left" }}>멤버</th>
                      <th style={{ ...glassTdStyle, fontWeight: 700, textAlign: "right", width: 72 }}>팀합계</th>
                      <th style={{ ...glassTdStyle, fontWeight: 700, textAlign: "right", width: 64 }}>평균</th>
                      <th style={{ ...glassTdStyle, fontWeight: 700, textAlign: "right", width: 72 }}>핀차이</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fivesDisplayRows.map((row) => (
                      <tr key={row.teamId} {...glassTrHoverProps}>
                        <td style={{ ...glassTdStyle, textAlign: "center", fontWeight: 700, color: row.rank === 1 ? "#f59e0b" : "#1e293b" }}>
                          {row.rank > 0 ? row.rank : "—"}
                        </td>
                        <td style={{ ...glassTdStyle, fontWeight: 700 }}>{row.teamName}</td>
                        <td style={{ ...glassTdStyle, textAlign: "center" }}>
                    <GlassBadge variant={row.teamType === "NORMAL" ? "success" : "warning"} style={{ fontSize: 11 }}>
                      {getTeamTypeLabel(row.teamType)}
                    </GlassBadge>
                        </td>
                        <td style={{ ...glassTdStyle, color: "#475569" }}>
                          {row.members.map((m) => `${m.name}(${m.total})`).join(" · ")}
                        </td>
                        <td style={{ ...glassTdStyle, textAlign: "right", fontWeight: 700, color: "#6366f1" }}>
                          {row.teamType === "NORMAL" ? row.teamTotal : "—"}
                        </td>
                        <td style={{ ...glassTdStyle, textAlign: "right", color: "#475569" }}>
                          {row.teamType === "NORMAL" && row.members.length > 0
                            ? (row.teamTotal / row.members.length).toFixed(1)
                            : "—"}
                        </td>
                        <td style={{ ...glassTdStyle, textAlign: "right", color: "#64748b" }}>
                          {row.teamType === "NORMAL" ? row.pinDiff : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!isSingleEventFives && (
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#475569", margin: "24px 0 12px" }}>개인 순위</h3>
              )}
            </div>
          )}
          {/* 5인조 전반+후반 합산 팀 순위 */}
          {event?.kind === "FIVES" && !isSingleEventFives && event?.halfType !== "SECOND" && fivesCombinedRows.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#6366f1", marginBottom: 12 }}>5인조 전반+후반 합계 팀 순위</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "rgba(99,102,241,0.12)" }}>
                      <th style={{ ...glassTdStyle, fontWeight: 700, textAlign: "center", width: 48 }}>순위</th>
                      <th style={{ ...glassTdStyle, fontWeight: 700, textAlign: "left" }}>팀명</th>
                      <th style={{ ...glassTdStyle, fontWeight: 700, textAlign: "right", width: 80 }}>합산</th>
                      <th style={{ ...glassTdStyle, fontWeight: 700, textAlign: "right", width: 64 }}>평균</th>
                      <th style={{ ...glassTdStyle, fontWeight: 700, textAlign: "right", width: 72 }}>핀차이</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fivesCombinedRows.map((row) => (
                      <tr key={row.teamId} {...glassTrHoverProps}>
                        <td style={{ ...glassTdStyle, textAlign: "center", fontWeight: 700, color: row.rank === 1 ? "#f59e0b" : "#1e293b" }}>
                          {row.rank > 0 ? row.rank : "—"}
                        </td>
                        <td style={{ ...glassTdStyle, fontWeight: 700 }}>{row.teamName}</td>
                        <td style={{ ...glassTdStyle, textAlign: "right", fontWeight: 700, color: "#6366f1" }}>{row.teamTotal}</td>
                        <td style={{ ...glassTdStyle, textAlign: "right", color: "#475569" }}>
                          {row.members.length > 0 ? (row.teamTotal / row.members.length).toFixed(1) : "—"}
                        </td>
                        <td style={{ ...glassTdStyle, textAlign: "right", color: "#64748b" }}>{row.pinDiff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {!(event?.kind === "FIVES" && isSingleEventFives) && (
            <RankingTable rows={eventRows} emptyMessage="순위 데이터가 없습니다." onSelectPlayer={(playerName) => setSelectedPlayer(playerName)} />
          )}
        </GlassCard>
      )}

      {/* ===== Tab: 종합순위 ===== */}
      {activeTab === "overall-rank" && (
        <GlassCard>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>전체 종합순위</h2>
          <RankingTable rows={overallRows} emptyMessage="종합점수 데이터가 없습니다." onSelectPlayer={(playerName) => setSelectedPlayer(playerName)} showOverallOnly eventTitleMap={eventTitleMap} />
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










































