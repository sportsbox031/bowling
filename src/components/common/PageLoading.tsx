import { GlassCard } from "@/components/ui";

type PageLoadingProps = {
  title: string;
  description?: string;
  mode?: "public" | "admin";
  layout?: "cards" | "table" | "detail";
};

const toneByMode = {
  public: {
    badge: "공개 페이지 준비 중",
    accent: "#6366f1",
    background: "rgba(99, 102, 241, 0.08)",
  },
  admin: {
    badge: "관리 화면 준비 중",
    accent: "#0f766e",
    background: "rgba(15, 118, 110, 0.08)",
  },
};

function SkeletonLine({ width, height = 14 }: { width: string; height?: number }) {
  return <div className="skeleton" style={{ width, height, borderRadius: 8 }} />;
}

export default function PageLoading({ title, description, mode = "public", layout = "cards" }: PageLoadingProps) {
  const tone = toneByMode[mode];

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "grid", gap: 20 }}>
        <GlassCard variant="strong" style={{ background: tone.background }}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: tone.accent, fontSize: 13, fontWeight: 700 }}>
              <span className="loading-dot" />
              {tone.badge}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#1e293b", margin: 0 }}>{title}</h1>
              <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>{description ?? "잠시만 기다려 주세요. 필요한 데이터를 빠르게 불러오고 있습니다."}</p>
            </div>
          </div>
        </GlassCard>

        {layout === "cards" && (
          <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {Array.from({ length: 6 }).map((_, index) => (
              <GlassCard key={index} style={{ minHeight: 176, display: "grid", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <SkeletonLine width="62%" height={22} />
                  <SkeletonLine width="22%" height={22} />
                </div>
                <SkeletonLine width="78%" />
                <SkeletonLine width="54%" />
                <SkeletonLine width="40%" />
              </GlassCard>
            ))}
          </section>
        )}

        {layout === "table" && (
          <GlassCard>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", gap: 10 }}>
                {Array.from({ length: 6 }).map((_, index) => <SkeletonLine key={index} width="100%" height={18} />)}
              </div>
              {Array.from({ length: 7 }).map((_, row) => (
                <div key={row} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", gap: 10 }}>
                  {Array.from({ length: 6 }).map((__, col) => <SkeletonLine key={col} width={col === 0 ? "88%" : "100%"} height={16} />)}
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {layout === "detail" && (
          <>
            <GlassCard variant="strong">
              <div style={{ display: "grid", gap: 12 }}>
                <SkeletonLine width="42%" height={30} />
                <SkeletonLine width="60%" />
                <SkeletonLine width="34%" />
              </div>
            </GlassCard>
            <GlassCard>
              <div style={{ display: "grid", gap: 10 }}>
                {Array.from({ length: 8 }).map((_, index) => <SkeletonLine key={index} width={index % 2 === 0 ? "100%" : "82%"} />)}
              </div>
            </GlassCard>
          </>
        )}
      </div>
    </div>
  );
}

