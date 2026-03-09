"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import { GlassCard, GlassButton, GlassInput } from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    if (!auth) {
      setBusy(false);
      setMessage("Firebase 클라이언트 설정이 필요합니다.");
      return;
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        setMessage("관리자 계정이 아니거나 로그인에 실패했습니다.");
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setMessage("로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard variant="strong">
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
        <GlassInput
          label="이메일"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          placeholder="admin@bowling.kr"
        />
        <GlassInput
          label="비밀번호"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          placeholder="비밀번호를 입력하세요"
        />
        <GlassButton type="submit" isLoading={busy} size="lg" style={{ width: "100%", marginTop: 4 }}>
          {busy ? "로그인 중..." : "로그인"}
        </GlassButton>
      </form>

      {message && (
        <StatusBanner tone="error" style={{ marginTop: 16, textAlign: "center", fontSize: 14 }}>
          {message}
        </StatusBanner>
      )}
    </GlassCard>
  );
}

export default function AdminLoginPage() {
  return (
    <main
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 64px)",
        padding: "2rem 1rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: 8,
            }}
          >
            관리자 로그인
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>대회 관리를 위해 로그인하세요</p>
        </div>

        <Suspense fallback={<GlassCard variant="strong">로그인 화면을 준비하고 있습니다...</GlassCard>}>
          <AdminLoginForm />
        </Suspense>

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link
            href="/"
            style={{
              color: "#94a3b8",
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            ← 대시보드로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
