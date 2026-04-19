"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { GlassButton, GlassCard, GlassSelect } from "@/components/ui";

interface AuditLog {
  id: string;
  targetType: string;
  targetId: string;
  action: string;
  actorUid: string;
  createdAt: string;
  note?: string;
  tournamentId?: string;
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  PLAYER_SUBMISSION: "선수등록",
  TEAM_SUBMISSION: "팀편성",
  FIVES_SUBSTITUTION: "후반 교체",
  SCORE: "점수",
  TOURNAMENT: "대회",
  DIVISION: "종별",
  EVENT: "세부종목",
  PLAYER: "선수",
  USER: "계정",
  ORGANIZATION: "소속",
};

const ACTION_LABELS: Record<string, string> = {
  APPROVE: "승인",
  REJECT: "반려",
  SCORE_SAVE: "점수 저장",
  CREATE: "생성",
  UPDATE: "수정",
  DELETE: "삭제",
  DISABLE: "비활성화",
  RESET_PASSWORD: "비밀번호 초기화",
};

const ACTION_COLORS: Record<string, string> = {
  APPROVE: "#16a34a",
  REJECT: "#dc2626",
  SCORE_SAVE: "#6366f1",
  CREATE: "#0284c7",
  UPDATE: "#d97706",
  DELETE: "#dc2626",
  DISABLE: "#94a3b8",
  RESET_PASSWORD: "#7c3aed",
};

const TARGET_TYPE_OPTIONS = [
  { value: "", label: "전체 유형" },
  { value: "PLAYER_SUBMISSION", label: "선수등록" },
  { value: "TEAM_SUBMISSION", label: "팀편성" },
  { value: "FIVES_SUBSTITUTION", label: "후반 교체" },
  { value: "SCORE", label: "점수" },
  { value: "TOURNAMENT", label: "대회" },
  { value: "USER", label: "계정" },
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [targetType, setTargetType] = useState("");

  const loadLogs = useCallback(async (type: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (type) params.set("targetType", type);
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error("로드 실패");
      const data = await res.json() as { items: AuditLog[] };
      setLogs(data.items ?? []);
    } catch {
      setError("감사 로그를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs(targetType);
  }, [loadLogs, targetType]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("ko-KR", {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ display: "grid", gap: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div>
        <Link href="/admin" style={{ color: "#94a3b8", fontSize: 13, textDecoration: "none" }}>
          ← 관리자 홈
        </Link>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            marginTop: 8,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          감사 로그
        </h1>
        <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
          관리자 조작 이력을 시간 순으로 확인합니다.
        </p>
      </div>

      <GlassCard variant="strong" style={{ padding: "14px 18px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>유형 필터</span>
        <GlassSelect
          value={targetType}
          onChange={(e) => setTargetType(e.target.value)}
          style={{ minWidth: 140 }}
        >
          {TARGET_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </GlassSelect>
        <GlassButton size="sm" variant="secondary" onClick={() => void loadLogs(targetType)}>
          새로고침
        </GlassButton>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#94a3b8" }}>
          {logs.length}건
        </span>
      </GlassCard>

      {error && (
        <GlassCard variant="subtle" style={{ padding: "12px 16px", color: "#dc2626", background: "rgba(239,68,68,0.08)" }}>
          {error}
        </GlassCard>
      )}

      {loading ? (
        <div style={{ display: "grid", gap: 8 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <GlassCard variant="subtle" style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
          기록된 감사 로그가 없습니다.
        </GlassCard>
      ) : (
        <GlassCard variant="strong" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(99,102,241,0.08)", borderBottom: "1px solid rgba(99,102,241,0.15)" }}>
                {["시각", "유형", "동작", "대상 ID", "메모", "관리자 UID"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#475569", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr
                  key={log.id ?? i}
                  style={{
                    borderBottom: "1px solid rgba(241,245,249,0.8)",
                    background: i % 2 === 0 ? "transparent" : "rgba(248,250,252,0.5)",
                  }}
                >
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: "#64748b" }}>
                    {formatDate(log.createdAt)}
                  </td>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                    {TARGET_TYPE_LABELS[log.targetType] ?? log.targetType}
                  </td>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#fff",
                        background: ACTION_COLORS[log.action] ?? "#64748b",
                      }}
                    >
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8", fontFamily: "monospace", fontSize: 11 }}>
                    {log.targetId?.slice(0, 20)}{(log.targetId?.length ?? 0) > 20 ? "…" : ""}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#475569", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.note ?? "-"}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8", fontFamily: "monospace", fontSize: 11 }}>
                    {log.actorUid?.slice(0, 12)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}
    </div>
  );
}
