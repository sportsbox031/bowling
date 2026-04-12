"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { GlassBadge, GlassButton, GlassCard, GlassInput, GlassSelect } from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";
import { cachedFetch } from "@/lib/client-cache";
import { GENDER_LABELS } from "@/lib/constants";
import {
  fetchUserProfileBundle,
  getApprovedOrganizationsFromBundle,
} from "@/lib/user-profile-client";

type TournamentOption = {
  id: string;
  title: string;
  seasonYear: number;
  region: string;
};

type DivisionOption = {
  id: string;
  title: string;
  gender: "M" | "F" | "MIXED";
};

type SubmissionItem = {
  id: string;
  divisionId: string;
  organizationId: string;
  status: string;
  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  players: Array<{
    name: string;
  }>;
};

type PlayerDraft = {
  id: string;
  name: string;
};

const blankDraft = () => ({
  id: `draft-${Date.now()}`,
  name: "",
});

const mergeUniqueSubmissions = (items: SubmissionItem[]) => {
  const byId = new Map<string, SubmissionItem>();
  for (const item of items) {
    byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) =>
    String(b.submittedAt ?? b.createdAt ?? "").localeCompare(String(a.submittedAt ?? a.createdAt ?? "")),
  );
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

type Props = {
  tournamentId?: string;
  hideTournamentSelect?: boolean;
};

