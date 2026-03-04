import { CSSProperties, InputHTMLAttributes } from "react";

type GlassInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

const inputStyle: CSSProperties = {
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
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#475569",
  marginBottom: 6,
};

export default function GlassInput({ label, style, ...rest }: GlassInputProps) {
  const input = (
    <input
      style={{ ...inputStyle, ...style }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.6)";
        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.15)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.4)";
        e.currentTarget.style.boxShadow = "none";
      }}
      {...rest}
    />
  );

  if (!label) return input;

  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      {input}
    </label>
  );
}
