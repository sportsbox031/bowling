"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import { getFirebaseAuthErrorMessage } from "@/lib/firebase/auth-error";
import { GlassButton, GlassCard, GlassInput } from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";
import UserShell from "@/components/user/UserShell";
import { getPostLoginRedirectPath } from "@/lib/user-flow";

export default function UserLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const guard = async () => {
      const response = await fetch("/api/session-state", { cache: "no-store", credentials: "include" });
      if (!response.ok) return;
      const data = await response.json() as { userActive?: boolean; adminActive?: boolean; userApproved?: boolean };
      if (data.adminActive) {
        router.replace("/admin");
      } else if (data.userActive) {
        router.replace(data.userApproved ? next : "/pending");
      }
    };

    void guard();
  }, [next, router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (!auth) throw new Error("Firebase 클라이언트 설정이 필요합니다.");
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      const adminResponse = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });

      if (adminResponse.ok) {
        await fetch("/api/user/session", { method: "DELETE", credentials: "include" });
        router.push("/admin");
        router.refresh();
        return;
      }

      const sessionResponse = await fetch("/api/user/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });
      if (!sessionResponse.ok) {
        throw new Error("로그인 세션을 생성하지 못했습니다.");
      }

      const meResponse = await fetch("/api/user/session", { cache: "no-store", credentials: "include" });
      if (!meResponse.ok) {
        throw new Error("로그인 상태를 확인하지 못했습니다.");
      }
      const meData = await meResponse.json() as { session?: { isApproved?: boolean } };
      router.push(getPostLoginRedirectPath({
        adminSessionCreated: false,
        userApproved: Boolean(meData.session?.isApproved),
        next,
      }));
      router.refresh();
    } catch (error) {
      setMessage(getFirebaseAuthErrorMessage(error, "로그인에 실패했습니다."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <UserShell
      title="로그인"
      subtitle="관리자와 사용자 모두 같은 페이지에서 로그인합니다."
      footer={
        <div style={{ textAlign: "center", display: "grid", gap: 8 }}>
          <Link href="/signup" style={{ color: "#0f766e", textDecoration: "none", fontWeight: 700 }}>회원가입</Link>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>로그인 후 권한에 따라 자동으로 이동합니다.</span>
        </div>
      }
    >
      <GlassCard variant="strong">
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
          <GlassInput label="메일주소" value={email} onChange={(event) => setEmail(event.target.value)} required type="email" />
          <GlassInput label="비밀번호" value={password} onChange={(event) => setPassword(event.target.value)} required type="password" />
          <GlassButton type="submit" isLoading={busy} size="lg" style={{ width: "100%" }}>
            {busy ? "로그인 중..." : "로그인"}
          </GlassButton>
        </form>
      </GlassCard>
      {message ? <StatusBanner tone="error" style={{ marginTop: 16 }}>{message}</StatusBanner> : null}
    </UserShell>
  );
}
