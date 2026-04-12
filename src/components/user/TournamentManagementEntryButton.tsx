"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import GlassButton from "@/components/ui/GlassButton";

type SessionState = {
  userActive?: boolean;
  adminActive?: boolean;
  userApproved?: boolean;
};

export default function TournamentManagementEntryButton({ tournamentId }: { tournamentId: string }) {
  const [sessionState, setSessionState] = useState<SessionState>({});
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/session-state", { cache: "no-store", credentials: "include" });
        const data = response.ok ? await response.json() as SessionState : {};
        if (!cancelled) {
          setSessionState(data);
        }
      } catch {
        if (!cancelled) {
          setSessionState({});
        }
      } finally {
        if (!cancelled) {
          setResolved(true);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!resolved) {
    return null;
  }

  if (sessionState.adminActive) {
    return (
      <Link href={`/admin/tournaments/${tournamentId}`}>
        <GlassButton size="lg">관리자 대회관리</GlassButton>
      </Link>
    );
  }

  if (sessionState.userActive && sessionState.userApproved) {
    return (
      <Link href={`/user/tournaments/${tournamentId}`}>
        <GlassButton size="lg">대회관리</GlassButton>
      </Link>
    );
  }

  return (
    <Link href={`/login?next=${encodeURIComponent(`/user/tournaments/${tournamentId}`)}`}>
      <GlassButton size="lg" variant="secondary">로그인 후 대회관리</GlassButton>
    </Link>
  );
}
