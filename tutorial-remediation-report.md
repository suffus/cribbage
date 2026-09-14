# Tutorial Remediation Report

**Subject:** remediation of the interactive-tutorial feature against `tutorial-gap-report.md` (dated 14 September 2026), which audited the working tree described by `detailed-tutorial-implementation-plan.md` / `tutorial-plan.md`.
**Scope:** the tutorial feature only (`src/features/tutorial/`, `src/components/tutorial/`, `src/screens/Learn.tsx` / `Lesson.tsx`, and the small set of shared engine/UI files the gap report flagged: `game.ts`, `App.css`, `GroupList.tsx`, `ScoreExplanation.tsx`). No backend, no new dependency, no change to `gamePlayer.ts`, `gameSlice.ts`, `store.ts`, `Cribbage.tsx`'s game logic, or any file outside this remediation's touch list below.
**Result:** `npx vitest run` → **34 files / 203 tests, all passing**. `npm run lint` → clean. `npm run build` (`tsc --noEmit` + `vite build`) → succeeds.

---

## 1. What was done, mapped to the gap report's §9 recommendations

The gap report's "Recommended follow-up, in priority order" (§9) is the actionable checklist. All ten items were addressed; #8 (finish the browser pass) is partially addressed and is called out below as still open.

### 1. Fix mastery accounting (ranked defect #1, High)

**Problem:** opening a lesson recorded an independent-correct mastery attempt for every concept on the lesson, even for passive `round-map`/`explain`/`recap` steps that auto-complete on mount. Lesson 1 alone tagged all ten of its concepts `ready` the instant it opened.

**Fix:**
- Added `isAssessedStepKind()` and `stepConcepts()` to `tutorialReducer.ts`. Only `score-practice`, `discard-practice`, `peg-practice`, and `checkpoint` steps are "assessed"; `explain`/`round-map`/`recap`/`guided-round` never record mastery.
- `Lesson.tsx`'s completion effect now calls `recordConceptAttempt` only when `isAssessedStepKind(step.kind)` is true, and only for `stepConcepts(step)` (the concepts that specific step actually tests), not the whole lesson's concept list.
- **Deviation from the plan's literal wording, recorded here as the plan requires:** the plan says "independentCorrect += 1 only when `attempts === 1`". In this codebase `attempts` was already being used inconsistently — `submitScore`/`submitDiscard` only incremented it on a *wrong* submission, while `submitPeg` incremented on every submission (right or wrong). I made all three (`submitScore`, `submitDiscard`, `submitPeg`) consistently count only wrong submissions, which makes `attempts === 0` — not `1` — the correct "solved without a mistake" signal. Using the plan's literal `=== 1` with this convention would have flagged the *first wrong* attempt as independently correct, which is backwards. `Lesson.tsx` now uses `state.step.attempts === 0`. This is the one place I deviated from the plan's literal text; the underlying intent (only a flawless graded attempt counts) is preserved.

**Tests:** `Lesson.test.tsx` gained a case that opens lesson 1, asserts no mastery was recorded from the passive first step, and a case that a graded step with zero wrong submissions records exactly one independent-correct attempt.

### 2. Fix skip persistence (ranked defect #2, Medium)

**Problem:** `skip` advanced the reducer to the next step before `Lesson.tsx` could observe a `"skipped"` status, so `skippedStepIds` was never written to `localStorage` except when skipping the very last step of a lesson.

**Fix:**
- Added `lastSkippedStepId: string | null` to `RunnerState`. The `skip` action now captures the skipped step's id and returns it in this field, independent of what `advance()` does to the *current* step.
- `Lesson.tsx` has a new effect keyed on `state.lastSkippedStepId` (guarded by a `lastHandledSkipId` ref so it fires exactly once per skip) that appends the id to the persisted `skippedStepIds`, and — if the skipped step was an assessed kind — records a non-correct attempt for its concepts (a skip is not mastery).

**Tests:** `Lesson.test.tsx` gained a case that skips a non-final graded step and asserts `loadTutorialProgress().skippedStepIds` contains it.

### 3. Write `guidedRound.test.ts` properly (ranked defect #5, Medium)

**Problem:** the shipped test file was 27 lines / 3 cases, one of them misnamed (it claimed to test an over-31 play but passed an unknown card id instead), and S-G3/S-G4/S-G5 had no coverage at all.

