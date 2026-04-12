import Link from "next/link";
import UserShell from "@/components/user/UserShell";
import TeamSubmissionManager from "@/components/user/TeamSubmissionManager";
import { GlassButton } from "@/components/ui";
import { requireApprovedUserSession } from "@/lib/auth/user-guard";

type Props = {
  params: {
    tournamentId: string;
    divisionId: string;
  };
};

export default async function UserDivisionTeamSubmissionsPage({ params }: Props) {
  await requireApprovedUserSession({ loginRedirectTo: "/login", pendingRedirectTo: "/pending" });

  return (
    <UserShell
      title="팀편성 제출"
      subtitle="선택한 대회와 종별 기준으로 팀편성을 제출하고 승인 상태를 확인합니다."
      style={{ alignItems: "flex-start", paddingTop: "4rem" }}
      footer={(
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Link href={`/tournaments/${params.tournamentId}?manage=1`}>
            <GlassButton variant="ghost">대회 관리로 돌아가기</GlassButton>
          </Link>
        </div>
      )}
    >
      <TeamSubmissionManager
        tournamentId={params.tournamentId}
        divisionId={params.divisionId}
        hideTournamentSelect
        hideDivisionSelect
      />
    </UserShell>
  );
}
