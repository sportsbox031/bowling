"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard, GlassTable, GlassBadge, glassTdStyle, glassTrHoverProps } from "@/components/ui";

type ScoreColumn = { gameNumber: number; score: number | null };
type EventRow = {
  rank: number;
  tieRank: number;
  attempts: number;
  playerId: string;
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

  const load = async () => {
    if (!tournamentId || !eventId) return;

    setLoading(true);
    try {
      const scoreRes = await fetch(
        `/api/public/scoreboard?tournamentId=${encodeURIComponent(tournamentId)}&eventId=${encodeURIComponent(
          eventId,
        )}&divisionId=${encodeURIComponent(divisionId)}`,
        { cache: "no-store" },
      );

      if (!scoreRes.ok) throw new Error("점수표를 불러오지 못했습니다.");
      const scoreboard = (await scoreRes.json()) as ScoreboardResponse;
      setRows(scoreboard.rows ?? []);
      setEventInfo(scoreboard.event ?? null);

      const detailRes = await fetch(`/api/public/tournaments/${tournamentId}`, { cache: "no-store" });
      if (detailRes.ok) {
        const next = (await detailRes.json()) as TournamentDetailResponse;
        setTournament(next.tournament);
        setDetail(next);
      }

      setMessage("");
    } catch (error) {
      setMessage((error as Error).message || "조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
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
          {loading && (
            <span style={{ color: "#94a3b8", fontSize: 13 }} className="loading-pulse">
              실시간 갱신 중...
            </span>
          )}
        </div>
        <div style={{ marginTop: 12 }}>
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

      {message && (
        <GlassCard variant="subtle" style={{ marginBottom: 16, color: "#ef4444", padding: "12px 16px" }}>
          {message}
        </GlassCard>
      )}

      {/* Scoreboard Table */}
      <GlassTable
        headers={["순위", "시도", "소속", "번호", "성명", "1G", "2G", "3G", "4G", "5G", "6G", "합계", "평균", "핀차"]}
        rowCount={rows.length}
        emptyMessage="등록된 점수가 없습니다."
      >
        {rows.map((row) => (
          <tr key={row.playerId} {...glassTrHoverProps}>
            <td style={{ ...glassTdStyle, ...rankStyle(row.rank), textAlign: "center" }}>{row.rank}</td>
            <td style={{ ...glassTdStyle, textAlign: "center", color: "#64748b" }}>{row.attempts}</td>
            <td style={glassTdStyle}>{row.affiliation}</td>
            <td style={{ ...glassTdStyle, textAlign: "center" }}>{row.number}</td>
            <td style={{ ...glassTdStyle, fontWeight: 600 }}>{row.name}</td>
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
    </main>
  );
};

export default EventScoreBoardPage;
