"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

type RouteTransitionProps = {
  children: ReactNode;
  mode?: "public" | "admin";
};

export default function RouteTransition({ children, mode = "public" }: RouteTransitionProps) {
  const pathname = usePathname();

  return (
    <div key={pathname} className={`route-transition route-transition--${mode}`}>
      {children}
    </div>
  );
}
