"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UserShell from "@/components/user/UserShell";
import { GlassButton, GlassCard } from "@/components/ui";

interface NotificationItem {
  id: string;
  message: string;
  type: string;
  targetType: string;
  tournamentId: string;
  createdAt: string;
  read: boolean;
}

const TYPE_ICON: Record<string, string> = {
  SUBMISSION_APPROVED: "✅",
  SUBMISSION_REJECTED: "❌",
};

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/notifications", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json() as { items?: NotificationItem[] };
        setItems(data.items ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    const unread = items.filter((n) => !n.read);
    if (unread.length === 0) return;
    await fetch("/api/user/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: unread.map((n) => n.id) }),
    }).catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <UserShell
      title="알림"
      subtitle="승인/반려 결과를 확인합니다."
      maxWidth={600}
      footer={
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Link href="/user">
            <GlassButton variant="ghost">← 대시보드로</GlassButton>
          </Link>
        </div>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        {items.some((n) => !n.read) && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <GlassButton size="sm" variant="secondary" onClick={() => void markAllRead()}>
              모두 읽음 처리
            </GlassButton>
          </div>
        )}

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12 }} />
          ))
        ) : items.length === 0 ? (
          <GlassCard variant="subtle" style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
            새 알림이 없습니다.
          </GlassCard>
        ) : (
          items.map((n) => (
            <GlassCard
              key={n.id}
              variant={n.read ? "subtle" : "strong"}
              style={{
                padding: "14px 16px",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                opacity: n.read ? 0.7 : 1,
              }}
            >
              <span style={{ fontSize: 20, flexShrink: 0 }}>{TYPE_ICON[n.type] ?? "🔔"}</span>
              <div style={{ flex: 1, display: "grid", gap: 4 }}>
                <span style={{ fontSize: 14, color: "#1e293b" }}>{n.message}</span>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{formatDate(n.createdAt)}</span>
                {n.tournamentId && (
                  <Link href={`/user/tournaments/${n.tournamentId}`} style={{ fontSize: 12, color: "#6366f1" }}>
                    대회로 이동 →
                  </Link>
                )}
              </div>
              {!n.read && (
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", flexShrink: 0, marginTop: 4 }} />
              )}
            </GlassCard>
          ))
        )}
      </div>
    </UserShell>
  );
}
