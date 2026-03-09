"use client";

import { ChangeEventHandler, CSSProperties } from "react";
import { GlassCard, GlassInput } from "@/components/ui";

type SearchFieldProps = {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onClear?: () => void;
  placeholder: string;
  helperText?: string;
  style?: CSSProperties;
};

export default function SearchField({
  value,
  onChange,
  onClear,
  placeholder,
  helperText,
  style,
}: SearchFieldProps) {
  return (
    <GlassCard variant="strong" style={{ marginBottom: 16, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 16 }}>&#x1F50D;</span>
        <GlassInput value={value} onChange={onChange} placeholder={placeholder} style={{ flex: 1 }} />
        {value && (
          <button
            type="button"
            onClick={onClear}
            aria-label="검색어 지우기"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              fontSize: 18,
              lineHeight: 1,
              padding: "0 4px",
            }}
          >
            &#x2715;
          </button>
        )}
      </div>
      {helperText && (
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6366f1" }}>{helperText}</p>
      )}
    </GlassCard>
  );
}
