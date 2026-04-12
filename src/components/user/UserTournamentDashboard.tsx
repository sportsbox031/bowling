"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GlassButton, GlassCard } from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";
import { cachedFetch } from "@/lib/client-cache";

type TournamentItem = {
  id: string;
  title: string;
  seasonYear: number;
  region: string;
};

export default function UserTournamentDashboard() {
  const [items, setItems] = useState<TournamentItem[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await cachedFetch<{ items?: TournamentItem[] }>("/api/public/tournaments", 120000);
        setItems(data.items ?? []);
      } catch (error) {
        setMessage((error as Error).message || "대회 목록을 불러오지 못했습니다.");
      }
    };

    void load();
  }, []);

  if (message) {
    return <StatusBanner tone="error">{message}</StatusBanner>;
  }

  if (items.length === 0) {
    return <StatusBanner tone="info">현재 등록된 대회가 없습니다.</StatusBanner>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((item) => (
        <GlassCard key={item.id} variant="strong" style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <strong style={{ color: "#1e293b", fontSize: 18 }}>{item.title}</strong>
            <span style={{ fontSize: 13, color: "#64748b" }}>
              {item.seasonYear}년 · {item.region}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Link href={`/user/tournaments/${item.id}`}>
              <GlassButton size="sm">대회 관리로 이동</GlassButton>
            </Link>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
