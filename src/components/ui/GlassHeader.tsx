"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CSSProperties } from "react";

type NavItem = {
  label: string;
  href: string;
};

type GlassHeaderProps = {
  title: string;
  navItems?: NavItem[];
  rightSlot?: React.ReactNode;
};

const headerStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.2)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.3)",
  padding: "0 1.5rem",
  position: "sticky",
  top: 0,
  zIndex: 100,
  boxShadow: "0 4px 24px rgba(0, 0, 0, 0.06)",
};

const innerStyle: CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  height: 64,
  gap: 24,
};

const titleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  textDecoration: "none",
  letterSpacing: "-0.02em",
};

const navStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const linkBase: CSSProperties = {
  padding: "6px 14px",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 500,
  textDecoration: "none",
  color: "#475569",
  transition: "all 0.2s ease",
};

const linkActive: CSSProperties = {
  ...linkBase,
  background: "rgba(99, 102, 241, 0.12)",
  color: "#6366f1",
  fontWeight: 600,
};

export default function GlassHeader({ title, navItems = [], rightSlot }: GlassHeaderProps) {
  const pathname = usePathname();

  return (
    <header style={headerStyle}>
      <div style={innerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={titleStyle}>
            {title}
          </Link>
          {navItems.length > 0 && (
            <nav style={navStyle}>
              {navItems.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={active ? linkActive : linkBase}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "rgba(99, 102, 241, 0.06)";
                        e.currentTarget.style.color = "#6366f1";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#475569";
                      }
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
        {rightSlot && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{rightSlot}</div>}
      </div>
    </header>
  );
}
