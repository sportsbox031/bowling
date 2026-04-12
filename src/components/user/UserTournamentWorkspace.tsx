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

type TournamentDetail = {
  tournament?: {
    id: string;
    title: string;
    seasonYear: number;
    region: string;
  };
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

export default function UserTournamentWorkspace({ tournamentId }: { tournamentId: string }) {
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [playerSubmissions, setPlayerSubmissions] = useState<PlayerSubmission[]>([]);
  const [fivesSubstitutionSummary, setFivesSubstitutionSummary] = useState<FivesSubstitutionSummary | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [detailData, submissionData, substitutionData] = await Promise.all([
          cachedFetch<TournamentDetail>(`/api/public/tournaments/${tournamentId}`, 120000),
          fetch(`/api/user/tournaments/${tournamentId}/player-submissions`, {
            cache: "no-store",
            credentials: "include",
          }).then(async (response) => {
            if (!response.ok) {
              throw new Error("대회관리 정보를 불러오지 못했습니다.");
            }
            return response.json() as Promise<{ items?: PlayerSubmission[] }>;
          }),
          fetch(`/api/user/tournaments/${tournamentId}/fives-substitutions`, {
            cache: "no-store",
            credentials: "include",
          }).then(async (response) => {
            if (!response.ok) {
              throw new Error("후반 교체 상태를 불러오지 못했습니다.");
            }
            return response.json() as Promise<{ summary?: FivesSubstitutionSummary }>;
          }),
        ]);

        if (cancelled) return;
        setDetail(detailData);
        setPlayerSubmissions(submissionData.items ?? []);
        setFivesSubstitutionSummary(substitutionData.summary ?? null);
        setMessage("");
      } catch (error) {
        if (!cancelled) {
          setMessage((error as Error).message || "대회관리 정보를 불러오지 못했습니다.");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  if (message) {
    return <StatusBanner tone="error">{message}</StatusBanner>;
  }

  const teamPrerequisite = getTournamentTeamSubmissionPrerequisite(playerSubmissions);
  const canOpenTeamSubmission = teamPrerequisite.status === "ready";
  const fivesSubstitutionPrerequisite = getTournamentFivesSubstitutionPrerequisite(fivesSubstitutionSummary);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <GlassCard variant="strong" style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <strong style={{ color: "#1e293b", fontSize: 20 }}>{detail?.tournament?.title ?? "대회"}</strong>
          {detail?.tournament ? (
            <span style={{ fontSize: 13, color: "#64748b" }}>
              {detail.tournament.seasonYear}년 · {detail.tournament.region}
            </span>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <div
            style={{
              display: "grid",
              gap: 10,
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(148,163,184,0.18)",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <strong style={{ color: "#1e293b" }}>선수등록 제출</strong>
              <span style={{ fontSize: 13, color: "#64748b" }}>
                이 대회에 출전할 선수를 등록하고 승인 상태를 확인합니다.
              </span>
            </div>
            <div>
              <Link href={`/user/tournaments/${tournamentId}/player-submissions`}>
                <GlassButton size="sm">선수등록 제출</GlassButton>
              </Link>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(148,163,184,0.18)",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <strong style={{ color: "#1e293b" }}>팀편성 제출</strong>
              <span style={{ fontSize: 13, color: "#64748b" }}>
                선수등록 승인 후 등록된 선수들로 팀편성을 제출합니다.
              </span>
            </div>
            <div>
              {canOpenTeamSubmission ? (
                <Link href={`/user/tournaments/${tournamentId}/team-submissions`}>
                  <GlassButton size="sm" variant="secondary">팀편성 제출</GlassButton>
                </Link>
              ) : (
                <GlassButton size="sm" variant="secondary" disabled>
                  팀편성 제출
                </GlassButton>
              )}
            </div>
            {!canOpenTeamSubmission ? (
              <span style={{ fontSize: 12, color: "#b45309" }}>{teamPrerequisite.message}</span>
            ) : null}
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(148,163,184,0.18)",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <strong style={{ color: "#1e293b" }}>후반 교체 제출</strong>
              <span style={{ fontSize: 13, color: "#64748b" }}>
                5인조 승인 팀의 후반 교체를 확인하고, 오픈된 경우 후반 출전 5명을 제출합니다.
              </span>
            </div>
            <div>
              {fivesSubstitutionPrerequisite.canOpenPage ? (
                <Link href={`/user/tournaments/${tournamentId}/fives-substitutions`}>
                  <GlassButton size="sm" variant="secondary">후반 교체 제출</GlassButton>
                </Link>
              ) : (
                <GlassButton size="sm" variant="secondary" disabled>
                  후반 교체 제출
                </GlassButton>
              )}
            </div>
            {fivesSubstitutionPrerequisite.message ? (
              <span style={{ fontSize: 12, color: "#b45309" }}>{fivesSubstitutionPrerequisite.message}</span>
            ) : null}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
