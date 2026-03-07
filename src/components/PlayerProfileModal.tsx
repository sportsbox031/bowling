"use client";

import { CSSProperties, useEffect, useState } from "react";
import { GlassCard, GlassBadge } from "@/components/ui";

type GameScore = { gameNumber: number; score: number | null };

type EventRecord = {
  eventId: string;
  eventTitle: string;
  kind: string;
  kindLabel: string;
  gameScores: GameScore[];
  total: number;
  average: number;
  rank: number;
  playerCount: number;
};

type TournamentRecord = {
  tournamentId: string;
  tournamentTitle: string;
  startsAt: string;
  region: string;
  divisionTitle: string;
  overallTotal: number;
  overallAverage: number;
  overallGames: number;
  events: EventRecord[];
};

type KindStat = {
  kind: string;
  kindLabel: string;
  games: number;
  totalScore: number;
  average: number;
};

type ProfileData = {
  playerName: string;
  summary: {
    totalScore: number;
    totalGames: number;
    average: number;
    tournamentCount: number;
    eventCount: number;
    highGame: number;
    kindStats: KindStat[];
  };
  tournaments: TournamentRecord[];
};

type Props = {
  playerName: string;
  onClose: () => void;
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0, 0, 0, 0.4)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  padding: "1rem",
};

const modalStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 720,
  maxHeight: "85vh",
  overflowY: "auto",
  background: "rgba(255, 255, 255, 0.85)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderRadius: 20,
  border: "1px solid rgba(255, 255, 255, 0.5)",
  boxShadow: "0 24px 80px rgba(0, 0, 0, 0.15)",
  padding: "2rem",
};

const closeBtnStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "1px solid rgba(0, 0, 0, 0.1)",
  background: "rgba(255, 255, 255, 0.6)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  color: "#64748b",
  transition: "background 0.15s",
};

const statBoxStyle: CSSProperties = {
  textAlign: "center",
  padding: "12px 8px",
  background: "rgba(99, 102, 241, 0.06)",
  borderRadius: 12,
  border: "1px solid rgba(99, 102, 241, 0.1)",
};

const eventCardStyle: CSSProperties = {
  padding: "14px 16px",
  background: "rgba(255, 255, 255, 0.5)",
  borderRadius: 12,
  border: "1px solid rgba(0, 0, 0, 0.06)",
};

const scoreBoxStyle = (score: number | null): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 42,
  height: 32,
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  background: score === null
    ? "rgba(0, 0, 0, 0.04)"
    : score >= 200
      ? "rgba(245, 158, 11, 0.12)"
      : "rgba(99, 102, 241, 0.08)",
  color: score === null
    ? "#cbd5e1"
    : score >= 200
      ? "#b45309"
      : "#1e293b",
  border: score !== null && score >= 200
    ? "1px solid rgba(245, 158, 11, 0.2)"
    : "1px solid rgba(0, 0, 0, 0.05)",
});

const rankBadgeVariant = (rank: number): "warning" | "info" | "default" => {
  if (rank <= 3) return "warning";
  if (rank <= 10) return "info";
  return "default";
};

