# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bowling tournament SaaS application (Korean-language domain). Manages tournaments, divisions, events, players, lane assignments, and scoring with real-time leaderboards.

**Stack**: Next.js 14 (App Router) + TypeScript + Firebase (Firestore + Auth + Admin SDK)

**Language context**: UI text, docs, and PRD are in Korean. Code identifiers are in English.

## Commands

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Next.js ESLint
```

No test framework is configured yet.

## Architecture

### Layers
- **Pages** (`src/app/`): Next.js App Router with server/client components
- **API Routes** (`src/app/api/`): Route Handlers split into `admin/` (protected) and `public/` (open read)
- **Domain Logic** (`src/lib/`): Scoring engine, lane assignment, models, auth
- **Firebase** (`src/lib/firebase/`): Client SDK (`client.ts`) and Admin SDK (`admin.ts`) initialization, collection paths (`schema.ts`)

### Data Flow
All data is **tournament-scoped** — every query includes `tournamentId`. Firestore collection hierarchy:
```
tournaments/{tournamentId}
  ├── divisions/{divisionId}
  │   └── events/{eventId}
  │       ├── scores/{scoreId}
  │       └── assignments/{assignmentId}
  └── players/{playerId}
```

### Auth Model
- Public pages: no auth required (read-only tournament/scoreboard data)
- Admin routes: Firebase Auth session cookie (10-day validity)
- Admin verification: `admin` custom claim OR email in `FIREBASE_ADMIN_EMAILS` env var
- Guard: `requireAdminSession()` in `src/lib/auth/guard.ts`

### Key Domain Logic

**Scoring** (`src/lib/scoring.ts`):
- `buildEventLeaderboard()` — per-event ranking by total DESC → average DESC → pinDiff ASC
- `buildOverallLeaderboard()` — cross-event combined ranking

**Lane Assignment** (`src/lib/lane.ts`):
- `assignRandomLanes()` — hash-seeded random distribution, 2-4 players per lane
- `getLaneForGame()` — table shift calculation with modulo wrapping
- `buildLaneBoardForGame()` — full assignment board across games

**Competition Service** (`src/lib/services/competitionService.ts`): Domain service orchestrating tournament operations.

### Import Alias
`@/*` maps to `./src/*`

## Environment Variables

**Client-side** (prefixed `NEXT_PUBLIC_`): Firebase config keys (API_KEY, AUTH_DOMAIN, PROJECT_ID, etc.)

**Server-side**: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_PATH`, `FIREBASE_ADMIN_EMAILS` (comma-separated allowlist)

## Implementation Status

Phase 0 (scaffolding) is complete. Core models, utilities, API route structure, and auth are in place. Admin UI, validation, testing, styling, and production hardening remain. See `docs/implementation-roadmap.md` for the 7-phase plan.

## Docs

- `docs/prd-bowling-firebase.md` — Product requirements
- `docs/system-architecture.md` — Technical architecture
- `docs/firestore-schema.md` — Firestore data model
- `docs/implementation-roadmap.md` — 7-phase roadmap
