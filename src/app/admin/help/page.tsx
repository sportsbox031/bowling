import Link from "next/link";
import { requireAdminSession } from "@/lib/auth/guard";
import { GlassBadge, GlassCard } from "@/components/ui";
import { adminManualSections, adminQuickStart } from "@/lib/admin-operator-manual";

export default async function AdminHelpPage() {
  await requireAdminSession();

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div>
        <Link href="/admin/tournaments" style={{ color: "#94a3b8", fontSize: 13, textDecoration: "none" }}>
          ← 관리자 홈으로 돌아가기
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "10px 0 0", color: "#0f172a" }}>관리자 상세 운영 매뉴얼</h1>
        <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14 }}>
          실제 경기 당일 운영 순서에 맞춰 준비, 레인 배정, 점수 입력, 순위 반영 과정을 정리했습니다.
        </p>
      </div>

      <GlassCard variant="strong">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1e293b" }}>빠른 시작 체크리스트</h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>처음 운영할 때는 이 순서를 먼저 확인하세요.</p>
          </div>
          <GlassBadge variant="success">현장 우선</GlassBadge>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {adminQuickStart.map((step, index) => (
            <div key={step.title} style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 12, alignItems: "flex-start", padding: "12px 0", borderTop: index === 0 ? "none" : "1px solid rgba(226,232,240,0.7)" }}>
              <div style={{ width: 34, height: 34, borderRadius: 999, background: "#0f766e", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>{index + 1}</div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: 15 }}>{step.title}</p>
                <p style={{ margin: "4px 0 0", color: "#475569", fontSize: 14, lineHeight: 1.6 }}>{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <div style={{ display: "grid", gap: 16 }}>
        {adminManualSections.map((section) => (
          <GlassCard key={section.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#1e293b" }}>{section.title}</h2>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>{section.summary}</p>
              </div>
              <GlassBadge variant={section.id === "trouble" ? "warning" : "info"}>{section.steps.length}단계</GlassBadge>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {section.steps.map((step, index) => (
                <div key={step.title} style={{ padding: "14px 0", borderTop: index === 0 ? "none" : "1px solid rgba(226,232,240,0.7)" }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{index + 1}. {step.title}</p>
                  <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.65, color: "#475569" }}>{step.description}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
