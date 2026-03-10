import "./globals.css";

import { ReactNode } from "react";
import PublicHeader from "@/components/PublicHeader";
import RouteTransition from "@/components/common/RouteTransition";

export const metadata = {
  title: "볼링 대회 성적 관리",
  description: "경기 운영을 위한 점수/순위/레이스 배정 SaaS",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <PublicHeader />
        <RouteTransition mode="public">{children}</RouteTransition>
      </body>
    </html>
  );
}
