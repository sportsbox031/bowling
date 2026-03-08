"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GlassCard, GlassTable, GlassBadge, GlassButton, GlassInput, glassTdStyle, glassTrHoverProps } from "@/components/ui";
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
    const data = await cachedFetch<TournamentDetailResponse>(
      `/api/public/tournaments/${tournamentId}`,
      600000,
    );
    return data.tournament as TournamentInfo;
  } catch {
    return { id: tournamentId, title: "대회명 미확인" };
  }
};

const rankStyle = (rank: number) => {
  if (rank === 1) return { color: "#f59e0b", fontWeight: 800 as const, fontSize: 15 };
  if (rank === 2) return { color: "#6366f1", fontWeight: 700 as const };
  if (rank === 3) return { color: "#8b5cf6", fontWeight: 600 as const };
  return {};
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

  const load = async () => {
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
  };

  useEffect(() => {
    load();
  }, [tournamentId, divisionId]);

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
          전체종합 성적
        </h1>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: "#64748b", fontSize: 14 }}>
            {tournament?.title ?? "대회 성적"}
          </span>
          {divisionId ? (
            <GlassBadge variant="info">종별 필터 적용</GlassBadge>
          ) : (
            <GlassBadge variant="success">전체 종별</GlassBadge>
          )}
          {loading && <span style={{ color: "#94a3b8", fontSize: 13 }}>불러오는 중...</span>}
        </div>
        {divisionId && (
          <div style={{ marginTop: 12 }}>
            <Link href={`/tournaments/${tournamentId}/overall`}>
              <GlassButton variant="secondary" size="sm">
                전체 종별 종합 보기
              </GlassButton>
            </Link>
          </div>
        )}
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

      {/* Overall Table */}
      <GlassTable
        headers={["순위", "시도", "소속", "번호", "성명", "1G", "2G", "3G", "4G", "5G", "6G", "합계", "평균", "핀차이", "게임수"]}
        rowCount={filteredRows.length}
        emptyMessage={searchKeyword ? "검색 결과가 없습니다." : "아직 성적 데이터가 없습니다."}
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
            <td style={{ ...glassTdStyle, textAlign: "center" }}>{row.gameCount}</td>
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
}
