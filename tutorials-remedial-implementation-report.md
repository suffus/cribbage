# Tutorial remediation — implementation report

Executed against `tutorial-remediation-plan.md`, phase by phase, per the execution rules in the
work order. `tutorial-remedial-spec.md` and the original user instructions were consulted only to
resolve ambiguity in the plan's wording; no work was added from them beyond what the plan specifies.

## 1. Status per phase

| Phase | Status |
| --- | --- |
| 1 — Counting exercises: card reuse, selectable starter, working `Clear` | Complete |
| 2 — Catalog validation for reachable counting scenarios | Complete |
| 3 — Shared trick row and board wrappers; guided-round table and show totals | Complete |
| 4 — Guided round: retain finished tricks, learner-paced opponent | Complete |
| 5 — Guided round: make the counting pause submittable | Complete |
| 6 — Pegging exercise: horizontal row, learner-paced, score callout, board | Complete with deviations |
| 7 — Engine: expose hand EV and crib EV on `DiscardOption` | Complete with deviations |
| 8 — Discard lesson: three-axis coaching and two-number disclosure | Complete with deviations |
| 9 — Round demo 1/3: content types, demo decks, validation, step kind | Complete |
| 10 — Round demo 2/3: the demo runner | Complete with deviations |
| 11 — Round demo 3/3: `RoundDemo` component and the new Lesson 1 | Complete with deviations |
| 12 — Navigation and orientation pass | Complete with deviations; one final-acceptance invariant blocked |
| Final acceptance | Complete, with the same one invariant blocked (carried from Phase 12) |

No phase failed outright. Every phase's own definition-of-done commands pass on the current tree;
the one item that cannot pass as literally specified is a repository-wide invariant shared by
Phase 12 and the final-acceptance checklist (see **Blocked items**), not a defect introduced by this
work.

## 2. Definition-of-done evidence

### Aggregate, current tree (covers every phase's tests simultaneously)

```
npm install        → up to date, audited 334 packages
npm run lint        → 0 problems (0 errors, 0 warnings)
npm run build       → tsc --noEmit && vite build; exit 0; dist/ written
npx vitest run      → Test Files 38 passed (38); Tests 291 passed (291); 0 skipped/todo
```

Baseline recorded at the start of this work was **34 test files / 203 tests**. The final count
(**38 files / 291 tests**) is greater in both dimensions, as the plan's final-acceptance section
requires. `rg` found zero `.skip(` / `.todo(` / `it.skip` / `describe.skip` / `xit(` / `xdescribe(`
occurrences anywhere in `src`.

### Phase 1–5 (counting, shared wrappers, guided-round table/board/count)

These phases were completed earlier in this same session, each with its own definition-of-done run
(`npx vitest run`, `npm run lint`, `npm run build`, plus the phase's specific `rg` checks and manual
browser walkthroughs) passing before the next phase began, per the execution rule "complete a phase
… before starting the next." The tests those phases added or updated —
`SelectableHand.test.tsx`, `HandScoringExercise.test.tsx`, `DiscardExercise.test.tsx`,
`TrickRow.test.tsx`, `TutorialBoard.test.tsx`, `GuidedRoundView.test.tsx`, `guidedRound.test.ts`,
`catalog.test.ts` — all continue to pass in the aggregate run above, confirming no later phase
regressed them.

### Phase 6 — Pegging exercise

- `npx vitest run src/components/tutorial/PeggingExercise.test.tsx src/features/tutorial/tutorialGrading.test.ts` — passes (part of the aggregate run).
- Manual: verified in-session that pegging cards lay out horizontally via `TrickRow`, that the
  learner paces the opponent with an explicit "Let them play" control, that scoring plays produce a
  `.peg-callout` announcement and a `peg-note` dispatch, and that `TutorialBoard` reflects peg
  movement.
- Deviation: see §3.1.

### Phase 7 — Engine: `DiscardOption.handScore` / `.cribScore`

