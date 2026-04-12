"use client";

import { useState } from "react";
import { GlassButton, GlassCard, GlassInput } from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";

export default function CoachOrganizationEditor({
  uid,
  profile,
  memberships,
  organizations,
  onChanged,
}: {
  uid: string;
  profile: Record<string, any>;
  memberships: Array<Record<string, any>>;
  organizations: Array<Record<string, any>>;
  onChanged?: () => Promise<void> | void;
}) {
  const [message, setMessage] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [busyMembershipId, setBusyMembershipId] = useState("");

  const setPrimary = async (organizationId: string) => {
    const response = await fetch(`/api/admin/coaches/${uid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryOrganizationId: organizationId }),
    });
    if (!response.ok) {
      setMessage("대표 단체를 저장하지 못했습니다.");
      return;
    }
    setMessage("대표 단체가 저장되었습니다.");
    await onChanged?.();
  };

  const addOrganization = async () => {
    if (!organizationName.trim()) return;
    const response = await fetch(`/api/admin/coaches/${uid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addOrganizationNames: [organizationName.trim()] }),
    });
    if (!response.ok) {
      setMessage("단체 요청을 추가하지 못했습니다.");
      return;
    }
    setOrganizationName("");
    setMessage("단체 요청이 추가되었습니다. 새로고침 후 상태를 확인해 주세요.");
    await onChanged?.();
  };

  const updateMembership = async (
    membershipId: string,
    action: "APPROVE" | "REJECT" | "APPROVE_REMOVAL" | "REJECT_REMOVAL",
  ) => {
    setBusyMembershipId(membershipId);
    const response = await fetch(`/api/admin/coaches/${uid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipAction: { membershipId, action } }),
    });
    if (!response.ok) {
      setMessage("단체 연결 상태를 변경하지 못했습니다.");
      setBusyMembershipId("");
      return;
    }
    setBusyMembershipId("");
    setMessage(
      action === "APPROVE"
        ? "단체 연결 승인 완료"
        : action === "REJECT"
          ? "단체 연결 반려 완료"
          : action === "APPROVE_REMOVAL"
            ? "단체 삭제 승인 완료"
            : "단체 삭제 반려 완료",
    );
    await onChanged?.();
  };

  return (
    <GlassCard variant="strong" style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 700, color: "#1e293b" }}>담당 단체</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 260px" }}>
          <GlassInput
            label="단체 추가"
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            placeholder="새 학교 또는 단체명을 입력하세요"
          />
        </div>
        <GlassButton variant="secondary" onClick={() => void addOrganization()}>단체 요청 추가</GlassButton>
      </div>
      {organizations.length === 0 ? (
        <div style={{ fontSize: 13, color: "#94a3b8" }}>연결된 단체가 없습니다.</div>
      ) : organizations.map((organization) => {
        const membership = memberships.find((item) => item.organizationId === organization.id);
        const isPrimary = profile.primaryOrganizationId === organization.id;
        return (
          <div key={organization.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <strong style={{ color: "#0f172a" }}>{String(organization.name ?? "")}</strong>
              <span style={{ fontSize: 12, color: "#64748b" }}>단체 상태: {String(organization.status ?? "")} · 연결 상태: {String(membership?.status ?? "")}</span>
              {membership?.removalRequestedAt ? (
                <span style={{ fontSize: 12, color: "#dc2626" }}>삭제 요청 대기</span>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {membership?.status !== "APPROVED" ? (
                <GlassButton size="sm" isLoading={busyMembershipId === membership?.id} onClick={() => void updateMembership(String(membership?.id), "APPROVE")}>
                  단체 승인
                </GlassButton>
              ) : null}
              {membership?.status === "PENDING_APPROVAL" ? (
                <GlassButton size="sm" variant="secondary" isLoading={busyMembershipId === membership?.id} onClick={() => void updateMembership(String(membership?.id), "REJECT")}>
                  단체 반려
                </GlassButton>
              ) : null}
              {membership?.status === "APPROVED" && membership?.removalRequestedAt ? (
                <GlassButton size="sm" variant="danger" isLoading={busyMembershipId === membership?.id} onClick={() => void updateMembership(String(membership?.id), "APPROVE_REMOVAL")}>
                  삭제 승인
                </GlassButton>
              ) : null}
              {membership?.status === "APPROVED" && membership?.removalRequestedAt ? (
                <GlassButton size="sm" variant="secondary" isLoading={busyMembershipId === membership?.id} onClick={() => void updateMembership(String(membership?.id), "REJECT_REMOVAL")}>
                  삭제 반려
                </GlassButton>
              ) : null}
              <GlassButton size="sm" variant={isPrimary ? "secondary" : "ghost"} onClick={() => void setPrimary(String(organization.id))}>
                {isPrimary ? "대표 단체" : "대표로 지정"}
              </GlassButton>
            </div>
          </div>
        );
      })}
      {message ? <StatusBanner tone="info">{message}</StatusBanner> : null}
    </GlassCard>
  );
}
