"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard, GlassTable, GlassBadge, GlassInput, glassTdStyle, glassTrHoverProps } from "@/components/ui";
import PlayerProfileModal from "@/components/PlayerProfileModal";
import { cachedFetch } from "@/lib/client-cache";

type ScoreColumn = { gameNumber: number; score: number | null };
type EventRow = {
  rank: number;
  tieRank: number;
  attempts: number;
  playerId: string;
  region: string;
  affiliation: string;
  number: number;
  name: string;
  gameScores: ScoreColumn[];
  total: number;
  average: number;
  pinDiff: number;
};

type EventDetail = {
  id: string;
  title: string;
  kind: string;
  gameCount: number;
  scheduleDate: string;
  laneStart: number;
  laneEnd: number;
  tableShift: number;
};

type TournamentMeta = {
  id: string;
  title: string;
};

type ScoreboardResponse = { rows: EventRow[]; event?: EventDetail };

type TournamentDetailResponse = {
  tournament: TournamentMeta;
  divisions: { id: string; title: string }[];
  eventsByDivision: { divisionId: string; events: EventDetail[] }[];
};

const KIND_LABELS: Record<string, string> = {
  SINGLE: "개인전",
  DOUBLES: "2인조",
  TRIPLES: "3인조",
  FOURS: "4인조",
  FIVES: "5인조",
  OVERALL: "개인종합",
};

const rankStyle = (rank: number) => {
  if (rank === 1) return { color: "#f59e0b", fontWeight: 800 as const, fontSize: 15 };
  if (rank === 2) return { color: "#6366f1", fontWeight: 700 as const };
  if (rank === 3) return { color: "#8b5cf6", fontWeight: 600 as const };
  return {};
};

