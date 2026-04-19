import Link from "next/link";
import UserShell from "@/components/user/UserShell";
import TeamSubmissionManager from "@/components/user/TeamSubmissionManager";
import TeamSubmissionStatusPanel from "@/components/user/TeamSubmissionStatusPanel";
import { GlassButton } from "@/components/ui";
import { requireApprovedUserSession } from "@/lib/auth/user-guard";

type Props = {
  params: {
    tournamentId: string;
  };
};

export default async function UserTournamentTeamSubmissionsPage({ params }: Props) {
  await requireApprovedUserSession({ loginRedirectTo: "/login", pendingRedirectTo: "/pending" });

  return (
    <UserShell
      title="팀편성 제출"
      subtitle="이 대회의 종별과 종목을 선택해 팀편성을 제출합니다."
      style={{ alignItems: "flex-start", paddingTop: "4rem" }}
      footer={(
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Link href={`/user/tournaments/${params.tournamentId}`}>
            <GlassButton variant="ghost">← 대회 제출 현황으로</GlassButton>
          </Link>
        </div>
      )}
    >
      <div style={{ display: "grid", gap: 16, width: "100%" }}>
        <TeamSubmissionStatusPanel tournamentId={params.tournamentId} />
        <TeamSubmissionManager
          tournamentId={params.tournamentId}
          hideTournamentSelect
        />
      </div>
    </UserShell>
  );
}
