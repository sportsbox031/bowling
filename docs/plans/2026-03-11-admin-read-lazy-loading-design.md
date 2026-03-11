# Admin Read Lazy Loading Design

Goal: cut Firestore reads in the admin scoreboard by avoiding the heavy full-bundle fetch on first load and by reusing client state across tab switches.

Recommended approach:
- Replace the initial full `bundle` request with a lighter `setup` bundle that returns only `event`, `players`, `participants`, `squads`, and `assignments`.
- Load score aggregates only when the user first enters a score or ranking tab.
- Load teams only when the user first enters the team tab.
- Track loaded sections in local state so revisiting tabs reuses existing data instead of re-fetching.
- After writes, update only the affected local state when possible, and reload only the specific section that is now stale.

Expected effect:
- Admin page open no longer pulls event scoreboards, overall aggregates, and team data by default.
- Tab switching inside one event becomes mostly local.
- Team create/edit flows stop refreshing unrelated score aggregates unless rank data is actually being viewed.
