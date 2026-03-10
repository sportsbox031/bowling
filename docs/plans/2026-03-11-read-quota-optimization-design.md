# Read Quota Optimization Design

> Goal: Reduce Firestore reads in the two highest-impact areas left in the app: public tournament detail rendering and repeated aggregate rebuilds during score entry.

## Recommendation

1. Change the public tournament detail page to read the existing public aggregate document directly instead of reading tournaments, divisions, and events separately.
2. Add aggregate staleness guards in score-save flow so expensive global aggregates are rebuilt only when they are old enough, while live scoreboards remain immediate.

## Scope

- Public detail page: switch to `readPublicTournamentAggregate` with rebuild fallback
- Score save: keep event scoreboard and overall aggregates fresh, but throttle player rankings and player profile rebuild frequency

## Expected Effect

- Public tournament detail page: from roughly `1 + division count + event count` reads to about `1` read
- Score save bursts: avoid repeating global scans on every single score input during active matches

## Validation

- Add a small staleness helper test
- Run the test red then green
- Run `npm run build`
