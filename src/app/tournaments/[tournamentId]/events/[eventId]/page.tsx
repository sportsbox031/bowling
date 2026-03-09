"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GlassBadge, GlassCard } from "@/components/ui";
import PageTitle from "@/components/common/PageTitle";
import PrintModeBar from "@/components/common/PrintModeBar";
import SearchField from "@/components/common/SearchField";
import StatusBanner from "@/components/common/StatusBanner";
import RankingTable from "@/components/scoreboard/RankingTable";
import PlayerProfileModal from "@/components/PlayerProfileModal";
import { cachedFetch } from "@/lib/client-cache";
import { KIND_LABELS } from "@/lib/constants";
import { chunkItems } from "@/lib/print-layout";

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

const PRINT_ROWS_PER_PAGE = 24;

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
  const [printMode, setPrintMode] = useState(false);

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

  const divisionTitle = detail?.divisions.find((division) => division.id === divisionId)?.title ?? "";
  const printPages = useMemo(() => chunkItems(filteredRows, PRINT_ROWS_PER_PAGE), [filteredRows]);
  const maxGameCount = useMemo(() => Math.max(0, ...filteredRows.map((row) => row.gameScores.length)), [filteredRows]);

  return (
    <main className={printMode ? "print-mode" : undefined}>
      <div className="screen-only">
        <div className="no-print" style={{ marginBottom: 8 }}>
          <Link href={`/tournaments/${tournamentId}`} style={{ color: "#94a3b8", fontSize: 13 }}>
            ← {tournament?.title ?? "대회"} 로 돌아가기
          </Link>
        </div>

        <PageTitle
          title={`${eventLabel || "세부종목"}${eventInfo ? ` (${KIND_LABELS[eventInfo.kind] ?? eventInfo.kind})` : ""}`}
          meta={
            <>
              <span style={{ color: "#64748b", fontSize: 14 }}>{divisionTitle}</span>
              {eventInfo?.scheduleDate && <GlassBadge variant="info">{eventInfo.scheduleDate}</GlassBadge>}
              {loading && <span style={{ color: "#94a3b8", fontSize: 13 }}>불러오는 중...</span>}
            </>
          }
          actions={
            <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href={`/tournaments/${tournamentId}/events/${eventId}/lanes?divisionId=${divisionId}`}>
                <GlassBadge variant="warning">레인 배정표</GlassBadge>
              </Link>
              <Link href={`/tournaments/${tournamentId}/overall?divisionId=${divisionId}`}>
                <GlassBadge variant="info">종합성적</GlassBadge>
              </Link>
            </div>
          }
        />

        <PrintModeBar enabled={printMode} onToggle={() => setPrintMode((prev) => !prev)} />

        <SearchField
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          onClear={() => setSearchKeyword("")}
          placeholder="선수명, 소속, 시도로 검색..."
          helperText={searchKeyword ? `"${searchKeyword}" 검색 결과: ${filteredRows.length}명` : undefined}
        />

        {message && <StatusBanner tone="error" style={{ marginBottom: 16 }}>{message}</StatusBanner>}

        {printMode && (
          <GlassCard variant="subtle" style={{ marginBottom: 16 }}>
            <strong style={{ color: "#475569" }}>인쇄 안내</strong>
            <p style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
              인쇄 시에는 화면용 카드 대신 페이지별 인쇄 전용 레이아웃이 출력됩니다.
            </p>
          </GlassCard>
        )}

        <RankingTable rows={filteredRows} emptyMessage={searchKeyword ? "검색 결과가 없습니다." : "등록된 점수가 없습니다."} onSelectPlayer={(playerName) => setSelectedPlayer(playerName)} />
      </div>

      <div className="print-only">
        {printPages.length === 0 ? (
          <section className="print-page">
            <h1 className="print-page-title">{tournament?.title ?? "대회"}</h1>
            <p className="print-page-subtitle">{eventLabel || "세부종목"}</p>
            <p style={{ fontSize: 12 }}>출력할 점수 데이터가 없습니다.</p>
          </section>
        ) : (
          printPages.map((pageRows, pageIndex) => (
            <section className="print-page" key={`score-print-${pageIndex}`}>
              <div className="print-header-block">
                <h1 className="print-page-title">{tournament?.title ?? "대회"}</h1>
                <p className="print-page-subtitle">
                  {eventLabel || "세부종목"}
                  {eventInfo?.kind ? ` (${KIND_LABELS[eventInfo.kind] ?? eventInfo.kind})` : ""}
                </p>
                <p className="print-page-meta">
                  {divisionTitle}
                  {eventInfo?.scheduleDate ? ` · ${eventInfo.scheduleDate}` : ""}
                  {printPages.length > 1 ? ` · ${pageIndex + 1}/${printPages.length} 페이지` : ""}
                </p>
              </div>

              <table className="print-table">
                <thead>
                  <tr>
                    <th>순위</th>
                    <th>시도</th>
                    <th>소속</th>
                    <th>번호</th>
                    <th>성명</th>
                    {Array.from({ length: maxGameCount }, (_, index) => (
                      <th key={`game-${index}`}>{index + 1}G</th>
                    ))}
                    <th>합계</th>
                    <th>평균</th>
                    <th>핀차</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={row.playerId}>
                      <td>{row.rank}</td>
                      <td>{row.region}</td>
                      <td>{row.affiliation}</td>
                      <td>{row.number}</td>
                      <td>{row.name}</td>
                      {Array.from({ length: maxGameCount }, (_, index) => (
                        <td key={`${row.playerId}-${index}`}>{row.gameScores[index]?.score ?? ""}</td>
                      ))}
                      <td>{row.total}</td>
                      <td>{row.average}</td>
                      <td>{row.pinDiff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        )}
      </div>

      {selectedPlayer && <PlayerProfileModal playerName={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
    </main>
  );
};

export default EventScoreBoardPage;
