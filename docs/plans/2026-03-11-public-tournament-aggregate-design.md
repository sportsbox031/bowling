# Public Tournament Aggregate Design

> Goal: Reduce Firestore reads for the public tournament detail API by serving tournament metadata, divisions, and events from a prebuilt aggregate document.

## Recommendation

Use a per-tournament aggregate document at `tournaments/{tournamentId}/aggregates/public-detail`.
The public detail API reads this document first and only rebuilds it if missing.
Admin tournament, division, and event write APIs rebuild the aggregate after successful writes.

## Data Flow

- Public API returns `tournament`, `divisions`, and `eventsByDivision` from one aggregate document.
- Aggregate payload preserves the existing response shape so the frontend does not need to change.
- Backfill script rebuilds the aggregate for existing tournaments to avoid heavy fallback reads on first request.

## Write Triggers

- Tournament create, update, delete
- Division create, update, delete
- Event create, update, delete

## Validation

- Add a small aggregate payload test for sorting and response shape.
- Run the test in node strip-types mode.
- Run `npm run build` after wiring the API and write triggers.
