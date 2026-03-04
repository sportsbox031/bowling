import { CSSProperties, ReactNode } from "react";

type GlassBadgeProps = {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "info" | "danger";
  style?: CSSProperties;
};

const variantStyles: Record<string, CSSProperties> = {
  default: {
    background: "rgba(100, 116, 139, 0.15)",
    color: "#475569",
    border: "1px solid rgba(100, 116, 139, 0.2)",
  },
  success: {
    background: "rgba(34, 197, 94, 0.15)",
    color: "#16a34a",
    border: "1px solid rgba(34, 197, 94, 0.25)",
  },
  warning: {
    background: "rgba(245, 158, 11, 0.15)",
    color: "#d97706",
    border: "1px solid rgba(245, 158, 11, 0.25)",
  },
  info: {
    background: "rgba(99, 102, 241, 0.15)",
    color: "#6366f1",
    border: "1px solid rgba(99, 102, 241, 0.25)",
  },
  danger: {
    background: "rgba(239, 68, 68, 0.15)",
    color: "#dc2626",
    border: "1px solid rgba(239, 68, 68, 0.25)",
  },
};

export default function GlassBadge({ children, variant = "default", style }: GlassBadgeProps) {
  const base: CSSProperties = {
    ...variantStyles[variant],
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.02em",
    ...style,
  };

  return <span style={base}>{children}</span>;
}
