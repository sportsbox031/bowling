import { ButtonHTMLAttributes, CSSProperties } from "react";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
};

const variantStyles: Record<string, CSSProperties> = {
  primary: {
    background: "linear-gradient(135deg, rgba(99, 102, 241, 0.85), rgba(139, 92, 246, 0.85))",
    color: "#fff",
    border: "1px solid rgba(255, 255, 255, 0.3)",
  },
  secondary: {
    background: "rgba(255, 255, 255, 0.25)",
    color: "#1e293b",
    border: "1px solid rgba(255, 255, 255, 0.4)",
  },
  danger: {
    background: "linear-gradient(135deg, rgba(239, 68, 68, 0.8), rgba(220, 38, 38, 0.8))",
    color: "#fff",
    border: "1px solid rgba(255, 255, 255, 0.2)",
  },
  ghost: {
    background: "transparent",
    color: "#475569",
    border: "1px solid transparent",
  },
};

const sizeStyles: Record<string, CSSProperties> = {
  sm: { padding: "6px 14px", fontSize: 13 },
  md: { padding: "10px 20px", fontSize: 14 },
  lg: { padding: "12px 28px", fontSize: 16 },
};

export default function GlassButton({
  variant = "primary",
  size = "md",
  style,
  disabled,
  children,
  ...rest
}: GlassButtonProps) {
  const base: CSSProperties = {
    ...variantStyles[variant],
    ...sizeStyles[size],
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderRadius: 10,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "all 0.2s ease",
    fontFamily: "inherit",
    letterSpacing: "-0.01em",
    ...style,
  };

  return (
    <button
      style={base}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.15)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
