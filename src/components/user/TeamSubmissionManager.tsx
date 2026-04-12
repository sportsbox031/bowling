"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { GlassBadge, GlassButton, GlassCard, GlassInput, GlassSelect } from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";
import { cachedFetch } from "@/lib/client-cache";
import { buildAutoTeamNames, parseTeamPlayerNumberInput } from "@/lib/team-submission-draft";
import {
  fetchUserProfileBundle,
  getApprovedOrganizationsFromBundle,
} from "@/lib/user-profile-client";

type TournamentOption = {
  id: string;
  title: string;
};

type DivisionOption = {
  id: string;
  title: string;
};

type EventOption = {
  id: string;
  title: string;
  kind: "DOUBLES" | "TRIPLES" | "FIVES";
  gameCount: number;
};

type EligiblePlayer = {
  id: string;
  number: number;
  name: string;
  affiliation: string;
  region: string;
  entryGroup?: "A" | "B";
  entryOrder?: number;
};

type TeamDraft = {
  id: string;
  entryGroup: "A" | "B" | null;
  playerIds: string[];
  firstHalfMemberIds: string[];
  numberInput: string;
};

type SubmissionItem = {
  id: string;
  divisionId: string;
  eventId: string;
  organizationId: string;
  status: string;
  createdAt: string;
  rejectionReason?: string;
  teams: Array<{
    name?: string;
    entryGroup: "A" | "B";
    playerIds: string[];
    firstHalfMemberIds?: string[];
    secondHalfMemberIds?: string[];
  }>;
};

const TEAM_SIZE_BY_KIND: Record<EventOption["kind"], number> = {
  DOUBLES: 2,
  TRIPLES: 3,
  FIVES: 5,
};

const makeDraft = (index: number): TeamDraft => ({
  id: `team-${index}-${Date.now()}`,
  entryGroup: null,
  playerIds: [],
  firstHalfMemberIds: [],
  numberInput: "",
});

