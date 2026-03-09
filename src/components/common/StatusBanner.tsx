"use client";

import { CSSProperties, ReactNode } from "react";
import { GlassCard } from "@/components/ui";

type StatusBannerProps = {
  children: ReactNode;
  tone?: "error" | "success" | "info";
  style?: CSSProperties;
};

const toneStyles: Record<NonNullable<StatusBannerProps["tone"]>, CSSProperties> = {
  error: {
    color: "#dc2626",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.2)",
  },
  success: {
    color: "#16a34a",
    background: "rgba(34, 197, 94, 0.1)",
    border: "1px solid rgba(34, 197, 94, 0.2)",
  },
  info: {
    color: "#475569",
    background: "rgba(148, 163, 184, 0.12)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
  },
};

export default function StatusBanner({ children, tone = "info", style }: StatusBannerProps) {
  return (
    <GlassCard
      variant="subtle"
      style={{
        padding: "12px 16px",
        ...toneStyles[tone],
        ...style,
      }}
    >
      {children}
    </GlassCard>
  );
}
