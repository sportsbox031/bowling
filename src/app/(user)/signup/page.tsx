"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import { getFirebaseAuthErrorMessage } from "@/lib/firebase/auth-error";
import { GlassBadge, GlassButton, GlassCard, GlassInput } from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";
import UserShell from "@/components/user/UserShell";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationInput, setOrganizationInput] = useState("");
  const [organizationNames, setOrganizationNames] = useState<string[]>([]);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const addOrganizationName = () => {
    const value = organizationInput.trim();
    if (!value) return;
    setOrganizationNames((current) => current.includes(value) ? current : [...current, value]);
    setOrganizationInput("");
  };

  const removeOrganizationName = (value: string) => {
    setOrganizationNames((current) => current.filter((item) => item !== value));
  };

  const handleOrganizationKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      addOrganizationName();
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (!auth) throw new Error("Firebase 클라이언트 설정이 필요합니다.");
      if (!privacyConsent) throw new Error("개인정보 동의가 필요합니다.");
      if (organizationNames.length === 0) throw new Error("담당 단체명을 하나 이상 입력해 주세요.");

      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      const sessionResponse = await fetch("/api/user/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });
      if (!sessionResponse.ok) {
        throw new Error("회원가입 세션을 생성하지 못했습니다.");
      }

      const profileResponse = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          phone,
          email,
          privacyConsent,
          organizationNames,
        }),
      });
      if (!profileResponse.ok) {
        const body = await profileResponse.json().catch(() => null);
        throw new Error(body?.message ?? "프로필을 저장하지 못했습니다.");
      }

      router.push("/pending");
      router.refresh();
    } catch (error) {
      setMessage(getFirebaseAuthErrorMessage(error, "회원가입에 실패했습니다."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <UserShell
      title="지도자 회원가입"
      subtitle="관리자 승인 후 선수등록과 팀편성 기능을 사용할 수 있습니다."
      footer={<div style={{ textAlign: "center" }}><Link href="/login" style={{ color: "#0f766e", textDecoration: "none", fontWeight: 700 }}>이미 계정이 있나요? 로그인</Link></div>}
    >
      <GlassCard variant="strong">
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
          <GlassInput label="담당자" value={name} onChange={(event) => setName(event.target.value)} required />
          <GlassInput label="연락처" value={phone} onChange={(event) => setPhone(event.target.value)} required />
          <GlassInput label="메일주소" value={email} onChange={(event) => setEmail(event.target.value)} required type="email" />
          <GlassInput label="비밀번호" value={password} onChange={(event) => setPassword(event.target.value)} required type="password" />
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>담당 단체명</span>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <textarea
                  value={organizationInput}
                  onChange={(event) => setOrganizationInput(event.target.value)}
                  onKeyDown={handleOrganizationKeyDown}
                  placeholder="학교 또는 단체명을 입력하고 추가를 누르세요"
                  style={{
                    width: "100%",
                    minHeight: 72,
                    padding: "10px 14px",
                    background: "rgba(255, 255, 255, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.4)",
                    borderRadius: 10,
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    fontSize: 14,
                    color: "#1e293b",
                    outline: "none",
                    fontFamily: "inherit",
                    flex: "1 1 320px",
                  }}
                />
                <GlassButton type="button" variant="secondary" onClick={addOrganizationName}>
                  단체 추가
                </GlassButton>
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Enter를 누르거나 `단체 추가`를 눌러 목록에 담아주세요.
              </div>
              {organizationNames.length > 0 ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {organizationNames.map((organizationName) => (
                    <button
                      key={organizationName}
                      type="button"
                      onClick={() => removeOrganizationName(organizationName)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "1px solid rgba(99,102,241,0.25)",
                        background: "rgba(99,102,241,0.10)",
                        color: "#4f46e5",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <GlassBadge variant="info" style={{ padding: "2px 6px" }}>담당단체</GlassBadge>
                      {organizationName}
                      <span style={{ color: "#64748b" }}>삭제</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#94a3b8" }}>추가된 담당단체가 아직 없습니다.</div>
              )}
            </div>
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "#475569" }}>
            <input type="checkbox" checked={privacyConsent} onChange={(event) => setPrivacyConsent(event.target.checked)} />
            <span>개인정보 수집 및 이용에 동의합니다.</span>
          </label>
          <GlassButton type="submit" isLoading={busy} size="lg" style={{ width: "100%" }}>
            {busy ? "가입 중..." : "회원가입"}
          </GlassButton>
        </form>
      </GlassCard>
      {message ? <StatusBanner tone="error" style={{ marginTop: 16 }}>{message}</StatusBanner> : null}
    </UserShell>
  );
}
