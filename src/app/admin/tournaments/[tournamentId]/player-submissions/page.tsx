import PlayerSubmissionApprovalPanel from "@/components/admin/PlayerSubmissionApprovalPanel";
import { requireAdminSession } from "@/lib/auth/guard";

type Props = {
  params: {
    tournamentId: string;
  };
};

export default async function TournamentPlayerSubmissionsPage({ params }: Props) {
  await requireAdminSession();

  return <PlayerSubmissionApprovalPanel tournamentId={params.tournamentId} hideTournamentSelect />;
}
