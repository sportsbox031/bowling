"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassCard, GlassTable, GlassInput, GlassBadge, glassTdStyle, glassTrHoverProps } from "@/components/ui";
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

const rankStyle = (rank: number) => {
  if (rank === 1) return { color: "#f59e0b", fontWeight: 800 as const, fontSize: 15 };
  if (rank === 2) return { color: "#6366f1", fontWeight: 700 as const };
  if (rank === 3) return { color: "#8b5cf6", fontWeight: 600 as const };
  return {};
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
      (p) =>
        p.name.toLowerCase().includes(kw) ||
        p.affiliation.toLowerCase().includes(kw) ||
        p.region.toLowerCase().includes(kw),
    );
  }, [players, searchKeyword]);

  return (
    <main>
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
          선수 랭킹
        </h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ color: "#64748b", fontSize: 14 }}>전체 대회 누적 성적 기준</span>
          <GlassBadge variant="info">{players.length}명</GlassBadge>
          {loading && <span style={{ color: "#94a3b8", fontSize: 13 }}>불러오는 중...</span>}
        </div>
      </div>

      {/* Search */}
      <GlassCard variant="strong" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>&#x1F50D;</span>
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
              &#x2715;
            </button>
          )}
        </div>
        {searchKeyword && (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6366f1" }}>
            &quot;{searchKeyword}&quot; 검색 결과: {filteredPlayers.length}명
          </p>
        )}
      </GlassCard>

      {message && (
        <GlassCard variant="subtle" style={{ marginBottom: 16, color: "#ef4444", padding: "12px 16px" }}>
          {message}
        </GlassCard>
      )}

      {/* Ranking Table */}
      <GlassTable
        headers={["순위", "성명", "시도", "소속", "평균", "총점", "총게임", "하이게임", "출전대회"]}
        rowCount={filteredPlayers.length}
        emptyMessage={searchKeyword ? "검색 결과가 없습니다." : loading ? "불러오는 중..." : "등록된 선수가 없습니다."}
      >
        {filteredPlayers.map((p) => (
          <tr
            key={p.name}
            {...glassTrHoverProps}
            onClick={() => setSelectedPlayer(p.name)}
            style={{ cursor: "pointer" }}
          >
            <td style={{ ...glassTdStyle, ...rankStyle(p.rank), textAlign: "center" }}>{p.rank}</td>
            <td style={{ ...glassTdStyle, fontWeight: 700, color: "#6366f1" }}>{p.name}</td>
            <td style={{ ...glassTdStyle, textAlign: "center", color: "#64748b" }}>{p.region}</td>
            <td style={glassTdStyle}>{p.affiliation}</td>
            <td style={{ ...glassTdStyle, textAlign: "center", fontWeight: 700, color: "#6366f1" }}>{p.average}</td>
            <td style={{ ...glassTdStyle, textAlign: "center", fontWeight: 600 }}>{p.totalScore.toLocaleString()}</td>
            <td style={{ ...glassTdStyle, textAlign: "center" }}>{p.totalGames}</td>
            <td style={{ ...glassTdStyle, textAlign: "center", color: "#f59e0b", fontWeight: 600 }}>{p.highGame}</td>
            <td style={{ ...glassTdStyle, textAlign: "center" }}>{p.tournamentCount}</td>
          </tr>
        ))}
      </GlassTable>

      {/* Profile Modal */}
      {selectedPlayer && (
        <PlayerProfileModal
          playerName={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </main>
  );
}