const EventScoreBoardPage = () => {
  const { tournamentId, eventId } = useParams<{ tournamentId: string; eventId: string }>();
  const searchParams = useSearchParams();
  const divisionId = searchParams.get("divisionId") ?? "";

  const [rows, setRows] = useState<EventRow[]>([]);
  const [eventInfo, setEventInfo] = useState<EventDetail | null>(null);
  const [tournament, setTournament] = useState<TournamentMeta | null>(null);
  const [detail, setDetail] = useState<TournamentDetailResponse | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const load = async () => {
    if (!tournamentId || !eventId) return;

    setLoading(true);
    try {
      const scoreboardUrl = `/api/public/scoreboard?tournamentId=${encodeURIComponent(tournamentId)}&eventId=${encodeURIComponent(eventId)}&divisionId=${encodeURIComponent(divisionId)}`;
      const [scoreboard, tournamentDetail] = await Promise.all([
        cachedFetch<ScoreboardResponse>(scoreboardUrl, 180000),
        cachedFetch<TournamentDetailResponse>(`/api/public/tournaments/${tournamentId}`, 600000),
      ]);

      setRows(scoreboard.rows ?? []);
      setEventInfo(scoreboard.event ?? null);
      setTournament(tournamentDetail.tournament);
      setDetail(tournamentDetail);
      setMessage("");
    } catch (error) {
      setMessage((error as Error).message || "조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tournamentId, eventId, divisionId]);

  const eventLabel = useMemo(() => {
    if (eventInfo) return eventInfo.title;
    const fallback = (detail?.eventsByDivision ?? [])
      .find((group) => group.divisionId === divisionId)
      ?.events.find((event) => event.id === eventId);
    return fallback?.title ?? "";
  }, [eventInfo, detail?.eventsByDivision, divisionId, eventId]);

  const kindLabel = useMemo(() => {
    if (eventInfo) return KIND_LABELS[eventInfo.kind] ?? eventInfo.kind;
    return "";
  }, [eventInfo]);

  const filteredRows = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(kw) ||
        row.affiliation.toLowerCase().includes(kw) ||
        row.region.toLowerCase().includes(kw),
    );
  }, [rows, searchKeyword]);

  return (
    <main>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8 }}>
        <Link href={`/tournaments/${tournamentId}`} style={{ color: "#94a3b8", fontSize: 13 }}>
          ← {tournament?.title ?? "대회"} 로 돌아가기
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
          {eventLabel || "세부종목"} {kindLabel ? `(${kindLabel})` : ""}
        </h1>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: "#64748b", fontSize: 14 }}>
            {detail?.divisions.find((d) => d.id === divisionId)?.title ?? ""}
          </span>
          {eventInfo?.scheduleDate && (
            <GlassBadge variant="info">{eventInfo.scheduleDate}</GlassBadge>
          )}
          {loading && <span style={{ color: "#94a3b8", fontSize: 13 }}>불러오는 중...</span>}
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            href={`/tournaments/${tournamentId}/events/${eventId}/lanes?divisionId=${divisionId}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              background: "rgba(245, 158, 11, 0.1)",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "#d97706",
              border: "1px solid rgba(245, 158, 11, 0.15)",
            }}
          >
            &#x1F3B3; 레인 배정표
          </Link>
          <Link
            href={`/tournaments/${tournamentId}/overall?divisionId=${divisionId}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              background: "rgba(99, 102, 241, 0.1)",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "#6366f1",
              border: "1px solid rgba(99, 102, 241, 0.15)",
            }}
          >
            📊 종합성적 보기
          </Link>
        </div>
      </div>

      {/* Search */}
      <GlassCard variant="strong" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <GlassInput
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="선수명, 소속, 시도로 검색..."
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
              ✕
            </button>
          )}
        </div>
        {searchKeyword && (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6366f1" }}>
            "{searchKeyword}" 검색 결과: {filteredRows.length}명
          </p>
        )}
      </GlassCard>

      {message && (
        <GlassCard variant="subtle" style={{ marginBottom: 16, color: "#ef4444", padding: "12px 16px" }}>
          {message}
        </GlassCard>
      )}

      {/* Scoreboard Table */}
      <GlassTable
        headers={["순위", "시도", "소속", "번호", "성명", "1G", "2G", "3G", "4G", "5G", "6G", "합계", "평균", "핀차"]}
        headerAligns={["center", "center", "left", "center", "left", "center", "center", "center", "center", "center", "center", "center", "center", "center"]}
        rowCount={filteredRows.length}
        emptyMessage={searchKeyword ? "검색 결과가 없습니다." : "등록된 점수가 없습니다."}
      >
        {filteredRows.map((row) => (
          <tr key={row.playerId} {...glassTrHoverProps}>
            <td style={{ ...glassTdStyle, ...rankStyle(row.rank), textAlign: "center" }}>{row.rank}</td>
            <td style={{ ...glassTdStyle, textAlign: "center", color: "#64748b" }}>{row.region}</td>
            <td style={glassTdStyle}>{row.affiliation}</td>
            <td style={{ ...glassTdStyle, textAlign: "center" }}>{row.number}</td>
            <td
              style={{ ...glassTdStyle, fontWeight: 600, color: "#6366f1", cursor: "pointer" }}
              onClick={() => setSelectedPlayer(row.name)}
            >
              {row.name}
            </td>
            <td style={{ ...glassTdStyle, textAlign: "center" }}>{row.gameScores[0]?.score ?? ""}</td>
            <td style={{ ...glassTdStyle, textAlign: "center" }}>{row.gameScores[1]?.score ?? ""}</td>
            <td style={{ ...glassTdStyle, textAlign: "center" }}>{row.gameScores[2]?.score ?? ""}</td>
            <td style={{ ...glassTdStyle, textAlign: "center" }}>{row.gameScores[3]?.score ?? ""}</td>
            <td style={{ ...glassTdStyle, textAlign: "center" }}>{row.gameScores[4]?.score ?? ""}</td>
            <td style={{ ...glassTdStyle, textAlign: "center" }}>{row.gameScores[5]?.score ?? ""}</td>
            <td style={{ ...glassTdStyle, textAlign: "center", fontWeight: 700, color: "#1e293b" }}>{row.total}</td>
            <td style={{ ...glassTdStyle, textAlign: "center", color: "#6366f1", fontWeight: 600 }}>{row.average}</td>
            <td style={{ ...glassTdStyle, textAlign: "center", color: "#64748b" }}>{row.pinDiff}</td>
          </tr>
        ))}
      </GlassTable>

      {selectedPlayer && (
        <PlayerProfileModal
          playerName={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </main>
  );
};

export default EventScoreBoardPage;
