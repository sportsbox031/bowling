import TeamSubmissionApprovalPanel from "@/components/admin/TeamSubmissionApprovalPanel";
import { requireAdminSession } from "@/lib/auth/guard";

type Props = {
  params: {
    tournamentId: string;
    divisionId: string;
  };
};

export default async function DivisionTeamSubmissionsPage({ params }: Props) {
  await requireAdminSession();

  return (
    <TeamSubmissionApprovalPanel
      tournamentId={params.tournamentId}
      divisionId={params.divisionId}
      hideTournamentSelect
    />
  );
}