const mergeUniqueSubmissions = (items: SubmissionItem[]) => {
  const byId = new Map<string, SubmissionItem>();
  for (const item of items) {
    byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
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
  divisionId?: string;
  hideTournamentSelect?: boolean;
  hideDivisionSelect?: boolean;
};

export default function TeamSubmissionManager({
  tournamentId: lockedTournamentId = "",
  divisionId: lockedDivisionId = "",
  hideTournamentSelect = false,
  hideDivisionSelect = false,
}: Props) {
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [approvedOrganizations, setApprovedOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [eventsByDivision, setEventsByDivision] = useState<Record<string, EventOption[]>>({});
  const [eligiblePlayers, setEligiblePlayers] = useState<EligiblePlayer[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState(lockedTournamentId);
  const [selectedDivisionId, setSelectedDivisionId] = useState(lockedDivisionId);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [drafts, setDrafts] = useState<TeamDraft[]>([makeDraft(0)]);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">("info");
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [tournamentData, profileData] = await Promise.all([
          cachedFetch<{ items: TournamentOption[] }>("/api/public/tournaments", 120000),
          fetchUserProfileBundle(),
        ]);
        setTournaments(tournamentData.items ?? []);
        setSelectedTournamentId(lockedTournamentId || ((tournamentData.items ?? [])[0]?.id ?? ""));

        const approved = getApprovedOrganizationsFromBundle(profileData);
        setApprovedOrganizations(approved);
        setSelectedOrganizationId(approved[0]?.id ?? "");
      } catch (error) {
        setMessageTone("error");
        setMessage((error as Error).message || "팀편성 준비 정보를 불러오지 못했습니다.");
      }
    };

    void bootstrap();
  }, [lockedTournamentId]);

  useEffect(() => {
    if (!selectedTournamentId) {
      setDivisions([]);
      setEventsByDivision({});
      setSubmissions([]);
      return;
    }

    const loadTournamentData = async () => {
      try {
        const [detailData, submissionData] = await Promise.all([
          cachedFetch<{ divisions?: DivisionOption[]; eventsByDivision?: Array<{ divisionId: string; events: EventOption[] }> }>(
            `/api/public/tournaments/${selectedTournamentId}`,
            120000,
          ),
          fetch(`/api/user/tournaments/${selectedTournamentId}/team-submissions`, { cache: "no-store" }).then(async (response) => {
            if (!response.ok) throw new Error("내 팀편성 제출 목록을 불러오지 못했습니다.");
            return response.json() as Promise<{ items?: SubmissionItem[] }>;
          }),
        ]);

        const nextDivisions = detailData.divisions ?? [];
        setDivisions(nextDivisions);
        setSelectedDivisionId((current) => {
          if (lockedDivisionId && nextDivisions.some((division) => division.id === lockedDivisionId)) {
            return lockedDivisionId;
          }
          return current && nextDivisions.some((division) => division.id === current) ? current : (nextDivisions[0]?.id ?? "");
        });

        const nextEventsByDivision = Object.fromEntries(
          (detailData.eventsByDivision ?? []).map((entry) => [
            entry.divisionId,
            (entry.events ?? []).filter((event) => ["DOUBLES", "TRIPLES", "FIVES"].includes(event.kind)),
          ]),
        );
        setEventsByDivision(nextEventsByDivision);
        setSubmissions(mergeUniqueSubmissions(submissionData.items ?? []));
      } catch (error) {
        setMessageTone("error");
        setMessage((error as Error).message || "대회별 팀편성 정보를 불러오지 못했습니다.");
      }
    };

    void loadTournamentData();
  }, [lockedDivisionId, selectedTournamentId]);

  const availableEvents = useMemo(() => eventsByDivision[selectedDivisionId] ?? [], [eventsByDivision, selectedDivisionId]);
  const selectedEvent = useMemo(() => availableEvents.find((event) => event.id === selectedEventId) ?? null, [availableEvents, selectedEventId]);
  const divisionById = useMemo(
    () => new Map(divisions.map((division) => [division.id, division.title])),
    [divisions],
  );
  const organizationById = useMemo(
    () => new Map(approvedOrganizations.map((organization) => [organization.id, organization.name])),
    [approvedOrganizations],
  );
  const eventById = useMemo(
    () => new Map(
      Object.values(eventsByDivision)
        .flatMap((events) => events)
        .map((event) => [event.id, event.title]),
    ),
    [eventsByDivision],
  );

  useEffect(() => {
    if (!selectedEventId && availableEvents.length > 0) {
      setSelectedEventId(availableEvents[0]?.id ?? "");
      return;
    }
    if (selectedEventId && !availableEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(availableEvents[0]?.id ?? "");
    }
  }, [availableEvents, selectedEventId]);

  useEffect(() => {
    if (!selectedTournamentId || !selectedDivisionId || !selectedOrganizationId) {
      setEligiblePlayers([]);
      return;
    }

    const loadEligiblePlayers = async () => {
      try {
        const response = await fetch(
          `/api/user/tournaments/${selectedTournamentId}/eligible-players?divisionId=${selectedDivisionId}&organizationId=${selectedOrganizationId}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("팀편성 가능 선수를 불러오지 못했습니다.");
        const data = await response.json() as { items?: EligiblePlayer[] };
        setEligiblePlayers(data.items ?? []);
      } catch (error) {
        setMessageTone("error");
        setMessage((error as Error).message || "팀편성 가능 선수를 불러오지 못했습니다.");
      }
    };

    void loadEligiblePlayers();
  }, [selectedTournamentId, selectedDivisionId, selectedOrganizationId]);

  const playersByGroup = useMemo(() => ({
    A: eligiblePlayers.filter((player) => player.entryGroup === "A"),
    B: eligiblePlayers.filter((player) => player.entryGroup === "B"),
  }), [eligiblePlayers]);
  const playerById = useMemo(
    () => new Map(eligiblePlayers.map((player) => [player.id, player])),
    [eligiblePlayers],
  );
  const playerByNumber = useMemo(
    () => new Map(eligiblePlayers.map((player) => [player.number, player])),
    [eligiblePlayers],
  );
  const hasEligiblePlayers = eligiblePlayers.length > 0;
  const organizationName = useMemo(
    () => organizationById.get(selectedOrganizationId) ?? "",
    [organizationById, selectedOrganizationId],
  );
  const autoTeamNames = useMemo(
    () => buildAutoTeamNames(organizationName, drafts),
    [drafts, organizationName],
  );

  const updateDraft = (draftId: string, updater: (draft: TeamDraft) => TeamDraft) => {
    setDrafts((current) => current.map((draft) => (draft.id === draftId ? updater(draft) : draft)));
  };

  const getBlockedPlayerIds = (draftId: string) => new Set(
    drafts
      .filter((draft) => draft.id !== draftId)
      .flatMap((draft) => draft.playerIds),
  );

  const togglePlayer = (draftId: string, playerId: string) => {
    updateDraft(draftId, (draft) => {
      const targetGroup = playerById.get(playerId)?.entryGroup ?? null;
      if (!targetGroup) {
        return draft;
      }

      if (!draft.playerIds.includes(playerId) && draft.entryGroup && draft.entryGroup !== targetGroup) {
        setMessageTone("info");
        setMessage("같은 조 안에서만 팀을 구성할 수 있습니다.");
        return draft;
      }

      const selected = draft.playerIds.includes(playerId)
        ? draft.playerIds.filter((id) => id !== playerId)
        : [...draft.playerIds, playerId];
      const nextEntryGroup = selected.length > 0
        ? (playerById.get(selected[0])?.entryGroup ?? null)
        : null;
      return {
        ...draft,
        entryGroup: nextEntryGroup,
        playerIds: selected,
        firstHalfMemberIds: draft.firstHalfMemberIds.filter((id) => selected.includes(id)),
        numberInput: draft.numberInput,
      };
    });
  };

  const applyNumberInput = (draftId: string) => {
    const draft = drafts.find((item) => item.id === draftId);
    if (!draft) return;
    const blockedPlayerIds = getBlockedPlayerIds(draftId);

    const numbers = parseTeamPlayerNumberInput(draft.numberInput);
    if (numbers === null) {
      setMessageTone("error");
      setMessage("번호는 7, 7-9, 7,9-11 형식으로 입력해 주세요.");
      return;
    }

    const nextIds: string[] = [];
    for (const number of numbers) {
      const player = playerByNumber.get(number);
      if (!player) {
        setMessageTone("error");
        setMessage(`선수번호 ${number}를 찾을 수 없습니다.`);
        return;
      }
      if (blockedPlayerIds.has(player.id)) {
        setMessageTone("info");
        setMessage(`${player.name} 선수는 이미 다른 팀에서 선택되었습니다.`);
        return;
      }
      nextIds.push(player.id);
    }

    const groups = [...new Set(
      nextIds
        .map((playerId) => playerById.get(playerId)?.entryGroup ?? null)
        .filter((group): group is "A" | "B" => group === "A" || group === "B"),
    )];
    if (groups.length !== 1) {
      setMessageTone("info");
      setMessage("같은 조 안에서만 팀을 구성할 수 있습니다.");
      return;
    }

    updateDraft(draftId, (current) => ({
      ...current,
      entryGroup: groups[0] ?? null,
      playerIds: nextIds,
      firstHalfMemberIds: current.firstHalfMemberIds.filter((id) => nextIds.includes(id)),
      numberInput: "",
    }));
  };

  const toggleLineup = (draftId: string, playerId: string) => {
    updateDraft(draftId, (draft) => {
      const current = draft.firstHalfMemberIds;
      const next = current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId];
      return { ...draft, firstHalfMemberIds: next };
    });
  };

  const addDraft = () => setDrafts((current) => [...current, makeDraft(current.length)]);
  const removeDraft = (draftId: string) => setDrafts((current) => (current.length === 1 ? current : current.filter((draft) => draft.id !== draftId)));

  const loadRejectedSubmission = (submission: SubmissionItem) => {
    setSelectedDivisionId(submission.divisionId);
    setSelectedEventId(submission.eventId);
    setSelectedOrganizationId(submission.organizationId);
    setDrafts(
      submission.teams.map((team, index) => ({
        id: `retry-${submission.id}-${index}-${Date.now()}`,
        entryGroup: team.entryGroup,
        playerIds: [...team.playerIds],
        firstHalfMemberIds: [...(team.firstHalfMemberIds ?? [])],
        numberInput: "",
      })),
    );
    setMessageTone("info");
    setMessage("반려된 팀편성 내용을 편집 화면으로 불러왔습니다. 수정 후 다시 제출하세요.");
  };

  const submit = async () => {
    if (submitting || submitLockRef.current) return;
    if (!selectedTournamentId || !selectedDivisionId || !selectedEventId || !selectedOrganizationId || !selectedEvent) {
      setMessageTone("error");
      setMessage("대회, 종별, 종목, 담당단체를 먼저 선택해 주세요.");
      return;
    }

    if (!hasEligiblePlayers) {
      setMessageTone("info");
      setMessage("선수등록부터 진행해주세요. 승인된 선수만 팀편성에 사용할 수 있습니다.");
      return;
    }

    const requiredSize = TEAM_SIZE_BY_KIND[selectedEvent.kind];
    const payloadTeams = drafts.map((draft) => {
      const groups = [...new Set(
        draft.playerIds
          .map((playerId) => playerById.get(playerId)?.entryGroup ?? "")
          .filter((group) => group === "A" || group === "B"),
      )] as Array<"A" | "B">;

      return {
        entryGroup: groups[0],
        playerIds: draft.playerIds,
        firstHalfMemberIds: draft.firstHalfMemberIds,
        isValidGroup: groups.length === 1,
      };
    }).filter((draft) => draft.playerIds.length > 0);

    if (payloadTeams.length === 0) {
      setMessageTone("error");
      setMessage("제출할 팀을 한 팀 이상 구성해 주세요.");
      return;
    }

    if (payloadTeams.some((team) => !team.isValidGroup || !team.entryGroup)) {
      setMessageTone("error");
      setMessage("같은 조 안에서만 팀을 구성할 수 있습니다.");
      return;
    }

    for (const team of payloadTeams) {
      if (selectedEvent.kind === "FIVES") {
        if (team.playerIds.length < 1 || team.playerIds.length > 7) {
          setMessageTone("error");
          setMessage("5인조는 1명부터 7명까지 로스터를 구성할 수 있습니다. 1명~4명 팀은 개인기록만 반영됩니다.");
          return;
        }
      } else if (selectedEvent.kind === "TRIPLES") {
        if (team.playerIds.length < 1 || team.playerIds.length > requiredSize) {
          setMessageTone("error");
          setMessage("3인조는 1명부터 3명까지 팀을 구성할 수 있습니다. 1명/2명 팀은 개인기록만 반영됩니다.");
          return;
        }
      } else if (team.playerIds.length < 1 || team.playerIds.length > requiredSize) {
        setMessageTone("error");
        setMessage("2인조는 1명부터 2명까지 팀을 구성할 수 있습니다. 1명 팀은 개인기록만 반영됩니다.");
        return;
      }
    }

    setSubmitting(true);
    submitLockRef.current = true;
    setMessage("");
    try {
      const response = await fetch(`/api/user/tournaments/${selectedTournamentId}/team-submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          divisionId: selectedDivisionId,
          eventId: selectedEventId,
          organizationId: selectedOrganizationId,
          teams: payloadTeams,
        }),
      });
      if (!response.ok) throw new Error("팀편성 제출에 실패했습니다.");
      const data = await response.json() as { item: SubmissionItem };
      setSubmissions((current) => mergeUniqueSubmissions([data.item, ...current]));
      setDrafts([makeDraft(0)]);
      setMessageTone("success");
      setMessage("팀편성 제출이 완료되었습니다. 5인조 후반 교체는 전반 종료 후 별도로 제출할 수 있습니다.");
    } catch (error) {
      setMessageTone("error");
      setMessage((error as Error).message || "팀편성 제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <GlassCard variant="strong" style={{ display: "grid", gap: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: "#1e293b" }}>팀편성 제출</h2>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14, lineHeight: 1.7 }}>
            승인된 선수만 사용할 수 있으며, 선수등록 순서에 따라 1~6번은 A조, 7번 이후는 B조로 자동 구분됩니다.
            {" "}2인조, 3인조, 5인조는 인원이 부족해도 제출할 수 있지만 정원 미달 팀은 개인기록만 반영됩니다.
            {" "}5인조 후반 교체는 전반 종료 후 별도로 제출합니다.
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
          {!hideDivisionSelect ? (
            <GlassSelect value={selectedDivisionId} onChange={(event) => setSelectedDivisionId(event.target.value)} label="종별">
              <option value="">종별을 선택하세요</option>
              {divisions.map((division) => (
                <option key={division.id} value={division.id}>{division.title}</option>
              ))}
            </GlassSelect>
          ) : null}
          <GlassSelect value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} label="종목">
            <option value="">종목을 선택하세요</option>
            {availableEvents.map((event) => (
              <option key={event.id} value={event.id}>{event.title}</option>
            ))}
          </GlassSelect>
          <GlassSelect value={selectedOrganizationId} onChange={(event) => setSelectedOrganizationId(event.target.value)} label="담당단체">
            <option value="">담당단체를 선택하세요</option>
            {approvedOrganizations.map((organization) => (
              <option key={organization.id} value={organization.id}>{organization.name}</option>
            ))}
          </GlassSelect>
        </div>

        {approvedOrganizations.length === 0 ? (
          <StatusBanner tone="info">
            승인된 담당단체가 아직 없습니다. <Link href="/account" style={{ color: "inherit", fontWeight: 700 }}>계정관리</Link>에서 단체를 추가 요청하고 관리자 승인을 기다려 주세요.
          </StatusBanner>
        ) : null}

        {!hasEligiblePlayers && selectedTournamentId && selectedDivisionId && selectedOrganizationId ? (
          <StatusBanner tone="info">
            선수등록부터 진행해주세요. 제출 후 승인된 선수만 팀편성에 사용할 수 있습니다.
          </StatusBanner>
        ) : null}

        <div style={{ display: "grid", gap: 12 }}>
          {drafts.map((draft, index) => {
            const selectedCount = draft.playerIds.length;
            const blockedPlayerIds = getBlockedPlayerIds(draft.id);
            return (
              <div key={draft.id} style={{ borderRadius: 14, border: "1px solid rgba(148,163,184,0.2)", background: "rgba(255,255,255,0.55)", padding: 14, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <strong style={{ color: "#1e293b" }}>팀 {index + 1}</strong>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <GlassBadge variant={draft.entryGroup === "B" ? "warning" : "info"}>
                      {draft.entryGroup ? `${draft.entryGroup}조 자동선택` : "조 자동선택 대기"}
                    </GlassBadge>
                    <GlassButton variant="ghost" size="sm" onClick={() => removeDraft(draft.id)}>팀 삭제</GlassButton>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 320px)" }}>
                  <div style={{
                    borderRadius: 12,
                    border: "1px solid rgba(99,102,241,0.16)",
                    background: "rgba(99,102,241,0.06)",
                    padding: "10px 12px",
                    display: "grid",
                    gap: 4,
                  }}>
                    <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 700 }}>자동 팀명</span>
                    <span style={{ fontSize: 14, color: "#1e293b", fontWeight: 700 }}>
                      {autoTeamNames[index] ?? `${organizationName || "소속"}${draft.entryGroup ?? "A"}조`}
                    </span>
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <GlassInput
                      label="번호로 빠르게 선택"
                      placeholder="예: 7, 8-10"
                      value={draft.numberInput}
                      onChange={(event) => updateDraft(draft.id, (current) => ({ ...current, numberInput: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          applyNumberInput(draft.id);
                        }
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>클릭 선택과 함께 사용할 수 있습니다.</span>
                      <GlassButton size="sm" variant="secondary" onClick={() => applyNumberInput(draft.id)}>
                        번호 적용
                      </GlassButton>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: "#64748b" }}>
                  선택된 선수 {selectedCount}명
                  {selectedEvent?.kind === "FIVES"
                    ? " / 1~7명 가능"
                    : selectedEvent?.kind === "TRIPLES"
                      ? " / 1~3명 가능"
                      : " / 1~2명 가능"}
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {(["A", "B"] as const)
                    .filter((group) => group === "A" || playersByGroup[group].length > 0)
                    .map((group) => {
                    const groupPlayers = playersByGroup[group].filter((player) => !blockedPlayerIds.has(player.id) || draft.playerIds.includes(player.id));
                    const groupLocked = draft.entryGroup !== null && draft.entryGroup !== group;

                    return (
                      <div key={group} style={{ display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                          <strong style={{ color: "#1e293b" }}>
                            {group}조
                          </strong>
                          <span style={{ fontSize: 12, color: groupLocked ? "#94a3b8" : "#64748b" }}>
                            {groupLocked ? "다른 조 선수를 먼저 선택해 잠겨 있습니다." : "선택 가능"}
                          </span>
                        </div>

                        {groupPlayers.length === 0 ? (
                          <div style={{ fontSize: 13, color: "#94a3b8" }}>승인된 선수가 없습니다.</div>
                        ) : (
                          groupPlayers.map((player) => {
                            const selected = draft.playerIds.includes(player.id);
                            const disabled = groupLocked && !selected;

                            return (
                              <label
                                key={player.id}
                                style={{
                                  display: "grid",
                                  gap: 8,
                                  padding: "10px 12px",
                                  borderRadius: 12,
                                  border: selected ? "1px solid rgba(99,102,241,0.35)" : "1px solid rgba(148,163,184,0.18)",
                                  background: selected ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.45)",
                                  opacity: disabled ? 0.55 : 1,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                  <span style={{ color: "#1e293b", fontWeight: 600 }}>{player.number}. {player.name}</span>
                                  <input type="checkbox" checked={selected} disabled={disabled} onChange={() => togglePlayer(draft.id, player.id)} />
                                </div>
                                <span style={{ fontSize: 12, color: "#64748b" }}>{player.affiliation} · {player.region}</span>
                                {selected && selectedEvent?.kind === "FIVES" ? (
                                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#475569", alignItems: "center" }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <input
                                        type="checkbox"
                                        checked={draft.firstHalfMemberIds.includes(player.id)}
                                        onChange={() => toggleLineup(draft.id, player.id)}
                                      />
                                      전반 출전
                                    </label>
                                    <span style={{ color: "#94a3b8" }}>후반 교체는 전반 종료 후 별도 제출</span>
                                  </div>
                                ) : null}
                              </label>
                            );
                          })
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <GlassButton variant="secondary" onClick={addDraft} disabled={!hasEligiblePlayers}>팀 추가</GlassButton>
          <GlassButton onClick={submit} isLoading={submitting} disabled={!hasEligiblePlayers}>팀편성 제출</GlassButton>
        </div>
      </GlassCard>

      {message ? <StatusBanner tone={messageTone}>{message}</StatusBanner> : null}

      <GlassCard variant="strong" style={{ display: "grid", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, color: "#1e293b" }}>내 팀편성 제출 내역</h3>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>선택한 대회의 제출건만 표시됩니다.</p>
        </div>
        {submissions.length === 0 ? (
          <div style={{ fontSize: 14, color: "#94a3b8" }}>아직 제출된 팀편성 건이 없습니다.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {submissions.map((submission) => (
              <div key={submission.id} style={{ borderRadius: 14, border: "1px solid rgba(148,163,184,0.2)", padding: 14, background: "rgba(255,255,255,0.55)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong style={{ color: "#1e293b" }}>
                      {divisionById.get(submission.divisionId) ?? submission.divisionId}
                      {" · "}
                      {eventById.get(submission.eventId) ?? submission.eventId}
                    </strong>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      {organizationById.get(submission.organizationId) ?? submission.organizationId}
                      {" · 제출 팀 "}
                      {submission.teams.length}개
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
                <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>{formatDateMinute(submission.createdAt)}</div>
                {submission.rejectionReason ? (
                  <div style={{ marginTop: 10, fontSize: 13, color: "#b45309" }}>
                    반려 사유: {submission.rejectionReason}
                  </div>
                ) : null}
                {submission.status === "REJECTED" ? (
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                    <GlassButton size="sm" variant="secondary" onClick={() => loadRejectedSubmission(submission)}>
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