- `npx vitest run src/app/game.test.ts` — passes, including the new
  `"reports hand and crib expectation that reconstruct the ranked score"` consistency test and the
  pre-existing `"keeps the frozen Expert discard on a few dozen hands and is 15 descending"` test
  (AI behaviour unchanged, per RM-6's own invariant).
- Deviation: see §3.2.

### Phase 8 — Discard lesson coaching

- `npx vitest run src/features/tutorial/tutorialCopy.test.ts src/features/tutorial/catalog.test.ts` — passes.
- Deviation: see §3.3.

### Phase 9 — Round demo content

- `npx vitest run src/features/tutorial/catalog.test.ts` — passes, including `validateCatalog()`
  over the full lesson catalog and `validateRoundScripts` over all round scripts (`completeRound`,
  the two demo scripts, and the guided-round scripts).

### Phase 10 — Round demo runner

- `npx vitest run src/features/tutorial/roundDemo.test.ts` — passes, all named cases: twelve-card
  deal, correct starters and his-heels handling for both hands, every pegging card with owner and a
  post-31 count reset, three breakdowns per hand with correct totals, cumulative scores of
  `You 36 · Them 25` at the end, `back()`/`reset()` behaviour, and constructor validation errors.
- Deviation: see §3.4.

### Phase 11 — `RoundDemo` view and new Lesson 1

- `npx vitest run src/components/tutorial/RoundDemo.test.tsx src/screens/Lesson.test.tsx src/features/tutorial/catalog.test.ts src/App.css` — all named tests present and passing:
  `"labels the advance button for the current stage"`, `"advances the demo and reports the change"`,
  `"shows both hands face up and names each played card's owner"`,
  `"renders a show breakdown whose total is the engine's total"`,
  `"renders the cribbage board with the cumulative score"` (all in `RoundDemo.test.tsx`);
  `"walks the lesson-1 demonstration into the deal"` and the two updated defect-1/defect-2 tests
  (`Lesson.test.tsx`); `"lesson 1 is an explain, a two-hand demonstration and a recap"` and
  `"the beginner path still fits inside about half an hour"` (`catalog.test.ts`).
- `rg -n "shape-deal|shape-discard|shape-pegging|shape-show|shape-board" src/` → no matches.
- `rg -n "setTimeout|setInterval|requestAnimationFrame|matchMedia" src/components/tutorial/RoundDemo.tsx src/screens/Lesson.tsx` → no matches.
- `npm run lint` / `npm run build` — 0 problems, exit 0.
- Manual (live-browser verification pass, `npm start` + `http://localhost:3000`): **all 13 checklist
  items passed**. `/learn` shows `8 min` on the first card; Lesson 1 opens on "One round, start to
  finish" / "Step 1 of 3"; the demonstration shows "Hand 1 of 2 — they deal.", the "Hand 1 of 2"
  round-map caption, the six-cards-each coach line, and a disabled `Back one step`; twelve deals fill
  both six-card rows; the crib forms; the starter `10♠` turns with the correct his-heels coaching;
  eight plays land in one horizontal row naming owners, with the count climbing through a run-of-
  three (3 points to the learner) and a 31-exactly (2 points to the opponent), the finished trick
  staying dimmed with a "count reached 31" sentence; the three show breakdowns read `Your hand` 8 /
  `Their hand` 4 / `Their crib` 5; hand 2 opens with caption "Hand 2 of 2", header "Hand 2 of 2 — you
  deal.", and board `You 11 · Them 12`; the demonstration ends with a disabled "The demonstration is
  over" and board `You 36 · Them 25`; `Back one step` returns to the previous beat; and the footer's
  `Next` reaches the recap screen. No console errors were observed.
- Deviation: see §3.5.

### Phase 12 — Navigation and orientation pass

- `npx vitest run src/components/tutorial/TutorialShell.test.tsx src/features/tutorial/tutorialReducer.test.ts src/screens/Lesson.test.tsx src/components/tutorial/RoundMap.test.tsx` —
  all named tests present and passing: `"names the current activity in the workspace heading"`,
  `"reports the same step number in the header and the progress bar"`,
  `"offers a way out of step 0 and enables Back afterwards"`, `"marks Skip as not counting toward
  completion"` (`TutorialShell.test.tsx`); `"Back then Next restores the counted groups, earned
  total, hints and attempts"`, `"restart-step clears the saved copy so the step really starts
  over"` (`tutorialReducer.test.ts`); `"shows a completion screen with three actions after a Quick
  Practice lesson"`, `"records a mastery attempt only once even after Back and Next"`
  (`Lesson.test.tsx`); `"announces completed phases to a screen reader"` (`RoundMap.test.tsx`).
- `rg -n "Your hand<" src/components/tutorial/TutorialShell.tsx` → no matches.
- `rg -n "role=\"status\"|aria-live" src/components/tutorial/` → matches **two** files,
  `CoachPanel.tsx` and `GuidedRoundView.tsx`, not one. **Blocked** — see §4 of blocked items below.
  This is the only checklist line in the whole remediation that does not pass as written.
- `npm run lint` → 0 problems. `npm run build` → exit 0.
- Manual (live-browser verification pass, `npm start` + `http://localhost:3000`, re-run after an
  initial pass found the dev server unreachable — see note below): **all 6 checks passed** — (1)
  `/learn/count-a-hand` step 1 shows heading "Watch this count", footer "Step 1 of 9", and "Back to
  Learn" navigates to `/learn`; (2) counting a pair, then Back, then Next, still shows the credited
  pair and its total afterward; (3) "Skipping does not count as completed." sits beside an outlined
  `Skip this step`, the header `Exit` is filled/solid and `Rules` is outlined; (4)
  `/learn/peg-practice` skipped four times lands on "Pegging practice complete" with `Practise
  again` / `Continue the beginner path` / `Back to Learn`; (5) on `/learn/coached-round`, `Confirm
  two discards` is the first control below the table and `Restart this round` is outlined/grey at
  the bottom, below the log; (6) the round-map strip shows a ✓ before the completed `Deal` phase. No
  console errors were observed.
- Deviations: see §3.6–3.8.

### Final acceptance — repository-wide invariants

```
rg -n "setTimeout|setInterval|requestAnimationFrame|matchMedia" src/features/tutorial/ src/components/tutorial/   → no matches
rg -n "role=\"status\"|aria-live" src/components/tutorial/                                                        → CoachPanel.tsx AND GuidedRoundView.tsx (blocked, see §4)
rg -n "thePlayer" src/features/tutorial/ src/components/tutorial/                                                 → no matches
rg -n "thePlayer" src/screens/Lesson.tsx                                                                          → only the handoff import + its use in handoff()
npx vitest run src/features/tutorial/boundary.test.ts                                                             → passes
rg -n "rankPlays" src/features/tutorial/                                                                          → only the boundary assertion in tutorialGrading.test.ts
rg -n "className=\"seq\"|className='seq'" src/                                                                    → no matches
rg -n "resolveOpponentTurns" src/                                                                                 → no matches
rg -n "[0-9]+\.[0-9]" src/features/tutorial/scenarios.ts                                                          → no matches
rg -n "shape-deal|shape-discard|shape-pegging|shape-show|shape-board" src/                                        → no matches
git diff --stat -- src/components/CribbageBoard.tsx                                                               → no changes (empty diff)
npx vitest run src/features/tutorial/catalog.test.ts                                                              → passes
npx vitest run src/app/game.test.ts src/app/gamePlayer.test.ts                                                    → passes (34 tests), including the frozen-Expert-discard test
```

Every invariant passes except the shared `role="status"` / `aria-live` check (§4).

## 3. Deviations

Each entry names the plan text, what was found, the change made, and why it was treated as
mechanical drift rather than a stop-and-report conflict (all preserve the plan's evident intent).

1. **Phase 6 — `PeggingExercise.test.tsx` accessible name.** The plan's step 10 gave `TrickRow` an
   explicit `label="On the table"`, but the horizontal-layout test the plan itself specifies in a
   later step queried `getByRole("list", { name: /cards on the table/i })`. Adjusted the test's
   regex to `/on the table/i` to match the label the same phase mandated; the intent (assert the
   pegging cards render as an accessible list) is unambiguous.

2. **Phase 7 — a comment in `src/app/game.ts` triggered its own `rg` check.** The definition-of-done
   `rg` check for `handScore|cribScore` was meant to match only the two new `DiscardOption` fields
   and the `options.push` call site, but an explanatory comment happened to contain the literal
   string `cribScore` too, producing an extra match. Reworded the comment (preserving its meaning)
   so only the intended three sites match.

3. **Phase 8 — `discard-yours` scenario prompt text.** The authored prompt (plan step 5) read "your
   own crib"; the new validation rule (plan step 6) requires the literal substring "your crib".
   Changed the prompt to "your crib" — a strict substring of what was authored, so no coaching
   content was lost — to satisfy the rule the same phase introduces.

4. **Phase 10 — `roundDemo.test.ts` owner label.** A test asserted a pegging card's owner as
   `"them"`; the `DemoOwner` type (defined earlier in the same phase) only allows `"you"` /
   `"opponent"`. Corrected the test's expectation to `"opponent"`.

5. **Phase 11 — component name `RoundDemo_View` vs `RoundDemoView`.** The plan uses `RoundDemoView`
   everywhere except one occurrence of `RoundDemo_View` (a typo). Used `RoundDemoView` throughout,
   matching every other reference in the plan (imports, tests, JSX usage).

6. **Phase 11 — `Lesson.test.tsx`, `"walks the lesson-1 demonstration into the deal"`.** The plan's
   recipe asserts `screen.getByText(/Hand 1 of 2/)`, but the plan's own manual-verification section
   for this same phase (and the code the phase specifies: the `RoundMap` `mapCaption` plus the
   `RoundDemoView` header line) puts that text on screen in **two** places at once — the round-map
   caption ("Hand 1 of 2") and the demonstration's own header ("Hand 1 of 2 — they deal."). A
   partial regex match is therefore ambiguous and `getByText` throws a multiple-matches error.
   Changed the query to the exact string `"Hand 1 of 2"` (RTL's default exact-match mode for a
   string argument), which matches only the caption and leaves the assertion intent intact.

7. **Phase 12 — `tutorialReducer.test.ts`, `"Back then Next restores…"`.** The plan says to credit
   only one group of the `pair-find` scenario before dispatching `{ type: "next" }`. That scenario
   requires **two** pair groups (2H-2C and 9D-9S) before the step's status becomes `"complete"`,
   and the reducer's `"next"` case is an intentional no-op for a non-passive step that is still
   `"in-progress"` (confirmed by direct probe: dispatching `next` after one credited group returns
   the identical state reference and `stepIndex` unchanged). Crediting only one group would make the
   whole round-trip trivial — nothing would ever move — so both groups are credited here, which lets
   `next` actually advance and lets the test exercise the restore path it is named for.

8. **Phase 12 — `Lesson.test.tsx`, `"shows a completion screen with three actions…"`.** The plan's
   recipe is "click Skip this step four times…, click Next". `peg-practice` has four steps; skipping
   the fourth (the recap, the lesson's last step) is itself what flips `state.lessonComplete` to
   `true` inside the same dispatch, and Lesson.tsx's new Quick Practice completion branch (this same
   phase's step 9) renders immediately once that happens — confirmed empirically: after four real
   skip clicks the screen already reads "Pegging practice complete" with no "Next" button left to
   click. The extra click was dropped; the four skips alone reach the completion screen, which is
   what the test asserts.

9. **Phase 12 — `Lesson.test.tsx`, `"records a mastery attempt only once even after Back and
   Next"`.** The plan's recipe clicks `Back` immediately after solving step 0. Phase 12's own step 6
   relabels step 0's footer button `"Back to Learn"` (it calls `onExit`, not
   `dispatch({ type: "back" })`), so there is no button named exactly `"Back"` until the learner has
   left step 0 at least once. Added an initial `Next` click before `Back` — which is also what
   actually exercises the completed-step-restore path the test is meant to guard, since without
   first leaving step 0 there is nothing for `Back` to restore.

None of these change what any production code does; all are corrections to test/content wording
so that an unambiguous, plan-mandated behaviour is asserted correctly.

## 4. Blocked items

**Repository-wide invariant / Phase 12 step 11 & final-acceptance checklist — "exactly one live
region" (R6).**

- **What the plan says:** `rg -n "role=\"status\"|aria-live" src/components/tutorial/` must match
  only `src/components/tutorial/CoachPanel.tsx`. Phase 12's "Do NOT" section states this as an
  assumed fact ("`CoachPanel.tsx` owns the only one (R6)").
- **What was found:** `src/components/tutorial/GuidedRoundView.tsx` already contains a second
  `role="status" aria-live="polite"` region — the `error-box` shown when a scripted training deal
  hits `view.awaiting === "error"`. `git diff HEAD -- src/components/tutorial/GuidedRoundView.tsx`
  shows this line was never touched by any phase in this remediation; it was already present in the
  pre-remediation baseline commit. The plan's assumption that `CoachPanel` was already the sole live
  region was false before this work began, independent of anything Phase 12 changed.
- **Why this stopped here rather than being patched:** removing `role="status"`/`aria-live` from
  `GuidedRoundView.tsx`'s error box is outside every phase's scope — Phase 3/4/5's work on that file
  is "reorder and restyle only" territory by Phase 12's own guardrail, and no phase's steps mention
  the error box at all. Silently deleting an existing accessibility affordance to make an `rg` count
  match felt like exactly the kind of unrequested code change the execution rules prohibit.
- **Recommended resolution:** two options, either acceptable — (a) accept two live regions as
  correct: the error box announces an unrecoverable engine fault (a distinct, rare situation) while
  `CoachPanel` announces routine coaching feedback, so a screen-reader user is not actually harmed by
  the second region; update the invariant text to allow it. Or (b) if a single global live region is
  truly required, remove `role="status" aria-live="polite"` from the `error-box` `div` in
  `GuidedRoundView.tsx` in a small follow-up change explicitly scoped to that fix (and confirm the
  `"This training deal could not continue"` message is still discoverable some other way, e.g. via
  the coach panel instead).

No other blocked items were found. Every other checklist line across all twelve phases and the
final-acceptance section passes.

**Process note (not a plan deviation):** the first attempt at both live-browser manual walkthroughs
found the dev server unreachable — it had been started in a background subshell whose process was
reaped when that shell call's session ended. Restarted with `nohup … & disown`, confirmed reachable
(`curl` → `200`), and re-ran both walkthroughs to completion; results above are from the successful
re-runs.

## 5. Files changed

Modified:

- `src/App.css`
- `src/app/game.ts`, `src/app/game.test.ts`
- `src/components/tutorial/DiscardExercise.tsx`, `DiscardExercise.test.tsx`
- `src/components/tutorial/GuidedRoundView.tsx`, `GuidedRoundView.test.tsx`
- `src/components/tutorial/HandScoringExercise.tsx`, `HandScoringExercise.test.tsx`
- `src/components/tutorial/PeggingExercise.tsx`, `PeggingExercise.test.tsx`
- `src/components/tutorial/RoundMap.tsx`, `RoundMap.test.tsx`
- `src/components/tutorial/SelectableHand.tsx`, `SelectableHand.test.tsx`
- `src/components/tutorial/TutorialShell.tsx`, `TutorialShell.test.tsx`
- `src/features/tutorial/catalog.test.ts`
- `src/features/tutorial/completeRound.ts`
- `src/features/tutorial/guidedRound.ts`, `guidedRound.test.ts`
- `src/features/tutorial/lessonCatalog.ts`
- `src/features/tutorial/scenarios.ts`
- `src/features/tutorial/tutorialCopy.ts`, `tutorialCopy.test.ts`
- `src/features/tutorial/tutorialGrading.ts`, `tutorialGrading.test.ts`
- `src/features/tutorial/tutorialReducer.ts`, `tutorialReducer.test.ts`
- `src/features/tutorial/tutorialTypes.ts`
- `src/features/tutorial/validateCatalog.ts`
- `src/screens/Lesson.tsx`, `Lesson.test.tsx`
- `package-lock.json` — incidental: `npm install` synced the recorded package version
  (`0.2.0` → `0.3.0`) to match `package.json`; not a remediation change.

New:

- `src/components/tutorial/RoundDemo.tsx`, `RoundDemo.test.tsx`
- `src/components/tutorial/TrickRow.tsx`, `TrickRow.test.tsx`
- `src/components/tutorial/TutorialBoard.tsx`, `TutorialBoard.test.tsx`
- `src/features/tutorial/roundDemo.ts`, `roundDemo.test.ts`
- `tutorials-remedial-implementation-report.md` (this file)
