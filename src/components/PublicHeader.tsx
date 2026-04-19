"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { GlassHeader } from "@/components/ui";
import GlassButton from "@/components/ui/GlassButton";
import Link from "next/link";
import { getPublicHeaderState } from "@/lib/user-flow";

interface NotificationItem {
  id: string;
  message: string;
  type: string;
  createdAt: string;
  read: boolean;
}

export default function PublicHeader() {
  const pathname = usePathname();
  const [userSessionActive, setUserSessionActive] = useState(false);
  const [adminSessionActive, setAdminSessionActive] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

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

  // 알림 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!notifOpen) return;
    const close = () => setNotifOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [notifOpen]);

  // 사용자 세션이 활성화된 경우 알림 로드
  useEffect(() => {
    if (!userSessionActive) {
      setNotifications([]);
      return;
    }
    fetch("/api/user/notifications", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { items?: NotificationItem[] };
        setNotifications(data.items ?? []);
      })
      .catch(() => {});
  }, [userSessionActive, pathname]);

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    await fetch("/api/user/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: unread.map((n) => n.id) }),
    }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

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
        <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative" }}>
          {userSessionActive && !hideAuthButtons && (
            <div style={{ position: "relative" }}>
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNotifOpen((prev) => !prev);
                  if (!notifOpen) void markAllRead();
                }}
                style={{ position: "relative" }}
              >
                🔔
                {notifications.length > 0 && (
                  <span style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#ef4444",
                    border: "1.5px solid #fff",
                  }} />
                )}
              </GlassButton>
              {notifOpen && (
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: 300,
                  background: "rgba(255,255,255,0.98)",
                  backdropFilter: "blur(12px)",
                  borderRadius: 14,
                  border: "1px solid rgba(148,163,184,0.2)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                  zIndex: 9999,
                  overflow: "hidden",
                }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(241,245,249,0.8)", fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
                    알림
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: "20px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                      새 알림이 없습니다.
                    </div>
                  ) : (
                    <div style={{ maxHeight: 300, overflowY: "auto" }}>
                      {notifications.map((n) => (
                        <div key={n.id} style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid rgba(241,245,249,0.8)",
                          background: n.read ? "transparent" : "rgba(99,102,241,0.04)",
                        }}>
                          <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>{n.message}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                            {new Date(n.createdAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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
