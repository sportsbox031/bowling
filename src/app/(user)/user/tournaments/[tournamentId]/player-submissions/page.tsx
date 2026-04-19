import Link from "next/link";
import UserShell from "@/components/user/UserShell";
import PlayerRegistrationManager from "@/components/user/PlayerRegistrationManager";
import { GlassButton } from "@/components/ui";
import { requireApprovedUserSession } from "@/lib/auth/user-guard";

type Props = {
  params: {
    tournamentId: string;
  };
};

export default async function UserTournamentPlayerSubmissionsPage({ params }: Props) {
  await requireApprovedUserSession({ loginRedirectTo: "/login", pendingRedirectTo: "/pending" });

  return (
    <UserShell
      title="선수등록 제출"
      subtitle="이 대회 기준으로 선수등록을 제출하고 승인 상태를 확인합니다."
      style={{ alignItems: "flex-start", paddingTop: "4rem" }}
      footer={(
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Link href={`/user/tournaments/${params.tournamentId}`}>
            <GlassButton variant="ghost">← 대회 제출 현황으로</GlassButton>
          </Link>
        </div>
      )}
    >
      <PlayerRegistrationManager tournamentId={params.tournamentId} hideTournamentSelect />
    </UserShell>
  );
}
