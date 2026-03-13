"use client";

import { usePathname } from "next/navigation";
import { GlassHeader } from "@/components/ui";
import GlassButton from "@/components/ui/GlassButton";
import Link from "next/link";

export default function PublicHeader() {
  const pathname = usePathname();

  // Admin pages have their own header
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <GlassHeader
      title="BOWLING"
      navItems={[
        { label: "대회 목록", href: "/" },
      ]}
      rightSlot={
        <Link href="/admin/login">
          <GlassButton variant="secondary" size="sm">
            관리자 로그인
          </GlassButton>
        </Link>
      }
    />
  );
}
