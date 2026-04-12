import UserShell from "@/components/user/UserShell";
import UserTournamentDashboard from "@/components/user/UserTournamentDashboard";
import { requireApprovedUserSession } from "@/lib/auth/user-guard";

export default async function UserDashboardPage() {
  await requireApprovedUserSession({ loginRedirectTo: "/login", pendingRedirectTo: "/pending" });

  return (
    <UserShell
      title="내 대회"
      subtitle="대회를 선택한 뒤 선수등록과 팀편성을 해당 대회 안에서 관리하세요."
      style={{ alignItems: "flex-start", paddingTop: "4rem" }}
    >
      <UserTournamentDashboard />
    </UserShell>
  );
}
