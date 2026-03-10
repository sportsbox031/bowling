"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
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

type Tournament = {
  id: string;
  title: string;
  host: string;
  region: string;
  seasonYear: number;
  laneStart: number;
  laneEnd: number;
  status: "UPCOMING" | "ONGOING" | "FINISHED";
  startsAt: string;
  endsAt: string;
};

type TournamentPayload = Omit<Tournament, "id"> & { status?: string };

const defaultForm: TournamentPayload = {
  title: "",
  host: "",
  region: "",
  seasonYear: new Date().getFullYear(),
  laneStart: 1,
  laneEnd: 6,
  status: "UPCOMING",
  startsAt: "",
  endsAt: "",
};

const api = async <T,>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "요청에 실패했습니다.");
  }
  return response.json();
};

const statusBadge = (status: string) => {
  switch (status) {
    case "ONGOING":
      return <GlassBadge variant="success">진행중</GlassBadge>;
    case "FINISHED":
      return <GlassBadge variant="default">종료</GlassBadge>;
    default:
      return <GlassBadge variant="info">예정</GlassBadge>;
  }
};

export default function TournamentManagerPage() {
  const [items, setItems] = useState<Tournament[]>([]);
  const [form, setForm] = useState<TournamentPayload>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await api<{ items: Tournament[] }>("/api/admin/tournaments");
      setItems(result.items ?? []);
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  useEffect(() => {
    load().catch(() => {
      setMessage("대회 정보를 가져오지 못했습니다.");
      setMessageType("error");
    });
  }, []);

  const saveTournament = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      if (editingId) {
        await api(`/api/admin/tournaments/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        setMessage("대회가 수정되었습니다.");
      } else {
        await api("/api/admin/tournaments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        setMessage("대회가 등록되었습니다.");
      }

      setMessageType("success");
      setEditingId(null);
      setForm(defaultForm);
      await load();
    } catch {
      setMessage("저장 실패");
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (item: Tournament) => {
    setFormOpen(true);
    setEditingId(item.id);
    setForm({
      title: item.title,
      host: item.host,
      region: item.region,
      seasonYear: item.seasonYear,
      laneStart: item.laneStart,
      laneEnd: item.laneEnd,
      status: item.status,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
    });
  };

  const remove = async (id: string) => {
    if (!confirm("삭제하면 복구가 어렵습니다. 진행하시겠습니까?")) {
      return;
    }

    try {
      await api(`/api/admin/tournaments/${id}`, { method: "DELETE" });
      await load();
      setMessage("삭제되었습니다.");
      setMessageType("success");
    } catch {
      setMessage("삭제 실패");
      setMessageType("error");
    }
  };

  return (
    <div style={{ display: "grid", gap: 32 }}>
      <div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 4,
          }}
        >
          대회 관리
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 14 }}>
          대회를 등록하고 관리합니다{loading ? " · 대회 정보를 가져오고 있습니다" : ""}
        </p>
      </div>

      {message && (
        <GlassCard
          variant="subtle"
          style={{
            padding: "12px 16px",
            color: messageType === "error" ? "#dc2626" : "#16a34a",
            background: messageType === "error" ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)",
            border: `1px solid ${messageType === "error" ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)"}`,
          }}
        >
          {message}
        </GlassCard>
      )}

      <GlassCard variant="strong">
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%", background: "none", border: "none", cursor: "pointer",
            padding: 0, fontFamily: "inherit",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0 }}>
            {editingId ? "대회 수정" : "대회 등록"}
          </h2>
          <span style={{ fontSize: 18, color: "#94a3b8", transition: "transform 0.2s", transform: formOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
        </button>
        {formOpen && <form onSubmit={saveTournament} style={{ display: "grid", gap: 16, maxWidth: 640, marginTop: 20 }}>
          <GlassInput label="대회명" required value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="대회명을 입력하세요" />
          <GlassInput label="주최" required value={form.host} onChange={(event) => setForm((prev) => ({ ...prev, host: event.target.value }))} placeholder="주최 기관을 입력하세요" />
          <GlassInput label="지역" required value={form.region} onChange={(event) => setForm((prev) => ({ ...prev, region: event.target.value }))} placeholder="지역을 입력하세요" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <GlassInput label="연도" type="number" value={form.seasonYear} onChange={(event) => setForm((prev) => ({ ...prev, seasonYear: Number(event.target.value) }))} />
            <GlassInput label="시작 레인" type="number" min={1} required value={form.laneStart} onChange={(event) => setForm((prev) => ({ ...prev, laneStart: Number(event.target.value) }))} />
            <GlassInput label="끝 레인" type="number" min={1} required value={form.laneEnd} onChange={(event) => setForm((prev) => ({ ...prev, laneEnd: Number(event.target.value) }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <GlassInput label="시작일" required type="date" value={form.startsAt} onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))} />
            <GlassInput label="종료일" required type="date" value={form.endsAt} onChange={(event) => setForm((prev) => ({ ...prev, endsAt: event.target.value }))} />
          </div>
          <GlassSelect label="상태" value={form.status ?? "UPCOMING"} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as Tournament["status"] }))}>
            <option value="UPCOMING">예정</option>
            <option value="ONGOING">진행중</option>
            <option value="FINISHED">종료</option>
          </GlassSelect>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <GlassButton type="submit" disabled={busy}>
              {busy ? "저장 중..." : editingId ? "수정" : "등록"}
            </GlassButton>
            {editingId && (
              <GlassButton type="button" variant="secondary" onClick={() => { setEditingId(null); setForm(defaultForm); }}>
                취소
              </GlassButton>
            )}
          </div>
        </form>}
      </GlassCard>

      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>
          대회 목록
        </h2>
        {loading && items.length === 0 ? (
          <PageLoading title="대회 목록을 준비하고 있습니다" description="관리 가능한 대회와 기본 정보를 빠르게 확인하고 있습니다." mode="admin" layout="table" />
        ) : (
          <GlassTable headers={["대회명", "기간", "지역", "레인", "상태", "작업"]} rowCount={items.length} emptyMessage={hasLoaded ? "등록된 대회가 없습니다." : "대회 정보를 가져오고 있습니다."}>
            {items.map((item) => (
              <tr key={item.id} {...glassTrHoverProps}>
                <td style={glassTdStyle}>
                  <Link href={`/admin/tournaments/${item.id}`} style={{ fontWeight: 600 }}>
                    {item.title}
                  </Link>
                </td>
                <td style={{ ...glassTdStyle, color: "#64748b", fontSize: 13 }}>
                  {item.startsAt} ~ {item.endsAt}
                </td>
                <td style={glassTdStyle}>{item.region}</td>
                <td style={{ ...glassTdStyle, color: "#64748b" }}>
                  {item.laneStart}-{item.laneEnd}
                </td>
                <td style={glassTdStyle}>{statusBadge(item.status)}</td>
                <td style={glassTdStyle}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <GlassButton variant="secondary" size="sm" onClick={() => startEdit(item)}>
                      수정
                    </GlassButton>
                    <GlassButton variant="danger" size="sm" onClick={() => remove(item.id)}>
                      삭제
                    </GlassButton>
                  </div>
                </td>
              </tr>
            ))}
          </GlassTable>
        )}
      </div>
    </div>
  );
}
