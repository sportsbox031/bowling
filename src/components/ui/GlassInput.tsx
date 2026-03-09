import { CSSProperties, FocusEvent, InputHTMLAttributes } from "react";

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

export default function GlassInput({ label, style, onFocus, onBlur, ...rest }: GlassInputProps) {
  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    event.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.6)";
    event.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.15)";
    onFocus?.(event);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    event.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.4)";
    event.currentTarget.style.boxShadow = "none";
    onBlur?.(event);
  };

  const input = <input style={{ ...inputStyle, ...style }} onFocus={handleFocus} onBlur={handleBlur} {...rest} />;

  if (!label) return input;

  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      {input}
    </label>
  );
}
