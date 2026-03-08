import { CSSProperties, ReactNode } from "react";

type Align = "left" | "center" | "right";

type GlassTableProps = {
  headers: string[];
  headerAligns?: Align[];
  children: ReactNode;
  emptyMessage?: string;
  rowCount?: number;
};

const wrapperStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.2)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  borderRadius: 16,
  border: "1px solid rgba(255, 255, 255, 0.3)",
  overflow: "hidden",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const thStyle: CSSProperties = {
  padding: "12px 14px",
  textAlign: "left",
  fontWeight: 700,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#475569",
  background: "rgba(255, 255, 255, 0.3)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.3)",
  whiteSpace: "nowrap",
};

export const glassTdStyle: CSSProperties = {
  padding: "10px 14px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
  color: "#1e293b",
  whiteSpace: "nowrap",
};

export const glassTrHoverProps = {
  onMouseEnter: (e: React.MouseEvent<HTMLTableRowElement>) => {
    e.currentTarget.style.background = "rgba(99, 102, 241, 0.06)";
  },
  onMouseLeave: (e: React.MouseEvent<HTMLTableRowElement>) => {
    e.currentTarget.style.background = "transparent";
  },
};

export default function GlassTable({
  headers,
  headerAligns,
  children,
  emptyMessage = "데이터가 없습니다.",
  rowCount = 0,
}: GlassTableProps) {
  return (
    <div style={{ overflowX: "auto", ...wrapperStyle }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th key={header} style={{ ...thStyle, textAlign: headerAligns?.[i] ?? "left" }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
          {rowCount === 0 && (
            <tr>
              <td
                colSpan={headers.length}
                style={{ ...glassTdStyle, textAlign: "center", padding: "2rem", color: "#94a3b8" }}
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
