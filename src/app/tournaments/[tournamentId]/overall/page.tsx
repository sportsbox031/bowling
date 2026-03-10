"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GlassBadge, GlassButton } from "@/components/ui";
import PageTitle from "@/components/common/PageTitle";
import PrintModeBar from "@/components/common/PrintModeBar";
import SearchField from "@/components/common/SearchField";
import StatusBanner from "@/components/common/StatusBanner";
import RankingTable from "@/components/scoreboard/RankingTable";
import PlayerProfileModal from "@/components/PlayerProfileModal";
import { cachedFetch } from "@/lib/client-cache";

type ScoreColumn = { gameNumber: number; score: number | null };
type OverallRow = {
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
  gameCount: number;
};

type TournamentInfo = {
  id: string;
  title: string;
};

type TournamentDetailResponse = {
  tournament: TournamentInfo;
  divisions: { id: string; title: string }[];
};

type OverallResponse = {
  tournament?: TournamentInfo;
  rows: OverallRow[];
};

const getOverallData = async (tournamentId: string, divisionId?: string) => {
  const query = new URLSearchParams();
  query.set("tournamentId", tournamentId);
  if (divisionId) query.set("divisionId", divisionId);
  return cachedFetch<OverallResponse>(`/api/public/scoreboard/overall?${query.toString()}`, 180000);
};

const getTournament = async (tournamentId: string) => {
  try {
    const data = await cachedFetch<TournamentDetailResponse>(`/api/public/tournaments/${tournamentId}`, 600000);
    return data.tournament as TournamentInfo;
  } catch {
    return { id: tournamentId, title: "대회명 미확인" };
  }
};

export default function TournamentOverallPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const searchParams = useSearchParams();
  const divisionId = searchParams.get("divisionId") ?? undefined;

  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [rows, setRows] = useState<OverallRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState(false);

  const load = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    setMessage("");
    try {
      const nextTournament = await getTournament(tournamentId);
      const nextRows = await getOverallData(tournamentId, divisionId);
      setTournament(nextTournament);
      setRows(nextRows.rows ?? []);
    } catch (error) {
      setMessage((error as Error).message || "종합성적 조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [divisionId, tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

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
    <main className={printMode ? "print-mode" : undefined}>
      <div className="no-print" style={{ marginBottom: 8 }}>
        <Link href={`/tournaments/${tournamentId}`} style={{ color: "#94a3b8", fontSize: 13 }}>
          ← {tournament?.title ?? "대회"} 로 돌아가기
        </Link>
      </div>

      <PageTitle
        title="전체종합 성적"
        meta={
          <>
            <span style={{ color: "#64748b", fontSize: 14 }}>{tournament?.title ?? "대회 성적"}</span>
            {divisionId ? <GlassBadge variant="info">종별 필터 적용</GlassBadge> : <GlassBadge variant="success">전체 종별</GlassBadge>}
            {loading && <span style={{ color: "#94a3b8", fontSize: 13 }}>불러오는 중...</span>}
          </>
        }
        actions={
          divisionId ? (
            <div className="no-print">
              <Link href={`/tournaments/${tournamentId}/overall`}>
                <GlassButton variant="secondary" size="sm">전체 종별 종합 보기</GlassButton>
              </Link>
            </div>
          ) : undefined
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

      <RankingTable
        rows={filteredRows}
        emptyMessage={searchKeyword ? "검색 결과가 없습니다." : "아직 성적 데이터가 없습니다."}
        onSelectPlayer={(playerName) => setSelectedPlayer(playerName)}
        showOverallOnly
      />

      {selectedPlayer && <PlayerProfileModal playerName={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
    </main>
  );
}
