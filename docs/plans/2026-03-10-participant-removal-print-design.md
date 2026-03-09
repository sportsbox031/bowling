# Participant Removal And Print Layout Design

**Date:** 2026-03-10

## Goal

- confirm participant removal before unregistering
- make participant removal reflect immediately in the current squad filter view
- remove blank first print pages on public event score and lane pages
- paginate print output into dense, predictable page-sized sections

## Approach

Use dedicated print-only sections instead of printing the live interactive layout. Keep existing screen UI for browsing, but render compact print page groups for score tables and lane sheets.

For participant removal, keep the existing add/remove API but require confirmation before unregistering, then update local participant state immediately so the current filtered participant list reflects the change without requiring a filter reset.
