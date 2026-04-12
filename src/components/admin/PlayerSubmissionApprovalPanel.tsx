"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassBadge, GlassButton, GlassCard, GlassInput, GlassSelect } from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";
import { cachedFetch } from "@/lib/client-cache";

type TournamentOption = {
  id: string;
  title: string;
};

type DivisionOption = {
  id: string;
  title: string;
};

type SubmissionItem = {
  id: string;
  divisionId: string;
  organizationId: string;
  organizationName?: string;
  coachUid: string;
  coachName?: string;
  status: string;
  createdAt: string;
  players: Array<{
    name: string;
    affiliation?: string;
    region?: string;
    hand?: "left" | "right";
  }>;
};

type Props = {
  tournamentId?: string;
  hideTournamentSelect?: boolean;
};

const formatKoreanDateMinute = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

export default function PlayerSubmissionApprovalPanel({ tournamentId: lockedTournamentId = "", hideTournamentSelect = false }: Props) {
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState(lockedTournamentId);
  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">("info");
  const [busyId, setBusyId] = useState("");
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const tournamentData = await cachedFetch<{ items: TournamentOption[] }>("/api/public/tournaments", 120000);
        setTournaments(tournamentData.items ?? []);
        setSelectedTournamentId(lockedTournamentId || ((tournamentData.items ?? [])[0]?.id ?? ""));
      } catch (error) {
        setMessageTone("error");
        setMessage((error as Error).message || "대회 목록을 불러오지 못했습니다.");
      }
    };

    void load();
  }, [lockedTournamentId]);

  useEffect(() => {
    if (!selectedTournamentId) {
      setDivisions([]);
      setItems([]);
      return;
    }

    const load = async () => {
      try {
        const [detailData, submissionData] = await Promise.all([
          cachedFetch<{ divisions?: DivisionOption[] }>(`/api/public/tournaments/${selectedTournamentId}`, 120000),
          fetch(`/api/admin/approvals/player-submissions?tournamentId=${selectedTournamentId}`, { cache: "no-store" }).then(async (response) => {
            if (!response.ok) throw new Error("선수등록 승인 대기 목록을 불러오지 못했습니다.");
            return response.json() as Promise<{ items?: SubmissionItem[] }>;
          }),
        ]);
        setDivisions(detailData.divisions ?? []);
        setItems(submissionData.items ?? []);
      } catch (error) {
        setMessageTone("error");
        setMessage((error as Error).message || "승인 대기 목록을 불러오지 못했습니다.");
      }
    };

    void load();
  }, [selectedTournamentId]);

  const divisionById = useMemo(
    () => new Map(divisions.map((division) => [division.id, division.title])),
    [divisions],
  );
  const selectedTournament = useMemo(
    () => tournaments.find((tournament) => tournament.id === selectedTournamentId) ?? null,
    [tournaments, selectedTournamentId],
  );

  const act = async (submissionId: string, action: "APPROVE" | "REJECT") => {
    if (!selectedTournamentId) return;
    setBusyId(submissionId);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/approvals/player-submissions/${submissionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          action,
          rejectionReason: action === "REJECT" ? (rejectionReasons[submissionId] ?? "").trim() : undefined,
        }),
      });
      if (!response.ok) {
        throw new Error(action === "APPROVE" ? "선수등록 승인에 실패했습니다." : "선수등록 반려에 실패했습니다.");
      }
      setItems((current) => current.filter((item) => item.id !== submissionId));
      setMessageTone("success");
      setMessage(action === "APPROVE" ? "선수등록 승인 완료" : "선수등록 반려 완료");
    } catch (error) {
      setMessageTone("error");
      setMessage((error as Error).message || "승인 처리에 실패했습니다.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <GlassCard variant="strong" style={{ display: "grid", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: "#1e293b" }}>선수등록 승인</h2>
          {hideTournamentSelect && selectedTournament ? (
            <div style={{ marginTop: 8, fontSize: 13, color: "#475569" }}>
              현재 대회: {selectedTournament.title}
            </div>
          ) : null}
        </div>
        {!hideTournamentSelect ? (
          <GlassSelect value={selectedTournamentId} onChange={(event) => setSelectedTournamentId(event.target.value)} label="대회">
            <option value="">대회를 선택하세요</option>
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>{tournament.title}</option>
            ))}
          </GlassSelect>
        ) : null}
      </GlassCard>

      {message ? <StatusBanner tone={messageTone}>{message}</StatusBanner> : null}

      {items.length === 0 ? (
        <GlassCard variant="subtle">
          <div style={{ fontSize: 14, color: "#64748b" }}>이 대회에는 승인 대기 중인 선수등록 제출건이 없습니다.</div>
        </GlassCard>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((item) => (
            <GlassCard key={item.id} variant="strong" style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <strong style={{ color: "#1e293b" }}>
                    {divisionById.get(item.divisionId) ?? item.divisionId} · {item.organizationName || item.organizationId}
                  </strong>
                  <span style={{ fontSize: 13, color: "#64748b" }}>
                    지도자 {item.coachName || item.coachUid} · 제출 {item.players.length}명 · {formatKoreanDateMinute(item.createdAt)}
                  </span>
                </div>
                <GlassBadge variant="info">승인 대기</GlassBadge>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {[
                  { label: "A조", badgeVariant: "info" as const, players: item.players.slice(0, 6), startIndex: 0, tone: "rgba(59,130,246,0.08)" },
                  { label: "B조", badgeVariant: "warning" as const, players: item.players.slice(6), startIndex: 6, tone: "rgba(245,158,11,0.10)" },
                ]
                  .filter((group) => group.players.length > 0)
                  .map((group) => (
                    <div
                      key={`${item.id}-${group.label}`}
                      style={{
                        display: "grid",
                        gap: 8,
                        padding: "12px 12px 10px",
                        borderRadius: 14,
                        background: group.tone,
                        border: "1px solid rgba(148,163,184,0.18)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <GlassBadge variant={group.badgeVariant}>{group.label}</GlassBadge>
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          {group.label} 자동
                        </span>
                      </div>

                      {group.players.map((player, index) => (
                        <div
                          key={`${item.id}-${group.label}-${index}`}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                            padding: "10px 12px",
                            borderRadius: 12,
                            background: "rgba(255,255,255,0.62)",
                            border: "1px solid rgba(148,163,184,0.16)",
                          }}
                        >
                          <span style={{ color: "#1e293b", fontWeight: 600 }}>
                            {group.startIndex + index + 1}. {player.name}
                          </span>
                          <span style={{ fontSize: 12, color: "#64748b" }}>
                            {group.label} 자동
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>

              <GlassInput
                label="반려 사유"
                value={rejectionReasons[item.id] ?? ""}
                onChange={(event) => setRejectionReasons((prev) => ({ ...prev, [item.id]: event.target.value }))}
                placeholder="반려 시 사용자에게 보여줄 사유를 입력하세요"
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                <GlassButton variant="secondary" isLoading={busyId === item.id} onClick={() => void act(item.id, "REJECT")}>
                  반려
                </GlassButton>
                <GlassButton isLoading={busyId === item.id} onClick={() => void act(item.id, "APPROVE")}>
                  승인
                </GlassButton>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
