"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { GlassCard, GlassTable, GlassBadge, GlassInput, glassTdStyle, glassTrHoverProps } from "@/components/ui";
import PlayerProfileModal from "@/components/PlayerProfileModal";

type AssignmentRow = {
  playerId: string;
  gameNumber: number;
  laneNumber: number;
  squadId: string | null;
  playerName: string;
  playerNumber: number;
  affiliation: string;
  region: string;
};

type EventDetail = {
  id: string;
  title: string;
  kind: string;
  gameCount: number;
  laneStart: number;
  laneEnd: number;
  tableShift: number;
};

type Squad = {
  id: string;
  name: string;
};

type AssignmentResponse = {
  assignments: AssignmentRow[];
  squads: Squad[];
  event?: EventDetail;
};

const KIND_LABELS: Record<string, string> = {
  SINGLE: "개인전",
  DOUBLES: "2인조",
  TRIPLES: "3인조",
  FOURS: "4인조",
  FIVES: "5인조",
  OVERALL: "개인종합",
};

const LaneAssignmentPage = () => {
  const { tournamentId, eventId } = useParams<{ tournamentId: string; eventId: string }>();
  const searchParams = useSearchParams();
  const divisionId = searchParams.get("divisionId") ?? "";

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [eventInfo, setEventInfo] = useState<EventDetail | null>(null);
  const [tournamentTitle, setTournamentTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const selectedSquadIdRef = useRef<string | null>(null);

  const hasSquads = squads.length > 0;
  selectedSquadIdRef.current = hasSquads ? selectedSquadId : null;

  const load = async () => {
    if (!tournamentId || !eventId) return;
    setLoading(true);
    try {
      const sqId = selectedSquadIdRef.current;
      const squadParam = sqId ? `&squadId=${encodeURIComponent(sqId)}` : "";
      const res = await fetch(
        `/api/public/assignments?tournamentId=${encodeURIComponent(tournamentId)}&eventId=${encodeURIComponent(eventId)}&divisionId=${encodeURIComponent(divisionId)}${squadParam}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("레인 배정 정보를 불러오지 못했습니다.");
      const data = (await res.json()) as AssignmentResponse;
      setAssignments(data.assignments ?? []);
      setSquads(data.squads ?? []);
      setEventInfo(data.event ?? null);
      setMessage("");

      // 스쿼드가 있는데 아직 선택 안 된 경우 첫 번째 자동 선택
      if (data.squads.length > 0 && !selectedSquadIdRef.current) {
        setSelectedSquadId(data.squads[0].id);
      }

      if (!tournamentTitle) {
        const detailRes = await fetch(`/api/public/tournaments/${tournamentId}`, { cache: "no-store" });
        if (detailRes.ok) {
          const detail = await detailRes.json();
          setTournamentTitle(detail.tournament?.title ?? "");
        }
      }
    } catch (error) {
      setMessage((error as Error).message || "조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      if (!document.hidden) load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [tournamentId, eventId, divisionId]);

  // 스쿼드 변경 시 재로드
  useEffect(() => {
    if (hasSquads && selectedSquadId) {
      load();
    }
  }, [selectedSquadId]);

  const gameCount = eventInfo?.gameCount ?? 0;
  const tableShift = eventInfo?.tableShift ?? 0;
  const laneStart = eventInfo?.laneStart ?? 0;
  const laneEnd = eventInfo?.laneEnd ?? 0;
  const totalLanes = laneEnd - laneStart + 1;

  const gameNumbers = useMemo(() => {
    if (gameCount <= 0) return [];
    return Array.from({ length: gameCount }, (_, i) => i + 1);
  }, [gameCount]);

  const laneGroups = useMemo(() => {
    const filtered = assignments.filter((a) => a.gameNumber === selectedGame);
    const grouped = new Map<number, AssignmentRow[]>();

    for (let lane = laneStart; lane <= laneEnd; lane++) {
      grouped.set(lane, []);
    }

    for (const row of filtered) {
      const list = grouped.get(row.laneNumber) ?? [];
      list.push(row);
      grouped.set(row.laneNumber, list);
    }

    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [assignments, selectedGame, laneStart, laneEnd]);

  // 검색: 매칭되는 선수가 있는 레인만 표시
  const searchResult = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    if (!kw) return { filtered: laneGroups, matchedPlayerIds: new Set<string>() };
    const matchedPlayerIds = new Set<string>();
    const matchedLanes = new Set<number>();
    for (const [lane, players] of laneGroups) {
      for (const p of players) {
        if (
          p.playerName.toLowerCase().includes(kw) ||
          p.affiliation.toLowerCase().includes(kw) ||
          p.region.toLowerCase().includes(kw) ||
          String(p.playerNumber).includes(kw)
        ) {
          matchedPlayerIds.add(p.playerId);
          matchedLanes.add(lane);
        }
      }
    }
    return {
      filtered: laneGroups.filter(([lane]) => matchedLanes.has(lane)),
      matchedPlayerIds,
    };
  }, [laneGroups, searchKeyword]);

  const shiftDescription = useMemo(() => {
    if (tableShift === 0) return "레인 이동 없음 (고정)";
    const direction = tableShift > 0 ? "오른쪽" : "왼쪽";
    const amount = Math.abs(tableShift);
    return `${amount}레인씩 ${direction}으로 이동`;
  }, [tableShift]);

  const totalPlayers = useMemo(() => {
    const ids = new Set(assignments.map((a) => a.playerId));
    return ids.size;
  }, [assignments]);

  return (
    <main>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, display: "flex", gap: 12 }}>
        <Link href={`/tournaments/${tournamentId}`} style={{ color: "#94a3b8", fontSize: 13 }}>
          {tournamentTitle || "대회"} 로 돌아가기
        </Link>
        <span style={{ color: "#cbd5e1", fontSize: 13 }}>|</span>
        <Link
          href={`/tournaments/${tournamentId}/events/${eventId}?divisionId=${divisionId}`}
          style={{ color: "#94a3b8", fontSize: 13 }}
        >
          성적표 보기
        </Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 8,
          }}
        >
          {eventInfo?.title ?? "세부종목"} 레인 배정표
          {eventInfo?.kind ? ` (${KIND_LABELS[eventInfo.kind] ?? eventInfo.kind})` : ""}
        </h1>
        {loading && <span style={{ color: "#94a3b8", fontSize: 13 }}>불러오는 중...</span>}
      </div>

      {/* Squad Tabs */}
      {hasSquads && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {squads.map((sq) => {
            const isSelected = selectedSquadId === sq.id;
            return (
              <button
                key={sq.id}
                onClick={() => setSelectedSquadId(sq.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: isSelected ? "1px solid rgba(139, 92, 246, 0.4)" : "1px solid rgba(255, 255, 255, 0.3)",
                  background: isSelected
                    ? "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(168, 85, 247, 0.15))"
                    : "rgba(255, 255, 255, 0.15)",
                  color: isSelected ? "#7c3aed" : "#64748b",
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: 14,
                  cursor: "pointer",
                  backdropFilter: "blur(8px)",
                }}
              >
                {sq.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Table Shift Rule */}
      <GlassCard variant="strong" style={{ marginBottom: 20, padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>&#x1F3B3;</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>경기 규칙</h3>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              background: "rgba(99, 102, 241, 0.06)",
              borderRadius: 10,
              border: "1px solid rgba(99, 102, 241, 0.1)",
            }}
          >
            <span style={{ fontSize: 14, color: "#6366f1", fontWeight: 700, minWidth: 60 }}>레인</span>
            <span style={{ fontSize: 14, color: "#334155" }}>
              {laneStart}번 ~ {laneEnd}번 (총 {totalLanes}레인)
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              background: "rgba(99, 102, 241, 0.06)",
              borderRadius: 10,
              border: "1px solid rgba(99, 102, 241, 0.1)",
            }}
          >
            <span style={{ fontSize: 14, color: "#6366f1", fontWeight: 700, minWidth: 60 }}>경기 수</span>
            <span style={{ fontSize: 14, color: "#334155" }}>{gameCount}게임</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              background: "rgba(99, 102, 241, 0.06)",
              borderRadius: 10,
              border: "1px solid rgba(99, 102, 241, 0.1)",
            }}
          >
            <span style={{ fontSize: 14, color: "#6366f1", fontWeight: 700, minWidth: 60 }}>참가 선수</span>
            <span style={{ fontSize: 14, color: "#334155" }}>{totalPlayers}명</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              background: tableShift !== 0 ? "rgba(245, 158, 11, 0.08)" : "rgba(99, 102, 241, 0.06)",
              borderRadius: 10,
              border: `1px solid ${tableShift !== 0 ? "rgba(245, 158, 11, 0.15)" : "rgba(99, 102, 241, 0.1)"}`,
            }}
          >
            <span style={{ fontSize: 14, color: tableShift !== 0 ? "#d97706" : "#6366f1", fontWeight: 700, minWidth: 60 }}>
              Table 이동
            </span>
            <span style={{ fontSize: 14, color: "#334155", fontWeight: 600 }}>
              {shiftDescription}
            </span>
          </div>
          {tableShift !== 0 && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(245, 158, 11, 0.05)",
                borderRadius: 10,
                border: "1px solid rgba(245, 158, 11, 0.1)",
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: "#92400e", lineHeight: 1.6 }}>
                {gameNumbers.map((g) => {
                  if (g === 1) return null;
                  const direction = tableShift > 0 ? "오른쪽" : "왼쪽";
                  const moved = Math.abs(tableShift) * (g - 1);
                  return (
                    <span key={g} style={{ display: "block" }}>
                      {g - 1}게임 종료 후 {direction}으로 {Math.abs(tableShift)}레인 이동 (1게임 대비 총 {moved}레인 이동)
                    </span>
                  );
                })}
              </p>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Search */}
      <GlassCard variant="strong" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>&#x1F50D;</span>
          <GlassInput
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="선수명, 번호, 소속, 시도로 검색..."
            style={{ flex: 1 }}
          />
          {searchKeyword && (
            <button
              onClick={() => setSearchKeyword("")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8",
                fontSize: 18,
                lineHeight: 1,
                padding: "0 4px",
              }}
            >
              &#x2715;
            </button>
          )}
        </div>
        {searchKeyword && (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6366f1" }}>
            &quot;{searchKeyword}&quot; 검색 결과: {searchResult.matchedPlayerIds.size}명 ({searchResult.filtered.length}레인)
          </p>
        )}
      </GlassCard>

      {message && (
        <GlassCard variant="subtle" style={{ marginBottom: 16, color: "#ef4444", padding: "12px 16px" }}>
          {message}
        </GlassCard>
      )}

      {/* Game Tabs */}
      {gameNumbers.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {gameNumbers.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGame(g)}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: selectedGame === g ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid rgba(255, 255, 255, 0.3)",
                background: selectedGame === g
                  ? "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))"
                  : "rgba(255, 255, 255, 0.15)",
                color: selectedGame === g ? "#6366f1" : "#64748b",
                fontWeight: selectedGame === g ? 700 : 500,
                fontSize: 14,
                cursor: "pointer",
                backdropFilter: "blur(8px)",
              }}
            >
              {g}게임
            </button>
          ))}
        </div>
      )}

      {/* Lane Assignment Table */}
      {assignments.length === 0 && !loading ? (
        <GlassCard variant="subtle" style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
          레인 배정이 아직 되지 않았습니다.
        </GlassCard>
      ) : (
        <GlassTable
          headers={["레인", "번호", "성명", "소속", "시도"]}
          rowCount={searchResult.filtered.reduce((acc, [, players]) => acc + Math.max(players.length, 1), 0)}
          emptyMessage={searchKeyword ? "검색 결과가 없습니다." : "배정된 선수가 없습니다."}
        >
          {searchResult.filtered.map(([lane, players]) => {
            if (players.length === 0) {
              return (
                <tr key={`lane-${lane}`} {...glassTrHoverProps}>
                  <td
                    style={{
                      ...glassTdStyle,
                      textAlign: "center",
                      fontWeight: 700,
                      color: "#6366f1",
                      background: "rgba(99, 102, 241, 0.04)",
                    }}
                  >
                    {lane}
                  </td>
                  <td style={{ ...glassTdStyle, textAlign: "center", color: "#cbd5e1" }} colSpan={4}>
                    -
                  </td>
                </tr>
              );
            }

            return players.map((player, idx) => (
              <tr
                key={`${lane}-${player.playerId}`}
                {...glassTrHoverProps}
                style={idx === 0 ? { borderTop: "2px solid rgba(99, 102, 241, 0.12)" } : undefined}
              >
                {idx === 0 ? (
                  <td
                    rowSpan={players.length}
                    style={{
                      ...glassTdStyle,
                      textAlign: "center",
                      fontWeight: 700,
                      fontSize: 16,
                      color: "#6366f1",
                      background: "rgba(99, 102, 241, 0.04)",
                      verticalAlign: "middle",
                    }}
                  >
                    {lane}
                  </td>
                ) : null}
                {(() => {
                  const isMatch = searchKeyword && searchResult.matchedPlayerIds.has(player.playerId);
                  const highlight = isMatch ? { background: "rgba(99, 102, 241, 0.1)", fontWeight: 700 as const } : {};
                  return (
                    <>
                      <td style={{ ...glassTdStyle, textAlign: "center", ...highlight }}>{player.playerNumber}</td>
                      <td
                        style={{ ...glassTdStyle, fontWeight: 600, ...highlight, color: isMatch ? "#6366f1" : "#6366f1", cursor: "pointer" }}
                        onClick={() => setSelectedPlayer(player.playerName)}
                      >
                        {player.playerName}
                      </td>
                      <td style={{ ...glassTdStyle, ...highlight }}>{player.affiliation}</td>
                      <td style={{ ...glassTdStyle, textAlign: "center", color: isMatch ? "#6366f1" : "#64748b", ...highlight }}>{player.region}</td>
                    </>
                  );
                })()}
              </tr>
            ));
          })}
        </GlassTable>
      )}

      {selectedPlayer && (
        <PlayerProfileModal
          playerName={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </main>
  );
};

export default LaneAssignmentPage;