export default function PlayerRegistrationManager({ tournamentId: lockedTournamentId = "", hideTournamentSelect = false }: Props) {
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [approvedOrganizations, setApprovedOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [divisionOptions, setDivisionOptions] = useState<DivisionOption[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState(lockedTournamentId);
  const [selectedDivisionId, setSelectedDivisionId] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [players, setPlayers] = useState<PlayerDraft[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<PlayerDraft>(blankDraft());
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">("info");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState("");
  const submitLockRef = useRef(false);

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      try {
        const [tournamentData, profileData] = await Promise.all([
          cachedFetch<{ items: TournamentOption[] }>("/api/public/tournaments", 120000),
          fetchUserProfileBundle(),
        ]);

        setTournaments(tournamentData.items ?? []);
        if ((tournamentData.items ?? []).length > 0) {
          setSelectedTournamentId(lockedTournamentId || ((tournamentData.items ?? [])[0]?.id ?? ""));
        }

        const approved = getApprovedOrganizationsFromBundle(profileData);
        setApprovedOrganizations(approved);
        setSelectedOrganizationId(approved[0]?.id ?? "");
      } catch (error) {
        setMessageTone("error");
        setMessage((error as Error).message || "선수등록 준비 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [lockedTournamentId]);

  useEffect(() => {
    if (!selectedTournamentId) {
      setDivisionOptions([]);
      setSubmissions([]);
      return;
    }

    const loadTournamentData = async () => {
      try {
        const [detailData, submissionData] = await Promise.all([
          cachedFetch<{ divisions?: DivisionOption[] }>(`/api/public/tournaments/${selectedTournamentId}`, 120000),
          fetch(`/api/user/tournaments/${selectedTournamentId}/player-submissions`, { cache: "no-store" }).then(async (response) => {
            if (!response.ok) throw new Error("내 선수등록 제출 목록을 불러오지 못했습니다.");
            return response.json() as Promise<{ items?: SubmissionItem[] }>;
          }),
        ]);

        const divisions = (detailData.divisions ?? []).filter((division) => Boolean(division.id));
        setDivisionOptions(divisions);
        setSelectedDivisionId((current) =>
          current && divisions.some((division) => division.id === current) ? current : (divisions[0]?.id ?? ""),
        );
        const nextSubmissions = mergeUniqueSubmissions(submissionData.items ?? []);
        setSubmissions(nextSubmissions);
        setExpandedSubmissionId((current) => (current && nextSubmissions.some((item) => item.id === current) ? current : (nextSubmissions[0]?.id ?? "")));
      } catch (error) {
        setMessageTone("error");
        setMessage((error as Error).message || "대회별 선수등록 정보를 불러오지 못했습니다.");
      }
    };

    void loadTournamentData();
  }, [selectedTournamentId]);

  const divisionById = useMemo(
    () => new Map(
      divisionOptions.map((division) => [
        division.id,
        `${division.title} ${GENDER_LABELS[division.gender] ?? division.gender}`.trim(),
      ]),
    ),
    [divisionOptions],
  );
  const organizationById = useMemo(
    () => new Map(approvedOrganizations.map((organization) => [organization.id, organization.name])),
    [approvedOrganizations],
  );

  const addPlayer = () => {
    const nextName = currentPlayer.name.trim();
    if (!nextName) {
      setMessageTone("error");
      setMessage("선수 이름을 입력한 뒤 추가해 주세요.");
      return;
    }
    setPlayers((current) => [...current, { ...currentPlayer, name: nextName }]);
    setCurrentPlayer(blankDraft());
    setMessage("");
  };

  const handleCurrentPlayerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addPlayer();
  };

  const removePlayer = (id: string) => {
    setPlayers((current) => (current.length === 1 ? current : current.filter((player) => player.id !== id)));
  };

  const loadRejectedSubmission = (submission: SubmissionItem) => {
    setSelectedDivisionId(submission.divisionId);
    setSelectedOrganizationId(submission.organizationId);
    setPlayers(
      submission.players.map((player, index) => ({
        id: `draft-retry-${submission.id}-${index}-${Date.now()}`,
        name: player.name,
      })),
    );
    setCurrentPlayer(blankDraft());
    setMessageTone("info");
    setMessage("반려된 선수등록 내용을 편집 화면으로 불러왔습니다. 수정 후 다시 제출하세요.");
  };

  const submit = async () => {
    if (submitting || submitLockRef.current) return;
    if (!selectedTournamentId || !selectedDivisionId || !selectedOrganizationId) {
      setMessageTone("error");
      setMessage("대회와 담당단체를 먼저 선택해 주세요.");
      return;
    }

    const candidatePlayers = currentPlayer.name.trim()
      ? [...players, { ...currentPlayer, name: currentPlayer.name.trim() }]
      : players;

    const normalizedPlayers = candidatePlayers
      .map((player, index) => ({
        name: player.name.trim(),
        number: index + 1,
      }))
      .filter((player) => player.name);

    if (normalizedPlayers.length === 0) {
      setMessageTone("error");
      setMessage("제출할 선수를 한 명 이상 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    submitLockRef.current = true;
    setMessage("");
    try {
      const response = await fetch(`/api/user/tournaments/${selectedTournamentId}/player-submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          divisionId: selectedDivisionId,
          organizationId: selectedOrganizationId,
          players: normalizedPlayers,
        }),
      });
      if (!response.ok) {
        throw new Error("선수등록 제출에 실패했습니다.");
      }
      const data = await response.json() as { item: SubmissionItem };
      setSubmissions((current) => mergeUniqueSubmissions([data.item, ...current]));
      setExpandedSubmissionId(data.item.id);
      setPlayers([]);
      setCurrentPlayer(blankDraft());
      setMessageTone("success");
      setMessage("선수등록 제출이 완료되었습니다. 관리자 승인 후 개인전 출전선수로 자동 반영됩니다.");
    } catch (error) {
      setMessageTone("error");
      setMessage((error as Error).message || "선수등록 제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <GlassCard variant="strong" style={{ display: "grid", gap: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: "#1e293b" }}>선수등록 제출</h2>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14, lineHeight: 1.7 }}>
            담당단체와 제출할 종별을 선택한 뒤 선수 명단을 제출하세요. 개인전은 승인된 선수 전원이 자동 출전하며, A/B 구분은 입력 순서 기준으로 승인 시 자동 확정됩니다.
          </p>
        </div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {!hideTournamentSelect ? (
            <GlassSelect value={selectedTournamentId} onChange={(event) => setSelectedTournamentId(event.target.value)} label="대회">
              <option value="">대회를 선택하세요</option>
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>{tournament.title}</option>
              ))}
            </GlassSelect>
          ) : null}
          <GlassSelect value={selectedOrganizationId} onChange={(event) => setSelectedOrganizationId(event.target.value)} label="담당단체">
            <option value="">담당단체를 선택하세요</option>
            {approvedOrganizations.map((organization) => (
              <option key={organization.id} value={organization.id}>{organization.name}</option>
            ))}
          </GlassSelect>
          <GlassSelect value={selectedDivisionId} onChange={(event) => setSelectedDivisionId(event.target.value)} label="종별">
            <option value="">종별을 선택하세요</option>
            {divisionOptions.map((division) => (
              <option key={division.id} value={division.id}>
                {divisionById.get(division.id) ?? division.title}
              </option>
            ))}
          </GlassSelect>
        </div>

        {approvedOrganizations.length === 0 ? (
          <StatusBanner tone="info">
            승인된 담당단체가 아직 없습니다. <Link href="/account" style={{ color: "inherit", fontWeight: 700 }}>계정관리</Link>에서 단체를 추가 요청하고 관리자 승인을 기다려 주세요.
          </StatusBanner>
        ) : null}

        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              display: "grid",
              gap: 12,
              padding: 14,
              borderRadius: 14,
              background: "rgba(255,255,255,0.5)",
              border: "1px solid rgba(148,163,184,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <strong style={{ color: "#1e293b" }}>선수 입력</strong>
              <GlassBadge variant={players.length < 6 ? "info" : "warning"}>
                {(players.length + 1) <= 6 ? "자동 A조" : "자동 B조"}
              </GlassBadge>
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(220px, 1fr)" }}>
              <GlassInput
                label="성명"
                value={currentPlayer.name}
                onChange={(event) => setCurrentPlayer((prev) => ({ ...prev, name: event.target.value }))}
                onKeyDown={handleCurrentPlayerKeyDown}
                placeholder="선수 이름을 입력하세요"
              />
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              소속은 담당단체명으로, 지역은 대회 지역으로, 투구손은 기본값으로 자동 등록됩니다.
            </div>
          </div>

          {players.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>추가된 선수</div>
              {players.map((player, index) => (
                <div
                  key={player.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.55)",
                    border: "1px solid rgba(148,163,184,0.18)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: "#1e293b", fontWeight: 600 }}>{index + 1}. {player.name}</span>
                    <GlassBadge variant={index < 6 ? "info" : "warning"}>{index < 6 ? "A조" : "B조"}</GlassBadge>
                  </div>
                  <GlassButton variant="ghost" size="sm" onClick={() => removePlayer(player.id)}>삭제</GlassButton>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <GlassButton variant="secondary" onClick={addPlayer}>선수 추가</GlassButton>
          <GlassButton onClick={submit} isLoading={submitting || loading}>제출하기</GlassButton>
        </div>
      </GlassCard>

      {message ? <StatusBanner tone={messageTone}>{message}</StatusBanner> : null}

      <GlassCard variant="strong" style={{ display: "grid", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, color: "#1e293b" }}>내 제출 내역</h3>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>선택한 대회의 제출건만 표시됩니다.</p>
        </div>
        {submissions.length === 0 ? (
          <div style={{ fontSize: 14, color: "#94a3b8" }}>아직 제출된 선수등록 건이 없습니다.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {submissions.map((submission) => (
              <div
                key={submission.id}
                onClick={() => setExpandedSubmissionId((current) => (current === submission.id ? "" : submission.id))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setExpandedSubmissionId((current) => (current === submission.id ? "" : submission.id));
                  }
                }}
                role="button"
                tabIndex={0}
                style={{
                  borderRadius: 14,
                  border: expandedSubmissionId === submission.id ? "1px solid rgba(99,102,241,0.35)" : "1px solid rgba(148,163,184,0.2)",
                  padding: 14,
                  background: "rgba(255,255,255,0.55)",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong style={{ color: "#1e293b" }}>
                      {divisionById.get(submission.divisionId) ?? submission.divisionId} · {organizationById.get(submission.organizationId) ?? submission.organizationId}
                    </strong>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      제출 {submission.players.length}명 · {formatDateMinute(submission.submittedAt ?? submission.createdAt)}
                    </span>
                  </div>
                  <GlassBadge variant={
                    submission.status === "APPROVED" ? "success" :
                      submission.status === "REJECTED" ? "danger" :
                        "info"
                  }>
                    {submission.status === "APPROVED" ? "승인됨" : submission.status === "REJECTED" ? "반려됨" : "승인 대기"}
                  </GlassBadge>
                </div>
                {expandedSubmissionId === submission.id ? (
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#64748b" }}>
                      <span>생성일시: {formatDateMinute(submission.createdAt)}</span>
                      {submission.submittedAt ? <span>제출일시: {formatDateMinute(submission.submittedAt)}</span> : null}
                      {submission.approvedAt ? <span>승인일시: {formatDateMinute(submission.approvedAt)}</span> : null}
                      {submission.rejectedAt ? <span>반려일시: {formatDateMinute(submission.rejectedAt)}</span> : null}
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>제출 선수</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {submission.players.map((player, index) => (
                          <div
                            key={`${submission.id}-${player.name}-${index}`}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 12,
                              flexWrap: "wrap",
                              padding: "8px 10px",
                              borderRadius: 10,
                              background: "rgba(255,255,255,0.45)",
                              border: "1px solid rgba(148,163,184,0.16)",
                            }}
                          >
                            <span style={{ color: "#1e293b", fontWeight: 600 }}>{index + 1}. {player.name}</span>
                            <GlassBadge variant={index < 6 ? "info" : "warning"}>{index < 6 ? "A조" : "B조"}</GlassBadge>
                          </div>
                        ))}
                      </div>
                    </div>
                    {submission.rejectionReason ? (
                      <div style={{ fontSize: 13, color: "#b45309" }}>
                        반려 사유: {submission.rejectionReason}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {submission.status === "REJECTED" ? (
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                    <GlassButton
                      size="sm"
                      variant="secondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        loadRejectedSubmission(submission);
                      }}
                    >
                      다시 편집
                    </GlassButton>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
