"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

export default function AdminAuthGate() {
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = useMemo(() => pathname?.startsWith("/admin/login"), [pathname]);

  useEffect(() => {
    if (isLoginPage) {
      return;
    }

    let active = true;
    const check = async () => {
      try {
        const response = await fetch("/api/admin/session", {
          cache: "no-store",
        });

        if (!active) {
          return;
        }

        if (response.status === 401) {
          const next = encodeURIComponent(pathname ?? "/admin");
          router.replace(`/admin/login?next=${next}`);
        }
      } catch {
        if (active) {
          const next = encodeURIComponent(pathname ?? "/admin");
          router.replace(`/admin/login?next=${next}`);
        }
      }
    };

    void check();

    return () => {
      active = false;
    };
  }, [isLoginPage, pathname, router]);

  return null;
}
