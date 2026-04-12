"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { GlassBadge, GlassButton, GlassCard, GlassInput } from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";
import { fetchUserProfileBundle } from "@/lib/user-profile-client";

type AccountFormProps = {
  initialProfile: {
    name: string;
    phone: string;
    email: string;
    status: string;
  };
};

type MembershipRecord = {
  id: string;
  organizationId: string;
  status: string;
  removalRequestedAt?: string;
};

type OrganizationRecord = {
  id: string;
  name: string;
  status: string;
};

export default function AccountForm({ initialProfile }: AccountFormProps) {
  const [name, setName] = useState(initialProfile.name);
  const [phone, setPhone] = useState(initialProfile.phone);
  const [email, setEmail] = useState(initialProfile.email);
  const [organizationInput, setOrganizationInput] = useState("");
  const [memberships, setMemberships] = useState<MembershipRecord[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingOrganization, setSavingOrganization] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">("info");

  const loadProfile = async () => {
    try {
      const data = await fetchUserProfileBundle() as {
        memberships?: MembershipRecord[];
        organizations?: OrganizationRecord[];
      };
      setMemberships(data.memberships ?? []);
      setOrganizations(data.organizations ?? []);
    } catch {
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const organizationRows = useMemo(() => organizations.map((organization) => {
    const membership = memberships.find((item) => item.organizationId === organization.id);
    return {
      id: organization.id,
      name: organization.name,
      status: membership?.status ?? organization.status,
    };
  }), [memberships, organizations]);

  const addOrganizationRequest = async () => {
    const value = organizationInput.trim();
    if (!value) return;
    setSavingOrganization(true);
    setMessage("");
    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationNames: [value],
        }),
      });
      if (!response.ok) {
        throw new Error("단체 요청을 저장하지 못했습니다.");
      }
      const data = await response.json() as {
        memberships?: MembershipRecord[];
        organizations?: OrganizationRecord[];
      };
      setMemberships(data.memberships ?? []);
      setOrganizations(data.organizations ?? []);
      setOrganizationInput("");
      setMessageTone("success");
      setMessage("단체 요청이 접수되었습니다. 관리자 승인 후 사용할 수 있습니다.");
    } catch (error) {
      setMessageTone("error");
      setMessage((error as Error).message || "단체 요청을 저장하지 못했습니다.");
    } finally {
      setSavingOrganization(false);
    }
  };

  const requestOrganizationRemoval = async (organizationId: string) => {
    setSavingOrganization(true);
    setMessage("");
    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          removeOrganizationIds: [organizationId],
        }),
      });
      if (!response.ok) {
        throw new Error("단체 삭제 요청을 저장하지 못했습니다.");
      }
      const data = await response.json() as {
        memberships?: MembershipRecord[];
        organizations?: OrganizationRecord[];
      };
      setMemberships(data.memberships ?? []);
      setOrganizations(data.organizations ?? []);
      setMessageTone("success");
      setMessage("단체 삭제 요청이 접수되었습니다. 관리자 승인 후 연결이 제거됩니다.");
    } catch (error) {
      setMessageTone("error");
      setMessage((error as Error).message || "단체 삭제 요청을 저장하지 못했습니다.");
    } finally {
      setSavingOrganization(false);
    }
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProfile(true);
    setMessage("");
    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
        }),
      });
      if (!response.ok) {
        throw new Error("계정 정보를 저장하지 못했습니다.");
      }
      const data = await response.json() as {
        memberships?: MembershipRecord[];
        organizations?: OrganizationRecord[];
      };
      setMemberships(data.memberships ?? []);
      setOrganizations(data.organizations ?? []);
      setMessageTone("success");
      setMessage("계정 정보가 저장되었습니다.");
    } catch (error) {
      setMessageTone("error");
      setMessage((error as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingPassword(true);
    setMessage("");
    try {
      const [{ EmailAuthProvider, reauthenticateWithCredential, updatePassword }, { auth }] = await Promise.all([
        import("firebase/auth"),
        import("@/lib/firebase/client"),
      ]);
      if (!auth?.currentUser || !auth.currentUser.email) {
        throw new Error("로그인 세션을 확인할 수 없습니다.");
      }
      if (!currentPassword || !nextPassword) {
        throw new Error("현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.");
      }
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, nextPassword);
      setCurrentPassword("");
      setNextPassword("");
      setMessageTone("success");
      setMessage("비밀번호가 변경되었습니다.");
    } catch (error) {
      setMessageTone("error");
      setMessage((error as Error).message || "비밀번호를 변경하지 못했습니다.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <GlassCard variant="strong">
        <form onSubmit={saveProfile} style={{ display: "grid", gap: 14 }}>
          <GlassInput label="담당자" value={name} onChange={(event) => setName(event.target.value)} required />
          <GlassInput label="연락처" value={phone} onChange={(event) => setPhone(event.target.value)} required />
          <GlassInput label="메일주소" value={email} onChange={(event) => setEmail(event.target.value)} required type="email" />
          <GlassInput
            label="추가 담당단체 요청"
            value={organizationInput}
            onChange={(event) => setOrganizationInput(event.target.value)}
            placeholder="새로 관리할 학교 또는 단체명을 입력하세요"
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <GlassButton type="button" variant="secondary" isLoading={savingOrganization} onClick={() => void addOrganizationRequest()}>
              단체 추가
            </GlassButton>
            <span style={{ fontSize: 12, color: "#64748b" }}>입력한 단체는 즉시 관리자 승인 요청으로 넘어갑니다.</span>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#64748b" }}>현재 담당단체</span>
            {organizationRows.length === 0 ? (
              <div style={{ fontSize: 13, color: "#94a3b8" }}>등록된 담당단체가 아직 없습니다.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {organizationRows.map((organization) => (
                  <div
                    key={organization.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      border: "1px solid rgba(148, 163, 184, 0.25)",
                      borderRadius: 12,
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.55)",
                    }}
                  >
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong style={{ color: "#1e293b" }}>{organization.name}</strong>
                      <span style={{ fontSize: 12, color: organization.status === "APPROVED" ? "#0f766e" : "#64748b" }}>
                        {organization.status === "APPROVED"
                          ? "승인됨"
                          : organization.status === "PENDING_APPROVAL"
                            ? "승인 대기"
                            : organization.status}
                      </span>
                      {memberships.find((membership) => membership.organizationId === organization.id)?.removalRequestedAt ? (
                        <span style={{ fontSize: 12, color: "#b45309" }}>삭제 요청 대기</span>
                      ) : null}
                    </div>
                    {(() => {
                      const membership = memberships.find((item) => item.organizationId === organization.id);
                      const canRequestRemoval = membership?.status === "APPROVED" && !membership.removalRequestedAt;
                      return canRequestRemoval ? (
                        <GlassButton
                          size="sm"
                          variant="ghost"
                          isLoading={savingOrganization}
                          onClick={() => void requestOrganizationRemoval(organization.id)}
                        >
                          삭제 요청
                        </GlassButton>
                      ) : null;
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#64748b" }}>승인 상태: {initialProfile.status}</span>
            <GlassButton type="submit" isLoading={savingProfile}>정보 저장</GlassButton>
          </div>
        </form>
      </GlassCard>

      <GlassCard variant="strong">
        <form onSubmit={savePassword} style={{ display: "grid", gap: 14 }}>
          <GlassInput label="현재 비밀번호" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} type="password" />
          <GlassInput label="새 비밀번호" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} type="password" />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <GlassButton type="submit" isLoading={savingPassword}>비밀번호 변경</GlassButton>
          </div>
        </form>
      </GlassCard>

      {message ? (
        <StatusBanner tone={messageTone}>
          {message}
        </StatusBanner>
      ) : null}
    </div>
  );
}
