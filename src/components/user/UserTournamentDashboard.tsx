"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GlassButton, GlassCard } from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";
import { cachedFetch } from "@/lib/client-cache";
import {
  getTournamentFivesSubstitutionPrerequisite,
  getTournamentTeamSubmissionPrerequisite,
} from "@/lib/user-flow";

type TournamentItem = {
  id: string;
  title: string;
  seasonYear: number;
  region: string;
};

type PlayerSubmission = {
  id: string;
  divisionId: string;
  status: string;
};

type FivesSubstitutionSummary = {
  approvedTeamCount: number;
  readyCount: number;
  submittedCount: number;
  approvedCount: number;
  rejectedCount: number;
};

type StepStatus = {
  label: string;
  text: string;
  color: string;
};

type TournamentProgress = {
  player: StepStatus;
  team: StepStatus;
  fives: StepStatus;
};

function getPlayerStatus(submissions: PlayerSubmission[]): StepStatus {
  if (submissions.some((s) => s.status === "APPROVED")) {
    return { label: "선수등록", text: "승인됨", color: "#16a34a" };
  }
  if (submissions.some((s) => ["SUBMITTED", "PENDING", "UNDER_REVIEW"].includes(s.status))) {
    return { label: "선수등록", text: "검토중", color: "#d97706" };
  }
  return { label: "선수등록", text: "미제출", color: "#94a3b8" };
}

function getTeamStatus(submissions: PlayerSubmission[]): StepStatus {
  const prereq = getTournamentTeamSubmissionPrerequisite(submissions);
  if (prereq.status === "ready") return { label: "팀편성", text: "진행가능", color: "#16a34a" };
  if (prereq.status === "pending") return { label: "팀편성", text: "대기중", color: "#d97706" };
  return { label: "팀편성", text: "잠김", color: "#94a3b8" };
}

function getFivesStatus(summary: FivesSubstitutionSummary | null): StepStatus {
  const prereq = getTournamentFivesSubstitutionPrerequisite(summary);
  if (prereq.status === "ready") return { label: "후반교체", text: "진행가능", color: "#16a34a" };
  if (prereq.status === "submitted") return { label: "후반교체", text: "제출완료", color: "#2563eb" };
  if (prereq.status === "waiting") return { label: "후반교체", text: "대기중", color: "#d97706" };
  return { label: "후반교체", text: "잠김", color: "#94a3b8" };
}

function ProgressBadge({ step }: { step: StepStatus }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
      <span style={{ color: "#64748b" }}>{step.label}</span>
      <span
        style={{
          display: "inline-block",
          padding: "1px 7px",
          borderRadius: 9999,
          background: step.color,
          color: "#fff",
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.02em",
        }}
      >
        {step.text}
      </span>
    </span>
  );
}

function SkeletonCard() {
  return (
    <GlassCard variant="strong" style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <div className="skeleton" style={{ width: "55%", height: 22, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: "30%", height: 16, borderRadius: 6 }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div className="skeleton" style={{ width: 80, height: 20, borderRadius: 9999 }} />
        <div className="skeleton" style={{ width: 80, height: 20, borderRadius: 9999 }} />
        <div className="skeleton" style={{ width: 80, height: 20, borderRadius: 9999 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div className="skeleton" style={{ width: 100, height: 32, borderRadius: 10 }} />
      </div>
    </GlassCard>
  );
}

export default function UserTournamentDashboard() {
  const [items, setItems] = useState<TournamentItem[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, TournamentProgress>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await cachedFetch<{ items?: TournamentItem[] }>("/api/public/tournaments", 120000);
        setItems(data.items ?? []);
      } catch (error) {
        setMessage((error as Error).message || "대회 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (items.length === 0) return;

    const loadProgress = async () => {
      const results = await Promise.allSettled(
        items.map(async (item) => {
          const [playerRes, fivesRes] = await Promise.all([
            fetch(`/api/user/tournaments/${item.id}/player-submissions`, {
              cache: "no-store",
              credentials: "include",
            }).then((r) => (r.ok ? (r.json() as Promise<{ items?: PlayerSubmission[] }>) : { items: [] })),
            fetch(`/api/user/tournaments/${item.id}/fives-substitutions`, {
              cache: "no-store",
              credentials: "include",
            }).then((r) => (r.ok ? (r.json() as Promise<{ summary?: FivesSubstitutionSummary }>) : { summary: undefined })),
          ]);

          const submissions = playerRes.items ?? [];
          const summary = fivesRes.summary ?? null;

          return {
            id: item.id,
            progress: {
              player: getPlayerStatus(submissions),
              team: getTeamStatus(submissions),
              fives: getFivesStatus(summary),
            },
          };
        }),
      );

      const map: Record<string, TournamentProgress> = {};
      for (const result of results) {
        if (result.status === "fulfilled") {
          map[result.value.id] = result.value.progress;
        }
      }
      setProgressMap(map);
    };

    void loadProgress();
  }, [items]);

  if (loading) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (message) {
    return <StatusBanner tone="error">{message}</StatusBanner>;
  }

  if (items.length === 0) {
    return <StatusBanner tone="info">현재 등록된 대회가 없습니다.</StatusBanner>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Link href="/user/notifications">
          <GlassButton size="sm" variant="ghost">🔔 알림 내역</GlassButton>
        </Link>
      </div>
      {items.map((item) => {
        const progress = progressMap[item.id];
        return (
          <GlassCard key={item.id} variant="strong" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <strong style={{ color: "#1e293b", fontSize: 18 }}>{item.title}</strong>
              <span style={{ fontSize: 13, color: "#64748b" }}>
                {item.seasonYear}년 · {item.region}
              </span>
            </div>
            {progress ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <ProgressBadge step={progress.player} />
                <ProgressBadge step={progress.team} />
                <ProgressBadge step={progress.fives} />
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <div className="skeleton" style={{ width: 80, height: 20, borderRadius: 9999 }} />
                <div className="skeleton" style={{ width: 80, height: 20, borderRadius: 9999 }} />
                <div className="skeleton" style={{ width: 80, height: 20, borderRadius: 9999 }} />
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Link href={`/user/tournaments/${item.id}`}>
                <GlassButton size="sm">제출 현황 보기</GlassButton>
              </Link>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
