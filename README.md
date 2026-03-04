# bowling-tournament-saas

Firebase 기반 경기도체육회 볼링 대회 운영 SaaS 뼈대

## 기본 설정
- Node: 20+
- Frontend/Backend: Next.js 14 (App Router)
- DB: Cloud Firestore

## 환경변수
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_PATH=
FIREBASE_ADMIN_EMAILS=
```

## 설치/실행
```bash
npm install
npm run dev
```

## 구현 현재 상태
- PRD/아키텍처/Firestore 스키마 문서 완성
- 기본 타입, 레인 계산 유틸, 점수/순위 집계 유틸 구현
- Firebase 클라이언트/관리자 초기 설정 파일 추가

## 다음 단계
`docs/implementation-roadmap.md` 기준으로 API 라우트와 페이지를 이어서 구현
