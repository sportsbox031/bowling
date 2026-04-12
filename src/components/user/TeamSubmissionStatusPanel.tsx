"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassBadge, GlassCard } from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";
import { cachedFetch } from "@/lib/client-cache";
import { getTeamSubmissionPrerequisite } from "@/lib/user-flow";

type DivisionItem = {
  id: string;
  title: string;
  gender: "M" | "F" | "MIXED";
};

type TournamentDetail = {
  divisions?: DivisionItem[];
};

type PlayerSubmission = {
  id: string;
  divisionId: string;
  status: string;
};

const genderLabel: Record<DivisionItem["gender"], string> = {
  M: "남자",
  F: "여자",
  MIXED: "혼합",
};

const prerequisiteBadge = (status: "ready" | "pending" | "missing") => {
  if (status === "ready") {
    return <GlassBadge variant="success">팀편성 가능</GlassBadge>;
  }

  if (status === "pending") {
    return <GlassBadge variant="warning">선수등록 승인 대기</GlassBadge>;
  }

  return <GlassBadge variant="info">선수등록 필요</GlassBadge>;
};

export default function TeamSubmissionStatusPanel({ tournamentId }: { tournamentId: string }) {
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [playerSubmissions, setPlayerSubmissions] = useState<PlayerSubmission[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [detailData, submissionData] = await Promise.all([
          cachedFetch<TournamentDetail>(`/api/public/tournaments/${tournamentId}`, 120000),
          fetch(`/api/user/tournaments/${tournamentId}/player-submissions`, {
            cache: "no-store",
            credentials: "include",
          }).then(async (response) => {
            if (!response.ok) {
              throw new Error("팀편성 가능 상태를 불러오지 못했습니다.");
            }
            return response.json() as Promise<{ items?: PlayerSubmission[] }>;
          }),
        ]);

        if (cancelled) return;
        setDetail(detailData);
        setPlayerSubmissions(submissionData.items ?? []);
        setMessage("");
      } catch (error) {
        if (!cancelled) {
          setMessage((error as Error).message || "팀편성 가능 상태를 불러오지 못했습니다.");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  const divisions = useMemo(() => detail?.divisions ?? [], [detail]);

  if (message) {
    return <StatusBanner tone="error">{message}</StatusBanner>;
  }

  if (divisions.length === 0) {
    return null;
  }

  return (
    <GlassCard variant="strong" style={{ display: "grid", gap: 12 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, color: "#1e293b" }}>종별별 팀편성 가능 상태</h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>
          선수등록 승인 여부에 따라 팀편성 가능 상태가 달라집니다.
        </p>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {divisions.map((division) => {
          const prerequisite = getTeamSubmissionPrerequisite(playerSubmissions, division.id);

          return (
            <div
              key={division.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.55)",
                border: "1px solid rgba(148,163,184,0.18)",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <strong style={{ color: "#1e293b" }}>{division.title}</strong>
                <span style={{ fontSize: 12, color: "#64748b" }}>{genderLabel[division.gender] ?? division.gender}</span>
              </div>
              <div style={{ display: "grid", justifyItems: "end", gap: 8 }}>
                {prerequisiteBadge(prerequisite.status)}
                <span style={{ fontSize: 12, color: "#64748b", textAlign: "right" }}>
                  {prerequisite.message || "제출 가능합니다."}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
