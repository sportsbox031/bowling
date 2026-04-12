"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { GlassButton, GlassCard } from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";
import CoachOrganizationEditor from "@/components/admin/CoachOrganizationEditor";

export default function AdminCoachDetailPage() {
  const params = useParams<{ uid: string }>();
  const uid = String(params?.uid ?? "");
  const [data, setData] = useState<{ profile?: Record<string, any>; memberships?: Array<Record<string, any>>; organizations?: Array<Record<string, any>> }>({});
  const [message, setMessage] = useState("");

  const load = async () => {
    const response = await fetch(`/api/admin/coaches/${uid}`, { cache: "no-store" });
    if (!response.ok) throw new Error("지도자 정보를 불러오지 못했습니다.");
    setData(await response.json());
  };

  useEffect(() => {
    if (!uid) return;
    void load().catch((error) => setMessage((error as Error).message));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const timer = window.setInterval(() => {
      void load().catch(() => null);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [uid]);

  const resetPassword = async () => {
    const response = await fetch(`/api/admin/coaches/${uid}/password-reset`, { method: "POST" });
    if (!response.ok) {
      setMessage("비밀번호를 초기화하지 못했습니다.");
      return;
    }
    setMessage("비밀번호가 0000으로 초기화되었습니다.");
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <GlassCard variant="strong">
        <h1 style={{ margin: 0, fontSize: 24, color: "#1e293b" }}>지도자 상세</h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "#64748b" }}>기본 정보, 승인 상태, 담당 단체를 한 화면에서 관리합니다.</p>
      </GlassCard>

      {message ? <StatusBanner tone="info">{message}</StatusBanner> : null}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <GlassButton variant="secondary" onClick={() => void load()}>
          새로고침
        </GlassButton>
      </div>

      {data.profile ? (
        <GlassCard variant="strong" style={{ display: "grid", gap: 8 }}>
          <div><strong>담당자:</strong> {String(data.profile.name ?? "")}</div>
          <div><strong>메일주소:</strong> {String(data.profile.email ?? "")}</div>
          <div><strong>연락처:</strong> {String(data.profile.phone ?? "")}</div>
          <div><strong>상태:</strong> {String(data.profile.status ?? "")}</div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <GlassButton variant="secondary" onClick={() => void resetPassword()}>비밀번호 0000 초기화</GlassButton>
          </div>
        </GlassCard>
      ) : null}

      {data.profile ? (
        <CoachOrganizationEditor
          uid={uid}
          profile={data.profile}
          memberships={data.memberships ?? []}
          organizations={data.organizations ?? []}
          onChanged={load}
        />
      ) : null}
    </div>
  );
}
