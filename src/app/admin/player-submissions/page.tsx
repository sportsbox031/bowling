import PlayerSubmissionApprovalPanel from "@/components/admin/PlayerSubmissionApprovalPanel";
import { requireAdminSession } from "@/lib/auth/guard";

export default async function AdminPlayerSubmissionsPage() {
  await requireAdminSession();

  return <PlayerSubmissionApprovalPanel />;
}
