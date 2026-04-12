import UserShell from "@/components/user/UserShell";
import UserTournamentWorkspace from "@/components/user/UserTournamentWorkspace";
import { requireApprovedUserSession } from "@/lib/auth/user-guard";

type Props = {
  params: {
    tournamentId: string;
  };
};

export default async function UserTournamentPage({ params }: Props) {
  await requireApprovedUserSession({ loginRedirectTo: "/login", pendingRedirectTo: "/pending" });

  return (
    <UserShell
      title="대회 관리"
      subtitle="이 대회에서 사용할 제출 메뉴를 선택하세요."
      style={{ alignItems: "flex-start", paddingTop: "4rem" }}
    >
      <UserTournamentWorkspace tournamentId={params.tournamentId} />
    </UserShell>
  );
}
