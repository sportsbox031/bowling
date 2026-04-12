import Link from "next/link";
import { GlassCard, GlassButton } from "@/components/ui";
import UserShell from "@/components/user/UserShell";
import { requireUserSession } from "@/lib/auth/user-guard";

export default async function PendingPage() {
  const session = await requireUserSession({ allowPending: true, loginRedirectTo: "/login" });

  return (
    <UserShell
      title="승인 대기중"
      subtitle="관리자 승인 후 선수등록과 팀편성 기능을 사용할 수 있습니다."
    >
      <GlassCard variant="strong" style={{ display: "grid", gap: 14 }}>
        <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.7 }}>
          <div><strong>담당자:</strong> {session.profile.name}</div>
          <div><strong>메일주소:</strong> {session.profile.email}</div>
          <div><strong>상태:</strong> {session.profile.status}</div>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>
          현재는 계정관리만 사용할 수 있습니다. 승인 후 담당 단체 기준으로 선수등록과 팀편성을 진행할 수 있습니다.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/account"><GlassButton>계정관리</GlassButton></Link>
          <Link href="/"><GlassButton variant="secondary">대회 목록</GlassButton></Link>
        </div>
      </GlassCard>
    </UserShell>
  );
}
