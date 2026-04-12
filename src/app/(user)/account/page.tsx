import AccountForm from "@/components/user/AccountForm";
import UserShell from "@/components/user/UserShell";
import { requireUserSession } from "@/lib/auth/user-guard";

export default async function AccountPage() {
  const session = await requireUserSession({ allowPending: true, loginRedirectTo: "/login" });

  return (
    <UserShell
      title="계정관리"
      subtitle="비밀번호와 개인정보를 관리합니다."
      style={{ alignItems: "flex-start", paddingTop: "4rem" }}
    >
      <AccountForm
        initialProfile={{
          name: session.profile.name,
          phone: session.profile.phone,
          email: session.profile.email,
          status: session.profile.status,
        }}
      />
    </UserShell>
  );
}
