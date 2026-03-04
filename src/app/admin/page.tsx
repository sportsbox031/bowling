import { requireAdminSession } from "@/lib/auth/guard";
import { redirect } from "next/navigation";

export default async function AdminHomePage() {
  await requireAdminSession();
  redirect("/admin/tournaments");
}
