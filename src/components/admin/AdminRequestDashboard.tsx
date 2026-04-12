"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassButton, GlassCard } from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";
import type { CoachApprovalRow } from "@/components/admin/CoachApprovalTable";

type TournamentOption = {
  id: string;
  title: string;
};

type FivesPendingItem = {
  id: string;
  tournamentId: string;
  tournamentTitle: string;
  divisionId: string;
  divisionTitle?: string;
  teamId: string;
  teamName?: string;
  coachName?: string;
  organizationName?: string;
};

export default function AdminRequestDashboard() {
  const [rows, setRows] = useState<CoachApprovalRow[]>([]);
  const [fivesPendingItems, setFivesPendingItems] = useState<FivesPendingItem[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [coachResponse, tournamentsResponse] = await Promise.all([
          fetch("/api/admin/coaches", { cache: "no-store" }),
          fetch("/api/public/tournaments", { cache: "no-store" }),
        ]);

        if (!coachResponse.ok || !tournamentsResponse.ok) {
          throw new Error("요청 현황을 불러오지 못했습니다.");
        }

        const [coachData, tournamentsData] = await Promise.all([
          coachResponse.json() as Promise<{ rows?: CoachApprovalRow[] }>,
          tournamentsResponse.json() as Promise<{ items?: TournamentOption[] }>,
        ]);

        const tournaments = tournamentsData.items ?? [];
        const pendingResponses = await Promise.all(
          tournaments.map(async (tournament) => {
            const response = await fetch(`/api/admin/approvals/fives-substitutions?tournamentId=${tournament.id}`, {
              cache: "no-store",
            });
            if (!response.ok) {
              return [];
            }
            const data = await response.json() as { items?: Array<Omit<FivesPendingItem, "tournamentId" | "tournamentTitle">> };
            return (data.items ?? []).map((item) => ({
              ...item,
              tournamentId: tournament.id,
              tournamentTitle: tournament.title,
            }));
          }),
        );

        setRows(coachData.rows ?? []);
        setFivesPendingItems(
          pendingResponses
            .flat()
            .sort((a, b) =>
              `${a.tournamentTitle} ${a.divisionTitle ?? ""} ${a.teamName ?? ""}`.localeCompare(
                `${b.tournamentTitle} ${b.divisionTitle ?? ""} ${b.teamName ?? ""}`,
              ),
            ),
        );
        setMessage("");
      } catch (error) {
        setMessage((error as Error).message || "요청 현황을 불러오지 못했습니다.");
      }
    };

    void load();
  }, []);

  const summary = useMemo(() => {
    const pendingUsers = rows.filter((row) => row.status === "PENDING_APPROVAL").length;
    const pendingOrganizations = rows.reduce((count, row) => count + row.pendingOrganizationCount, 0);
    const pendingOrganizationRemovals = rows.reduce((count, row) => count + row.pendingRemovalCount, 0);

    return {
      pendingUsers,
      pendingOrganizations,
      pendingOrganizationRemovals,
    };
  }, [rows]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <GlassCard variant="strong" style={{ display: "grid", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: "#0f172a" }}>운영 대시보드</h1>
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          전역 승인 업무와 대회 운영 진입점을 한 번에 확인할 수 있습니다.
        </p>
      </GlassCard>

      {message ? <StatusBanner tone="error">{message}</StatusBanner> : null}

      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>회원 승인 업무</div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <GlassCard variant="strong" style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>승인 대기 회원</span>
              <strong style={{ fontSize: 28, color: "#0f172a" }}>{summary.pendingUsers}명</strong>
              <Link href="/admin/coaches" style={{ textDecoration: "none" }}>
                <GlassButton size="sm">지도자 관리로 이동</GlassButton>
              </Link>
            </GlassCard>

            <GlassCard variant="strong" style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>승인 대기 단체 요청</span>
              <strong style={{ fontSize: 28, color: "#0f172a" }}>{summary.pendingOrganizations}건</strong>
              <Link href="/admin/coaches" style={{ textDecoration: "none" }}>
                <GlassButton size="sm" variant="secondary">요청 확인하기</GlassButton>
              </Link>
            </GlassCard>

            <GlassCard variant="strong" style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>단체 삭제 요청</span>
              <strong style={{ fontSize: 28, color: "#0f172a" }}>{summary.pendingOrganizationRemovals}건</strong>
              <Link href="/admin/coaches" style={{ textDecoration: "none" }}>
                <GlassButton size="sm" variant="secondary">삭제 요청 확인</GlassButton>
              </Link>
            </GlassCard>
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>대회 운영</div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <GlassCard variant="strong" style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>대회 운영</span>
              <strong style={{ fontSize: 28, color: "#0f172a" }}>바로가기</strong>
              <Link href="/admin/tournaments" style={{ textDecoration: "none" }}>
                <GlassButton size="sm" variant="secondary">대회 관리로 이동</GlassButton>
              </Link>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
