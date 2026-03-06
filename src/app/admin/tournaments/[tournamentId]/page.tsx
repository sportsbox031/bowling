"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

const KIND_LABELS: Record<string, string> = {
  SINGLE: "개인전",
  DOUBLES: "2인조",
  TRIPLES: "3인조",
  FOURS: "4인조",
  FIVES: "5인조",
  OVERALL: "개인종합",
};

const GENDER_LABELS: Record<string, string> = {
  M: "남자",
  F: "여자",
  MIXED: "혼합",
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

  // Division form
  const [divisionFormOpen, setDivisionFormOpen] = useState(false);
  const [editingDivisionId, setEditingDivisionId] = useState("");
  const [divisionForm, setDivisionForm] = useState({ title: "", gender: "M" });

  // Event form
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

  // Player form
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

  const selectedDivisionPlayers = useMemo(() => {
    const base = players.filter((p) => !activeDivisionId || p.divisionId === activeDivisionId);
    if (!playerSearch.trim()) return base;
    const q = playerSearch.trim().toLowerCase();
    return base.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.affiliation.toLowerCase().includes(q) ||
      p.region.toLowerCase().includes(q) ||
      String(p.number).includes(q)
    );
  }, [players, activeDivisionId, playerSearch]);

  const showMessage = (msg: string, type: "success" | "error" = "success") => {
    setMessage(msg);
    setMessageType(type);
  };

  // --- Data loading ---
  const loadTournament = async () => {
    const result = await api<{ items?: TournamentDetail[] }>(`/api/admin/tournaments`);
    const found = result.items?.find((item) => item.id === tournamentId);
    if (found) setTournament(found);
  };

  const loadDivisions = async () => {
    if (!tournamentId) return;
    const result = await api<{ items: Division[] }>(`/api/admin/tournaments/${tournamentId}/divisions`);
    const items = result.items ?? [];
    setDivisions(items);
    if (items.length > 0 && (!activeDivisionId || !items.some((d) => d.id === activeDivisionId))) {
      setActiveDivisionId(items[0].id);
    }
    if (items.length === 0) {
      setActiveDivisionId("");
    }
  };

  const loadEvents = async () => {
    if (!tournamentId || !activeDivisionId) { setEvents([]); return; }
    const result = await api<{ items: Event[] }>(
      `/api/admin/tournaments/${tournamentId}/divisions/${activeDivisionId}/events`,
    );
    setEvents(result.items ?? []);
  };

  const loadPlayers = async () => {
    if (!tournamentId) return;
    const filter = activeDivisionId ? `?divisionId=${activeDivisionId}` : "";
    const result = await api<{ items: Player[] }>(`/api/admin/tournaments/${tournamentId}/players${filter}`);
    setPlayers(result.items ?? []);
  };

  // --- Reset helpers ---
  const resetDivisionForm = () => { setDivisionForm({ title: "", gender: "M" }); setEditingDivisionId(""); };
  const resetEventForm = () => { setEventForm({ title: "", kind: "SINGLE", gameCount: 1, scheduleDate: "", laneStart: 1, laneEnd: 1, tableShift: 1 }); setEditingEventId(""); };
  const resetPlayerForm = () => { setPlayerForm({ group: "A", region: "", affiliation: "", name: "", hand: "right" }); setEditingPlayerId(""); };

  useEffect(() => { loadTournament(); }, [tournamentId]);
  useEffect(() => { loadDivisions().catch(() => showMessage("종별을 불러올 수 없습니다.", "error")); }, [tournamentId]);
  useEffect(() => { loadEvents(); loadPlayers(); }, [tournamentId, activeDivisionId]);

  // --- CRUD Handlers ---
  const saveDivision = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tournamentId) return;
    setBusy(true); setMessage("");
    try {
      if (editingDivisionId) {
        await api(`/api/admin/tournaments/${tournamentId}/divisions/${editingDivisionId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(divisionForm) });
        showMessage("종별이 수정되었습니다.");
      } else {
        await api(`/api/admin/tournaments/${tournamentId}/divisions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(divisionForm) });
        showMessage("종별이 등록되었습니다.");
      }
      resetDivisionForm();
      setDivisionFormOpen(false);
      await loadDivisions();
    } catch { showMessage("종별 저장 실패", "error"); }
    finally { setBusy(false); }
  };

  const deleteDivision = async (id: string) => {
    if (!confirm("종별 삭제 시 하위 데이터가 모두 삭제됩니다. 진행하시겠습니까?")) return;
    if (!tournamentId) return;
    try {
      await api(`/api/admin/tournaments/${tournamentId}/divisions/${id}`, { method: "DELETE" });
      if (activeDivisionId === id) setActiveDivisionId("");
      resetDivisionForm(); resetEventForm(); resetPlayerForm();
      await loadDivisions();
      showMessage("종별 삭제됨");
    } catch { showMessage("종별 삭제 실패", "error"); }
  };

  const saveEvent = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tournamentId || !activeDivisionId) return;
    setBusy(true); setMessage("");
    try {
      if (editingEventId) {
        await api(`/api/admin/tournaments/${tournamentId}/divisions/${activeDivisionId}/events/${editingEventId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eventForm) });
        showMessage("세부종목이 수정되었습니다.");
      } else {
        await api(`/api/admin/tournaments/${tournamentId}/divisions/${activeDivisionId}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eventForm) });
        showMessage("세부종목 등록됨");
      }
      resetEventForm();
      await loadEvents();
    } catch { showMessage("세부종목 저장 실패", "error"); }
    finally { setBusy(false); }
  };

  const deleteEvent = async (eventId: string) => {
    if (!tournamentId || !activeDivisionId || !confirm("삭제하시겠습니까?")) return;
    try {
      await api(`/api/admin/tournaments/${tournamentId}/divisions/${activeDivisionId}/events/${eventId}`, { method: "DELETE" });
      if (editingEventId === eventId) resetEventForm();
      await loadEvents();
      showMessage("세부종목 삭제됨");
    } catch { showMessage("세부종목 삭제 실패", "error"); }
  };

  const savePlayer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tournamentId) return;
    setBusy(true); setMessage("");
    try {
      const data = { ...playerForm, divisionId: activeDivisionId };
      if (!data.divisionId) { showMessage("종별을 먼저 선택해 주세요.", "error"); return; }
      if (editingPlayerId) {
        await api(`/api/admin/tournaments/${tournamentId}/players/${editingPlayerId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        showMessage("선수 정보가 수정되었습니다.");
      } else {
        await api(`/api/admin/tournaments/${tournamentId}/players`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        showMessage("선수 등록됨");
      }
      resetPlayerForm();
      await loadPlayers();
    } catch { showMessage("선수 저장 실패", "error"); }
    finally { setBusy(false); }
  };

  const deletePlayer = async (playerId: string) => {
    if (!tournamentId || !confirm("삭제하시겠습니까?")) return;
    try {
      await api(`/api/admin/tournaments/${tournamentId}/players/${playerId}`, { method: "DELETE" });
      if (editingPlayerId === playerId) resetPlayerForm();
      await loadPlayers();
      showMessage("선수 삭제됨");
    } catch { showMessage("선수 삭제 실패", "error"); }
  };

  const triggerScoreboard = (eventId: string) => {
    window.open(`/admin/tournaments/${tournamentId}/scoreboard?eventId=${eventId}&divisionId=${activeDivisionId}`, "_blank");
  };

  // --- Tab styles ---
  const tabStyle = (tab: Tab) => ({
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
  } as const);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Header */}
      <div>
        <Link href="/admin/tournaments" style={{ color: "#94a3b8", fontSize: 13 }}>
          ← 대회 목록
        </Link>
        <h1 style={{
          fontSize: 28, fontWeight: 800, marginTop: 8,
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          {tournament?.title ?? "대회 상세"}
        </h1>
        {tournament && (
          <div style={{ display: "flex", gap: 16, color: "#64748b", fontSize: 14, marginTop: 4 }}>
            <span>📍 {tournament.region}</span>
            <span>🎳 레인 {tournament.laneStart}-{tournament.laneEnd}</span>
            <span>📅 {tournament.seasonYear}년</span>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <GlassCard variant="subtle" style={{
          padding: "10px 16px",
          color: messageType === "error" ? "#dc2626" : "#16a34a",
          background: messageType === "error" ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)",
          border: `1px solid ${messageType === "error" ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)"}`,
        }}>
          {message}
        </GlassCard>
      )}

      {/* Division Selector + Management */}
      <GlassCard variant="strong" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: divisions.length > 0 ? 0 : 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>종별</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
            {divisions.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setActiveDivisionId(d.id);
                  resetEventForm();
                  resetPlayerForm();
                }}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: activeDivisionId === d.id ? 700 : 500,
                  color: activeDivisionId === d.id ? "#fff" : "#475569",
                  background: activeDivisionId === d.id
                    ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                    : "rgba(255, 255, 255, 0.3)",
                  border: activeDivisionId === d.id
                    ? "1px solid rgba(255, 255, 255, 0.3)"
                    : "1px solid rgba(255, 255, 255, 0.4)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  fontFamily: "inherit",
                }}
              >
                {d.title} ({GENDER_LABELS[d.gender] ?? d.gender})
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <GlassButton size="sm" onClick={() => { setDivisionFormOpen((v) => !v); resetDivisionForm(); }}>
              {divisionFormOpen ? "닫기" : "+ 종별 추가"}
            </GlassButton>
            {activeDivisionId && (
              <>
                <GlassButton variant="secondary" size="sm" onClick={() => {
                  const d = divisions.find((div) => div.id === activeDivisionId);
                  if (d) {
                    setEditingDivisionId(d.id);
                    setDivisionForm({ title: d.title, gender: d.gender });
                    setDivisionFormOpen(true);
                  }
                }}>수정</GlassButton>
                <GlassButton variant="danger" size="sm" onClick={() => deleteDivision(activeDivisionId)}>삭제</GlassButton>
              </>
            )}
          </div>
        </div>
        {divisions.length === 0 && !divisionFormOpen && (
          <span style={{ color: "#94a3b8", fontSize: 13 }}>등록된 종별이 없습니다. 종별을 먼저 추가하세요.</span>
        )}

        {/* Division form (inline) */}
        {divisionFormOpen && (
          <form onSubmit={saveDivision} style={{ display: "flex", gap: 12, alignItems: "flex-end", marginTop: 14, flexWrap: "wrap" }}>
            <GlassInput label="종별명" required value={divisionForm.title}
              onChange={(e) => setDivisionForm((p) => ({ ...p, title: e.target.value }))} placeholder="예: 초등부 남자" />
            <GlassSelect label="성별" value={divisionForm.gender}
              onChange={(e) => setDivisionForm((p) => ({ ...p, gender: e.target.value }))}>
              <option value="M">남자</option>
              <option value="F">여자</option>
              <option value="MIXED">혼합</option>
            </GlassSelect>
            <GlassButton type="submit" size="sm" disabled={busy}>
              {editingDivisionId ? "수정" : "등록"}
            </GlassButton>
            <GlassButton type="button" variant="secondary" size="sm" onClick={() => { setDivisionFormOpen(false); resetDivisionForm(); }}>취소</GlassButton>
          </form>
        )}
      </GlassCard>

      {/* Tabs - only show when division selected */}
      {activeDivisionId && (
        <>
          <div style={{
            display: "flex", gap: 0,
            borderBottom: "1px solid rgba(255, 255, 255, 0.3)",
            background: "rgba(255, 255, 255, 0.15)",
            borderRadius: "12px 12px 0 0",
            overflow: "hidden",
          }}>
            <button style={tabStyle("events")} onClick={() => setActiveTab("events")}>세부종목 관리</button>
            <button style={tabStyle("players")} onClick={() => setActiveTab("players")}>선수 등록</button>
          </div>

          {/* ===== Tab: Events ===== */}
          {activeTab === "events" && (
            <GlassCard>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 20 }}>
                {editingEventId ? "세부종목 수정" : "세부종목 등록"}
              </h2>
              <form onSubmit={saveEvent} style={{ display: "grid", gap: 14, maxWidth: 620 }}>
                <GlassInput label="종목명" required value={eventForm.title}
                  onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <GlassSelect label="종류" value={eventForm.kind}
                    onChange={(e) => setEventForm((p) => ({ ...p, kind: e.target.value as Event["kind"] }))}>
                    <option value="SINGLE">개인전</option>
                    <option value="DOUBLES">2인조</option>
                    <option value="TRIPLES">3인조</option>
                    <option value="FOURS">4인조</option>
                    <option value="FIVES">5인조</option>
                    <option value="OVERALL">개인종합</option>
                  </GlassSelect>
                  <GlassInput label="게임 수" type="number" min={1} max={6} value={eventForm.gameCount}
                    onChange={(e) => setEventForm((p) => ({ ...p, gameCount: Number(e.target.value) }))} />
                  <GlassSelect label="Table 이동" value={String(eventForm.tableShift)}
                    onChange={(e) => setEventForm((p) => ({ ...p, tableShift: Number(e.target.value) }))}>
                    {Array.from({ length: 41 }, (_, i) => i - 20).map((v) => (
                      <option key={v} value={v}>{v >= 0 ? `+${v}` : v}</option>
                    ))}
                  </GlassSelect>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <GlassInput label="경기일" type="date" required value={eventForm.scheduleDate}
                    onChange={(e) => setEventForm((p) => ({ ...p, scheduleDate: e.target.value }))} />
                  <GlassInput label="시작 레인" type="number" min={1} value={eventForm.laneStart}
                    onChange={(e) => setEventForm((p) => ({ ...p, laneStart: Number(e.target.value) }))} />
                  <GlassInput label="끝 레인" type="number" min={1} value={eventForm.laneEnd}
                    onChange={(e) => setEventForm((p) => ({ ...p, laneEnd: Number(e.target.value) }))} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <GlassButton type="submit" disabled={busy}>
                    {busy ? "저장중..." : editingEventId ? "세부종목 수정" : "세부종목 등록"}
                  </GlassButton>
                  {editingEventId && <GlassButton type="button" variant="secondary" onClick={resetEventForm}>취소</GlassButton>}
                </div>
              </form>

              <div style={{ marginTop: 24 }}>
                <GlassTable headers={["종목명", "종류", "게임수", "레인", "Table", "경기일", "작업"]} rowCount={events.length} emptyMessage="등록된 세부종목이 없습니다.">
                  {events.map((ev) => (
                    <tr key={ev.id} {...glassTrHoverProps}>
                      <td style={glassTdStyle}>
                        <button onClick={() => triggerScoreboard(ev.id)}
                          style={{ border: "none", padding: 0, color: "#6366f1", background: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", fontSize: 14 }}>
                          {ev.title}
                        </button>
                      </td>
                      <td style={glassTdStyle}><GlassBadge>{KIND_LABELS[ev.kind] ?? ev.kind}</GlassBadge></td>
                      <td style={{ ...glassTdStyle, textAlign: "center" }}>{ev.gameCount}</td>
                      <td style={{ ...glassTdStyle, color: "#64748b" }}>{ev.laneStart}-{ev.laneEnd}</td>
                      <td style={{ ...glassTdStyle, textAlign: "center" }}>{ev.tableShift >= 0 ? `+${ev.tableShift}` : ev.tableShift}</td>
                      <td style={{ ...glassTdStyle, color: "#64748b" }}>{ev.scheduleDate}</td>
                      <td style={glassTdStyle}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <GlassButton variant="secondary" size="sm" onClick={() => {
                            setEditingEventId(ev.id);
                            setEventForm({ title: ev.title, kind: ev.kind, gameCount: ev.gameCount, scheduleDate: ev.scheduleDate, laneStart: ev.laneStart, laneEnd: ev.laneEnd, tableShift: ev.tableShift });
                          }}>수정</GlassButton>
                          <GlassButton variant="danger" size="sm" onClick={() => deleteEvent(ev.id)}>삭제</GlassButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </GlassTable>
              </div>
            </GlassCard>
          )}

          {/* ===== Tab: Players ===== */}
          {activeTab === "players" && (
            <GlassCard>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 20 }}>
                {editingPlayerId ? "선수 수정" : "선수 등록"}
              </h2>
              <form onSubmit={savePlayer} style={{ display: "grid", gap: 14, maxWidth: 600 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <GlassSelect label="팀조" value={playerForm.group}
                    onChange={(e) => setPlayerForm((p) => ({ ...p, group: e.target.value }))}>
                    <option value="A">A</option>
                    <option value="B">B</option>
                  </GlassSelect>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <GlassInput label="시군" required value={playerForm.region}
                    onChange={(e) => setPlayerForm((p) => ({ ...p, region: e.target.value }))} />
                  <GlassInput label="소속(학교)" required value={playerForm.affiliation}
                    onChange={(e) => setPlayerForm((p) => ({ ...p, affiliation: e.target.value }))} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <GlassInput label="성명" required value={playerForm.name}
                    onChange={(e) => setPlayerForm((p) => ({ ...p, name: e.target.value }))} />
                  <GlassSelect label="손" value={playerForm.hand}
                    onChange={(e) => setPlayerForm((p) => ({ ...p, hand: e.target.value as Player["hand"] }))}>
                    <option value="right">오른손</option>
                    <option value="left">왼손</option>
                  </GlassSelect>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <GlassButton type="submit" disabled={busy}>
                    {busy ? "저장중..." : editingPlayerId ? "선수 수정" : "선수 등록"}
                  </GlassButton>
                  {editingPlayerId && <GlassButton type="button" variant="secondary" onClick={() => resetPlayerForm()}>취소</GlassButton>}
                </div>
              </form>

              <div style={{ marginTop: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
                    <input
                      type="text"
                      value={playerSearch}
                      onChange={(e) => setPlayerSearch(e.target.value)}
                      placeholder="이름, 소속, 시군, 번호로 검색..."
                      style={{
                        width: "100%", padding: "9px 14px 9px 36px", borderRadius: 10,
                        fontSize: 13, fontFamily: "inherit", color: "#1e293b",
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
                    {selectedDivisionPlayers.length}명{playerSearch.trim() ? ` (전체 ${players.filter((p) => !activeDivisionId || p.divisionId === activeDivisionId).length}명)` : ""}
                  </span>
                </div>
                <GlassTable headers={["번호", "이름", "시군", "소속", "손", "팀조", "작업"]} rowCount={selectedDivisionPlayers.length} emptyMessage="등록된 선수가 없습니다.">
                  {selectedDivisionPlayers.map((p) => (
                    <tr key={p.id} {...glassTrHoverProps}>
                      <td style={{ ...glassTdStyle, textAlign: "center", fontWeight: 600 }}>{p.number}</td>
                      <td style={{ ...glassTdStyle, fontWeight: 600 }}>{p.name}</td>
                      <td style={glassTdStyle}>{p.region}</td>
                      <td style={glassTdStyle}>{p.affiliation}</td>
                      <td style={glassTdStyle}>{p.hand === "left" ? "왼손" : "오른손"}</td>
                      <td style={{ ...glassTdStyle, textAlign: "center" }}><GlassBadge>{p.group}</GlassBadge></td>
                      <td style={glassTdStyle}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <GlassButton variant="secondary" size="sm" onClick={() => {
                            setEditingPlayerId(p.id);
                            setPlayerForm({ group: p.group, region: p.region, affiliation: p.affiliation, name: p.name, hand: p.hand });
                          }}>수정</GlassButton>
                          <GlassButton variant="danger" size="sm" onClick={() => deletePlayer(p.id)}>삭제</GlassButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </GlassTable>
              </div>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}
