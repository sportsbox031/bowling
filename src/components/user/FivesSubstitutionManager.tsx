"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassBadge, GlassButton, GlassCard } from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";

type PlayerItem = {
  id: string;
  number: number;
  name: string;
  affiliation: string;
  region: string;
  entryGroup?: "A" | "B" | "";
};

type SubmissionItem = {
  id: string;
  status: string;
  createdAt: string;
  rejectionReason?: string;
  secondHalfMemberIds: string[];
};

type TeamItem = {
  teamId: string;
  teamEntrySubmissionId: string;
  organizationId: string;
  organizationName: string;
  divisionId: string;
  divisionTitle: string;
  eventId: string;
  eventTitle: string;
  teamName: string;
  roster: PlayerItem[];
  firstHalfMemberIds: string[];
  windowOpen: boolean;
  canSubmit: boolean;
  status: "READY" | "WAITING_OPEN" | "SUBMITTED" | "APPROVED" | "REJECTED";
  message: string;
  submission: SubmissionItem | null;
};

type ResponsePayload = {
  items?: TeamItem[];
};

const formatDateMinute = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const getStatusBadge = (status: TeamItem["status"]) => {
  if (status === "READY") {
    return { label: "제출 가능", variant: "success" as const };
  }
  if (status === "SUBMITTED") {
    return { label: "승인 대기", variant: "info" as const };
  }
  if (status === "APPROVED") {
    return { label: "승인 완료", variant: "success" as const };
  }
  if (status === "REJECTED") {
    return { label: "반려", variant: "danger" as const };
  }
  return { label: "오픈 대기", variant: "warning" as const };
};

