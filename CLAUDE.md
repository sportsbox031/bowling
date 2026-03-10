# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bowling tournament SaaS application (Korean-language domain). Manages tournaments, divisions, events, players, lane assignments, squads, and scoring with real-time leaderboards.

**Stack**: Next.js 14.2 (App Router) + TypeScript + Firebase (Firestore + Auth + Admin SDK)

**Language context**: UI text, docs, and PRD are in Korean. Code identifiers are in English. No external UI library — uses custom `Glass*` component system (`src/components/ui/`).

## Commands

```bash
npm run dev      # Development server
npm run build    # Production build (also validates types)
npm run start    # Start production server
npm run lint     # Next.js ESLint
```

No test framework is configured yet. Type-check via `npm run build` (runs `next build` which enforces strict TS). Requires Node 20+. External dependencies: Next.js 14.2, React 18, Firebase, firebase-admin, and `xlsx` (Excel export).

## Architecture

### Layers
- **Pages** (`src/app/`): Next.js App Router — nearly all pages are `"use client"` components with `export const dynamic = "force-dynamic"`. Server components: `admin/page.tsx` (session check + redirect). Root layout (`layout.tsx`) is a server component that renders `PublicHeader`. Admin layout (`admin/layout.tsx`) is also a server component wrapping `AdminHeader` + `AdminAuthGate`.
- **API Routes** (`src/app/api/`): Route Handlers split into `admin/` (protected) and `public/` (open read). Admin routes receive dynamic params via `ctx: { params: { tournamentId, divisionId, eventId } }` context object. Public routes include `players/` (profile, rankings), `scoreboard/` (overall), and `tournaments/` (metadata, events, bundle). Admin routes cover CRUD for tournaments, divisions, events, squads, scores, lane assignments, session management, and summary/certificates generation.
- **Domain Logic** (`src/lib/`): Scoring engine, lane assignment, models, auth — pure functions, no Firebase imports (except `eventPath.ts`)
- **Firebase** (`src/lib/firebase/`): Client SDK (`client.ts`), Admin SDK (`admin.ts`), collection paths (`schema.ts`), event resolution (`eventPath.ts`)
- **UI Components** (`src/components/ui/`): Glass-morphism design system using inline `CSSProperties` (not CSS classes). Components: `GlassCard` (supports `className` prop for custom CSS), `GlassButton`, `GlassInput`, `GlassSelect`, `GlassTable` (supports `headerAligns` prop for per-column text alignment), `GlassBadge`, `GlassHeader`. Barrel export from `index.ts` — also exports `glassTdStyle` and `glassTrHoverProps` helpers from `GlassTable`.
- **Shared Components** (`src/components/`): `PublicHeader` (client component, hides on `/admin` paths), `PlayerProfileModal` (player stats modal with tournament history)
- **Admin Components** (`src/app/admin/_components/`): `AdminAuthGate` (client-side session check), `AdminHeader`
- **Admin Feature Pages** (`src/app/admin/tournaments/[tournamentId]/`): `certificates/` (A4 printable award certificates with per-division/event filtering), `summary/` (종합집계표 — per-event medal winners + team tally ranking by medal count)

### Data Flow
All data is **tournament-scoped** — every query includes `tournamentId`. Firestore collection hierarchy:
```
tournaments/{tournamentId}
  ├── divisions/{divisionId}
  │   └── events/{eventId}
  │       ├── scores/{playerId}_{gameNumber}    ← deterministic doc ID
  │       ├── assignments/{assignmentId}
  │       └── squads/{squadId}
  └── players/{playerId}
```

**Event resolution**: Events are nested under divisions, but some API routes receive only `tournamentId` + `eventId` (no `divisionId`). Use `resolveEventRef()` / `getEventRefOrThrow()` from `src/lib/firebase/eventPath.ts` to scan divisions and find the event. This is the one `src/lib/` file that imports Firebase Admin directly.

**3-Layer Caching Architecture**:
1. **Server-side** (`src/lib/api-cache.ts`): In-memory TTL cache (`getCached` / `setCache` / `invalidateCache`, default 5s). `jsonCached<T>()` wraps responses with HTTP `Cache-Control` headers (`s-maxage`, `stale-while-revalidate`) for CDN edge caching. Routes use variable TTLs (5s–15s).
2. **Client-side** (`src/lib/client-cache.ts`): Dual sessionStorage + in-memory cache (MAX_MEM_SIZE=100). Exports `getClientCache<T>()`, `setClientCache<T>()`, `invalidateClientCache()`, and `cachedFetch<T>()`. Used in `PlayerProfileModal` and public pages.
3. **HTTP CDN cache**: Set by `jsonCached()` response headers on public API routes.

