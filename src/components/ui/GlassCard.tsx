import { CSSProperties, ReactNode } from "react";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  variant?: "default" | "strong" | "subtle";
  hover?: boolean;
  onClick?: () => void;
};

const variantStyles: Record<string, CSSProperties> = {
  default: {
    background: "rgba(255, 255, 255, 0.25)",
    border: "1px solid rgba(255, 255, 255, 0.35)",
  },
  strong: {
    background: "rgba(255, 255, 255, 0.4)",
    border: "1px solid rgba(255, 255, 255, 0.5)",
  },
  subtle: {
    background: "rgba(255, 255, 255, 0.15)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
  },
};

export default function GlassCard({
  children,
  style,
  variant = "default",
  hover = false,
  onClick,
}: GlassCardProps) {
  const base: CSSProperties = {
    ...variantStyles[variant],
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    borderRadius: 16,
    padding: "1.25rem",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
    transition: "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s ease",
    cursor: onClick ? "pointer" : undefined,
    ...style,
  };

  return (
    <div
      style={base}
      onClick={onClick}
      onMouseEnter={
        hover
          ? (e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 12px 40px rgba(0, 0, 0, 0.12)";
            }
          : undefined
      }
      onMouseLeave={
        hover
          ? (e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.08)";
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
