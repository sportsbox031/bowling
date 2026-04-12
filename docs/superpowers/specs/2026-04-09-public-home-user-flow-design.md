# Public Home User Flow Design

## Goal

Keep the public tournament home and detail experience as the primary navigation surface for everyone, while exposing user and admin management actions only when the session allows them.

## Decisions

- The public home page at `/` remains the main landing page before and after login.
- The public tournament detail page at `/tournaments/[tournamentId]` becomes the place where a logged-in user discovers and enters tournament management actions.
- Login is unified at `/login`. The same form accepts both admin and user credentials.
- After login, admins are redirected to `/admin`. Approved users are redirected to the requested `next` path or `/` by default. Pending users are redirected to `/pending`.
- Public navigation shows only the auth action that matches the current state. Logged-out users see `로그인`. Logged-in users see `로그아웃`. Admins may also see an `관리자` shortcut.
- Team submission depends on player registration. When a division has no prior player registration submission, the UI should block the team-submission entry point with a clear `선수등록부터 진행해주세요.` message.
- Deep links to team submission must still explain the dependency when no eligible players are available.

## UX Flow

1. Visitor opens `/` and sees the public tournament list.
2. Visitor selects a tournament and lands on the public tournament detail page.
3. Logged-out users can still read scores, lanes, and standings, and are invited to log in if they want to manage entries.
4. Approved users see a tournament management panel on the same detail page with `선수등록 제출` first and division-level `팀편성 제출` actions second.
5. Admins are routed into `/admin` after login and continue to use the dedicated admin interface.

## Implementation Notes

- Add shared user-flow helper functions for auth CTA state, safe post-login redirects, and team-submission prerequisite messages.
- Reuse the existing user management routes for the actual forms, but re-anchor the main entry flow around the public pages.
- Keep server-side enforcement unchanged where possible, and improve the client-side messaging so the dependency is obvious before the user reaches a dead end.
