"use client";

import { useEffect, useState } from "react";
import CoachApprovalTable, { CoachApprovalRow } from "@/components/admin/CoachApprovalTable";
import { GlassCard } from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";

export default function AdminCoachesPage() {
  const [rows, setRows] = useState<CoachApprovalRow[]>([]);
  const [message, setMessage] = useState("");

  const load = async () => {
    const response = await fetch("/api/admin/coaches", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("지도자 목록을 불러오지 못했습니다.");
    }
    const data = await response.json();
    setRows(data.rows ?? []);
  };

  useEffect(() => {
    void load().catch((error) => setMessage((error as Error).message));
  }, []);

  const onAction = async (uid: string, action: "APPROVE" | "REJECT" | "DISABLE") => {
    const response = await fetch("/api/admin/coaches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, action }),
    });
    if (!response.ok) {
      setMessage("지도자 상태를 변경하지 못했습니다.");
      return;
    }
    const data = await response.json();
    setRows(data.rows ?? []);
    setMessage(action === "APPROVE" ? "회원 승인 완료" : action === "REJECT" ? "회원 반려 완료" : "회원 탈퇴 처리 완료");
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <GlassCard variant="strong">
        <h1 style={{ margin: 0, fontSize: 24, color: "#1e293b" }}>지도자 관리</h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "#64748b" }}>회원 승인, 대표 단체 확인, 탈퇴 처리를 여기서 관리합니다.</p>
      </GlassCard>
      {message ? <StatusBanner tone="info">{message}</StatusBanner> : null}
      <CoachApprovalTable rows={rows} onAction={onAction} />
    </div>
  );
}
