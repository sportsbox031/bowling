# Bowling Admin/Public Enhancements Design

**Date:** 2026-03-10

## Goal

Apply the approved improvements without regressing existing tournament workflows:

- unify repeated public/admin UI patterns
- remove duplicated labels and player-normalization logic
- add bulk player import for CSV/TSV/XLSX
- add keyboard-first score entry with draft recovery
- add print-friendly public results and lane sheets

## Constraints

- Existing tournament, division, event, participant, lane assignment, and ranking behavior must remain intact.
- Shared logic should be extracted only where behavior is already duplicated.
- New UX layers must wrap current APIs instead of replacing trusted save/load flows.
- Bulk import must validate and preview rows before persistence.

## Chosen Approach

Use a conservative integration approach:

1. Keep current page routing and server APIs in place.
2. Introduce small shared primitives for repeated UI and labels.
3. Move repeated player normalization and dedupe behavior into shared admin helpers.
4. Layer bulk import, draft persistence, keyboard navigation, and print mode on top of current pages.

This minimizes regression risk while still reducing duplication and improving usability.

## Public UI Design

- Standardize page headers, search fields, status banners, and ranking tables across list/detail/ranking pages.
- Rebalance visual hierarchy so hero headers, summary cards, and data tables have distinct emphasis.
- Reuse the same print-mode toggle and print CSS rules across event rankings, overall rankings, and lane sheets.
- Keep mobile behavior focused on readability by tightening card spacing and table presentation rather than changing data semantics.

## Admin UI Design

- Preserve the existing tournament admin page structure, but replace repeated message/search/panel patterns with shared components.
- Add a dedicated bulk import panel to the player-management area.
- Keep score-entry save behavior unchanged, but add:
  - local draft persistence keyed by tournament/division/event/game/lane context
  - recovery messaging with reset action
  - keyboard movement between score inputs

## Data and Validation Design

- Centralize player normalization, validation, number assignment, and Firestore document assembly in shared admin helpers.
- Bulk import accepts `.csv`, `.tsv`, and `.xlsx`.
- All formats are converted into a single internal row shape before preview/validation/import.
- Duplicate prevention continues to use normalized identity fields:
  - `divisionId`
  - `group`
  - `region`
  - `affiliation`
  - `name`

## Error Handling

- Public pages show shared inline status banners for fetch failures and empty states.
- Import previews must surface invalid rows before submission.
- Import API returns row-level failure metadata when payload validation fails.
- Score-entry draft recovery must be non-destructive and user-resettable.

## Verification

- TypeScript must compile cleanly.
- Public ranking pages and lane sheets must render with and without print mode.
- Admin player CRUD and bulk import must both succeed after refactor.
- Score entry must preserve existing save behavior while draft restore and keyboard movement work correctly.
