import { CSSProperties, SelectHTMLAttributes } from "react";

type GlassSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
};

const selectStyle: CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "rgba(255, 255, 255, 0.3)",
  border: "1px solid rgba(255, 255, 255, 0.4)",
  borderRadius: 10,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  fontSize: 14,
  color: "#1e293b",
  outline: "none",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  fontFamily: "inherit",
  cursor: "pointer",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23475569' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 36,
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#475569",
  marginBottom: 6,
};

export default function GlassSelect({ label, style, children, ...rest }: GlassSelectProps) {
  const select = (
    <select
      style={{ ...selectStyle, ...style }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.6)";
        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.15)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.4)";
        e.currentTarget.style.boxShadow = "none";
      }}
      {...rest}
    >
      {children}
    </select>
  );

  if (!label) return select;

  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      {select}
    </label>
  );
}
