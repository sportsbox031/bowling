"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { GlassBadge, GlassButton, GlassCard, GlassInput, GlassSelect } from "@/components/ui";
import { exportPlayerList } from "@/lib/admin/excel-export";
import PageLoading from "@/components/common/PageLoading";
import { GENDER_LABELS, KIND_LABELS, formatDivisionLabel } from "@/lib/constants";
import { normalizeFivesPhaseSplit } from "@/lib/fives-config";

type Division = {
  id: string;
  title: string;
  gender: "M" | "F" | "MIXED";
};

type Event = {
  id: string;
  title: string;
  kind: "SINGLE" | "DOUBLES" | "TRIPLES" | "FOURS" | "FIVES" | "OVERALL";
  gameCount: number;
  scheduleDate: string;
  laneStart: number;
  laneEnd: number;
  tableShift: number;
  fivesConfig?: {
    firstHalfGameCount: number;
    secondHalfGameCount: number;
  };
  linkedEventId?: string;
  halfType?: "FIRST" | "SECOND";
};

type TournamentDetail = {
  id: string;
  title: string;
  host: string;
  region: string;
  seasonYear: number;
  laneStart: number;
  laneEnd: number;
};

type ApprovalCounts = {
  playerSubmissions: number;
  teamSubmissions: number;
  fivesSubstitutions: number;
};

const EVENT_ICONS: Record<Event["kind"], string> = {
  SINGLE: "🎳",
  DOUBLES: "👥",
  TRIPLES: "👤👤👤",
  FOURS: "👤👤👤👤",
  FIVES: "🖐️",
  OVERALL: "📊",
};

const api = async <T,>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "요청에 실패했습니다.");
  }
  return response.json();
};

const approvalCardStyle = {
  display: "grid",
  gap: 8,
  padding: 18,
} as const;

