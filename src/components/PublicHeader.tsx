"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { GlassHeader } from "@/components/ui";
import GlassButton from "@/components/ui/GlassButton";
import Link from "next/link";
import { getPublicHeaderState } from "@/lib/user-flow";

export default function PublicHeader() {
  const pathname = usePathname();
  const [userSessionActive, setUserSessionActive] = useState(false);
  const [adminSessionActive, setAdminSessionActive] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadSessions = async () => {
      try {
        const response = await fetch("/api/session-state", { cache: "no-store", credentials: "include" });
        const data = response.ok
          ? await response.json() as { userActive?: boolean; adminActive?: boolean }
          : { userActive: false, adminActive: false };

        if (cancelled) return;
        setUserSessionActive(Boolean(data.userActive));
        setAdminSessionActive(Boolean(data.adminActive));
      } catch {
        if (cancelled) return;
        setUserSessionActive(false);
        setAdminSessionActive(false);
      } finally {
        if (!cancelled) {
          setAuthResolved(true);
        }
      }
    };

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const logout = async () => {
    await Promise.all([
      fetch("/api/user/session", { method: "DELETE" }),
      fetch("/api/admin/session", { method: "DELETE" }),
    ]);
    setUserSessionActive(false);
    setAdminSessionActive(false);
    setAuthResolved(true);
    window.location.href = "/";
  };

  const headerState = getPublicHeaderState({
    authResolved,
    userSessionActive,
    adminSessionActive,
  });

  // Admin pages have their own header
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const hideAuthButtons = pathname === "/login" || pathname === "/signup";

  return (
    <GlassHeader
      title="BOWLING"
      navItems={[
        { label: "대회 목록", href: "/" },
      ]}
      rightSlot={
        <div style={{ display: "flex", gap: 8 }}>
          {hideAuthButtons ? null : (
            <>
          {headerState.showSignup ? (
            <Link href="/signup">
              <GlassButton variant="ghost" size="sm">
                회원가입
              </GlassButton>
            </Link>
          ) : null}
          {headerState.dashboardHref && headerState.dashboardLabel ? (
              <Link href={headerState.dashboardHref}>
                <GlassButton variant="secondary" size="sm">
                  {headerState.dashboardLabel}
                </GlassButton>
              </Link>
          ) : null}
          {headerState.accountHref && headerState.accountLabel ? (
              <Link href={headerState.accountHref}>
                <GlassButton variant="secondary" size="sm">
                  {headerState.accountLabel}
                </GlassButton>
              </Link>
          ) : null}
          {headerState.showLogin ? (
              <Link href="/login">
                <GlassButton variant="secondary" size="sm">
                  로그인
                </GlassButton>
              </Link>
          ) : null}
          {headerState.showLogout ? (
              <GlassButton variant="ghost" size="sm" onClick={logout}>
                로그아웃
              </GlassButton>
          ) : null}
            </>
          )}
        </div>
      }
    />
  );
}
