"use client";

import { CSSProperties, ReactNode } from "react";

type PageTitleProps = {
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  style?: CSSProperties;
};

export default function PageTitle({ title, description, meta, actions, style }: PageTitleProps) {
  return (
    <div style={{ marginBottom: 24, ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: description || meta ? 8 : 0,
            }}
          >
            {title}
          </h1>
          {description && <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>{description}</p>}
          {meta && <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>{meta}</div>}
        </div>
        {actions}
      </div>
    </div>
  );
}
