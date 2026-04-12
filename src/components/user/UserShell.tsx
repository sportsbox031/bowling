"use client";

import type { CSSProperties, ReactNode } from "react";

type UserShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  style?: CSSProperties;
};

export default function UserShell({ title, subtitle, children, footer, style }: UserShellProps) {
  return (
    <main
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 64px)",
        padding: "2rem 1rem",
        ...style,
      }}
    >
      <div style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              background: "linear-gradient(135deg, #0f766e, #14b8a6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: 8,
            }}
          >
            {title}
          </h1>
          {subtitle && <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>{subtitle}</p>}
        </div>
        {children}
        {footer ? <div style={{ marginTop: 20 }}>{footer}</div> : null}
      </div>
    </main>
  );
}
