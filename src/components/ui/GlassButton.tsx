import { ButtonHTMLAttributes, CSSProperties } from "react";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
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

const spinnerStyle: CSSProperties = {
  display: "inline-block",
  width: 14,
  height: 14,
  borderRadius: "50%",
  border: "2px solid rgba(255, 255, 255, 0.35)",
  borderTopColor: "currentColor",
  animation: "spin 0.7s linear infinite",
  verticalAlign: "middle",
  marginRight: 6,
  flexShrink: 0,
};

export default function GlassButton({
  variant = "primary",
  size = "md",
  style,
  disabled,
  isLoading,
  children,
  ...rest
}: GlassButtonProps) {
  const isDisabled = disabled || isLoading;
  const base: CSSProperties = {
    ...variantStyles[variant],
    ...sizeStyles[size],
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderRadius: 10,
    fontWeight: 600,
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isDisabled ? 0.6 : 1,
    transition: "transform 0.12s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.12s ease, opacity 0.12s ease",
    fontFamily: "inherit",
    letterSpacing: "-0.01em",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...style,
  };

  return (
    <button
      style={base}
      disabled={isDisabled}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.15)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
      onMouseDown={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.transform = "scale(0.97)";
          e.currentTarget.style.boxShadow = "none";
        }
      }}
      onMouseUp={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.15)";
        }
      }}
      {...rest}
    >
      {isLoading && <span style={spinnerStyle} aria-hidden="true" />}
      {children}
    </button>
  );
}
