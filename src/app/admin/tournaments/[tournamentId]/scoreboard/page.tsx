"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getLaneForGame } from "@/lib/lane";

type ScoreColumn = { gameNumber: number; score: number | null };
type EventLeaderboardRow = {
  playerId: string;
  rank: number;
  tieRank: number;
  attempts: number;
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
};

type ApiList<T> = { items: T[] };
type ApiError = { message?: string };

type Board = Record<number, Record<number, string[]>>;
type GameBoard = Record<number, string[]>;

const parseError = async (response: Response) => {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as ApiError;
    return parsed.message || text || "요청이 실패했습니다.";
  } catch {
    return text || "요청이 실패했습니다.";
  }
};

const range = (start: number, end: number) => {
  const items: number[] = [];
  for (let i = start; i <= end; i += 1) {
    items.push(i);
  }
  return items;
};

const buildBoards = (
  assignments: Assignment[],
  gameCount: number,
  laneStart: number,
  laneEnd: number,
): Board => {
  const board: Board = {};
  for (let game = 1; game <= gameCount; game += 1) {
    board[game] = Object.fromEntries(range(laneStart, laneEnd).map((lane) => [lane, [] as string[]]));
  }

  for (const item of assignments) {
    if (!board[item.gameNumber]) {
      board[item.gameNumber] = {};
    }
    if (!board[item.gameNumber][item.laneNumber]) {
      board[item.gameNumber][item.laneNumber] = [];
    }
    board[item.gameNumber][item.laneNumber].push(item.playerId);
  }

  return board;
};

const hasPlayerInBoard = (board: GameBoard, playerId: string) =>
  Object.values(board).some((players) => players.includes(playerId));

type DragSource = {
  playerId: string;
  sourceLane?: number;
};

const encodeDragSource = (payload: DragSource): string => {
  return JSON.stringify(payload);
};

