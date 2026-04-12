import TeamSubmissionApprovalPanel from "@/components/admin/TeamSubmissionApprovalPanel";
import { requireAdminSession } from "@/lib/auth/guard";

export default async function AdminTeamSubmissionsPage() {
  await requireAdminSession();

  return <TeamSubmissionApprovalPanel />;
}
