import FivesSubstitutionApprovalPanel from "@/components/admin/FivesSubstitutionApprovalPanel";
import { requireAdminSession } from "@/lib/auth/guard";

type Props = {
  params: {
    tournamentId: string;
    divisionId: string;
  };
};

export default async function DivisionFivesSubstitutionsPage({ params }: Props) {
  await requireAdminSession();

  return (
    <FivesSubstitutionApprovalPanel
      tournamentId={params.tournamentId}
      divisionId={params.divisionId}
      hideTournamentSelect
    />
  );
}
