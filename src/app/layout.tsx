import "./globals.css";

import { ReactNode } from "react";
import PublicHeader from "@/components/PublicHeader";

export const metadata = {
  title: "볼링 대회 성적 관리",
  description: "경기 운영을 위한 점수/순위/레이스 배정 SaaS",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <PublicHeader />
        <div>{children}</div>
      </body>
    </html>
  );
}