export default function TournamentDetailPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [approvalCounts, setApprovalCounts] = useState<ApprovalCounts>({
    playerSubmissions: 0,
    teamSubmissions: 0,
    fivesSubstitutions: 0,
  });
  const [activeDivisionId, setActiveDivisionId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [divisionFormOpen, setDivisionFormOpen] = useState(false);
  const [editingDivisionId, setEditingDivisionId] = useState("");
  const [divisionForm, setDivisionForm] = useState({ title: "", gender: "M" });
  const [editingEventId, setEditingEventId] = useState("");
  const [eventForm, setEventForm] = useState({
    title: "",
    kind: "SINGLE" as Event["kind"],
    gameCount: 1,
    scheduleDate: "",
    laneStart: 1,
    laneEnd: 1,
    tableShift: 1,
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [busy, setBusy] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [eventProgress, setEventProgress] = useState<Record<string, number>>({});

  const activeDivision = useMemo(
    () => divisions.find((division) => division.id === activeDivisionId) ?? null,
    [activeDivisionId, divisions],
  );

  const showMessage = (nextMessage: string, type: "success" | "error" = "success") => {
    setMessage(nextMessage);
    setMessageType(type);
  };

  const loadTournament = useCallback(async () => {
    const result = await api<TournamentDetail>(`/api/admin/tournaments/${tournamentId}`);
    setTournament(result);
  }, [tournamentId]);

  const loadDivisions = useCallback(async () => {
    if (!tournamentId) return;
    const result = await api<{ items: Division[] }>(`/api/admin/tournaments/${tournamentId}/divisions`);
    const items = result.items ?? [];
    setDivisions(items);
    if (items.length > 0 && (!activeDivisionId || !items.some((division) => division.id === activeDivisionId))) {
      setActiveDivisionId(items[0].id);
    }
    if (items.length === 0) {
      setActiveDivisionId("");
    }
  }, [activeDivisionId, tournamentId]);

  const loadEvents = useCallback(async () => {
    if (!tournamentId || !activeDivisionId) {
      setEvents([]);
      return;
    }
    const result = await api<{ items: Event[] }>(
      `/api/admin/tournaments/${tournamentId}/divisions/${activeDivisionId}/events`,
    );
    setEvents(result.items ?? []);
  }, [activeDivisionId, tournamentId]);

  const loadProgress = useCallback(async () => {
    if (!tournamentId) return;
    try {
      const result = await api<{ items?: Array<{ eventId: string; completionPct: number }> }>(
        `/api/admin/tournaments/${tournamentId}/progress`
      );
      const map: Record<string, number> = {};
      for (const item of result.items ?? []) {
        map[item.eventId] = item.completionPct;
      }
      setEventProgress(map);
    } catch {
      // 진행률 로드 실패는 조용히 무시 (핵심 기능 아님)
    }
  }, [tournamentId]);

  const loadApprovalCounts = useCallback(async () => {
    if (!tournamentId || !activeDivisionId) {
      setApprovalCounts({
        playerSubmissions: 0,
        teamSubmissions: 0,
        fivesSubstitutions: 0,
      });
      return;
    }

    const [playerData, teamData, fivesData] = await Promise.all([
      api<{ items?: unknown[] }>(`/api/admin/approvals/player-submissions?tournamentId=${tournamentId}&divisionId=${activeDivisionId}`),
      api<{ items?: unknown[] }>(`/api/admin/approvals/team-submissions?tournamentId=${tournamentId}&divisionId=${activeDivisionId}`),
      api<{ items?: unknown[] }>(`/api/admin/approvals/fives-substitutions?tournamentId=${tournamentId}&divisionId=${activeDivisionId}`),
    ]);

    setApprovalCounts({
      playerSubmissions: playerData.items?.length ?? 0,
      teamSubmissions: teamData.items?.length ?? 0,
      fivesSubstitutions: fivesData.items?.length ?? 0,
    });
  }, [activeDivisionId, tournamentId]);

  const resetDivisionForm = () => {
    setDivisionForm({ title: "", gender: "M" });
    setEditingDivisionId("");
  };

  const resetEventForm = () => {
    setEventForm({
      title: "",
      kind: "SINGLE",
      gameCount: 1,
      scheduleDate: "",
      laneStart: 1,
      laneEnd: 1,
      tableShift: 1,
    });
    setEditingEventId("");
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setBootstrapping(true);
      try {
        await Promise.all([loadTournament(), loadDivisions()]);
      } catch {
        if (!cancelled) {
          showMessage("대회 운영 정보를 불러오지 못했습니다.", "error");
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [loadDivisions, loadTournament]);

  useEffect(() => {
    if (!activeDivisionId) {
      setEvents([]);
      setApprovalCounts({
        playerSubmissions: 0,
        teamSubmissions: 0,
        fivesSubstitutions: 0,
      });
      return;
    }

    let cancelled = false;

    const loadDivisionData = async () => {
      setSectionLoading(true);
      try {
        await Promise.all([loadEvents(), loadApprovalCounts(), loadProgress()]);
      } catch {
        if (!cancelled) {
          showMessage("종별 데이터를 불러오지 못했습니다.", "error");
        }
      } finally {
        if (!cancelled) {
          setSectionLoading(false);
        }
      }
    };

    void loadDivisionData();

    return () => {
      cancelled = true;
    };
  }, [activeDivisionId, loadApprovalCounts, loadEvents, loadProgress]);

  const saveDivision = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tournamentId) return;
    setBusy(true);
    setMessage("");
    try {
      if (editingDivisionId) {
        await api(`/api/admin/tournaments/${tournamentId}/divisions/${editingDivisionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(divisionForm),
        });
        showMessage("종별이 수정되었습니다.");
      } else {
        await api(`/api/admin/tournaments/${tournamentId}/divisions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(divisionForm),
        });
        showMessage("종별이 등록되었습니다.");
      }
      resetDivisionForm();
      setDivisionFormOpen(false);
      await loadDivisions();
    } catch {
      showMessage("종별 저장 실패", "error");
    } finally {
      setBusy(false);
    }
  };

  const deleteDivision = async (id: string) => {
    if (!confirm("종별 삭제 시 하위 데이터가 모두 삭제됩니다. 진행하시겠습니까?")) return;
    if (!tournamentId) return;
    try {
      await api(`/api/admin/tournaments/${tournamentId}/divisions/${id}`, { method: "DELETE" });
      if (activeDivisionId === id) setActiveDivisionId("");
      resetDivisionForm();
      resetEventForm();
      await loadDivisions();
      showMessage("종별 삭제됨");
    } catch {
      showMessage("종별 삭제 실패", "error");
    }
  };

  const saveEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tournamentId || !activeDivisionId) return;
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        ...eventForm,
        ...(eventForm.kind === "FIVES" ? { fivesConfig: normalizeFivesPhaseSplit({ gameCount: eventForm.gameCount }) } : {}),
      };
      if (editingEventId) {
        await api(`/api/admin/tournaments/${tournamentId}/divisions/${activeDivisionId}/events/${editingEventId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        showMessage("세부종목이 수정되었습니다.");
      } else {
        await api(`/api/admin/tournaments/${tournamentId}/divisions/${activeDivisionId}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        showMessage("세부종목 등록됨");
      }
      resetEventForm();
      await loadEvents();
    } catch {
      showMessage("세부종목 저장 실패", "error");
    } finally {
      setBusy(false);
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!tournamentId || !activeDivisionId || !confirm("삭제하시겠습니까?")) return;
    try {
      await api(`/api/admin/tournaments/${tournamentId}/divisions/${activeDivisionId}/events/${eventId}`, { method: "DELETE" });
      if (editingEventId === eventId) resetEventForm();
      await loadEvents();
      showMessage("세부종목 삭제됨");
    } catch {
      showMessage("세부종목 삭제 실패", "error");
    }
  };

  if (bootstrapping && !tournament && divisions.length === 0) {
    return (
      <PageLoading
        title="대회 운영 화면을 준비하고 있습니다"
        description="종별과 세부종목 정보를 함께 불러오고 있습니다."
        mode="admin"
        layout="detail"
      />
    );
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div>
        <Link href="/admin/tournaments" style={{ color: "#94a3b8", fontSize: 13 }}>
          ← 대회 목록
        </Link>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            marginTop: 8,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {tournament?.title ?? "대회 상세"}
        </h1>
        {tournament ? (
          <div style={{ display: "flex", gap: 16, color: "#64748b", fontSize: 14, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
            <span>📍 {tournament.region}</span>
            <span>🎳 레인 {tournament.laneStart}-{tournament.laneEnd}</span>
            <span>📅 {tournament.seasonYear}년</span>
            <span style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href={`/admin/tournaments/${tournamentId}/summary`}>
                <GlassButton size="sm" variant="secondary">📊 종합집계표</GlassButton>
              </Link>
              <Link href={`/admin/tournaments/${tournamentId}/certificates`}>
                <GlassButton size="sm" variant="secondary">🏅 상장 생성</GlassButton>
              </Link>
              <GlassButton
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/admin/tournaments/${tournamentId}/players`);
                    const data = await res.json() as { items?: Array<{ group: string; region: string; affiliation: string; number: number; name: string; hand: string; divisionId: string }> };
                    const players = (data.items ?? []).map((p) => {
                      const div = divisions.find((d) => d.id === p.divisionId);
                      return { ...p, divisionTitle: div?.title };
                    });
                    exportPlayerList(players, tournament?.title ?? "대회");
                  } catch {
                    showMessage("선수 명단 내보내기 실패", "error");
                  }
                }}
              >
                📥 선수명단 엑셀
              </GlassButton>
            </span>
          </div>
        ) : null}
      </div>

      {message ? (
        <GlassCard
          variant="subtle"
          style={{
            padding: "10px 16px",
            color: messageType === "error" ? "#dc2626" : "#16a34a",
            background: messageType === "error" ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)",
            border: `1px solid ${messageType === "error" ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)"}`,
          }}
        >
          {message}
        </GlassCard>
      ) : null}

      <GlassCard variant="strong" style={{ padding: "18px 20px", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>종별 선택</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
            {divisions.map((division) => (
              <button
                key={division.id}
                onClick={() => {
                  setActiveDivisionId(division.id);
                  resetEventForm();
                }}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: activeDivisionId === division.id ? 700 : 500,
                  color: activeDivisionId === division.id ? "#fff" : "#475569",
                  background: activeDivisionId === division.id ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255, 255, 255, 0.3)",
                  border: activeDivisionId === division.id ? "1px solid rgba(255, 255, 255, 0.3)" : "1px solid rgba(255, 255, 255, 0.4)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  fontFamily: "inherit",
                }}
              >
                {formatDivisionLabel(division.title, division.gender)}
              </button>
            ))}
          </div>
        </div>

        {divisions.length === 0 && !bootstrapping ? (
          <span style={{ color: "#94a3b8", fontSize: 13 }}>등록된 종별이 없습니다. 종별을 먼저 추가하세요.</span>
        ) : null}

        {activeDivision ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <strong style={{ fontSize: 18, color: "#0f172a" }}>{formatDivisionLabel(activeDivision.title, activeDivision.gender)}</strong>
                <span style={{ fontSize: 13, color: "#64748b" }}>이 종별 기준 승인 요청과 세부종목 운영을 확인합니다.</span>
              </div>
              <GlassButton size="sm" variant={settingsOpen ? "secondary" : "primary"} onClick={() => setSettingsOpen((open) => !open)}>
                {settingsOpen ? "설정 닫기" : "설정 보기"}
              </GlassButton>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <GlassCard variant="strong" style={approvalCardStyle}>
                <span style={{ fontSize: 13, color: "#64748b" }}>선수등록 승인</span>
                <strong style={{ fontSize: 30, color: "#0f172a" }}>{approvalCounts.playerSubmissions}건</strong>
                <span style={{ fontSize: 13, color: "#64748b" }}>현재 종별의 선수등록 제출 승인 대기 건수</span>
                <Link href={`/admin/tournaments/${tournamentId}/player-submissions`} style={{ textDecoration: "none" }}>
                  <GlassButton size="sm" variant="secondary">바로 확인</GlassButton>
                </Link>
              </GlassCard>

              <GlassCard variant="strong" style={approvalCardStyle}>
                <span style={{ fontSize: 13, color: "#64748b" }}>팀편성 승인</span>
                <strong style={{ fontSize: 30, color: "#0f172a" }}>{approvalCounts.teamSubmissions}건</strong>
                <span style={{ fontSize: 13, color: "#64748b" }}>현재 종별의 팀편성 제출 승인 대기 건수</span>
                <Link href={`/admin/tournaments/${tournamentId}/divisions/${activeDivisionId}/team-submissions`} style={{ textDecoration: "none" }}>
                  <GlassButton size="sm" variant="secondary">바로 확인</GlassButton>
                </Link>
              </GlassCard>

              <GlassCard variant="strong" style={approvalCardStyle}>
                <span style={{ fontSize: 13, color: "#64748b" }}>후반 교체 승인</span>
                <strong style={{ fontSize: 30, color: "#0f172a" }}>{approvalCounts.fivesSubstitutions}건</strong>
                <span style={{ fontSize: 13, color: "#64748b" }}>현재 종별의 5인조 후반 교체 승인 대기 건수</span>
                <Link href={`/admin/tournaments/${tournamentId}/divisions/${activeDivisionId}/fives-substitutions`} style={{ textDecoration: "none" }}>
                  <GlassButton size="sm" variant="secondary">바로 확인</GlassButton>
                </Link>
              </GlassCard>
            </div>
          </div>
        ) : null}

        {settingsOpen ? (
          <GlassCard variant="subtle" style={{ padding: 18, display: "grid", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <strong style={{ fontSize: 16, color: "#0f172a" }}>종별 설정</strong>
                <span style={{ fontSize: 13, color: "#64748b" }}>종별 추가와 수정, 삭제를 여기서 관리합니다.</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <GlassButton size="sm" onClick={() => { setDivisionFormOpen((open) => !open); resetDivisionForm(); }}>
                  {divisionFormOpen ? "종별 입력 닫기" : "+ 종별 추가"}
                </GlassButton>
                {activeDivisionId ? (
                  <>
                    <GlassButton
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const selectedDivision = divisions.find((division) => division.id === activeDivisionId);
                        if (selectedDivision) {
                          setEditingDivisionId(selectedDivision.id);
                          setDivisionForm({ title: selectedDivision.title, gender: selectedDivision.gender });
                          setDivisionFormOpen(true);
                        }
                      }}
                    >
                      종별 수정
                    </GlassButton>
                    <GlassButton variant="danger" size="sm" onClick={() => deleteDivision(activeDivisionId)}>
                      종별 삭제
                    </GlassButton>
                  </>
                ) : null}
              </div>
            </div>

            {divisionFormOpen ? (
              <form onSubmit={saveDivision} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <GlassInput
                  label="종별명"
                  required
                  value={divisionForm.title}
                  onChange={(event) => setDivisionForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="예: 초등부"
                />
                <GlassSelect
                  label="성별"
                  value={divisionForm.gender}
                  onChange={(event) => setDivisionForm((prev) => ({ ...prev, gender: event.target.value }))}
                >
                  <option value="M">남자</option>
                  <option value="F">여자</option>
                  <option value="MIXED">혼합</option>
                </GlassSelect>
                <GlassButton type="submit" size="sm" disabled={busy}>
                  {editingDivisionId ? "종별 수정 저장" : "종별 등록"}
                </GlassButton>
                <GlassButton type="button" variant="secondary" size="sm" onClick={() => { setDivisionFormOpen(false); resetDivisionForm(); }}>
                  취소
                </GlassButton>
              </form>
            ) : null}

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <strong style={{ fontSize: 16, color: "#0f172a" }}>세부종목 등록</strong>
                  <span style={{ fontSize: 13, color: "#64748b" }}>폼을 열어 새 세부종목을 등록하거나 기존 종목을 수정합니다.</span>
                </div>
              </div>

              <form onSubmit={saveEvent} style={{ display: "grid", gap: 14, maxWidth: 720 }}>
                <GlassInput label="종목명" required value={eventForm.title} onChange={(event) => setEventForm((prev) => ({ ...prev, title: event.target.value }))} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <GlassSelect
                    label="종류"
                    value={eventForm.kind}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, kind: event.target.value as Event["kind"] }))}
                  >
                    <option value="SINGLE">개인전</option>
                    <option value="DOUBLES">2인조</option>
                    <option value="TRIPLES">3인조</option>
                    <option value="FOURS">4인조</option>
                    <option value="FIVES">5인조</option>
                    <option value="OVERALL">개인종합</option>
                  </GlassSelect>
                  <GlassInput label="게임 수" type="number" min={1} max={6} value={eventForm.gameCount} onChange={(event) => setEventForm((prev) => ({ ...prev, gameCount: Number(event.target.value) }))} />
                  <GlassSelect label="Table 이동" value={String(eventForm.tableShift)} onChange={(event) => setEventForm((prev) => ({ ...prev, tableShift: Number(event.target.value) }))}>
                    {Array.from({ length: 41 }, (_, index) => index - 20).map((value) => (
                      <option key={value} value={value}>{value >= 0 ? `+${value}` : value}</option>
                    ))}
                  </GlassSelect>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <GlassInput label="경기일" type="date" required value={eventForm.scheduleDate} onChange={(event) => setEventForm((prev) => ({ ...prev, scheduleDate: event.target.value }))} />
                  <GlassInput label="시작 레인" type="number" min={1} value={eventForm.laneStart} onChange={(event) => setEventForm((prev) => ({ ...prev, laneStart: Number(event.target.value) }))} />
                  <GlassInput label="끝 레인" type="number" min={1} value={eventForm.laneEnd} onChange={(event) => setEventForm((prev) => ({ ...prev, laneEnd: Number(event.target.value) }))} />
                </div>

                {eventForm.kind === "FIVES" ? (
                  <div style={{ padding: "12px 14px", background: "rgba(99,102,241,0.06)", borderRadius: 10, border: "1px solid rgba(99,102,241,0.15)" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 10 }}>5인조 단일 종목 설정</div>
                    <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                      {eventForm.gameCount === 4 && "4게임은 전반 2게임 + 후반 2게임으로 저장됩니다."}
                      {eventForm.gameCount === 6 && "6게임은 전반 3게임 + 후반 3게임으로 저장됩니다."}
                      {eventForm.gameCount !== 4 && eventForm.gameCount !== 6 && "5인조는 4게임 또는 6게임 운영을 권장합니다. 저장 시 게임 수 기준으로 전반/후반이 자동 분리됩니다."}
                    </div>
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 8 }}>
                  <GlassButton type="submit" disabled={busy}>
                    {busy ? "저장중..." : editingEventId ? "세부종목 수정" : "세부종목 등록"}
                  </GlassButton>
                  {editingEventId ? <GlassButton type="button" variant="secondary" onClick={resetEventForm}>취소</GlassButton> : null}
                </div>
              </form>
            </div>
          </GlassCard>
        ) : null}
      </GlassCard>

      {activeDivisionId ? (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>세부종목 카드</h2>
              <span style={{ fontSize: 13, color: "#64748b" }}>현재 종별의 세부종목을 카드형으로 확인하고 바로 운영 화면으로 이동합니다.</span>
            </div>
          </div>

          {sectionLoading && events.length === 0 ? (
            <PageLoading
              title="세부종목을 준비하고 있습니다"
              description="선택한 종별의 경기 일정과 운영 항목을 불러오고 있습니다."
              mode="admin"
              layout="table"
            />
          ) : events.length === 0 ? (
            <GlassCard variant="strong" style={{ padding: 20, color: "#94a3b8", fontSize: 14 }}>
              등록된 세부종목이 없습니다. 설정 보기에서 세부종목을 추가하세요.
            </GlassCard>
          ) : (
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              {events.map((event) => (
                <GlassCard key={event.id} variant="strong" style={{ padding: 18, display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 22 }}>{EVENT_ICONS[event.kind]}</span>
                        <strong style={{ fontSize: 18, color: "#0f172a" }}>{event.title}</strong>
                      </div>
                      <GlassBadge>{`${EVENT_ICONS[event.kind]} ${KIND_LABELS[event.kind] ?? event.kind}`}</GlassBadge>
                    </div>
                    <GlassBadge variant="info">{event.gameCount}게임</GlassBadge>
                  </div>

                  <div style={{ display: "grid", gap: 6, fontSize: 13, color: "#64748b" }}>
                    <span>📅 경기일 {event.scheduleDate || "-"}</span>
                    <span>🎳 레인 {event.laneStart}-{event.laneEnd}</span>
                    <span>🔁 Table 이동 {event.tableShift >= 0 ? `+${event.tableShift}` : event.tableShift}</span>
                  </div>

                  {event.kind !== "OVERALL" && eventProgress[event.id] !== undefined && (
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                        <span>점수 입력</span>
                        <span style={{ fontWeight: 700, color: eventProgress[event.id] === 100 ? "#16a34a" : "#6366f1" }}>
                          {eventProgress[event.id]}%
                        </span>
                      </div>
                      <div style={{ height: 6, background: "rgba(99,102,241,0.15)", borderRadius: 999, overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${eventProgress[event.id]}%`,
                            background: eventProgress[event.id] === 100
                              ? "linear-gradient(90deg, #16a34a, #22c55e)"
                              : "linear-gradient(90deg, #6366f1, #8b5cf6)",
                            borderRadius: 999,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`/admin/tournaments/${tournamentId}/scoreboard?eventId=${event.id}&divisionId=${activeDivisionId}`} target="_blank" style={{ textDecoration: "none" }}>
                      <GlassButton size="sm">운영 화면 ↗</GlassButton>
                    </Link>
                    <GlassButton
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSettingsOpen(true);
                        setEditingEventId(event.id);
                        setEventForm({
                          title: event.title,
                          kind: event.kind,
                          gameCount: event.gameCount,
                          scheduleDate: event.scheduleDate,
                          laneStart: event.laneStart,
                          laneEnd: event.laneEnd,
                          tableShift: event.tableShift,
                        });
                      }}
                    >
                      수정
                    </GlassButton>
                    <GlassButton variant="danger" size="sm" onClick={() => deleteEvent(event.id)}>삭제</GlassButton>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
