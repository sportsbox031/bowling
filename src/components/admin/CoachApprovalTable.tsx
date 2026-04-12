"use client";

import Link from "next/link";
import { GlassCard, GlassButton } from "@/components/ui";

export type CoachApprovalRow = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  organizationCount: number;
  representativeOrganizationName: string | null;
  pendingOrganizationCount: number;
  pendingOrganizationNames: string[];
  pendingRemovalCount: number;
  pendingRemovalNames: string[];
};

export default function CoachApprovalTable({
  rows,
  onAction,
}: {
  rows: CoachApprovalRow[];
  onAction: (uid: string, action: "APPROVE" | "REJECT" | "DISABLE") => Promise<void>;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {rows.map((row) => (
        <GlassCard key={row.uid} variant="strong" style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <strong style={{ color: "#1e293b" }}>{row.name || "이름 미입력"}</strong>
              <span style={{ fontSize: 13, color: "#64748b" }}>{row.email}</span>
              <span style={{ fontSize: 13, color: "#64748b" }}>{row.phone || "연락처 미입력"}</span>
              <span style={{ fontSize: 12, color: "#0f766e" }}>
                단체 {row.organizationCount}개
                {row.representativeOrganizationName ? ` · 대표 ${row.representativeOrganizationName}` : ""}
              </span>
              {row.pendingOrganizationCount > 0 ? (
                <span style={{ fontSize: 12, color: "#b45309" }}>
                  승인 대기 단체 {row.pendingOrganizationCount}개
                  {row.pendingOrganizationNames.length > 0 ? ` · ${row.pendingOrganizationNames.join(", ")}` : ""}
                </span>
              ) : null}
              {row.pendingRemovalCount > 0 ? (
                <span style={{ fontSize: 12, color: "#dc2626" }}>
                  삭제 요청 단체 {row.pendingRemovalCount}개
                  {row.pendingRemovalNames.length > 0 ? ` · ${row.pendingRemovalNames.join(", ")}` : ""}
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
              {row.status === "PENDING_APPROVAL" ? <GlassButton size="sm" onClick={() => void onAction(row.uid, "APPROVE")}>승인</GlassButton> : null}
              {row.status === "PENDING_APPROVAL" ? <GlassButton size="sm" variant="secondary" onClick={() => void onAction(row.uid, "REJECT")}>반려</GlassButton> : null}
              {row.status !== "DISABLED" ? <GlassButton size="sm" variant="danger" onClick={() => void onAction(row.uid, "DISABLE")}>탈퇴</GlassButton> : null}
              <Link href={`/admin/coaches/${row.uid}`}><GlassButton size="sm" variant="ghost">상세</GlassButton></Link>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>상태: {row.status}</div>
        </GlassCard>
      ))}
    </div>
  );
}
