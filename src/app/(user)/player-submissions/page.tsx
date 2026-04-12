import { requireApprovedUserSession } from "@/lib/auth/user-guard";
import { redirect } from "next/navigation";

export default async function PlayerSubmissionsPage() {
  await requireApprovedUserSession({ loginRedirectTo: "/login", pendingRedirectTo: "/pending" });
  redirect("/user");
}
