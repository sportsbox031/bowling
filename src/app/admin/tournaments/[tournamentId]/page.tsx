"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassSelect,
  GlassTable,
  GlassBadge,
  glassTdStyle,
  glassTrHoverProps,
} from "@/components/ui";
import PageLoading from "@/components/common/PageLoading";
import PlayerBulkImportPanel from "@/components/admin/PlayerBulkImportPanel";
import { GENDER_LABELS, KIND_LABELS } from "@/lib/constants";
import { buildFivesEventPayload, shouldPromptFivesCopy } from "@/lib/fives-link";

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
  linkedEventId?: string;
  halfType?: "FIRST" | "SECOND";
};

type Player = {
  id: string;
  divisionId: string;
  group: string;
  region: string;
  affiliation: string;
  number: number;
  name: string;
  hand: "left" | "right";
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

type Tab = "events" | "players";

const api = async <T,>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "요청에 실패했습니다.");
  }
  return response.json();
};

export default function TournamentDetailPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [activeDivisionId, setActiveDivisionId] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("events");

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
    linkedEventId: "" as string,
    halfType: "" as "" | "FIRST" | "SECOND",
  });

  const [editingPlayerId, setEditingPlayerId] = useState("");
  const [playerForm, setPlayerForm] = useState({
    group: "A",
    region: "",
    affiliation: "",
    name: "",
    hand: "right" as Player["hand"],
  });

  const [playerSearch, setPlayerSearch] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [busy, setBusy] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);

  const selectedDivisionPlayers = useMemo(() => {
    const base = players.filter((player) => !activeDivisionId || player.divisionId === activeDivisionId);
    if (!playerSearch.trim()) return base;
    const query = playerSearch.trim().toLowerCase();
    return base.filter(
      (player) =>
        player.name.toLowerCase().includes(query) ||
        player.affiliation.toLowerCase().includes(query) ||
        player.region.toLowerCase().includes(query) ||
        String(player.number).includes(query),
    );
  }, [players, activeDivisionId, playerSearch]);

  const showMessage = (nextMessage: string, type: "success" | "error" = "success") => {
    setMessage(nextMessage);
    setMessageType(type);
  };

  const loadTournament = useCallback(async () => {
    const result = await api<{ items?: TournamentDetail[] }>("/api/admin/tournaments");
    const found = result.items?.find((item) => item.id === tournamentId);
    if (found) setTournament(found);
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
  }, [tournamentId, activeDivisionId]);

  const loadEvents = useCallback(async () => {
    if (!tournamentId || !activeDivisionId) {
      setEvents([]);
      return;
    }
    const result = await api<{ items: Event[] }>(
      `/api/admin/tournaments/${tournamentId}/divisions/${activeDivisionId}/events`,
    );
    setEvents(result.items ?? []);
  }, [tournamentId, activeDivisionId]);

  const loadPlayers = useCallback(async () => {
    if (!tournamentId) return;
    const filter = activeDivisionId ? `?divisionId=${activeDivisionId}` : "";
    const result = await api<{ items: Player[] }>(`/api/admin/tournaments/${tournamentId}/players${filter}`);
    setPlayers(result.items ?? []);
  }, [tournamentId, activeDivisionId]);

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
      linkedEventId: "",
      halfType: "",
    });
    setEditingEventId("");
  };

  const resetPlayerForm = () => {
    setPlayerForm({ group: "A", region: "", affiliation: "", name: "", hand: "right" });
    setEditingPlayerId("");
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

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [loadTournament, loadDivisions]);

  useEffect(() => {
    if (!activeDivisionId) {
      setEvents([]);
      setPlayers([]);
      return;
    }

    let cancelled = false;

    const loadDivisionData = async () => {
      setSectionLoading(true);
      try {
        await Promise.all([loadEvents(), loadPlayers()]);
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

    loadDivisionData();

    return () => {
      cancelled = true;
    };
  }, [activeDivisionId, loadEvents, loadPlayers]);

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
      resetPlayerForm();
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
      const payload = buildFivesEventPayload(eventForm);
      if (editingEventId) {
        await api(`/api/admin/tournaments/${tournamentId}/divisions/${activeDivisionId}/events/${editingEventId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        showMessage("세부종목이 수정되었습니다.");
      } else {
        const created = await api<Event>(`/api/admin/tournaments/${tournamentId}/divisions/${activeDivisionId}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (shouldPromptFivesCopy(payload, false) && confirm("후반전을 만들었습니다. 전반전 데이터와 연동하시겠습니까?")) {
          try {
            await api(
              `/api/admin/tournaments/${tournamentId}/divisions/${activeDivisionId}/events/${created.id}/copy-from/${payload.linkedEventId}`,
              { method: "POST" },
            );
            showMessage("후반전이 등록되고 전반전 데이터가 연동되었습니다.");
          } catch {
            showMessage("후반전은 등록되었지만 전반전 데이터 연동에 실패했습니다.", "error");
          }
        } else {
          showMessage("세부종목 등록됨");
        }
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

  const savePlayer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tournamentId) return;
    setBusy(true);
    setMessage("");
    try {
      const data = { ...playerForm, divisionId: activeDivisionId };
      if (!data.divisionId) {
        showMessage("종별을 먼저 선택해 주세요.", "error");
        return;
      }
      if (editingPlayerId) {
        await api(`/api/admin/tournaments/${tournamentId}/players/${editingPlayerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        showMessage("선수 정보가 수정되었습니다.");
      } else {
        await api(`/api/admin/tournaments/${tournamentId}/players`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        showMessage("선수 등록됨");
      }
      resetPlayerForm();
      await loadPlayers();
    } catch {
      showMessage("선수 저장 실패", "error");
    } finally {
      setBusy(false);
    }
  };

  const deletePlayer = async (playerId: string) => {
    if (!tournamentId || !confirm("삭제하시겠습니까?")) return;
    try {
      await api(`/api/admin/tournaments/${tournamentId}/players/${playerId}`, { method: "DELETE" });
      if (editingPlayerId === playerId) resetPlayerForm();
      await loadPlayers();
      showMessage("선수 삭제됨");
    } catch {
      showMessage("선수 삭제 실패", "error");
    }
  };

  const triggerScoreboard = (eventId: string) => {
    window.open(`/admin/tournaments/${tournamentId}/scoreboard?eventId=${eventId}&divisionId=${activeDivisionId}`, "_blank");
  };

  const tabStyle = (tab: Tab) =>
    ({
      padding: "10px 20px",
      fontSize: 14,
      fontWeight: activeTab === tab ? 700 : 500,
      color: activeTab === tab ? "#6366f1" : "#64748b",
      background: activeTab === tab ? "rgba(99, 102, 241, 0.1)" : "transparent",
      border: "none",
      borderBottom: activeTab === tab ? "2px solid #6366f1" : "2px solid transparent",
      cursor: "pointer",
      transition: "all 0.2s ease",
      fontFamily: "inherit",
    }) as const;

  if (bootstrapping && !tournament && divisions.length === 0) {
    return (
      <PageLoading
        title="대회 운영 화면을 준비하고 있습니다"
        description="종별, 세부종목, 선수 정보를 함께 불러오고 있습니다."
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
        {tournament && (
          <div style={{ display: "flex", gap: 16, color: "#64748b", fontSize: 14, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
            <span>📍 {tournament.region}</span>
            <span>🎳 레인 {tournament.laneStart}-{tournament.laneEnd}</span>
            <span>📅 {tournament.seasonYear}년</span>
            <span style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: 12, display: "flex", gap: 8 }}>
              <Link href={`/admin/tournaments/${tournamentId}/summary`}>
                <GlassButton size="sm" variant="secondary">📊 종합집계표</GlassButton>
              </Link>
              <Link href={`/admin/tournaments/${tournamentId}/certificates`}>
                <GlassButton size="sm" variant="secondary">🏅 상장 생성</GlassButton>
              </Link>
            </span>
          </div>
        )}
      </div>

      {message && (
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
      )}

      <GlassCard variant="strong" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: divisions.length > 0 ? 0 : 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>종별</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
            {divisions.map((division) => (
              <button
                key={division.id}
                onClick={() => {
                  setActiveDivisionId(division.id);
                  resetEventForm();
                  resetPlayerForm();
                }}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
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
                {division.title} ({GENDER_LABELS[division.gender] ?? division.gender})
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <GlassButton size="sm" onClick={() => { setDivisionFormOpen((open) => !open); resetDivisionForm(); }}>
              {divisionFormOpen ? "닫기" : "+ 종별 추가"}
            </GlassButton>
            {activeDivisionId && (
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
                  수정
                </GlassButton>
                <GlassButton variant="danger" size="sm" onClick={() => deleteDivision(activeDivisionId)}>
                  삭제
                </GlassButton>
              </>
            )}
          </div>
        </div>

        {divisions.length === 0 && !divisionFormOpen && !bootstrapping && (
          <span style={{ color: "#94a3b8", fontSize: 13 }}>등록된 종별이 없습니다. 종별을 먼저 추가하세요.</span>
        )}

        {divisionFormOpen && (
          <form onSubmit={saveDivision} style={{ display: "flex", gap: 12, alignItems: "flex-end", marginTop: 14, flexWrap: "wrap" }}>
            <GlassInput
              label="종별명"
              required
              value={divisionForm.title}
              onChange={(event) => setDivisionForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="예: 초등부 남자"
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
              {editingDivisionId ? "수정" : "등록"}
            </GlassButton>
            <GlassButton type="button" variant="secondary" size="sm" onClick={() => { setDivisionFormOpen(false); resetDivisionForm(); }}>
              취소
            </GlassButton>
          </form>
        )}
      </GlassCard>

      {activeDivisionId && (
        <>
          <div
            style={{
              display: "flex",
              gap: 0,
              borderBottom: "1px solid rgba(255, 255, 255, 0.3)",
              background: "rgba(255, 255, 255, 0.15)",
              borderRadius: "12px 12px 0 0",
              overflow: "hidden",
            }}
          >
            <button style={tabStyle("events")} onClick={() => setActiveTab("events")}>세부종목 관리</button>
            <button style={tabStyle("players")} onClick={() => setActiveTab("players")}>선수 등록</button>
          </div>

          {activeTab === "events" && (
            <GlassCard>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 20 }}>
                {editingEventId ? "세부종목 수정" : "세부종목 등록"}
              </h2>
              <form onSubmit={saveEvent} style={{ display: "grid", gap: 14, maxWidth: 620 }}>
                <GlassInput label="종목명" required value={eventForm.title} onChange={(event) => setEventForm((prev) => ({ ...prev, title: event.target.value }))} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <GlassSelect
                    label="종류"
                    value={eventForm.kind}
                    onChange={(event) => setEventForm((prev) => {
                      const kind = event.target.value as Event["kind"];
                      return kind === "FIVES"
                        ? { ...prev, kind }
                        : { ...prev, kind, linkedEventId: "", halfType: "" };
                    })}
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

                {eventForm.kind === "FIVES" && (
                  <div style={{ padding: "12px 14px", background: "rgba(99,102,241,0.06)", borderRadius: 10, border: "1px solid rgba(99,102,241,0.15)" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 10 }}>
                      5인조 전반/후반 설정
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: eventForm.halfType === "SECOND" ? "1fr 1fr" : "1fr", gap: 12 }}>
                      <GlassSelect
                        label="전반/후반 구분"
                        value={eventForm.halfType}
                        onChange={(event) => setEventForm((prev) => {
                          const halfType = event.target.value as "" | "FIRST" | "SECOND";
                          return {
                            ...prev,
                            halfType,
                            linkedEventId: halfType === "SECOND" ? prev.linkedEventId : "",
                          };
                        })}
                      >
                        <option value="">미설정</option>
                        <option value="FIRST">전반</option>
                        <option value="SECOND">후반</option>
                      </GlassSelect>
                      {eventForm.halfType === "SECOND" && (
                        <GlassSelect
                          label="연동할 전반전"
                          value={eventForm.linkedEventId}
                          onChange={(event) => setEventForm((prev) => ({ ...prev, linkedEventId: event.target.value }))}
                        >
                          <option value="">선택 안 함</option>
                          {events
                            .filter((event) => event.kind === "FIVES" && event.id !== editingEventId && event.halfType === "FIRST")
                            .map((event) => (
                              <option key={event.id} value={event.id}>
                                {event.title}
                              </option>
                            ))}
                        </GlassSelect>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8, marginBottom: 0 }}>
                      후반전을 등록한 뒤 확인을 누르면 전반전의 출전선수, 스쿼드, 팀 편성을 1회 연동합니다. 이후 운영 데이터는 서로 자동 반영되지 않지만 팀 종합점수는 계속 합산됩니다.
                    </p>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <GlassButton type="submit" disabled={busy}>
                    {busy ? "저장중..." : editingEventId ? "세부종목 수정" : "세부종목 등록"}
                  </GlassButton>
                  {editingEventId && <GlassButton type="button" variant="secondary" onClick={resetEventForm}>취소</GlassButton>}
                </div>
              </form>

              <div style={{ marginTop: 24 }}>
                {sectionLoading && events.length === 0 ? (
                  <PageLoading
                    title="세부종목을 준비하고 있습니다"
                    description="선택한 종별의 경기 일정과 운영 항목을 불러오고 있습니다."
                    mode="admin"
                    layout="table"
                  />
                ) : (
                  <GlassTable
                    headers={["종목명", "종류", "게임수", "레인", "Table", "경기일", "작업"]}
                    headerAligns={["left", "left", "center", "left", "center", "left", "left"]}
                    rowCount={events.length}
                    emptyMessage={sectionLoading ? "세부종목 정보를 가져오고 있습니다." : "등록된 세부종목이 없습니다."}
                  >
                    {events.map((event) => (
                      <tr key={event.id} {...glassTrHoverProps}>
                        <td style={glassTdStyle}>
                          <button
                            onClick={() => triggerScoreboard(event.id)}
                            style={{ border: "none", padding: 0, color: "#6366f1", background: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", fontSize: 14 }}
                          >
                            {event.title}
                          </button>
                        </td>
                        <td style={glassTdStyle}><GlassBadge>{KIND_LABELS[event.kind] ?? event.kind}</GlassBadge></td>
                        <td style={{ ...glassTdStyle, textAlign: "center" }}>{event.gameCount}</td>
                        <td style={{ ...glassTdStyle, color: "#64748b" }}>{event.laneStart}-{event.laneEnd}</td>
                        <td style={{ ...glassTdStyle, textAlign: "center" }}>{event.tableShift >= 0 ? `+${event.tableShift}` : event.tableShift}</td>
                        <td style={{ ...glassTdStyle, color: "#64748b" }}>{event.scheduleDate}</td>
                        <td style={glassTdStyle}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <GlassButton
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setEditingEventId(event.id);
                                setEventForm({
                                  title: event.title,
                                  kind: event.kind,
                                  gameCount: event.gameCount,
                                  scheduleDate: event.scheduleDate,
                                  laneStart: event.laneStart,
                                  laneEnd: event.laneEnd,
                                  tableShift: event.tableShift,
                                  linkedEventId: event.linkedEventId ?? "",
                                  halfType: event.halfType ?? "",
                                });
                              }}
                            >
                              수정
                            </GlassButton>
                            <GlassButton variant="danger" size="sm" onClick={() => deleteEvent(event.id)}>삭제</GlassButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </GlassTable>
                )}
              </div>
            </GlassCard>
          )}

          {activeTab === "players" && (
            <GlassCard>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 20 }}>
                {editingPlayerId ? "선수 수정" : "선수 등록"}
              </h2>
              <form onSubmit={savePlayer} style={{ display: "grid", gap: 14, maxWidth: 600 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <GlassSelect label="팀조" value={playerForm.group} onChange={(event) => setPlayerForm((prev) => ({ ...prev, group: event.target.value }))}>
                    <option value="A">A</option>
                    <option value="B">B</option>
                  </GlassSelect>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <GlassInput label="시군" required value={playerForm.region} onChange={(event) => setPlayerForm((prev) => ({ ...prev, region: event.target.value }))} />
                  <GlassInput label="소속(학교)" required value={playerForm.affiliation} onChange={(event) => setPlayerForm((prev) => ({ ...prev, affiliation: event.target.value }))} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <GlassInput label="성명" required value={playerForm.name} onChange={(event) => setPlayerForm((prev) => ({ ...prev, name: event.target.value }))} />
                  <GlassSelect label="손" value={playerForm.hand} onChange={(event) => setPlayerForm((prev) => ({ ...prev, hand: event.target.value as Player["hand"] }))}>
                    <option value="right">오른손</option>
                    <option value="left">왼손</option>
                  </GlassSelect>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <GlassButton type="submit" disabled={busy}>
                    {busy ? "저장중..." : editingPlayerId ? "선수 수정" : "선수 등록"}
                  </GlassButton>
                  {editingPlayerId && <GlassButton type="button" variant="secondary" onClick={resetPlayerForm}>취소</GlassButton>}
                </div>
              </form>

              <div style={{ marginTop: 24 }}>
                <PlayerBulkImportPanel tournamentId={tournamentId} divisionId={activeDivisionId} onImported={loadPlayers} />

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
                    <input
                      type="text"
                      value={playerSearch}
                      onChange={(event) => setPlayerSearch(event.target.value)}
                      placeholder="이름, 소속, 시군, 번호로 검색..."
                      style={{
                        width: "100%",
                        padding: "9px 14px 9px 36px",
                        borderRadius: 10,
                        fontSize: 13,
                        fontFamily: "inherit",
                        color: "#1e293b",
                        background: "rgba(255, 255, 255, 0.5)",
                        border: "1px solid rgba(203, 213, 225, 0.5)",
                        outline: "none",
                      }}
                    />
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#94a3b8", pointerEvents: "none" }}>
                      🔍
                    </span>
                  </div>
                  <span style={{ fontSize: 13, color: "#64748b" }}>
                    {selectedDivisionPlayers.length}명{playerSearch.trim() ? ` (전체 ${players.filter((player) => !activeDivisionId || player.divisionId === activeDivisionId).length}명)` : ""}
                  </span>
                </div>
                {sectionLoading && selectedDivisionPlayers.length === 0 ? (
                  <PageLoading
                    title="출전 선수를 준비하고 있습니다"
                    description="선택한 종별의 선수 명단과 팀조 정보를 정리하고 있습니다."
                    mode="admin"
                    layout="table"
                  />
                ) : (
                  <GlassTable
                    headers={["번호", "이름", "시군", "소속", "손", "팀조", "작업"]}
                    headerAligns={["center", "left", "left", "left", "left", "center", "left"]}
                    rowCount={selectedDivisionPlayers.length}
                    emptyMessage={sectionLoading ? "선수 정보를 가져오고 있습니다." : "등록된 선수가 없습니다."}
                  >
                    {selectedDivisionPlayers.map((player) => (
                      <tr key={player.id} {...glassTrHoverProps}>
                        <td style={{ ...glassTdStyle, textAlign: "center", fontWeight: 600 }}>{player.number}</td>
                        <td style={{ ...glassTdStyle, fontWeight: 600 }}>{player.name}</td>
                        <td style={glassTdStyle}>{player.region}</td>
                        <td style={glassTdStyle}>{player.affiliation}</td>
                        <td style={glassTdStyle}>{player.hand === "left" ? "왼손" : "오른손"}</td>
                        <td style={{ ...glassTdStyle, textAlign: "center" }}><GlassBadge>{player.group}</GlassBadge></td>
                        <td style={glassTdStyle}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <GlassButton
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setEditingPlayerId(player.id);
                                setPlayerForm({
                                  group: player.group,
                                  region: player.region,
                                  affiliation: player.affiliation,
                                  name: player.name,
                                  hand: player.hand,
                                });
                              }}
                            >
                              수정
                            </GlassButton>
                            <GlassButton variant="danger" size="sm" onClick={() => deletePlayer(player.id)}>삭제</GlassButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </GlassTable>
                )}
              </div>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}