const decodeDragSource = (raw: string): DragSource | null => {
  try {
    const parsed = JSON.parse(raw) as DragSource;
    if (!parsed || typeof parsed.playerId !== "string") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const MAX_SCORE = 300;
const MAX_PLAYERS_PER_LANE = 4;

const getLaneForPlayerInAssignments = (board: Board, gameNumber: number, playerId: string) => {
  const lanes = board[gameNumber] ?? {};
  for (const [laneText, players] of Object.entries(lanes)) {
    if (players.includes(playerId)) {
      return Number(laneText);
    }
  }

  return 0;
};

const getPlayersAtLaneInBoard = (board: GameBoard, laneNumber: number) => board[laneNumber] ?? [];

const getLaneForPlayer = (board: GameBoard, playerId: string) => {
  for (const [laneText, players] of Object.entries(board)) {
    if (players.includes(playerId)) {
      return Number(laneText);
    }
  }

  return 0;
};

const buildBoardForGame = (
  board: Board,
  gameNumber: number,
  event: EventInfo | null,
): GameBoard => {
  const laneStart = event?.laneStart ?? 1;
  const laneEnd = event?.laneEnd ?? laneStart;
  const result: Record<number, string[]> = {};

  for (let lane = laneStart; lane <= laneEnd; lane += 1) {
    result[lane] = [];
  }

  const baseBoard = board[gameNumber] ?? {};
  const manualAssignedPlayers = new Set<string>();

  for (const [laneText, playerIds] of Object.entries(baseBoard)) {
    const lane = Number(laneText);
    result[lane] = [...playerIds];
    playerIds.forEach((playerId) => manualAssignedPlayers.add(playerId));
  }

  if (!event || gameNumber <= 1) {
    return result;
  }

  const firstGameBoard = board[1] ?? {};
  if (Object.keys(firstGameBoard).length === 0) {
    return result;
  }

  for (const [laneText, playerIds] of Object.entries(firstGameBoard)) {
    const sourceLane = Number(laneText);
    const targetLane = getLaneForGame({
      initialLane: sourceLane,
      gameNumber,
      shift: event.tableShift,
      range: { start: event.laneStart, end: event.laneEnd },
    });

    for (const playerId of playerIds) {
      if (manualAssignedPlayers.has(playerId)) {
        continue;
      }

      result[targetLane] ??= [];
      result[targetLane].push(playerId);
    }
  }

  return result;
};

export default function AdminScoreboardPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const searchParams = useSearchParams();
  const divisionId = searchParams.get("divisionId") ?? "";
  const eventId = searchParams.get("eventId") ?? "";

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [eventRows, setEventRows] = useState<EventLeaderboardRow[]>([]);
  const [overallRows, setOverallRows] = useState<OverallLeaderboardRow[]>([]);
  const [selectedGame, setSelectedGame] = useState(1);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<"random" | "manual">("random");
  const [scoreDraft, setScoreDraft] = useState<Record<string, string>>({});
  const pollerRef = useRef<number | null>(null);

  const playerById = useMemo(() => {
    const map = new Map<string, Player>();
    for (const player of players) {
      map.set(player.id, player);
    }
    return map;
  }, [players]);

  const lanes = useMemo(() => {
    if (!event) return [];
    return range(event.laneStart, event.laneEnd);
  }, [event]);

  const board = useMemo(
    () => buildBoards(assignments, event?.gameCount ?? 1, event?.laneStart ?? 1, event?.laneEnd ?? 1),
    [assignments, event?.gameCount, event?.laneStart, event?.laneEnd],
  );
  const currentBoard = useMemo(
    () => buildBoardForGame(board, selectedGame, event),
    [board, event, selectedGame],
  );

  const unassignedPlayers = useMemo(
    () => players.filter((player) => !hasPlayerInBoard(currentBoard, player.id)),
    [currentBoard, players],
  );

  const loadAssignments = async (signal?: AbortSignal) => {
    if (!tournamentId || !divisionId || !eventId) {
      return;
    }

    const response = await fetch(
      `/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/assignments`,
      { cache: "no-store", signal },
    );
    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const data = (await response.json()) as ApiList<Assignment>;
    setAssignments(data.items ?? []);
  };

  const loadPlayers = async (signal?: AbortSignal) => {
    if (!tournamentId || !divisionId) {
      return;
    }

    const response = await fetch(
      `/api/admin/tournaments/${tournamentId}/players?divisionId=${encodeURIComponent(divisionId)}`,
      { cache: "no-store", signal },
    );
    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const data = (await response.json()) as ApiList<Player>;
    setPlayers(data.items ?? []);
  };

  const loadEvent = async (signal?: AbortSignal) => {
    if (!tournamentId || !divisionId || !eventId) {
      return;
    }

    const response = await fetch(
      `/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}`,
      { cache: "no-store", signal },
    );
    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const data = (await response.json()) as EventInfo;
    setEvent(data);
    setSelectedGame((prev) => {
      const max = data.gameCount;
      if (prev < 1 || prev > max) return 1;
      return prev;
    });
  };

  const loadLeaderboard = async (signal?: AbortSignal) => {
    if (!tournamentId || !divisionId || !eventId) {
      return;
    }

    const response = await fetch(
      `/api/public/scoreboard?tournamentId=${encodeURIComponent(tournamentId)}&eventId=${encodeURIComponent(
        eventId,
      )}&divisionId=${encodeURIComponent(divisionId)}`,
      { cache: "no-store", signal },
    );
    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const data = (await response.json()) as { rows: EventLeaderboardRow[] };
    setEventRows(data.rows ?? []);

    const next: Record<string, string> = {};
    data.rows?.forEach((row) => {
      const value = row.gameScores?.[selectedGame - 1]?.score;
      if (typeof value === "number") {
        next[row.playerId] = String(value);
      } else {
        next[row.playerId] = "";
      }
    });
    setScoreDraft(next);
  };

  const loadOverall = async (signal?: AbortSignal) => {
    if (!tournamentId || !divisionId) {
      return;
    }

    const response = await fetch(
      `/api/public/scoreboard/overall?tournamentId=${encodeURIComponent(tournamentId)}&divisionId=${encodeURIComponent(
        divisionId,
      )}`,
      { cache: "no-store", signal },
    );
    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const data = (await response.json()) as { rows: OverallLeaderboardRow[] };
    setOverallRows(data.rows ?? []);
  };

  const loadAll = async () => {
    if (!tournamentId || !divisionId || !eventId) {
      return;
    }

    setLoading(true);
    setMessage("");
    const controller = new AbortController();

    try {
      await Promise.all([
        loadEvent(controller.signal),
        loadPlayers(controller.signal),
        loadAssignments(controller.signal),
        loadLeaderboard(controller.signal),
        loadOverall(controller.signal),
      ]);
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      setMessage((error as Error).message || "조회 실패");
    } finally {
      setLoading(false);
    }

    return controller;
  };

  useEffect(() => {
    let activeController: AbortController | null = new AbortController();

    (async () => {
      const controller = await loadAll();
      if (!controller) {
        return;
      }
      activeController = controller;
    })();

    if (pollerRef.current) {
      window.clearInterval(pollerRef.current);
    }
    pollerRef.current = window.setInterval(() => {
      void loadAssignments();
      void loadLeaderboard();
      void loadOverall();
    }, 4000) as unknown as number;

    return () => {
      if (activeController) {
        activeController.abort();
      }
      if (pollerRef.current) {
        clearInterval(pollerRef.current);
      }
    };
  }, [tournamentId, divisionId, eventId]);

  useEffect(() => {
    void loadLeaderboard();
  }, [selectedGame]);

  const movePlayerInCurrentGame = (playerId: string, toLaneNumber?: number, sourceLane?: number) => {
    const actualSourceLane = getLaneForPlayerInAssignments(board, selectedGame, playerId);
    const source = actualSourceLane > 0 ? actualSourceLane : sourceLane ?? 0;
    const isSourceAssigned = actualSourceLane > 0;

    if (!toLaneNumber) {
      if (!isSourceAssigned) {
        return;
      }

      setAssignments((current) =>
        current.filter((assignment) => !(assignment.playerId === playerId && assignment.gameNumber === selectedGame)),
      );
      return;
    }

    if (source === toLaneNumber) {
      return;
    }

    const targetPlayers = getPlayersAtLaneInBoard(currentBoard, toLaneNumber);
    const sourcePlayers = getPlayersAtLaneInBoard(currentBoard, source);
    const swapCandidateId = targetPlayers.find((player) => player !== playerId);

    if (!isSourceAssigned) {
      if (targetPlayers.length >= MAX_PLAYERS_PER_LANE) {
        setMessage("한 레인은 최대 4명까지만 배정할 수 있습니다.");
        return;
      }

      setAssignments((current) => [
        ...current.filter(
          (assignment) => !(assignment.playerId === playerId && assignment.gameNumber === selectedGame),
        ),
        {
          id: `${playerId}_${selectedGame}_${toLaneNumber}`,
          playerId,
          gameNumber: selectedGame,
          laneNumber: toLaneNumber,
        },
      ]);
      return;
    }

    if (targetPlayers.length < MAX_PLAYERS_PER_LANE) {
      setAssignments((current) =>
        [
          ...current.filter(
            (assignment) => !(assignment.playerId === playerId && assignment.gameNumber === selectedGame),
          ),
          {
            playerId,
            gameNumber: selectedGame,
            laneNumber: toLaneNumber,
            id: `${playerId}_${selectedGame}_${toLaneNumber}`,
          },
        ],
      );
      return;
    }

    if (!swapCandidateId) {
      setMessage("스왑할 수 없는 상태입니다.");
      return;
    }

    if (sourcePlayers.length === 0) {
      setMessage("현재 배정된 소스 레인을 찾을 수 없습니다.");
      return;
    }

    setAssignments((current) =>
      [
        ...current.filter(
          (assignment) =>
            assignment.gameNumber !== selectedGame ||
            (assignment.playerId !== playerId && assignment.playerId !== swapCandidateId),
        ),
        {
          playerId,
          gameNumber: selectedGame,
          laneNumber: toLaneNumber,
          id: `${playerId}_${selectedGame}_${toLaneNumber}`,
        },
        {
          playerId: swapCandidateId,
          gameNumber: selectedGame,
          laneNumber: source,
          id: `${swapCandidateId}_${selectedGame}_${source}`,
        },
      ],
    );
  };

  const onDragStartPlayer = (
    event: DragEvent<HTMLParagraphElement>,
    playerId: string,
    sourceLane?: number,
  ) => {
    event.dataTransfer.setData("text/plain", encodeDragSource({ playerId, sourceLane }));
  };

  const onDropLane = (laneNumber: number) => {
    return (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const payload = decodeDragSource(event.dataTransfer.getData("text/plain"));
      if (!payload) {
        return;
      }

      movePlayerInCurrentGame(payload.playerId, laneNumber, payload.sourceLane);
    };
  };

  const onDropPool = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const payload = decodeDragSource(event.dataTransfer.getData("text/plain"));
    if (!payload) {
      return;
    }
    movePlayerInCurrentGame(payload.playerId);
  };

  const handleAllowDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
  };

  const handleRandomAssign = async () => {
    if (!tournamentId || !divisionId || !eventId) {
      return;
    }

    setLoading(true);
    setActiveMode("random");
    try {
      const response = await fetch(
        `/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/assignments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "random" }),
        },
      );

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      await loadAssignments();
      setMessage("랜덤 배정이 완료되었습니다.");
    } catch (error) {
      setMessage((error as Error).message || "랜덤 배정 실패");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManual = async () => {
    if (!tournamentId || !divisionId || !eventId) {
      return;
    }

    setLoading(true);
    setActiveMode("manual");

    const items = assignments.map((assignment) => ({
      playerId: assignment.playerId,
      gameNumber: assignment.gameNumber,
      laneNumber: assignment.laneNumber,
    }));

    try {
      const response = await fetch(
        `/api/admin/tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/assignments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "manual", items, replaceAll: true }),
        },
      );
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      await loadAssignments();
      setMessage("수동 배정이 저장되었습니다.");
    } catch (error) {
      setMessage((error as Error).message || "수동 배정 저장 실패");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScore = async (playerId: string) => {
    if (!event || !tournamentId || !divisionId || !eventId) {
      return;
    }

    const draft = scoreDraft[playerId];
    if (draft === undefined || draft === "") {
      setMessage("점수를 입력해 주세요.");
      return;
    }

    const score = Number(draft);
    if (!Number.isFinite(score) || !Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
      setMessage("유효하지 않은 점수입니다.");
      return;
    }

    const laneNumber = getLaneForPlayer(currentBoard, playerId);
    if (laneNumber <= 0) {
      setMessage("점수 입력 전 레인 배정이 필요합니다.");
      return;
    }
    try {
      const response = await fetch("/api/admin/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          divisionId,
          eventId,
          playerId,
          gameNumber: selectedGame,
          score,
          laneNumber,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      setMessage(`점수가 저장되었습니다. (${playerById.get(playerId)?.name ?? playerId})`);
      await Promise.all([loadLeaderboard(), loadOverall()]);
    } catch (error) {
      setMessage((error as Error).message || "점수 저장 실패");
    }
  };

  if (!divisionId || !eventId) {
    return (
      <main>
        <p>이벤트 접근에 필요한 파라미터가 없습니다. 대회 상세에서 이벤트를 다시 선택해 주세요.</p>
      </main>
    );
  }

  return (
    <main>
      <header style={{ marginBottom: 16 }}>
        <h1>이벤트 점수판</h1>
        <p>
          <Link href={`/admin/tournaments/${tournamentId}`}>대회 상세로 이동</Link>
        </p>
      </header>

      <section style={{ display: "grid", gap: 12 }}>
        <p>
          이벤트: {event?.title ?? "-"} / {event?.kind ?? ""} / 경기일 {event?.scheduleDate ?? "-"}
        </p>
        <label>
          게임 선택
          <select value={selectedGame} onChange={(event) => setSelectedGame(Number(event.target.value))}>
            {Array.from({ length: event?.gameCount ?? 1 }, (_, index) => index + 1).map((game) => (
              <option key={game} value={game}>
                {game}G
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleRandomAssign} disabled={loading}>
            랜덤 배정
          </button>
          <button onClick={handleSaveManual} disabled={loading}>
            수동 배정 저장
          </button>
          <span>현재 모드: {activeMode === "random" ? "랜덤" : "수동"}</span>
        </div>
        <p>{message || " "}</p>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>레인 보드 (게임 {selectedGame})</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 320px" }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
            {lanes.map((laneNumber) => {
              const playerIds = currentBoard[laneNumber] ?? [];
              return (
                <div
                  key={laneNumber}
                  style={{ border: "1px dashed #d1d5db", borderRadius: 8, padding: 8, marginBottom: 8 }}
                  onDragOver={handleAllowDrop}
                  onDrop={onDropLane(laneNumber)}
                >
                  <strong>Lane {laneNumber}</strong>
                  {playerIds.length === 0 ? <p style={{ margin: "4px 0", color: "#6b7280" }}>비어 있음</p> : null}
                  {playerIds.map((playerId) => {
                    const player = playerById.get(playerId);
                    if (!player) {
                      return null;
                    }
                    return (
                      <p
                        key={`${laneNumber}-${player.id}`}
                        draggable
                        onDragStart={(event) => onDragStartPlayer(event, player.id, laneNumber)}
                        style={{
                          padding: "6px 8px",
                          border: "1px solid #d1d5db",
                          borderRadius: 6,
                          margin: "6px 0",
                          background: "#f9fafb",
                          cursor: "grab",
                        }}
                      >
                        {player.number} {player.name} / {player.affiliation}
                      </p>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div
            style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}
            onDragOver={handleAllowDrop}
            onDrop={onDropPool}
          >
            <h3 style={{ marginTop: 0 }}>미배정 선수</h3>
            {unassignedPlayers.length === 0 ? <p style={{ color: "#6b7280" }}>모든 선수가 배정됨</p> : null}
            {unassignedPlayers.map((player) => (
              <p
                key={player.id}
                draggable
                onDragStart={(event) => onDragStartPlayer(event, player.id)}
                style={{
                  padding: "6px 8px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  margin: "6px 0",
                  background: "#fff",
                  cursor: "grab",
                }}
              >
                {player.number} {player.name} / {player.affiliation}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>게임 점수 입력</h2>
        <table border={1} cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>순위</th>
              <th>소속</th>
              <th>번호</th>
              <th>성명</th>
              <th>점수</th>
              <th>저장</th>
            </tr>
          </thead>
          <tbody>
            {eventRows.map((row) => (
              <tr key={row.playerId}>
                <td>{row.rank}</td>
                <td>{row.affiliation}</td>
                <td>{row.number}</td>
                <td>{row.name}</td>
                <td>
                  <input
                    min={0}
                    max={MAX_SCORE}
                    step={1}
                    type="number"
                    value={scoreDraft[row.playerId] ?? ""}
                    onChange={(event) =>
                      setScoreDraft((prev) => ({
                        ...prev,
                        [row.playerId]: event.target.value,
                      }))
                    }
                  />
                </td>
                <td>
                  <button type="button" onClick={() => handleSaveScore(row.playerId)}>
                    저장
                  </button>
                </td>
              </tr>
            ))}
            {eventRows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center" }}>
                  점수 입력 대상이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>세부종목 순위</h2>
        <table border={1} cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>순위</th>
              <th>시도</th>
              <th>소속</th>
              <th>번호</th>
              <th>성명</th>
              <th>합계</th>
              <th>평균</th>
              <th>핀차</th>
            </tr>
          </thead>
          <tbody>
            {eventRows.map((row) => (
              <tr key={row.playerId}>
                <td>{row.rank}</td>
                <td>{row.attempts}</td>
                <td>{row.affiliation}</td>
                <td>{row.number}</td>
                <td>{row.name}</td>
                <td>{row.total}</td>
                <td>{row.average}</td>
                <td>{row.pinDiff}</td>
              </tr>
            ))}
            {eventRows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center" }}>
                  순위 데이터가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>전체 종합순위 (상위 20)</h2>
        <table border={1} cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>순위</th>
              <th>소속</th>
              <th>번호</th>
              <th>성명</th>
              <th>합계</th>
              <th>평균</th>
              <th>게임수</th>
            </tr>
          </thead>
          <tbody>
            {overallRows.slice(0, 20).map((row) => (
              <tr key={row.playerId}>
                <td>{row.rank}</td>
                <td>{row.affiliation}</td>
                <td>{row.number}</td>
                <td>{row.name}</td>
                <td>{row.total}</td>
                <td>{row.average}</td>
                <td>{row.gameCount}</td>
              </tr>
            ))}
            {overallRows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center" }}>
                  종합점수 데이터가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
