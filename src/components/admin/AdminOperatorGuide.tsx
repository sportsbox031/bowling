"use client";

import Link from "next/link";
import { GlassBadge, GlassCard } from "@/components/ui";
import { adminManualSections, adminQuickStart } from "@/lib/admin-operator-manual";

export default function AdminOperatorGuide() {
  return (
    <GlassCard variant="strong" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          padding: "20px 22px",
          background: "linear-gradient(135deg, rgba(15,118,110,0.18), rgba(14,165,233,0.16))",
          borderBottom: "1px solid rgba(255,255,255,0.28)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#0f766e", letterSpacing: "0.08em" }}>ADMIN GUIDE</p>
            <h2 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800, color: "#134e4a" }}>관리자 운영 가이드</h2>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "#335c58", maxWidth: 760 }}>
              실제 경기 운영 순서에 맞춰 빠른 시작, 자주 하는 작업, 실수 방지 팁을 한 번에 볼 수 있도록 정리했습니다.
            </p>
          </div>
          <GlassBadge variant="info">현장 운영용</GlassBadge>
        </div>
      </div>

      <div style={{ padding: 22, display: "grid", gap: 20 }}>
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1e293b" }}>빠른 시작</h3>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>처음 운영할 때는 아래 순서대로 진행하면 됩니다.</p>
            </div>
            <Link href="/admin/help" style={{ fontSize: 13, fontWeight: 700, color: "#0f766e", textDecoration: "none" }}>
              상세 매뉴얼 보기 →
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {adminQuickStart.map((step, index) => (
              <div
                key={step.title}
                style={{
                  padding: "14px 14px 16px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.42)",
                  border: "1px solid rgba(148,163,184,0.22)",
                }}
              >
                <div style={{ display: "inline-flex", width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center", background: "#0f766e", color: "#fff", fontSize: 12, fontWeight: 800 }}>
                  {index + 1}
                </div>
                <p style={{ margin: "10px 0 6px", fontWeight: 700, color: "#0f172a", fontSize: 14 }}>{step.title}</p>
                <p style={{ margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.5 }}>{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ display: "grid", gap: 10 }}>
          {adminManualSections.map((section) => (
            <details
              key={section.id}
              open={section.id === "score"}
              style={{
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,0.22)",
                background: "rgba(255,255,255,0.32)",
                padding: "0 16px",
              }}
            >
              <summary style={{ cursor: "pointer", listStyle: "none", padding: "16px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1e293b" }}>{section.title}</p>
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>{section.summary}</p>
                  </div>
                  <GlassBadge variant={section.id === "trouble" ? "warning" : "default"}>{section.steps.length}개 단계</GlassBadge>
                </div>
              </summary>
              <div style={{ padding: "0 0 16px", display: "grid", gap: 10 }}>
                {section.steps.map((step, index) => (
                  <div key={step.title} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(15,118,110,0.12)", color: "#0f766e", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>
                      {index + 1}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{step.title}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.55, color: "#475569" }}>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </section>
      </div>
    </GlassCard>
  );
}

