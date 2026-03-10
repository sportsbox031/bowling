import AdminHeader from "@/app/admin/_components/AdminHeader";
import AdminAuthGate from "@/app/admin/_components/AdminAuthGate";
import RouteTransition from "@/components/common/RouteTransition";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AdminHeader />
      <AdminAuthGate />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <RouteTransition mode="admin">{children}</RouteTransition>
      </main>
    </>
  );
}