**Polling pattern**: Bundle routes support `?only=scores` and `?only=assignments` query params for partial data polling instead of full bundle refetch.

**Note**: `squads` collection is used in API routes but has no corresponding type in `models.ts` or path helper in `schema.ts` — squad documents are built ad-hoc in the route handlers.

### Auth Model
- **Public pages**: no auth required (read-only tournament/scoreboard data)
- **Admin API routes**: verify session cookie via `verifyAdminSessionToken()` from `src/lib/auth/admin.ts`
- **Admin pages (server)**: `requireAdminSession()` in `src/lib/auth/guard.ts` — redirects to `/admin/login`
- **Admin pages (client)**: `AdminAuthGate` component checks `/api/admin/session` and redirects on 401
- Admin verification: `admin` custom claim OR email in `FIREBASE_ADMIN_EMAILS` env var
- Session cookie name: `bowling_admin_session` (10-day validity)

### Key Domain Logic

**Scoring** (`src/lib/scoring.ts`):
- `buildEventLeaderboard()` — per-event ranking by total DESC → average DESC → pinDiff ASC
- `buildOverallLeaderboard()` — cross-event combined ranking, merges scores across events
- Max 6 games per event (`MAX_GAME_COUNT`), max score 300 per game
- Tie-breaking: same total → compare average → compare pinDiff (lower is better)

**Lane Assignment** (`src/lib/lane.ts`):
- `assignRandomLanes()` — hash-seeded (LCG PRNG) random distribution across lanes
- `getLaneForGame()` — table shift calculation with modulo wrapping per `EventSpec.tableShift`
- `buildLaneBoardForGame()` — full assignment board across all games
- `normalizeLane()` — wraps lane numbers within a `LaneRange` using modulo arithmetic

**Competition Service** (`src/lib/services/competitionService.ts`): Thin orchestration layer composing `scoring.ts` and `lane.ts` pure functions. Provides `calculateRandomAssignments()`, `buildEventRanking()`, `buildOverallRanking()`.

### Import Alias
`@/*` maps to `./src/*`

## Environment Variables

**Client-side** (prefixed `NEXT_PUBLIC_`): Firebase config keys (API_KEY, AUTH_DOMAIN, PROJECT_ID, etc.)

**Server-side**: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_PATH` (path to JSON file on disk, loaded via `fs.readFileSync`), `FIREBASE_STORAGE_BUCKET`, `FIREBASE_ADMIN_EMAILS` (comma-separated allowlist)

## Conventions

- API error responses use short uppercase message codes: `"UNAUTHORIZED"`, `"INVALID_PAYLOAD"`, `"EVENT_NOT_FOUND"`, etc.
- Admin SDK may be `null` if env vars are missing — always check `if (!adminDb)` before Firestore calls in API routes.
- TypeScript strict mode is enabled. `allowJs` is false. Target is ES2022.
- Domain models are defined in `src/lib/models.ts` (types like `Tournament`, `Division`, `EventSpec`, `Player`, `ScoreRow`, `GameAssignment`, `EventRankingRow`, `OverallRankingRow`). Firestore document types in `schema.ts` extend these models.
- `firestorePaths` helper in `schema.ts` builds collection/document path strings.
- Glass components use inline styles via `CSSProperties`, not CSS class names. When creating new UI, follow this pattern.
- Pages re-declare local types mirroring API response shapes rather than importing from `models.ts` — this is intentional for client/server boundary isolation.
- CSS custom properties in `globals.css` define the design palette: `--color-primary: #6366f1`, `--color-accent: #8b5cf6`, `--gradient-bg` for page backgrounds, `--glass-*` for component theming. Font: Noto Sans KR. Keyframe animations: `float` (background orbs), `pulse`, `fadeIn`, `shimmer` (skeleton loading via `.skeleton` class). Supports `prefers-reduced-motion`.
- `next.config.mjs` uses ESM format. `reactStrictMode` is enabled.
- Print-optimized pages use `@media print` CSS with `-webkit-print-color-adjust: exact` and `.no-print` class to hide UI controls during printing.

## Docs

- `docs/prd-bowling-firebase.md` — Product requirements
- `docs/system-architecture.md` — Technical architecture
- `docs/firestore-schema.md` — Firestore data model
- `docs/implementation-roadmap.md` — 7-phase roadmap