export default function PlayerProfileModal({ playerName, onClose }: Props) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/public/players/profile?name=${encodeURIComponent(playerName)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error("선수 프로필을 불러오지 못했습니다.");
        const data = (await res.json()) as ProfileData;
        setProfile(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [playerName]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle} className="fade-in">
        <button
          style={closeBtnStyle}
          onClick={onClose}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.6)"; }}
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ marginBottom: 24, paddingRight: 40 }}>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 800,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: 4,
            }}
          >
            {playerName}
          </h2>
          <p style={{ fontSize: 14, color: "#64748b" }}>선수 누적 기록</p>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "3rem 0", color: "#94a3b8" }}>
            <div className="loading-pulse" style={{ fontSize: 15 }}>기록을 불러오는 중...</div>
          </div>
        )}

        {error && (
          <GlassCard variant="subtle" style={{ color: "#ef4444", padding: "12px 16px" }}>
            {error}
          </GlassCard>
        )}

        {profile && !loading && (
          <>
            {/* Summary Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8, marginBottom: 20 }}>
              <div style={statBoxStyle}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#6366f1" }}>{profile.summary.average}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>평균</div>
              </div>
              <div style={statBoxStyle}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#1e293b" }}>{profile.summary.totalScore.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>총점</div>
              </div>
              <div style={statBoxStyle}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#1e293b" }}>{profile.summary.totalGames}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>총 게임수</div>
              </div>
              <div style={statBoxStyle}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b" }}>{profile.summary.highGame}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>하이게임</div>
              </div>
              <div style={statBoxStyle}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#1e293b" }}>{profile.summary.tournamentCount}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>출전 대회</div>
              </div>
              <div style={statBoxStyle}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#1e293b" }}>{profile.summary.eventCount}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>출전 종목</div>
              </div>
            </div>

            {/* Kind Stats */}
            {profile.summary.kindStats.length > 0 && (
              <GlassCard variant="subtle" style={{ marginBottom: 20, padding: "14px 16px" }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 10 }}>
                  종목별 통계
                </h4>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {profile.summary.kindStats.map((ks) => (
                    <div
                      key={ks.kind}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        background: "rgba(99, 102, 241, 0.06)",
                        border: "1px solid rgba(99, 102, 241, 0.1)",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "#6366f1" }}>{ks.kindLabel}</span>
                      <span style={{ color: "#64748b", marginLeft: 8 }}>{ks.games}G</span>
                      <span style={{ color: "#1e293b", marginLeft: 8, fontWeight: 600 }}>avg {ks.average}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Tournament History */}
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>
              대회별 기록
            </h3>

            {profile.tournaments.length === 0 && (
              <p style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", padding: "2rem 0" }}>
                기록이 없습니다.
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {profile.tournaments.map((t) => (
                <GlassCard key={`${t.tournamentId}-${t.divisionTitle}`} style={{ padding: "16px 18px" }}>
                  {/* Tournament Header */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                        {t.tournamentTitle}
                      </span>
                      <GlassBadge variant="info">{t.divisionTitle}</GlassBadge>
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 13, color: "#64748b" }}>
                      {t.startsAt && <span>{t.startsAt.split("T")[0]}</span>}
                      {t.region && <span>{t.region}</span>}
                    </div>
                    {/* Tournament overall */}
                    <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 13 }}>
                      <span>
                        <span style={{ color: "#64748b" }}>총점 </span>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>{t.overallTotal}</span>
                      </span>
                      <span>
                        <span style={{ color: "#64748b" }}>평균 </span>
                        <span style={{ fontWeight: 700, color: "#6366f1" }}>{t.overallAverage}</span>
                      </span>
                      <span>
                        <span style={{ color: "#64748b" }}>게임 </span>
                        <span style={{ fontWeight: 600 }}>{t.overallGames}G</span>
                      </span>
                    </div>
                  </div>

                  {/* Events */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {t.events.map((ev) => (
                      <div key={ev.eventId} style={eventCardStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{ev.eventTitle}</span>
                          <GlassBadge>{ev.kindLabel}</GlassBadge>
                          <GlassBadge variant={rankBadgeVariant(ev.rank)}>
                            {ev.rank}위 / {ev.playerCount}명
                          </GlassBadge>
                        </div>

                        {/* Game scores */}
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                          {ev.gameScores.map((g) => (
                            <div key={g.gameNumber} style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>{g.gameNumber}G</div>
                              <div style={scoreBoxStyle(g.score)}>
                                {g.score ?? "-"}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Event totals */}
                        <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                          <span>
                            <span style={{ color: "#64748b" }}>합계 </span>
                            <span style={{ fontWeight: 700, color: "#1e293b" }}>{ev.total}</span>
                          </span>
                          <span>
                            <span style={{ color: "#64748b" }}>평균 </span>
                            <span style={{ fontWeight: 700, color: "#6366f1" }}>{ev.average}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
