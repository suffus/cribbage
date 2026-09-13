# CribbageX v0.3.0 — Additional Scaffold Tests

**Date:** 13 September 2026  
**Author:** Automated test engineer  
**Ground truth:** the working tree (not the plan or the implementation report)  
**Related:** `detailed-spec-for-scaffold.md`, `scaffolding-plan.md`, `scaffolding-implementation.md`, `scaffolding-gaps.md`

---

## 1. What was already there

The scaffold delivery already had the named plan tests T1–T9:

| ID | File | What it covered |
| --- | --- | --- |
| T1 | `src/app/game.test.ts` | Frozen Expert keeps; `rankDiscards` length 15 and descending |
| T2 | `src/app/game.test.ts` | `rankPlays` vs `playBestCard1`; no over-31; empty illegal list |
| T3a / T3b | `src/app/difficulty.test.ts` | Deterministic `pickWeightedIndex`; fair-shuffle source guard |
| T4 | `src/app/game.test.ts` | Full-game ledger invariant; mid-game quit; `rounds === shuffle-deck` count |
| T5 / T5b | `src/app/game.test.ts` | Nobs attribution; crib-flush correction |
| T6 | `src/features/game/gameSlice.test.ts` | `prepare-board` keeps difficulty; reset/clear reducers |
| T7 | `src/screens/Splash.test.tsx`, `src/App.test.tsx` | Splash Play/Learn; Learn navigation; `/stats` `/friend`; catch-all |
| T8 | `src/Cribbage.test.tsx` | Difficulty modal gate until Start Game |
| T9 | `src/app/persistence.test.ts` | `setItem` throw, bad JSON, sanitisation, happy path + `clearAll` |

That was **7 files / 26 tests**. It covered the plan’s checklist and little else. The gap report already called out missing rounds, quit, persistence-edge, opponent-AI, and screen-level assertions. Several of those T* tests had also been tightened in the tree before this work (T1 is fixtures, not a wrapper tautology; T4 asserts `rounds`).

This pass treats **the code** as the spec: every new module, reducer, modal, screen, and hazard that ships in v0.3 and was not already asserted.

---

## 2. Approach

1. Read the four scaffold documents, then the implementation (`game.ts`, `gamePlayer.ts`, `difficulty.ts`, `persistence.ts`, `gameSlice.ts`, screens, modals, `Cribbage.tsx`, `App.tsx`).
2. Map F1–F5, P1–P5, H1–H13, and E1–E15 onto existing tests.
3. Add unit tests next to the subject (engine, persistence, player, hook) and RTL + `MemoryRouter` + per-test store tests for screens and modals.
4. Prefer `CribbageGame.doAction` and direct method calls over driving `thePlayer` through a full hand. Tests that touch the singleton call `thePlayer.resetForNewSession()`.
5. Do **not** change product code. One TypeScript compile fix was needed in a new test (`Object.hasOwn` is not in the project’s `ES2020` lib).

---

## 3. Verification

```
npx vitest run     # 15 files, 83 tests passed
npm run lint       # exit 0
npm run build      # tsc --noEmit && vite build, exit 0
```

Suite grew from **26 → 83** tests (**+57**). No production files were edited.

---

## 4. New and extended test files

### Created

| File | Tests | Area |
| --- | --- | --- |
| `src/app/gamePlayer.test.ts` | 7 | Opponent AI, session reset, snapshot publish, H13 / E14 |
| `src/app/useCardMetrics.test.ts` | 1 | P3 seam |
| `src/components/ScoreExplanation.test.tsx` | 1 | P2 contract |
| `src/components/DifficultyModal.test.tsx` | 2 | F2 modal |
| `src/components/GameOverModal.test.tsx` | 5 | F3 modal, H9, E5, E6 |
| `src/screens/Learn.test.tsx` | 3 | F5 + P1 |
| `src/screens/Stats.test.tsx` | 3 | P4 + F4 recording |
| `src/screens/FriendPlay.test.tsx` | 2 | P5 |

### Extended

| File | Added | Why |
| --- | --- | --- |
| `src/app/game.test.ts` | 16 | Ledger, Q1-B rounds, quit / `game-win`, nobs/heels, wrappers |
| `src/app/difficulty.test.ts` | 3 | Frozen tables; extra `pickWeightedIndex` edges; import DAG |
| `src/app/persistence.test.ts` | 6 | Blob shape, merge, `getItem`/`removeItem` throw, session copy, DAG |
| `src/features/game/gameSlice.test.ts` | 2 | Seed + `setDifficulty` isolation |
| `src/screens/Splash.test.tsx` | 3 | Copy, Play/Friend nav, `/brooke` and `/select` |
| `src/Cribbage.test.tsx` | 3 | Easy confirm, `/select` order, record-on-snapshot (H12 / E7 / E15) |
| `src/App.test.tsx` | 0 (assertions only) | Learn button + fairness line on the BrowserRouter smoke test |

