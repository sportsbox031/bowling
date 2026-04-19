"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GlassHeader } from "@/components/ui";
import GlassButton from "@/components/ui/GlassButton";
import Link from "next/link";

export default function AdminHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  if (pathname?.startsWith("/admin/login")) {
    return null;
  }

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/session", { method: "DELETE" });
      router.push("/admin/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <GlassHeader
      title="BOWLING ADMIN"
      navItems={[
        { label: "대시보드", href: "/admin" },
        { label: "대회 관리", href: "/admin/tournaments" },
        { label: "지도자 관리", href: "/admin/coaches" },
        { label: "감사 로그", href: "/admin/audit-logs" },
      ]}
      rightSlot={
        <>
          <Link href="/">
            <GlassButton variant="ghost" size="sm">
              사이트 보기
            </GlassButton>
          </Link>
          <GlassButton variant="secondary" size="sm" onClick={logout} isLoading={loggingOut} disabled={loggingOut}>
            로그아웃
          </GlassButton>
        </>
      }
    />
  );
}
