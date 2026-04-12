"use client";

import { usePathname, useRouter } from "next/navigation";
import { GlassHeader } from "@/components/ui";
import GlassButton from "@/components/ui/GlassButton";
import Link from "next/link";

export default function AdminHeader() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname?.startsWith("/admin/login")) {
    return null;
  }

  const logout = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.push("/admin/login");
  };

  return (
    <GlassHeader
      title="BOWLING ADMIN"
      navItems={[
        { label: "대회 관리", href: "/admin/tournaments" },
        { label: "지도자 관리", href: "/admin/coaches" },
      ]}
      rightSlot={
        <>
          <Link href="/">
            <GlassButton variant="ghost" size="sm">
              사이트 보기
            </GlassButton>
          </Link>
          <GlassButton variant="secondary" size="sm" onClick={logout}>
            로그아웃
          </GlassButton>
        </>
      }
    />
  );
}
