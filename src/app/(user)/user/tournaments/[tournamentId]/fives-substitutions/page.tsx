import UserShell from "@/components/user/UserShell";
import FivesSubstitutionManager from "@/components/user/FivesSubstitutionManager";
import { requireApprovedUserSession } from "@/lib/auth/user-guard";

type Props = {
  params: {
    tournamentId: string;
  };
};

export default async function UserTournamentFivesSubstitutionPage({ params }: Props) {
  await requireApprovedUserSession({ loginRedirectTo: "/login", pendingRedirectTo: "/pending" });

  return (
    <UserShell
      title="후반 교체 제출"
      subtitle="승인된 5인조 팀의 후반 출전 5명을 제출합니다."
      style={{ alignItems: "flex-start", paddingTop: "4rem" }}
    >
      <FivesSubstitutionManager tournamentId={params.tournamentId} />
    </UserShell>
  );
}