**Fix:** rewrote `guidedRound.test.ts` as a full suite (21 tests) covering both scripts (`first-round`, `second-round`) end to end through the real `GuidedRound`/`CribbageGame`, using the gap report's own empirical findings as the assertion list:
- S-G2 deal parity for both dealer parities (learner holds the correct alternating deck indices).
- S-G4: starter identity, heels-to-the-learner in `second-round`, the pegging 31, count order per seat (non-dealer counts first), crib ownership, final scores staying below 121.
- S-G5: `reset()` mid-round restores a view **byte-identical** to the pre-round initial view (this caught and fixed a real defect — see §2 below), idempotent across repeated resets.
- S-G6: refusal of a 1-card discard, a 3-card discard, an unknown card id, and a genuine over-31 play (fixed the old test's actual over-31 case, and gave it an accurate name).
- The specific-label pegging-log fix (§2) is asserted via a `"Run of three: 5-3-4"`-style specific label rather than the generic `"a run in the play"`.

### 4. Wire `CoachPanel`'s `progress` and `secondary` (ranked defect #4, Medium)

**Problem:** `CoachPanel` already implemented a category-progress `<dl>` and a `secondary`/"Show the math" disclosure slot, but no caller ever passed either prop — both were dead code.

**Fix:**
- Moved the `CategoryProgress` type into `tutorialGrading.ts` (single source of truth; `CoachPanel.tsx` now imports the type instead of redeclaring it) and added a `categoryProgress(scenario, found)` helper that derives "Fifteens 1 of 2" / "Pairs not started" style counts from a `ScoreScenario` and the learner's found-group ids.
- `tutorialReducer.ts`'s `Feedback` type gained an optional `math?: string`, populated by `submitDiscard` from `describeDiscardComparison`'s existing `math` field (previously computed and discarded).
- `TutorialShell.tsx` now computes `progress` (for score scenarios) and `secondary` (a `<p className="coach-math">` for discard scenarios with EV math text) and passes both to `CoachPanel`.
- Added a small `.coach-math` style to `App.css` for consistency with the existing coach-panel styles.

### 5. Implement `play-sequence` pegging (ranked defect #3, Medium)

**Problem:** the `peg-go` scenario authored a full `opponentScript`, but `PeggingExercise.tsx` folded `play-sequence` tasks into the same single-card radio-and-submit flow as `select-scoring`, so the script was never played and go/reset/last-card were only ever taught in hint prose.

**Fix:**
- Added a turn-based pegging-sequence engine to `tutorialGrading.ts`: `PegSequenceState`, `PegSequenceEvent`, `initPegSequence`, `learnerLegalCardIds`, `playLearnerCard`, `learnerGo`, and the opponent-side `opponentStep`/`resolveOpponentTurns` that walks the scripted `opponentScript`, alternating turns, detecting "go", resetting the count, and scoring the last card.
- Rewrote `PeggingExercise.tsx` to render a dedicated `PlaySequenceExercise` subcomponent for `play-sequence` tasks, which owns local component state driven by the new engine: it shows the running sequence, the learner's remaining hand as selectable cards, a "Go" button when the learner has no legal play, auto-plays the opponent's scripted replies, and a running log of events.
- On completion it dispatches a new `complete-peg-sequence` reducer action (added to `tutorialReducer.ts`) carrying the total points earned; the old `play-sequence`-specific branch inside `submitPeg` was removed since it's now dead.
- A scripted opponent card that would be illegal at its scripted count point is now permanently skipped (sliced out of `oppRemaining`) rather than being retried indefinitely, so the fixed teaching script always terminates.

**Tests:** `tutorialGrading.test.ts` gained tests for the sequence engine (score progression, a run, a go, the last-card bonus, `learnerGo`/`playLearnerCard` edge cases) and `categoryProgress`. `PeggingExercise.test.tsx` (new) drives all three `PeggingExercise` modes (`select-legal`, `select-scoring`, `play-sequence`) through Testing Library, including the full `play-sequence` flow to a `complete-peg-sequence` dispatch with the correct earned total.

### 6. Add the missing component tests (ranked defect #6, Medium)

**Problem:** `HandScoringExercise.tsx`, `DiscardExercise.tsx`, `PeggingExercise.tsx`, `TutorialShell.tsx`, and `GuidedRoundView.tsx` had zero tests; the three components that did have tests (`SelectableHand`, `CoachPanel`, `RoundMap`) covered only a fraction of their acceptance criteria.

**Fix — new test files:**
- `HandScoringExercise.test.tsx`: example-mode `reveal-next`, practice-mode `clear-selection` and the disabled-submit-until-selection state, and a full keyboard-only completion of a "pair-find" exercise through a live reducer (using a `tabUntil` helper that walks `Tab` presses until an element with a matching accessible name is focused, since credited/disabled cards drop out of tab order as the exercise progresses).
- `DiscardExercise.test.tsx`: disabled confirm button until exactly two cards are chosen, crib-ownership copy, ignoring clicks while `locked`, and an end-to-end integration test (real reducer) selecting a valid discard, confirming, and seeing the "try another discard" affordance.
- `TutorialShell.test.tsx`: heading structure (`h1`/`h2`), step-count text, Back/Next/Skip button enabled/disabled states and dispatches, the Rules `Offcanvas` toggle, and the coach `role="status"` live region.
- `GuidedRoundView.test.tsx`: error state + restart button, discard confirmation (two-card selection then confirm), over-31 cards rendered `disabled`, `acknowledge()`/`completeCount()` dispatch to the mocked `round`, and `reset()`/`onChange` wiring.
- `PeggingExercise.test.tsx` (also new, per item 5 above): all three task kinds.

**Fix — expanded existing test files:**
- `SelectableHand.test.tsx`: keyboard-only interaction (Tab/Space/Enter), static `mode="none"` rendering, and accessible naming/disabled state for `credited`/`hinted`/`disabled` cards.

### 7. Add negative fixtures to `catalog.test.ts` (ranked defect #9, Low)

**Problem:** `validateCatalog() === []` was only ever exercised against the real, already-clean catalog, so a broken check inside `validateCatalog` (e.g. one that always returns `[]`) would not be caught.

**Fix:**
- Refactored `validateCatalog.ts` to extract its per-scenario logic into exported, individually testable pure functions: `checkCards`, `uniqueSlug` (already existed, now exported), `checkScoreScenario`, `checkDiscardScenario`, `checkPegScenario`. `validateCatalog()` itself is unchanged in behaviour — it just now calls these extracted functions instead of inlining the same logic three times.
- Added a new `describe` block to `catalog.test.ts` with 7 negative-fixture tests: a duplicate id and a non-slug id (`uniqueSlug`); an authored `"joker"` suit, an out-of-range rank, and a duplicate card (`checkCards`); a genuine zero-score hand and a mismatched record key, plus an unsatisfiable `require` category (`checkScoreScenario`); an out-of-range `acceptTopN` and a best-discard with no authored reason (`checkDiscardScenario`); a `reasons` key that isn't a real two-card subset of the hand; and a sequence over 31 plus an illegal scripted opponent play (`checkPegScenario`). Each test constructs a bad fixture and asserts the specific problem string is produced — so `validateCatalog() === []` on the real catalog now means the checks are provably sharp, not vacuous.

### 8. Finish the browser pass and record it (ranked defect — partially addressed, see below)

I ran a scoped browser smoke pass (not the full §7.3 checklist) covering the tutorial surfaces this remediation touched:
- `/learn` hub loads with all 7 lessons and progress indicators.
- Lesson navigation into `/learn/count-a-hand` renders the shell correctly.
- A passive step (`reveal-next`) and a graded pair-finding exercise both work end to end: selection, submission, correct grading with coach feedback ("NICE — Pair of twos for 2"), running point total, and cards disabling after being counted.
- The Skip button advances to the next step without crashing and the progress bar updates.

**Not re-verified in this pass** (carried over from the gap report's own open list, §7.3): the three `/play` breakdown panels at the show, 200% zoom, 320px layout, keyboard-only completion in a real browser (jsdom coverage was added instead — see item 6), completing/restarting either guided round in a live browser, the Easy-game handoff at the table, `prefers-reduced-motion`, and the flag-off preview build. These remain open exactly as the gap report described them; closing them fully would require a much longer, dedicated UI-QA pass than this remediation's scope.

**Unrelated observation (out of scope, flagged for awareness only):** while smoke-testing, the main `/play` table appeared to stall at the cut-for-deal screen in the sandboxed browser tool — clicking the fanned deck cards there did not visibly progress the game in that environment. `Cribbage.tsx`'s `playerCut` handler and the `cutting`-stage `CardHand` wiring are unchanged by this remediation (this file was already modified by the prior developer, not touched here), `Cribbage.test.tsx`'s existing assertion that starting a round reaches `cutting`/`dealing`/`selection`/`playing` still passes, and no console errors were observed. This looked more consistent with a browser-automation click-targeting quirk (overlapping absolutely-positioned card images) than a functional regression, but since `/play` is outside this remediation's scope (the gap report is entirely about the tutorial feature) I did not investigate further or change any main-game file. Worth a manual check in a real browser if it recurs.

### 9. Fix `second-round` crib-flush contrast and `first-round` "includes nobs" (ranked defects #7 and #8, Low-Med)

**`second-round` (defect #7):** the coach's crib checkpoint claimed "Four of a suit is not a crib flush unless the starter matches," but the authored deal made a four-club crib structurally unreachable (the opponent's discard and the learner's kept six shared at most one club). Changed one card in the `second-round` deck (`scenarios.ts`) so the learner's hand plus the opponent's discard can produce a genuine four-club crib against a non-matching starter, making the coach's claim demonstrable. `guidedRound.test.ts` now asserts the resulting crib's suits and score (4 points, no flush) to lock this in.

**`first-round` (defect #8):** the coach asserted "This hand includes nobs" unconditionally, which is only true if the learner happens to keep the jack of diamonds. Hedged the copy to *"If you kept the jack of diamonds, this hand includes nobs — it matches the starter's suit,"* so the sentence is true regardless of the learner's discard choice.

### 10. Housekeeping (ranked defects #10–17, Low)

| Defect | Fix |
| --- | --- |
| #10 discard retries stop counting attempts | `submitDiscard` now increments `attempts` on every wrong submission (previously froze after the first miss), consistent with #1's fix. |
| #11 `GroupList` pair aggregation reorders rows / prints points twice | `aggregateDisplay` now preserves the kernel's `fifteen → pair → run → flush → nobs` group order and strips the score from aggregated pair labels so the points render once, in `.groupList-points`, not twice. |
| #12 X2 console mismatch logs every render | `ScoreExplanation.tsx` now guards the mismatch `console.log` with a `useRef` keyed on the hand, so it logs at most once per unique hand. |
| #13 `useMemo` never hits | `ScoreExplanation.tsx`'s memo is now keyed on stable `cardKey` strings instead of the fresh `hand`/`starter` object references `Cribbage.tsx` creates every render, and the unused `total` dependency was dropped. |
| #14 `discard-theirs` missing the tempting 5-5 | Reworked the `discard-theirs`/`discard-yours` hands (`scenarios.ts`) to include two fives, with updated prompts and reasons that teach "don't feed either five into their crib." |
| #15 off-palette colours + duplicate CSS rules | Removed the dead, superseded `.scoreExplanation`/`.scoreExplanation-total` rule block in `App.css` (the newer block further down was the one actually in effect). Replaced `#1f6b3a` and `#123d27` inside the new tutorial CSS block with the approved palette (`#166534`, `#14532d`); left `#9b1c1c` (the error-box border) with an explanatory comment, since the gap report itself calls this one "defensible" — an error state needs a red affordance the 7-colour decorative palette doesn't provide. (Pre-existing `#1f6b3a`/`#123d27` uses in the unrelated, out-of-scope `.learn-accordion`/`.learn-page` block were left untouched.) |
| #16 `SUIT_FLUSH_NAME` dead identity function | Removed; `game.ts` now imports and uses `entities.ts`'s existing `SUIT_NAMES` export. |
| #17 (bundle) silent `return state` fallback; hardcoded `"ready-table"` / `curriculumVersion: 1`; duplicate imports | `tutorialReducer.ts`'s inner `submit` switch now ends with an exhaustiveness guard (`assertNeverStepKind`) that throws if a future step kind is added without a `submit` branch, instead of silently no-op'ing. `Lesson.tsx` now derives the last beginner lesson id from `BEGINNER_PATH` instead of the hardcoded string `"ready-table"`, and imports `CURRICULUM_VERSION` instead of hardcoding `1` in all four `track()` calls. Consolidated the duplicate `'../app/persistence'` and `'react-bootstrap'` import statements in `Lesson.tsx`. Also removed the unnecessary `ReadonlyArray` cast in `countNobs`'s call site (part of the original Phase 0 nits list, same bucket). |

---

## 2. Additional defects found and fixed during remediation (not in the original gap report)

While writing the comprehensive `guidedRound.test.ts` (item 3 above), two real bugs surfaced that the gap report's more limited empirical probing hadn't caught:

1. **`GuidedRound.view().log` aliased the internal mutable array.** `view()` returned `this.log` directly rather than a copy, so a test capturing the initial view and later comparing it against a post-`reset()` view saw the *same* array object that had since been mutated by the round's own progress — `reset()` looked broken even though the reset logic itself was correct. Fixed by returning `[...this.log]` (a snapshot) from `view()`.
2. **Pegging log entries used a generic reason instead of `explainPegPlay`'s specific label.** `guidedRound.ts`'s `applyScore` only looked up `SCORE_REASON_COPY[reason]` (e.g. "a run in the play"), even though `explainPegPlay` had already computed a specific, more useful label (e.g. "Run of three: 5-3-4") that was being discarded. `pump()` now threads `explainPegPlay`'s per-event labels through to `applyScore` for `play-card` actions, so the guided-round log shows the specific label.

Two TypeScript compile errors in `tutorialGrading.test.ts` (`.sort()` on a `readonly string[]`, `.at()` on a `readonly` array under this project's `tsconfig` target) were also fixed as part of getting `tsc --noEmit` clean.

---

## 3. Items from the gap report intentionally left open

These are lower-priority items the gap report raised outside its numbered §9 recommendations, or where §9's item 8 (the full manual browser pass) wasn't fully closed. None of them block the ten primary recommendations, and none surfaced as automated test failures.

| Item | Gap-report location | Why left open |
| --- | --- | --- |
| §7.3 full manual browser checklist (12 items) | §7.3, §9 item 8 | Only a scoped smoke pass of the tutorial surfaces was done (see §1 item 8 above). The remaining items (200% zoom, 320px, `/play` show panels, `prefers-reduced-motion`, flag-off preview build, full guided-round completion/restart in a live browser) need a dedicated UI-QA pass beyond this remediation's scope. |
| `GroupList`/`SelectableHand` duplicate legacy class-name aliases (e.g. `groupList grouplist`, `groupList-label lbl`) | §6 "Implemented but not in the plan"; also `groupList-classnames` follow-up | Cosmetic/dead-weight only (no functional or accessibility effect — the semantic class is always present alongside the alias); not in the numbered §9 list. Removing the aliases would require confirming no external CSS/test depends on the short aliases first, which risks scope creep for a purely cosmetic cleanup. |
| S-C2, S-P2, S-G3 spec test-ID naming/traceability (§3 scorecard) | §3 | The *behaviour* those IDs originally named is now covered (guided-round S-G3/S-G4/S-G5 functionally, catalog/discard scenarios via the new negative fixtures), but tests are not literally renamed to embed the spec IDs in their titles. This is a documentation-traceability convention, not a functional gap, and renaming tests across the suite risked unrelated churn. |
| T-B1 hardcoded 12-file list in `boundary.test.ts` / T-B2 grep-only analytics check | Phase 3 "Other deviations" | Both still work correctly against the current file set; making T-B1 scan the directory and T-B2 call `track()` behaviourally were not called out in the numbered §9 list and were judged lower value than the items that were addressed. |
| Eager (non-lazy) `findLesson` import in `persistence.ts` | Phase 3 "Other deviations" | The gap report itself confirms there is no import cycle, so this is a bundle-size nit, not a correctness issue; not in §9. |
| `rankDiscards` before/after timing measurement (Phase 0 plan requirement) | §4 Phase 0, §8 | A documentation/process artifact (task 0.2 acceptance), not a code defect; no code path needed to change to produce it, and it isn't in §9's list either. |
| "Practise a weak concept" deep-links to a `BEGINNER_PATH` lesson instead of a Quick Practice lesson | Phase 4 "Smaller items" | Not in §9; would require deciding which QP lesson maps to which weak concept, which the gap report doesn't specify and which risks an incorrect authoring choice without product input. |

---

## 4. Files touched in this remediation

**Engine / shared UI (small, targeted changes):**
- `src/app/game.ts` — removed `SUIT_FLUSH_NAME`, use `SUIT_NAMES`; `countNobs` takes `ReadonlyArray<Card>`.
- `src/App.css` — removed duplicate `.scoreExplanation`/`.scoreExplanation-total` rule block; replaced off-palette colours in the tutorial block; added `.coach-math`.
- `src/components/GroupList.tsx`, `src/components/GroupList.test.tsx` — pair-aggregation ordering and double-print fix, tests.
- `src/components/ScoreExplanation.tsx`, `src/components/ScoreExplanation.test.tsx` — `useMemo` keying, guarded mismatch log, updated assertion.

**Tutorial reducer / grading / content:**
- `src/features/tutorial/tutorialReducer.ts` — mastery accounting helpers, skip-persistence field, consistent attempts counting, `Feedback.math`, `complete-peg-sequence` action, exhaustiveness guard.
- `src/features/tutorial/tutorialGrading.ts`, `src/features/tutorial/tutorialGrading.test.ts` — `categoryProgress`, the `play-sequence` pegging engine, related tests, TS fixes.
- `src/features/tutorial/scenarios.ts` — `discard-theirs`/`discard-yours` 5-5 rework, `second-round` deck fix, `first-round` nobs copy hedge.
- `src/features/tutorial/guidedRound.ts` — `view().log` snapshot fix, specific peg-play labels threaded into `applyScore`.
- `src/features/tutorial/guidedRound.test.ts` — full rewrite (21 tests, both scripts, S-G2–S-G6).
- `src/features/tutorial/validateCatalog.ts` — extracted and exported `checkCards`, `uniqueSlug`, `checkScoreScenario`, `checkDiscardScenario`, `checkPegScenario` (behaviour-preserving refactor).
- `src/features/tutorial/catalog.test.ts` — negative-fixture test suite.

**Tutorial screens / components:**
- `src/screens/Lesson.tsx`, `src/screens/Lesson.test.tsx` — mastery/skip wiring, `CURRICULUM_VERSION`, derived last-lesson id, de-duplicated imports, new tests.
- `src/components/tutorial/CoachPanel.tsx` — `CategoryProgress` now imported from `tutorialGrading.ts`.
- `src/components/tutorial/TutorialShell.tsx`, `src/components/tutorial/TutorialShell.test.tsx` — `progress`/`secondary` wiring, new test file.
- `src/components/tutorial/PeggingExercise.tsx`, `src/components/tutorial/PeggingExercise.test.tsx` — `play-sequence` UI, new test file.
- `src/components/tutorial/SelectableHand.test.tsx` — expanded coverage.
- `src/components/tutorial/HandScoringExercise.test.tsx` (new)
- `src/components/tutorial/DiscardExercise.test.tsx` (new)
- `src/components/tutorial/GuidedRoundView.test.tsx` (new)

No changes were made to `gamePlayer.ts`, `gameSlice.ts`, `store.ts`, `hooks.ts`, `difficulty.ts`, `CardComponents.tsx`, `CribbageBoard.tsx`, `Cribbage.tsx`, `App.tsx`, `Splash.tsx`, `Stats.tsx`, `FriendPlay.tsx`, `RulesReference.tsx`, `entities.ts`, `persistence.ts`, `scoreCopy.ts`, `Learn.tsx`, `GameOverModal.tsx`, `setupTests.ts`, `vite-env.d.ts`, or any file outside `src/`. Those files were already part of the pre-existing (pre-remediation) tutorial implementation and were not in scope for this pass except where a specific gap-report defect named them (`game.ts`, `App.css`, `GroupList.tsx`, `ScoreExplanation.tsx` above).

---

## 5. Verification

```
npx vitest run   → 34 test files, 203 tests, all passing
npm run lint     → clean (eslint .)
npx tsc --noEmit → clean
npm run build    → tsc --noEmit + vite build succeed
```

A scoped browser smoke pass confirmed the Learn hub, lesson navigation, a graded exercise (selection → submit → correct grading → coach feedback → running total → card disabling), and the Skip button all work end to end with no console errors, as described in §1 item 8.
