"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassBadge, GlassButton, GlassCard, GlassInput, GlassSelect } from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";
import { cachedFetch } from "@/lib/client-cache";

type TournamentOption = {
  id: string;
  title: string;
};

type SubmissionItem = {
  id: string;
  divisionId: string;
  divisionTitle?: string;
  eventId: string;
  eventTitle?: string;
  organizationId: string;
  organizationName?: string;
  coachUid: string;
  coachName?: string;
  createdAt: string;
  rejectionReason?: string;
  teams: Array<{
    name?: string;
    entryGroup: "A" | "B";
    playerIds: string[];
    playerLabels?: string[];
    firstHalfMemberIds?: string[];
    secondHalfMemberIds?: string[];
    firstHalfPlayerLabels?: string[];
    secondHalfPlayerLabels?: string[];
  }>;
};

type Props = {
  tournamentId?: string;
  divisionId?: string;
  hideTournamentSelect?: boolean;
};

export default function TeamSubmissionApprovalPanel({
  tournamentId: lockedTournamentId = "",
  divisionId: lockedDivisionId = "",
  hideTournamentSelect = false,
}: Props) {
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState(lockedTournamentId);
  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">("info");
  const [busyId, setBusyId] = useState("");
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const selectedTournament = useMemo(
    () => tournaments.find((tournament) => tournament.id === selectedTournamentId) ?? null,
    [tournaments, selectedTournamentId],
  );
  const selectedDivisionTitle = useMemo(
    () => items.find((item) => item.divisionId === lockedDivisionId)?.divisionTitle ?? lockedDivisionId,
    [items, lockedDivisionId],
  );

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
      setItems([]);
      return;
    }

    const load = async () => {
      try {
        const params = new URLSearchParams({ tournamentId: selectedTournamentId });
        if (lockedDivisionId) {
          params.set("divisionId", lockedDivisionId);
        }
        const response = await fetch(`/api/admin/approvals/team-submissions?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("팀편성 승인 대기 목록을 불러오지 못했습니다.");
        const data = await response.json() as { items?: SubmissionItem[] };
        setItems(data.items ?? []);
      } catch (error) {
        setMessageTone("error");
        setMessage((error as Error).message || "팀편성 승인 대기 목록을 불러오지 못했습니다.");
      }
    };
    void load();
  }, [selectedTournamentId, lockedDivisionId]);

  const act = async (submissionId: string, action: "APPROVE" | "REJECT") => {
    if (!selectedTournamentId) return;
    setBusyId(submissionId);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/approvals/team-submissions/${submissionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          action,
          rejectionReason: action === "REJECT" ? (rejectionReasons[submissionId] ?? "").trim() : undefined,
        }),
      });
      if (!response.ok) throw new Error(action === "APPROVE" ? "팀편성 승인에 실패했습니다." : "팀편성 반려에 실패했습니다.");
      setItems((current) => current.filter((item) => item.id !== submissionId));
      setMessageTone("success");
      setMessage(action === "APPROVE" ? "팀편성 승인 완료" : "팀편성 반려 완료");
    } catch (error) {
      setMessageTone("error");
      setMessage((error as Error).message || "팀편성 승인 처리에 실패했습니다.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <GlassCard variant="strong" style={{ display: "grid", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: "#1e293b" }}>팀편성 승인</h1>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14, lineHeight: 1.7 }}>
            제출된 2인조, 3인조, 5인조 팀편성을 검토하고 승인합니다. 팀 편성은 사용자 제출 기준으로 확정되며, 운영 화면에서는 승인된 결과를 기준으로 진행합니다.
          </p>
          {hideTournamentSelect && selectedTournament ? (
            <div style={{ marginTop: 8, fontSize: 13, color: "#475569" }}>
              현재 대회: {selectedTournament.title}{lockedDivisionId ? ` / 현재 종별: ${selectedDivisionTitle}` : ""}
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
          <div style={{ fontSize: 14, color: "#64748b" }}>이 대회에는 승인 대기 중인 팀편성 제출건이 없습니다.</div>
        </GlassCard>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((item) => (
            <GlassCard key={item.id} variant="strong" style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <strong style={{ color: "#1e293b" }}>
                    {item.divisionTitle || item.divisionId} · {item.eventTitle || item.eventId}
                  </strong>
                  <span style={{ fontSize: 13, color: "#64748b" }}>
                    지도자 {item.coachName || item.coachUid} · 단체 {item.organizationName || item.organizationId} · 제출 팀 {item.teams.length}개
                  </span>
                </div>
                <GlassBadge variant="info">승인 대기</GlassBadge>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {item.teams.map((team, index) => (
                  <div key={`${item.id}-${index}`} style={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(255,255,255,0.5)", padding: "12px 14px", display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <strong style={{ color: "#1e293b" }}>{team.name || `팀 ${index + 1}`}</strong>
                      <GlassBadge variant={team.entryGroup === "A" ? "info" : "warning"}>{team.entryGroup}조</GlassBadge>
                    </div>
                    <div style={{ fontSize: 13, color: "#475569" }}>
                      선수 {team.playerIds.length}명: {(team.playerLabels ?? team.playerIds).join(", ")}
                    </div>
                    {team.firstHalfMemberIds?.length ? (
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        전반: {(team.firstHalfPlayerLabels ?? team.firstHalfMemberIds).join(", ")} / 후반: {(team.secondHalfPlayerLabels ?? team.secondHalfMemberIds ?? []).join(", ")}
                      </div>
                    ) : null}
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
                <GlassButton variant="secondary" isLoading={busyId === item.id} onClick={() => void act(item.id, "REJECT")}>반려</GlassButton>
                <GlassButton isLoading={busyId === item.id} onClick={() => void act(item.id, "APPROVE")}>승인</GlassButton>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