---

## 5. Catalogue of tests written in this pass

### Engine — `src/app/game.test.ts`

| Test | Requirement |
| --- | --- |
| `emptyBreakdown is all zeros for both seats` | Task 3.2 default ledger |
| `getBreakdownSnapshot copies seats so later mutation cannot leak into the game` | Redux must not receive `this.breakdown` by reference |
| `does not keep the dead playing/starting score keys` | Task 3.2 cleanup |
| `splits nobs out of hand and crib and puts his-nibs in bonuses` | H4; uniform his-nibs arithmetic |
| `attributes pegging reasons to pegging and skips an unknown category` | All five peg reasons; E11 skip |
| `keeps the raw score when a player goes past 121` | H9 |
| `counts a later winning deal that never hits round-end` | Q1-B (the defect the gap report measured) |
| `registers game-win in ending and ignores a second quit` | H3; H2b `gameOver` short-circuit |
| `quits from starting and showing into ending as an opponent concession` | H2, H2b; no trailing `new-game` |
| `new-game from ending still leaves through prepare-board` | Task 3.3 acceptance |
| `resetGame clears ledger and rounds only when the game is over` | Per-game, not per-round reset |
| `scores nobs only for the jack of the starter suit` | Extra `countNobs` cases (two jacks, empty hand) |
| `awards his heels to the dealer bonuses when the starter is a jack` | `starter-card` → `his-nibs` → score |
| `puts crib nobs in bonuses rather than crib on show-crib` | Show-crib `bonus` path |
| `getBestHand is the first ranked keep on both crib flags` | Wrapper contract after Task 1.3 |
| `playBestCard1 is the first ranked legal card` | Wrapper contract |

### Difficulty — `src/app/difficulty.test.ts`

| Test | Requirement |
| --- | --- |
| `exports the committed order, weights, labels, and descriptions` | Spec §4.3.3 verbatim |
| `never returns an index past the truncated weight list` | H6 with 15 candidates; single-weight renormalise; negative count → `-1` |
| `does not import the engine or mention a difficulty argument on shuffle` | Fair-shuffle DAG (`game` / `entities` / `if (difficulty`) |

### Persistence — `src/app/persistence.test.ts`

| Test | Requirement |
| --- | --- |
| `discards a blob that is missing preferences or stats` | E9 wholesale discard, no migration |
| `merges savePreferences without wiping recorded stats` | Task 5.1 merge |
| `does not throw when getItem or removeItem throws` | H11 on the remaining storage methods |
| `sanitises Infinity and NaN and keeps an invalid save from clobbering prefs` | Non-finite → 0; recomputed `total`; invalid `savePreferences` ignored |
| `copies session stats and does not count an undefined winner as a seat win` | Session deep copy; `playerWins + opponentWins` may be `< gamesPlayed` |
| `does not import the Redux slice or GamePlayer` | Import DAG + `cribbagex.v1` key |

### Slice — `src/features/game/gameSlice.test.ts`

| Test | Requirement |
| --- | --- |
| `seeds difficulty from a valid Difficulty and leaves the gate closed` | `initialState` contract |
| `setDifficulty does not clear an existing finalBreakdown` | Reducers do one job |

### GamePlayer — `src/app/gamePlayer.test.ts`

| Test | Requirement |
| --- | --- |
| `resetForNewSession clears queues, ledger, and scores` | H7 |
| `has no stored difficulty field` | H13 |
| `selects the Expert keep for the opponent at expert difficulty` | Expert ≡ `rankDiscards()[0]` |
| `plays the Expert pegging card at expert difficulty` | Expert ≡ `playBestCard1` |
| `returns error when the opponent has no legal peg card` | E1 / E2 |
| `auto-select and autoplay stay on the Expert wrappers` | E14 |
| `publishes a snapshot on game-win using the incoming state difficulty` | Task 4.4 |

### Hook and presentational components

| Test | File | Requirement |
| --- | --- | --- |
| `returns the table constants with no visual change` | `useCardMetrics.test.ts` | P3 (150 / 100 / 120 / 170) |
| `renders the total and the coming-soon contract body` | `ScoreExplanation.test.tsx` | P2 |
| `lists every level from the difficulty module and has no close control` | `DifficultyModal.test.tsx` | Static modal; labels from `difficulty.ts` |
| `pre-selects the store difficulty and persists the confirmed choice` | `DifficultyModal.test.tsx` | Prefill ≠ skip; `savePreferences` |
| `renders nothing without a snapshot` | `GameOverModal.test.tsx` | Null `finalBreakdown` |
| `shows raw totals, rounds, difficulty, and the explanation slot` | `GameOverModal.test.tsx` | H9 (130), Q5 dummy slot |
| `treats a non-player winner as an opponent win` | `GameOverModal.test.tsx` | Title copy |
| `Back to Menu resets the gate and returns home` | `GameOverModal.test.tsx` | E6 |
| `Play Again clears the snapshot without resetting difficulty` | `GameOverModal.test.tsx` | E5 |