export default function FivesSubstitutionManager({ tournamentId }: { tournamentId: string }) {
  const [items, setItems] = useState<TeamItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">("info");
  const [busyTeamId, setBusyTeamId] = useState("");

  const load = async () => {
    try {
      const response = await fetch(`/api/user/tournaments/${tournamentId}/fives-substitutions`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("후반 교체 정보를 불러오지 못했습니다.");
      }
      const data = await response.json() as ResponsePayload;
      setItems(data.items ?? []);
      setMessage("");
    } catch (error) {
      setMessageTone("error");
      setMessage((error as Error).message || "후반 교체 정보를 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    void load();
  }, [tournamentId]);

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const item of items) {
        if (!next[item.teamId] || next[item.teamId].length === 0) {
          next[item.teamId] = item.submission?.secondHalfMemberIds?.length
            ? item.submission.secondHalfMemberIds
            : item.firstHalfMemberIds;
        }
      }
      return next;
    });
  }, [items]);

  const playerMaps = useMemo(
    () =>
      new Map(
        items.map((item) => [
          item.teamId,
          new Map(item.roster.map((player) => [player.id, player])),
        ]),
      ),
    [items],
  );

  const togglePlayer = (teamId: string, playerId: string) => {
    const target = items.find((item) => item.teamId === teamId);
    if (!target?.canSubmit) {
      return;
    }

    setDrafts((current) => {
      const currentIds = current[teamId] ?? [];
      if (currentIds.includes(playerId)) {
        return {
          ...current,
          [teamId]: currentIds.filter((id) => id !== playerId),
        };
      }
      if (currentIds.length >= 5) {
        setMessageTone("info");
        setMessage("후반 출전 선수는 5명까지만 선택할 수 있습니다.");
        return current;
      }
      return {
        ...current,
        [teamId]: [...currentIds, playerId],
      };
    });
  };

  const submit = async (item: TeamItem) => {
    const secondHalfMemberIds = drafts[item.teamId] ?? [];
    if (secondHalfMemberIds.length !== 5) {
      setMessageTone("error");
      setMessage("후반 출전 선수 5명을 선택해 주세요.");
      return;
    }

    setBusyTeamId(item.teamId);
    setMessage("");
    try {
      const response = await fetch(`/api/user/tournaments/${tournamentId}/fives-substitutions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          divisionId: item.divisionId,
          eventId: item.eventId,
          organizationId: item.organizationId,
          teamId: item.teamId,
          teamEntrySubmissionId: item.teamEntrySubmissionId,
          secondHalfMemberIds,
        }),
      });
      if (!response.ok) {
        throw new Error("후반 교체 제출에 실패했습니다.");
      }

      setMessageTone("success");
      setMessage("후반 교체 제출이 완료되었습니다. 관리자 승인을 기다려 주세요.");
      await load();
    } catch (error) {
      setMessageTone("error");
      setMessage((error as Error).message || "후반 교체 제출에 실패했습니다.");
    } finally {
      setBusyTeamId("");
    }
  };

  if (message && items.length === 0) {
    return <StatusBanner tone={messageTone}>{message}</StatusBanner>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <GlassCard variant="strong" style={{ display: "grid", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 22, color: "#1e293b" }}>후반 교체 제출</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "#64748b" }}>
          승인된 5인조 팀만 표시됩니다. 전반 종료 후 관리자가 제출을 열면 같은 로스터 안에서 후반 출전 5명을 한 번 제출할 수 있습니다.
        </p>
      </GlassCard>

      {message ? <StatusBanner tone={messageTone}>{message}</StatusBanner> : null}

      {items.length === 0 ? (
        <GlassCard variant="subtle">
          <div style={{ fontSize: 14, color: "#64748b" }}>
            아직 승인된 5인조 팀이 없습니다. 팀편성 승인 후 이 화면에서 후반 교체를 제출할 수 있습니다.
          </div>
        </GlassCard>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {items.map((item) => {
            const selectedIds = drafts[item.teamId] ?? [];
            const playerById = playerMaps.get(item.teamId) ?? new Map<string, PlayerItem>();
            const firstHalfLabels = item.firstHalfMemberIds
              .map((playerId) => playerById.get(playerId))
              .filter(Boolean)
              .map((player) => `${player?.number}. ${player?.name}`);
            const badge = getStatusBadge(item.status);

            return (
              <GlassCard key={item.teamId} variant="strong" style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong style={{ color: "#1e293b", fontSize: 18 }}>{item.teamName}</strong>
                    <span style={{ fontSize: 13, color: "#64748b" }}>
                      {item.divisionTitle} · {item.eventTitle} · {item.organizationName}
                    </span>
                  </div>
                  <GlassBadge variant={badge.variant}>{badge.label}</GlassBadge>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 13, color: "#475569" }}>
                    전반 출전: {firstHalfLabels.join(", ")}
                  </span>
                  {item.message ? (
                    <span style={{ fontSize: 12, color: item.status === "REJECTED" ? "#b45309" : "#64748b" }}>
                      {item.message}
                    </span>
                  ) : null}
                  {item.submission ? (
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>
                      최근 제출: {formatDateMinute(item.submission.createdAt)}
                    </span>
                  ) : null}
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 13, color: "#475569" }}>
                    후반 선택 {selectedIds.length}/5
                  </div>
                  {item.roster.map((player) => {
                    const selected = selectedIds.includes(player.id);
                    const disabled = !item.canSubmit && !selected;
                    return (
                      <label
                        key={player.id}
                        style={{
                          display: "grid",
                          gap: 6,
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: selected ? "1px solid rgba(99,102,241,0.35)" : "1px solid rgba(148,163,184,0.18)",
                          background: selected ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.45)",
                          opacity: disabled ? 0.6 : 1,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <span style={{ color: "#1e293b", fontWeight: 600 }}>
                            {player.number}. {player.name}
                          </span>
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={disabled}
                            onChange={() => togglePlayer(item.teamId, player.id)}
                          />
                        </div>
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          {player.affiliation} · {player.region}
                          {player.entryGroup ? ` · ${player.entryGroup}조` : ""}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <GlassButton
                    variant="secondary"
                    size="sm"
                    disabled={!item.canSubmit}
                    isLoading={busyTeamId === item.teamId}
                    onClick={() => void submit(item)}
                  >
                    후반 교체 제출
                  </GlassButton>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
