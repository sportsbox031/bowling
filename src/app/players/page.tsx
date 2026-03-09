"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassBadge } from "@/components/ui";
import PageTitle from "@/components/common/PageTitle";
import SearchField from "@/components/common/SearchField";
import StatusBanner from "@/components/common/StatusBanner";
import RankingTable from "@/components/scoreboard/RankingTable";
import PlayerProfileModal from "@/components/PlayerProfileModal";
import { cachedFetch } from "@/lib/client-cache";

type PlayerRanking = {
  name: string;
  region: string;
  affiliation: string;
  totalScore: number;
  totalGames: number;
  average: number;
  tournamentCount: number;
  highGame: number;
  rank: number;
};

export default function PlayersRankingPage() {
  const [players, setPlayers] = useState<PlayerRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await cachedFetch<{ players: PlayerRanking[] }>("/api/public/players/rankings", 600000);
        setPlayers(data.players ?? []);
        setMessage("");
      } catch (err) {
        setMessage((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredPlayers = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    if (!kw) return players;
    return players.filter(
      (player) =>
        player.name.toLowerCase().includes(kw) ||
        player.affiliation.toLowerCase().includes(kw) ||
        player.region.toLowerCase().includes(kw),
    );
  }, [players, searchKeyword]);

  const rows = filteredPlayers.map((player) => ({
    ...player,
    playerId: player.name,
    number: 0,
    gameScores: [],
    total: player.totalScore,
    pinDiff: player.highGame,
    gameCount: player.totalGames,
  }));

  return (
    <main>
      <PageTitle
        title="선수 랭킹"
        description="전체 대회 누적 성적 기준으로 집계한 선수 랭킹입니다."
        meta={
          <>
            <GlassBadge variant="info">전체 {players.length}명</GlassBadge>
            {loading && <span style={{ color: "#94a3b8", fontSize: 13 }}>불러오는 중...</span>}
          </>
        }
      />

      <SearchField
        value={searchKeyword}
        onChange={(event) => setSearchKeyword(event.target.value)}
        onClear={() => setSearchKeyword("")}
        placeholder="선수명, 소속, 시도로 검색..."
        helperText={searchKeyword ? `"${searchKeyword}" 검색 결과: ${filteredPlayers.length}명` : undefined}
      />

      {message && <StatusBanner tone="error" style={{ marginBottom: 16 }}>{message}</StatusBanner>}

      <RankingTable
        rows={rows}
        emptyMessage={searchKeyword ? "검색 결과가 없습니다." : loading ? "불러오는 중..." : "등록된 선수가 없습니다."}
        onSelectPlayer={(playerName) => setSelectedPlayer(playerName)}
        showOverallOnly
      />

      {selectedPlayer && <PlayerProfileModal playerName={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
    </main>
  );
}