### Screens and table integration

| Test | File | Requirement |
| --- | --- | --- |
| `documents the corrected crib flush and the rest of the scoring table` | `Learn.test.tsx` | F5 table matches `scoreHand` |
| `renders difficulty copy from the module and disables lesson tiles` | `Learn.test.tsx` | P1 `disabled`; no duplicated strings |
| `goes back to the splash` | `Learn.test.tsx` | Back control |
| `shows real zero counters and coming-soon rows that are not zeros` | `Stats.test.tsx` | P4 (coming soon ≠ 0) |
| `renders recorded lifetime totals including a conceded opponent win` | `Stats.test.tsx` | Quit stats |
| `clears lifetime and session and returns home` | `Stats.test.tsx` | `clearAll` + Back |
| `renders the planned local-only copy with a disabled room form` | `FriendPlay.test.tsx` | P5 |
| `contains no network primitives and goes back home` | `FriendPlay.test.tsx` | Source guard: no `fetch` / `WebSocket` |
| `shows the committed tagline, fairness line, and secondary links` | `Splash.test.tsx` | F1 copy + hero `src` + Stats nav |
| `navigates Play to the table gate and Friend to the placeholder` | `Splash.test.tsx` | Play → modal; Friend → planned copy |
| `opens skin deep-links on the table and /select on the deck picker` | `Splash.test.tsx` | `/brooke` not splash; E7 |
| `confirms Easy and keeps Auto Select on the Expert wrapper` | `Cribbage.test.tsx` | E14 source guard |
| `shows the deck picker before the modal when no deck is supplied` | `Cribbage.test.tsx` | E7 |
| `hides table actions and records a result when a snapshot is published` | `Cribbage.test.tsx` | E15 + H12 (`recordCompletedGame` from the effect) |
| T8 also now asserts **Quit!** is hidden until confirm | `Cribbage.test.tsx` | Gate covers both `.commitCrib` buttons |

---

## 6. Hazards and edges now under test

| ID | Now covered by |
| --- | --- |
| H1 | Existing T6 |
| H2 / H2b | Quit from starting/showing; no `new-game`; second quit ignored |
| H3 | `game-win` registers in `ending` |
| H4 | Direct attribution + show-crib / his-heels paths |
| H5 | Existing T1 fixtures (generation order / stable sort) |
| H6 | Extra `pickWeightedIndex` truncation cases |
| H7 | `resetForNewSession` unit test |
| H8 | Existing splash-specific `App.test.tsx` |
| H9 | Engine 130-point finish + GameOverModal 130 display |
| H10 | Hero `src` asserted; `onError` path still exists (not fired in jsdom) |
| H11 | `setItem` (T9) plus `getItem` / `removeItem` |
| H12 | Cribbage records once when `finalBreakdown` is published |
| H13 | No `this.difficulty` on `GamePlayer` |
| E1 / E2 | Empty `playOpponentCard` → `error` |
| E4 / quit stats | Mid-game quit ledger (T4) + Stats conceded win |
| E5 / E6 | GameOverModal Play Again / Back to Menu |
| E7 | `/select` picker before modal (route + `Cribbage` without deck) |
| E9 | Missing `preferences`/`stats` discarded |
| E10 | Existing T5b |
| E11 | Unknown `categoryFor` pair |
| E13 | Existing T7 catch-all |
| E14 | Source guards on `Cribbage.tsx` and `gamePlayer.ts`; Expert opponent picks |
| E15 | Snapshot present ⇒ no Start The Round |

---

## 7. Deliberately not automated

These remain manual or out of scope, matching the plan’s “not this phase” column:

- Easy / Intermediate *feel* (approximate miss rates). Weights are pinned; play-feel is not a unit assertion.
- Splash animation and `prefers-reduced-motion` (CSS structure only; no computed-style harness).
- Hero `onError` fallback class (`splash--fallback`) — would need a synthetic image error.
- Show-phase `ScoreExplanation` slot under the player hand (needs a driven show state in RTL).
- Browser / Docker / nginx SPA fallback (already specified as a human pass).
- Playwright / Cypress. None added.

No product defects were found by the new tests. The Q1-B `roundCounted` clear on `start-round` is present in the current `game.ts` and the new rounds test passes.

---

## 8. How to run

```bash
npx vitest run
npm run lint
npm run build
```

Watch mode remains `npm test`. Engine tests that touch `thePlayer` reset the singleton in `beforeEach`. Persistence tests call `clearAll()` in `afterEach`.
