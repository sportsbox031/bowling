import Link from "next/link";
import UserShell from "@/components/user/UserShell";
import UserTournamentWorkspace from "@/components/user/UserTournamentWorkspace";
import { GlassButton } from "@/components/ui";
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
      title="대회 제출 현황"
      subtitle="이 대회에서 사용할 제출 메뉴를 선택하세요."
      maxWidth={860}
      style={{ alignItems: "flex-start", paddingTop: "4rem" }}
      footer={(
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Link href="/user">
            <GlassButton variant="ghost">← 내 대회 목록으로</GlassButton>
          </Link>
        </div>
      )}
    >
      <UserTournamentWorkspace tournamentId={params.tournamentId} />
    </UserShell>
  );
}
