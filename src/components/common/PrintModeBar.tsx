"use client";

import { GlassButton } from "@/components/ui";

type PrintModeBarProps = {
  enabled: boolean;
  onToggle: () => void;
  label?: string;
};

export default function PrintModeBar({ enabled, onToggle, label = "인쇄 친화 모드" }: PrintModeBarProps) {
  return (
    <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      <GlassButton type="button" size="sm" variant={enabled ? "primary" : "secondary"} onClick={onToggle}>
        {enabled ? `${label} 해제` : label}
      </GlassButton>
      <GlassButton type="button" size="sm" variant="secondary" onClick={() => window.print()}>
        인쇄
      </GlassButton>
    </div>
  );
}
