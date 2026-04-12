import { requireAdminSession } from "@/lib/auth/guard";
import AdminRequestDashboard from "@/components/admin/AdminRequestDashboard";

export default async function AdminHomePage() {
  await requireAdminSession();

  return <AdminRequestDashboard />;
}
