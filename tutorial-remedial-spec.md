# CribbageX Interactive Tutorial — Remediation Specification

**Status:** implementation-ready. Written for an engineer with access to this repository and no access to the
original product report, the implementation report, or the previous remediation report.
**Scope:** the tutorial feature — `src/features/tutorial/`, `src/components/tutorial/`, `src/screens/Learn.tsx`,
`src/screens/Lesson.tsx`, plus the small number of shared files named per item (`src/app/game.ts`,
`src/App.css`, `src/components/ScoreExplanation.tsx`).
**Verification baseline at time of writing:** `npx vitest run` → 34 files / 203 tests, all passing.
`npm run lint` clean. That green suite is not evidence the feature works; see §3.

---

## 1. Summary

The tutorial's scaffolding is built and its engine layer is sound, but the learner-facing path is **not
completable**. Three independent dead ends sit on the required route: every hand-counting exercise except one
(`pair-find`) is mathematically impossible to finish because a counted card is permanently disabled and the
starter card is not selectable at all; the coached round's "Count selected cards" button is a literal no-op
because the reducer has no `submit` branch for `guided-round` steps, so neither coached round can be finished;
and the coached round never renders the played pegging sequence, so a played card simply vanishes. Lesson 1 is
six paragraphs of static text rather than a demonstration of a round, the discard lesson exposes one blended
expected-value number instead of separating hand value from crib value, and the pegging exercise stacks the laid
cards vertically and resolves the opponent's entire reply in the same tick as the learner's click.

The previous remediation attempt was accurate about the defects it chose and **all ten of its claimed fixes are
present in the source**. Its problem is coverage, not correctness: it verified the one counting scenario that
happens to need neither card reuse nor the starter (`pair-find`), wrote its guided-round tests against the
`GuidedRound` class rather than through the UI components, and therefore certified as working the exact two
paths that are broken. Two of its fixes — the `play-sequence` pegging engine and the "Show the math"
disclosure — now conflict with what the user is asking for and need rework rather than reverting.

The work ahead is roughly: unblock the three dead ends (counting, guided count submission, pegging table),
then rebuild three lessons' interaction design (round-shape demonstration, discard coaching, pegging pacing),
then a navigation pass. The engine kernel (`scoreHandDetailed`, `explainPegPlay`, `rankDiscards`) does not need
to change except for one additive field on `DiscardOption`.

---

## 2. Requirements conformance

### 2.1 Requirements inventory

User instructions (`U*`) are authoritative. Original-spec requirements (`R*`) are listed only where they are
still binding and bear on this work.

| ID | Requirement (one line) | Source | Status | Evidence |
| --- | --- | --- | --- | --- |
| **U1** | Lesson 1 "The shape of a round" must be an animated walkthrough that shows every stage, not text that skips stages | user | **Not met** | `src/features/tutorial/lessonCatalog.ts:20-28` — six steps: four `round-map` text panels (deal, discard, pegging, show), one `explain`, one `recap`. No `starter` or `crib` step, no cards, no animation. No demonstration component exists in `src/components/tutorial/`. |
| U1a | Show the hands being dealt, like the main game | user | Not met | as U1 |
| U1b | Show both players discarding to form the crib | user | Not met | as U1 |
| U1c | Show the starter being selected by cutting the deck | user | Not met | as U1; the `starter` phase has no step at all |
| U1d | Show the pegging and its effect on scoring | user | Not met | as U1 |
| U1e | Show the three-phase Show — pone hand, dealer hand, crib — each followed by that score being pegged on the board | user | Not met | as U1; `shape-show` is one paragraph with no seat distinction and no board |
| U1f | Then show dealer and pone swapping roles, and a second hand played with reversed roles and crib | user | Not met | Lesson 1 has a single `recap` step; no second hand anywhere in the lesson |
| **U2a** | A card may belong to more than one scoring combination; after a combination is counted its cards must be selectable again | user | **Implemented incorrectly** | `src/components/tutorial/SelectableHand.tsx:77` — `disabled={item.state === "disabled" \|\| item.state === "credited"}`. `HandScoringExercise.tsx:27` sets `credited` from `step.found`. Once a group is credited its cards are permanently disabled. |
| U2b | "Clear" must work | user | **Implemented incorrectly** | `tutorialReducer.ts:367-368` — `clear-selection` clears `selected` only. `submitScore` already empties `selected` on both the correct (`:244`) and incorrect (`:232`) path, so at the moment the learner is stuck there is nothing pending to clear and the button is observably inert. It never un-counts anything. |
| U2c | The starter card must be selectable as part of a combination | user | **Not met** | `HandScoringExercise.tsx:64-76` renders the starter through `SelectableHand` with `mode="none"`, which emits a `<div>`, not a button (`SelectableHand.tsx:60-68`). |
| **U3a** | Discard prompts must explain *why*, split into (a) maximising points in your hand and (b) maximising/minimising expected crib points depending on whether you deal | user | **Not met** | `scenarios.ts:157-186` — prompts and `reasons` talk only about "don't feed a five"; neither axis is named. `tutorialCopy.ts:22-36` produces one undifferentiated sentence. |
| U3b | Also factor in pegging quality — a hand of varied card values pegs better | user | **Not met** | No pegging language in any discard scenario, hint tier, or copy helper. |
| U3c | "Show the math" must show two numbers: expected score of the cards kept, plus (or minus) the expected crib score | user | **Implemented incorrectly** | `tutorialCopy.ts:33` emits `"Chosen keep expected value X; best keep Y."` — two *keeps*, one blended number each. `game.ts:418-421` computes `eScore` and `cScore` separately but `DiscardOption` (`game.ts:383-387`) exposes only the combined `score`. |
| **U4a** | Laid pegging cards must be horizontal, as on the main table | user | **Not met** | `PeggingExercise.tsx:48-64` and `:171-186` wrap each laid card in its own `<fieldset class="selectable-hand">` inside `<div className="seq">`. There is no `.seq` rule in `src/App.css`; fieldsets are block-level, so the cards stack vertically. A suitable flex rule `.peg-sequence` exists at `App.css:1178-1184` and is referenced by nothing. |
| U4b | There must be a delay between the learner playing and the opponent replying | user | **Not met** | `tutorialGrading.ts:399` — `playLearnerCard` returns `resolveOpponentTurns(afterPlay(...))`, which loops the opponent's entire reply chain before returning. `PeggingExercise.tsx:126` applies the whole thing in one `setState`. |
| U4c | A score made in training must be shown explicitly, ideally pegged on the cribbage board | user | **Partially met** | The score is named in the event log (`PeggingExercise.tsx:137-145`, text from `describePegOutcome`) and totalled on completion. There is no board, no peg movement, and no per-play score callout — `PeggingExercise.tsx` imports neither `CribbageBoard` nor `Peg`. |
| U4d | Preferably a "let the opponent play their card" button so the learner sets the pace | user | **Not met** | No such control; see U4b. |
| **U5** | In the coached round, playing the first pegging card makes it disappear instead of being played on the table | user | **Not met** (observation confirmed) | `GuidedRoundView.tsx:117-155` renders only a count chip and the learner's remaining hand during `awaiting === "play-card"`. `view.playingSequence` is populated (`guidedRound.ts:78`) and never read. Verified by driving `GuidedRound` directly: playing `7H` moves the view sequence from `[]` to `[7H, 4D]` with count 11, while the UI shows nothing. On the next play the engine resets the trick and the view sequence returns to `[]`, so the cards vanish a second time. |
| **U6** | Navigation must be intuitive throughout | user | **Partially met** | See item RM-7 for the itemised list; e.g. `TutorialShell.tsx:124` hard-codes the workspace heading "Your hand" on every step kind, and `:178` labels the progress bar from the 0-based `state.stepIndex` while `:108` shows the 1-based "Step N of M". |
| **OBS-1** | *(derived from U5's path)* The coached round cannot be completed: its counting step's submit is a no-op | observation | **Not met** | `tutorialReducer.ts:390-394` — `case "guided-round": return state` inside `submit`. Confirmed with a reducer probe: on the `coach-first` step, `reducer(state, {type:"submit"})` returns the **identical object**; `status` stays `in-progress` and `found` stays empty. `GuidedRoundView.tsx:165` gates the "Continue" button on `step.status === "complete"`, so it never renders and the round dead-ends at the first count pause. |
| R1 | Worked example → guided practice → independent count, with faded assistance | spec | Met (structure) | `lessonCatalog.ts:34-45` orders `score-example` before `score-practice`; hint tiers in `CoachPanel.tsx:25-33` |
| R2 | The curriculum must teach that a card can be reused across combinations | spec | Not met | Superseded in emphasis by U2a; `scenarios.ts:107` prompt claims "Cards may be used in more than one combination" while the UI forbids it |
| R3 | The guided round must include discard, crib ownership, starter, a pegging score, a go/last card, a multi-group hand, nobs, and the count order pone → dealer → crib | spec | Partially met | `scenarios.ts:230-278` scripts all of it and the engine produces it, but the round cannot be finished (OBS-1) |
| R4 | Discard lesson: name the crib owner, take two cards, then compare against strong alternatives on guaranteed hand points / starter help / crib benefit or risk; plain language first, numbers behind a disclosure | spec | Partially met | Owner named (`DiscardExercise.tsx:18,26`); disclosure wired (`TutorialShell.tsx:90-92`); the three-axis comparison is absent |
| R5 | Pegging lesson: running count always visible; animate only the played card and the peg movement; create a go and explain who leads after the reset and why the last card scores | spec | Partially met | Count chip present; go/reset/last-card implemented in `tutorialGrading.ts:305-349`; no animation applied, no peg movement |
| R6 | Accessibility: keyboard-operable cards with accessible names, one `aria-live="polite"` region, no colour-only encoding, 44×44 targets, reduced-motion support, learner advances manually | spec | Mostly met | `SelectableHand.tsx:70-84`; `CoachPanel.tsx:58`; `App.css:741-814`; `App.css:1190-1200` guards the only animation. Must be preserved by every item below. |
| R7 | One source of truth for rules: all tutorial answers come from `scoreHandDetailed` / `rankDiscards` / `explainPegPlay`; no authored scores | spec | Met | `tutorialGrading.ts` throughout; enforced by `boundary.test.ts` and `tutorialGrading.test.ts` |
| R8 | The tutorial must never use the `thePlayer` singleton; it runs an isolated `CribbageGame` on a `FixedDeck` | spec | Met | `guidedRound.ts:158-176`; enforced by `boundary.test.ts:22-26` |
| R9 | The training deal must be labelled as arranged, not shuffled | spec | Met | `tutorialCopy.ts:49-50`; rendered at `GuidedRoundView.tsx:61-64` |
| R10 | Skip must not falsely mark mastery; progress persists locally and survives refresh | spec | Met | `tutorialReducer.ts:106-143`; `Lesson.tsx:95-151` |

### 2.2 Spec requirements superseded by user instructions

| Spec requirement | Superseded by | Note |
| --- | --- | --- |
| Lesson 1 is "objective, board, dealer, and four phases", introduced by "a compact round map" | **U1** | Lesson 1 becomes a played demonstration of two complete hands across all six phases. The round map stays as the persistent orientation strip, but it is no longer the lesson. |
| "Provide reduced-motion behavior and **avoid timers in lessons**" | **U1, U4b** (partially) | Motion and pacing are now required. The conflict is resolved by making learner-driven advance the default (U4d) and any timed auto-play an opt-in that is disabled under `prefers-reduced-motion: reduce`. The reduced-motion requirement itself is **not** dropped. |
| "'Show the math' for EV" as a single expected-value disclosure | **U3c** | The disclosure must now present hand EV and crib EV as two separate numbers with an explicit sign. |
| "Animate only the selected card and the awarded peg movement" (pegging lesson) | **U1d, U4c** | Still the rule for the *exercise*; the lesson-1 demonstration additionally animates the deal, the discard and the cut, because U1 requires them shown. |

---

## 3. Previous remediation audit

All ten claimed fixes were checked against the current source. **All ten are present.** The failures are of
coverage and of alignment with the user instructions, not of execution.

| # | Claimed fix | Verdict | Code evidence / caveat |
| --- | --- | --- | --- |
| 1 | Mastery accounting: only assessed step kinds record concept attempts | **Landed** | `tutorialReducer.ts:106-143` (`isAssessedStepKind`, `stepConcepts`); `Lesson.tsx:107-120` gates on it and uses `attempts === 0`. Keep. **Caveat:** because RM-1 and RM-2 make almost every graded step uncompletable, the mastery signal is currently unreachable in practice, so the lesson-7 pills read "not yet" for nearly everything. |
| 2 | Skip persistence via `lastSkippedStepId` | **Landed** | `tutorialReducer.ts:44-48, 458-462`; consumed at `Lesson.tsx:133-151`. Keep. |
| 3 | `guidedRound.test.ts` rewritten (21 tests, both scripts) | **Landed but blind** | `src/features/tutorial/guidedRound.test.ts` is 252 lines and green. It drives the `GuidedRound` class directly and calls `round.completeCount()` itself, so it never exercises `GuidedRoundView` or the reducer. This is precisely why OBS-1 and U5 survive a fully green suite. New coverage must go through the components. |
| 4 | `CoachPanel` `progress` / `secondary` wired up | **Landed, conflicts with U3c** | `TutorialShell.tsx:84-92` computes both; `:160,167` passes them; `CoachPanel.tsx:48-57, 75-84` renders them. The category-progress `<dl>` is good and should stay. The `secondary` **content** is the single-blended-number string that U3c replaces — rework the string, keep the plumbing. |
| 5 | `play-sequence` pegging engine + UI | **Landed, conflicts with U4** | `tutorialGrading.ts:232-409` and `PeggingExercise.tsx:25-147`. The turn engine, go handling, count reset and last-card bonus are correct and should be kept. Its **auto-resolution of the opponent's whole reply chain** (`resolveOpponentTurns` called from inside `playLearnerCard`, `:399`) is exactly what U4b/U4d forbid and must be reworked, not reverted. |
| 6 | Component tests for the five untested components | **Landed but blind** | Five new files exist. `HandScoringExercise.test.tsx:78` is titled "completes a full **count-all** exercise" but actually drives `pair-find` — the only scenario in the catalog with two disjoint groups and no starter participation. Its helper comment at `:39-40` even documents relying on credited cards dropping out of the tab order, i.e. it asserts the U2a defect as intended behaviour. This test must be rewritten by RM-1. |
| 7 | Negative fixtures in `catalog.test.ts` | **Landed** | `catalog.test.ts` is 113 lines with a negative-fixture block; `validateCatalog.ts` exports `checkCards`, `uniqueSlug`, `checkScoreScenario`, `checkDiscardScenario`, `checkPegScenario`. **Gap:** none of these checks asks whether a scenario's required groups are *reachable through the UI*. See RM-9. |
| 8 | Browser pass (self-declared partial) | **Partial, and its positive finding is unsafe** | Its smoke pass reported a graded exercise working "end to end" with cards "disabling after being counted". That was `pair-find`, the single completable scenario, and the disabling it recorded as correct behaviour is defect U2a. |
| 9 | `second-round` crib-flush deck change and `first-round` nobs copy hedge | **Landed** | `scenarios.ts:253` carries the hedged "If you kept the jack of diamonds…" wording; the `second-round` deck at `:260-268` is the reworked one. No conflict with the user instructions. |
| 10 | Housekeeping (`SUIT_FLUSH_NAME` removal, `useMemo` keying, guarded mismatch log, `GroupList` ordering, palette, `CURRICULUM_VERSION`, exhaustiveness guard) | **Landed** | `grep SUIT_FLUSH_NAME src/` returns nothing; `ScoreExplanation.tsx:28-40` keys the memo on `cardKey` strings and `:41-49` guards the log with a `useRef`; `App.css:839-843` has `.coach-math`; `tutorialReducer.ts:9-12, 395-399` has `assertNeverStepKind`. No conflicts. **Note for RM-5:** that exhaustiveness guard will throw if a new `TutorialStep.kind` is added without a `submit` branch — see §6. |

**Nothing from the previous remediation needs to be reverted.** Items 4 and 5 need rework in place.

---

## 4. Remediation items

### RM-1 — Counting exercises: allow card reuse, make the starter selectable, make Clear meaningful
**Priority: Blocker.** Traces to **U2a, U2b, U2c**; unblocks **R2**; prerequisite for RM-2.

**What is wrong now.** Once a scoring group is credited, `HandScoringExercise.tsx:27` marks each of its cards
`credited`, and `SelectableHand.tsx:77` renders every `credited` card `disabled`. The starter is never
selectable at all — `HandScoringExercise.tsx:64-76` renders it with `mode="none"`, which produces a static
`<div>`. `gradeScoreSelection` (`tutorialGrading.ts:130-133`) matches a submission against the *exact* card-id
set of an engine group, and many engine groups contain the starter or reuse a card from an earlier group.
The two defects together make every counting exercise in the catalog except `pair-find` impossible to finish.
"Clear" (`tutorialReducer.ts:367-368`) only empties the pending selection, which `submitScore` has already
emptied, so it is observably inert — matching the user's report that it does nothing.

Verified by running `scoreHandDetailed` over every catalog scenario:

| Scenario | Used by | Required groups (engine output) | Why it is currently impossible |
| --- | --- | --- | --- |
| `pair-find` | lesson 2, QP | `pair:2C-2H` (2), `pair:9D-9S` (2) | — completable; the only one |
| `fifteen-multi` | lesson 2, QP, quirks | `fifteen:2C-3C-10D`, `fifteen:2C-3C-KS`, `fifteen:5H-10D`, `fifteen:5H-KS` (2 each, total 8) | two groups need the starter `3C`; `2C`, `5H`, `10D`, `KS` each appear twice |
| `run-double` | lesson 2, QP, quirks | `run:4H-5C-6S`, `run:4H-5D-6S` (3 each, total 6) | `4H` and `6S` appear in both runs |
| `count-all` | lesson 2, QP | `fifteen:7C-8S`, `fifteen:7D-8S`, `pair:7C-7D`, `run:6H-7C-8S`, `run:6H-7D-8S` (total 12) | `8S` in three groups, `7C`/`7D`/`6H` in two each |
| `checkpoint-count` | lesson 7 checkpoint | `fifteen:5D-10H`, `fifteen:5S-10H`, `pair:5D-5S`, `run:3H-4C-5D`, `run:3H-4C-5S` (total 12) | two fifteens need the starter `10H`; `5D`/`5S`/`3H`/`4C` reused |
| guided round count tasks | lessons 5 and 6 | e.g. first-round `fifteen:7H-8D` + `nobs:JD`; second-round `pair:JD-JH`; second-round crib `fifteen:2C-3C-JH`, `fifteen:5C-JH` | every one of these needs the starter |

**Required behaviour.**

1. **Card reuse.** A card that has been part of one or more credited groups stays a live, focusable control.
   Selecting it again is legal and counts toward a new group. Only `state: "disabled"` may set the DOM
   `disabled` attribute; `credited` must not.
2. **Distinguishing "already used" without disabling.** Keep the existing `credited` visual treatment
   (double border, `App.css:789-795`) as a *"used in a counted combination"* marker, not an *unavailable*
   marker, and update the accessible name accordingly. Current name is
   `"Five of hearts, already counted"` (`SelectableHand.tsx:31-32`); required name is of the form
   `"Five of hearts, used in 2 counted combinations, not selected"` (singular/plural correct; the
   selected/not-selected clause still varies with `aria-pressed`). Do not encode this by colour alone (R6).
   A card that is both credited and currently selected must read as selected.
3. **Starter selectable.** In `mode: "practice"` (and in the guided-round count of RM-2) the starter renders as
   a selectable control in its own group labelled `Starter`, dispatching the same `toggle-card` action as a
   hand card. In `mode: "example"` it stays static. The starter must never be counted as part of the four-card
   flush logic by the UI — group membership is whatever `scoreHandDetailed` says; the UI does not compute it.
4. **Clear.** Two distinct affordances, both always visible in practice mode:
   - **`Clear`** — deselects the pending selection. It must be `disabled` when `selected.length === 0`, so it
     is never a dead control.
   - **`Start this count again`** — resets `selected`, `found`, `earned`, `revealed` and `feedback` for the
     current step so every combination can be found again from scratch. It must **preserve** `attempts` and
     `hintLevel` so that restarting cannot manufacture an "independent correct" mastery record
     (`Lesson.tsx:114` treats `attempts === 0` as flawless; `persistence.ts:316` treats `hintLevel < 2` as
     unaided). Add a dedicated reducer action for this; do not reuse `restart-step`
     (`tutorialReducer.ts:463-464`), which resets to `emptyStepState` and would zero both counters.
5. **Duplicate protection stays where it is.** `gradeScoreSelection` already refuses a group whose id is in
   `found` (`tutorialGrading.ts:131`) and `whyNotScore` already produces "…that fifteen may already be
   counted" (`tutorialGrading.ts:90-95`). No new duplicate logic is needed in the component.
6. **Coach progress stays correct.** `categoryProgress` (`tutorialGrading.ts:108-123`) counts groups, not
   cards, and needs no change.

**Location (confirmed).** `src/components/tutorial/SelectableHand.tsx` (disabled predicate, `stateName`),
`src/components/tutorial/HandScoringExercise.tsx` (starter rendering, credited derivation at `:27`, button
row at `:98-110`), `src/features/tutorial/tutorialReducer.ts` (new reset action, `clear-selection`),
`src/App.css` (credited marker semantics if the treatment changes).

Note: `HandScoringExercise.tsx:27` derives credited state with
`step.found.some((id) => id.includes(cardId))` — a substring test against a group id of the form
`"fifteen:5H-KD"`. With reuse allowed this needs to become an exact membership test against the parsed card-id
list of each found group (split the id on `":"` then `"-"`, or thread the matched `ScoringGroup[]` through),
because a substring match cannot count how many groups a card belongs to and is fragile for multi-character
ranks.

**Acceptance criteria.**
- A parameterised test over `fifteen-multi`, `run-double`, `count-all`, `checkpoint-count` and `pair-find`
  drives `HandScoringExercise` in `practice` mode through the **real** reducer, selecting each engine group in
  turn (including starter-bearing and card-reusing groups), and asserts `step.status === "complete"` and
  `step.earned` equals the totals in the table above (8, 6, 12, 12, 4).
- A test asserts that after a group is credited, each of its cards is still `enabled`, still focusable by
  `Tab`, and can be selected again.
- A test asserts the starter renders as a `button` in practice mode and as a non-interactive element in
  example mode.
- A test asserts `Clear` is disabled with nothing selected and enabled with something selected.
- A test asserts `Start this count again` empties `found`/`earned`/`selected` while leaving `attempts` and
  `hintLevel` unchanged.
- **Rewrite `src/components/tutorial/HandScoringExercise.test.tsx:78-105`** — its `tabUntil` helper and comment
  depend on credited cards leaving the tab order, which this item deliberately changes. Rename it to match the
  scenario it actually drives.
- Manual: `/learn/count-a-hand`, step "count-multi", find all four fifteens including the two that use the
  `3♣` starter; the step completes with 8 points.

---

### RM-2 — Coached round: the counting step's submit is a no-op, so neither coached round can be finished
**Priority: Blocker.** Traces to **OBS-1**; required for **U1e**, **R3**, **R12**. Depends on RM-1.

**What is wrong now.** `GuidedRoundView.tsx:157-171` renders a `HandScoringExercise` for the
`awaiting === "count-hand"` pause and passes it the runner's `state.step` — which belongs to a `guided-round`
step. `HandScoringExercise`'s "Count selected cards" button dispatches `{type: "submit"}`, and
`tutorialReducer.ts:390-394` returns `state` unchanged for `guided-round`. Verified with a reducer probe: on
the `coach-first` step, after `toggle-card`, `reducer(state, {type:"submit"})` returns the **identical object**
— `status` stays `"in-progress"`, `found` stays empty, `earned` stays 0. `GuidedRoundView.tsx:165` only renders
"Continue" when `step.status === "complete"`, and that status is set only by `complete-guided-round`
(`tutorialReducer.ts:467-471`), which fires only when the whole round is already over. The round therefore
dead-ends permanently at the first show pause, with the learner's only escape being "Restart this round" or
"Skip this step".

**Required behaviour.**
1. The counting pause inside a guided round behaves exactly like a `score-practice` step: selecting cards,
   submitting, per-group crediting, the coach's feedback and running total, hint tiers, and RM-1's reuse /
   starter / Clear semantics all work.
2. When every group required by the count task has been found, a **Continue** button appears and calls
   `round.completeCount()`; the round then proceeds to the next show sub-phase.
3. There must also be an unconditional escape that does not require completing the count — a
   **"Show me the count"** control that reveals the full breakdown (via `GroupList` on
   `scoreHandDetailed`) and then enables Continue. This step must not be able to trap a learner again.
   Reaching Continue this way records the attempt as assisted, not independent.
4. Per the original spec, the learner counts **their own** hand manually; the opponent's hand and the crib are
   demonstrated rather than counted by the learner. The `acknowledge` pauses that already implement this
   (`guidedRound.ts:364-386`) stay as they are, except that a crib that belongs to the learner is a count task
   (`guidedRound.ts:380-383` already does this) and must therefore also work.

**Implementation note (two viable shapes — pick one and state it in the PR).**
- *Reducer-owned (recommended).* Add an action that carries the dynamic scenario, e.g.
  `{ type: "submit-count"; scenario: ScoreScenario }`, so the reducer stays pure (the scenario is plain data)
  and reuses `gradeScoreSelection`. `GuidedRoundView` builds the `ScoreScenario` from `view.countTask`, as it
  already does at `GuidedRoundView.tsx:44-57`.
- *Component-owned.* Give the count exercise its own `useReducer`. This requires first removing the remount
  at `Lesson.tsx:276` (`key={roundView}`, where `roundView` increments on every `onChange`), because that
  destroys all local state on every interaction. If you choose this shape, key the element on the script id
  or the round instance instead.

Either way, `GuidedRoundView`'s "Continue" gate must stop reading `step.status`.

**Location (confirmed).** `src/components/tutorial/GuidedRoundView.tsx:157-171`,
`src/features/tutorial/tutorialReducer.ts:369-401`, `src/screens/Lesson.tsx:273-289`.

**Acceptance criteria.**
- A component test renders `GuidedRoundView` against a real `GuidedRound` driven to `awaiting: "count-hand"`,
  selects the engine's groups for that count task, submits, and asserts Continue appears and
  `round.completeCount()` advances the round.
- An end-to-end component test completes **both** `first-round` and `second-round` through `GuidedRoundView`
  alone — discard, every pegging play, every count, every acknowledge — and asserts the round reaches
  `awaiting: "done"` and dispatches `complete-guided-round` exactly once.
- A test asserts "Show me the count" reveals the breakdown and enables Continue without a correct submission.
- Manual: `/learn/coached-round` and `/learn/coached-round-dealer` both run from deal to "The training deal is
  finished." without pressing Skip or Restart.

---

### RM-3 — Coached round: render the pegging table so played cards are visible
**Priority: Blocker.** Traces to **U5**; supports **U4a, U4c**.

**What is wrong now.** During `awaiting === "play-card"`, `GuidedRoundView.tsx:117-155` renders a count chip
and the learner's remaining hand — nothing else. `view.playingSequence` is populated by
`guidedRound.ts:78` and read by no component. Confirmed by driving the round: playing `7♥` takes the view
sequence from `[]` to `[7♥, 4♦]` with count 11 while the screen shows only "Count: 11"; the learner's card and
the opponent's reply are both invisible. Worse, after the next play the engine clears the trick (count returns
to 0 and the sequence returns to `[]`), so the whole exchange disappears with no explanation.

**Required behaviour.**
1. Throughout the pegging phase, render the current trick as a **single horizontal row** of face-up cards in
   play order, next to the running count chip. Use one `SelectableHand` with `mode="none"` (its
   `.selectable-hand-cards` container is already `display: flex`, `App.css:753-757`) or an equivalent flex row
   — not one fieldset per card.
2. Attribute each card to its player. `playingSequence` is currently `ReadonlyArray<PCard>` with no owner.
   Extend the view to carry owners, e.g. change it to
   `ReadonlyArray<{ card: PCard; by: "you" | "opponent" }>`, or add a parallel
   `playingSequenceOwners: ReadonlyArray<"you" | "opponent">`. `GuidedRound.pump` already sees the owner on
   each `play-card` action's `subaction` (`guidedRound.ts:269-286`). Render the attribution as text, not
   colour alone.
3. **Do not let a trick vanish silently.** When the engine resets the count (31 or a double go), retain the
   completed trick and show it dimmed above the new one, labelled with why it ended — for example
   *"That made 31 — 2 points. The count resets to 0."* or *"Nobody could play. Last card scores 1. The count
   resets to 0."* Add the snapshot to the view (e.g. `lastTrick: ReadonlyArray<…>` plus
   `lastTrickReason: string`), captured in `GuidedRound.pump` when `playingHand` empties.
4. The newly laid card gets the existing entry animation (`App.css:1190-1200`, `.selectable-card.is-played`,
   already guarded by `prefers-reduced-motion: no-preference`). No other card animates.
5. The opponent's reply must not land in the same tick as the learner's click — see RM-4, whose
   "Let them play" control applies to the coached round as well as the pegging exercise.

**Location (confirmed).** `src/components/tutorial/GuidedRoundView.tsx:117-155`,
`src/features/tutorial/guidedRound.ts:13-33` (view type), `:64-93` (`view()`), `:234-302` (`pump`),
`src/App.css`.

**Acceptance criteria.**
- A component test drives `GuidedRoundView` to the pegging phase, plays a card, and asserts the card is
  present in the rendered trick row with its owner attributed.
- A test asserts that after a 31 or a double go, the previous trick is still in the DOM (dimmed) with a reason
  string, and the new trick starts empty.
- A layout assertion (or reviewed screenshot) showing the trick row is horizontal at 320 px and at 1280 px.
- Manual: `/learn/coached-round`, lead a card — your card and their reply both appear on the table, the count
  updates, nothing disappears without a sentence explaining it.

---

### RM-4 — Pegging exercise: horizontal layout, learner-paced opponent, explicit scores on the board
**Priority: Major.** Traces to **U4a, U4b, U4c, U4d**; keeps **R5, R6**.

**What is wrong now.**
- *Layout (U4a):* `PeggingExercise.tsx:48-64` (play-sequence) and `:171-186` (select-legal / select-scoring)
  wrap every laid card in its own `<fieldset class="selectable-hand">` inside `<div className="seq">`.
  `src/App.css` has no `.seq` rule, so the block-level fieldsets stack vertically. The correct flex rule
  `.peg-sequence` exists at `App.css:1178-1184` and is applied to nothing.
- *Pacing (U4b, U4d):* `tutorialGrading.ts:382-400` — `playLearnerCard` calls `resolveOpponentTurns`, which
  loops `opponentStep` until it is the learner's turn again (`:368-375`). `PeggingExercise.tsx:119-127` applies
  the entire resolved state in one `setState`, so the learner's card, every opponent reply, every score, any
  go and any reset all appear simultaneously.
- *Score visibility (U4c):* scores appear only as rows in a small scrolling `<ul className="roundlog">`
  (`PeggingExercise.tsx:137-145`, `App.css:1033-1040` caps it at 180 px with `overflow: auto`). There is no
  board, no peg movement, and no per-play callout. `PeggingExercise.tsx` imports neither `CribbageBoard` nor
  `Peg`.

**Required behaviour.**
1. **Horizontal trick row.** One row, play order left to right, count chip adjacent. Same treatment as RM-3;
   the two should share a component. Each laid card is attributed to "you" or "them" in text.
2. **Turn-by-turn, learner-paced.** Split the sequence engine so one call performs one action:
   - `playLearnerCard(scenario, state, cardId)` plays **only** the learner's card and hands the turn over.
   - a new `opponentStep`-style public call performs **exactly one** opponent action (one card, one go, or the
     resolution of a double go including the count reset and the last-card point).
   Remove `resolveOpponentTurns` from `playLearnerCard`'s return path.
3. **"Let them play" control.** When it is the opponent's turn and the exchange is not finished, the primary
   button reads **`Let them play`** (accessible name may be `Let the opponent play their card`). Nothing on the
   opponent's side happens until it is pressed. There is no timer on this path.
4. **Optional auto-pace.** A secondary toggle (`Play at normal speed`) may auto-press the same control on a
   delay. If implemented, use ~1200 ms between plays to match the live table
   (`gamePlayer.ts:73` — `playOpponentCard(difficulty, 1200)`), and it must be **off by default** and
   force-disabled when `window.matchMedia("(prefers-reduced-motion: reduce)").matches` (R6 —
   `setupTests.ts` already polyfills `matchMedia` for jsdom).
5. **Explicit score callout.** Whenever a play scores, show a prominent, non-log callout naming the score and
   who got it, from `explainPegPlay`'s labels — for example *"That makes 15 — 2 points to you"*,
   *"Run of three: 5-3-4 — 3 points to them"*. It stays visible until the next action. The existing
   `role="status"` live region requirement (one per screen, `CoachPanel.tsx:58`) must not be violated; route
   the announcement through the coach region rather than adding a second live region.
6. **Board.** Render `CribbageBoard` with two `Peg`s inside the exercise, tracking cumulative pegging points
   for the learner and the opponent within this exercise, updated as each score lands. Peg bookkeeping follows
   the existing three-slot shift used elsewhere (`guidedRound.ts:208-213`,
   `gamePlayer.ts:96-99`): `pga[2]=pga[1]; pga[1]=pga[0]; pga[0]+=score`. Show both running totals numerically
   as well, because the board is small.
7. The count chip, the "Say go" affordance, the go/reset explanation and the last-card point all keep their
   current behaviour (`tutorialGrading.ts:305-349`).

**Location (confirmed).** `src/components/tutorial/PeggingExercise.tsx`,
`src/features/tutorial/tutorialGrading.ts:232-409`, `src/components/CribbageBoard.tsx` (reuse only),
`src/App.css` (`.seq` / `.peg-sequence`).

**Acceptance criteria.**
- `PeggingExercise.test.tsx` (existing, 66 lines) is extended: after the learner plays, the opponent's card is
  **not** yet in the trick row and the exchange does not advance until `Let them play` is pressed; pressing it
  once advances by exactly one opponent action.
- A test asserts the `peg-go` scenario still reaches `complete-peg-sequence` with the same earned total as
  today (the current test asserts `earned: 10` — keep that number unless the engine's scoring changes).
- A test asserts a scoring play renders a callout containing the `explainPegPlay` label and the points.
- A test asserts a `CribbageBoard` is rendered and the learner's peg position advances after a scoring play.
- A layout assertion or screenshot showing the laid cards in one horizontal row.
- Manual: `/learn/peg-to-31`, step `peg-go-step` — play the seven, see it land alone, press `Let them play`,
  see their six land, see the count and the board move; reach the go, the reset and the last-card point one
  action at a time.

---

### RM-5 — Lesson 1: an animated demonstration of two complete hands with the roles reversed
**Priority: Major.** Traces to **U1a–U1f**; supersedes the spec's static lesson 1.

**What is wrong now.** `lessonCatalog.ts:20-28` defines lesson 1 as four `round-map` text panels
(deal, discard, pegging, show), one `explain` and one `recap`. No cards are shown, nothing moves, the
**starter** and **crib** phases have no step even though `RoundMap.tsx:3-10` displays six phases, and only one
hand is described — there is no demonstration of the deal alternating or of the crib changing hands.

**Required behaviour.**

The lesson becomes a scripted, engine-driven demonstration of **two complete hands** in which the learner
watches rather than decides. Both hands are dealt from a `FixedDeck` into an isolated `CribbageGame`, exactly
as the coached rounds already do (`guidedRound.ts:158-176`) — the tutorial must not touch `thePlayer`
(enforced by `boundary.test.ts:22-26`) and must not author any score (R7): every card, every point and every
phase transition comes from the engine.

**Stages, in order, for hand 1:**

| # | Stage | What must be visible | Coach must state |
| --- | --- | --- | --- |
| 1 | Deal | Twelve cards dealt one at a time, alternating, starting with the non-dealer; both hands end face up (this is a demonstration, so the opponent's hand is shown) | Who deals, that the deal alternates, and that the dealer owns the crib |
| 2 | Discard | Both players' two cards moving into a visible crib pile, face down after they land | Six to four; whose crib it is this hand |
| 3 | Starter | The deck being cut and the starter turned face up. If the starter is a jack, his heels scores 2 to the dealer and that must be pegged on the board | What the starter is, and that it is shared by every count |
| 4 | Pegging | Each card laid one at a time into a horizontal row, count chip updating. Every scoring play shows its `explainPegPlay` label and moves the scorer's peg on the board. The go / reset / last-card moment is shown and named | The 31 limit; what scores in the play; who leads after a reset; why the last card scores |
| 5a | Show — pone's hand | The pone's four cards plus the starter, with the `scoreHandDetailed` group breakdown (reuse `GroupList` / `ScoreExplanation`), then that total pegged on the board | The non-dealer counts first |
| 5b | Show — dealer's hand | Same, for the dealer, then pegged | The dealer counts second |
| 5c | Show — the crib | The crib's four cards plus the starter, scored with `isCrib: true`, then pegged | The crib belongs to the dealer and is counted last |
| 6 | Hand over | The deal passing to the other player; scores carried forward | The roles swap: the dealer becomes the pone, and the crib changes hands |

**Then repeat stages 1–5c for hand 2 with the dealer and pone reversed and the crib belonging to the other
player.** The coach copy in hand 2 must name the contrast against hand 1 at the deal, the discard and the
show — for example *"Last hand they dealt and the crib was theirs. This hand you deal, so the crib is yours,
they lead, and you count second."*

**Additional requirements.**
- **Pacing and control.** Advance is learner-driven by default: a primary **Next** / **Deal the next card** /
  **Continue** control at every stage, plus **Back** to re-watch the previous stage. An optional
  `Play it for me` auto-advance may be offered; it must be off by default, interruptible, and disabled under
  `prefers-reduced-motion: reduce`. Suggested cadence when auto-playing, informed by the live table
  (`gamePlayer.ts:50-84`): 250–400 ms per dealt card (the table's 50 ms is too fast to teach with),
  ~1200 ms per pegging play, ~1200 ms per show sub-phase, ~2000 ms at a stage boundary.
- **Round map.** The persistent `RoundMap` must advance through **all six** phases across each hand
  (deal → discard → starter → pegging → show → crib) and reset for hand 2. It must also indicate which hand of
  the two is showing.
- **Board.** `CribbageBoard` with both pegs is visible for the whole lesson; every score moves a peg at the
  moment it is awarded.
- **No decisions.** The learner never discards or plays in this lesson. Both players' discards and plays are
  scripted.
- **Content model.** The existing `RoundScript` (`tutorialTypes.ts:93-116`) scripts the deck, the opponent's
  discard and the opponent's plays but assumes the learner supplies their own. The demonstration needs
  scripted **player** discards and plays as well: extend `RoundScript` with optional
  `playerDiscard?: readonly [CardSpec, CardSpec]` and `playerPlays?: ReadonlyArray<CardSpec>`, or introduce a
  `DemoScript` type. Two new scripts are needed (one per hand) or one script pair with a documented role swap.
  `validateCatalog.ts` must validate the new fields the way it validates `opponentPlays` today, and
  `catalog.test.ts` must gain a negative fixture for an illegal scripted player play.
- **Step kind.** Add a step kind (suggested `{ kind: "round-demo"; id: string; scriptId: string }`). Adding a
  kind touches four places that will otherwise fail loudly or silently: the `submit` switch in
  `tutorialReducer.ts:369-401` (its `assertNeverStepKind` guard at `:395-399` **throws** on an unhandled
  kind — add an explicit non-grading branch), `passiveKind` (`:68-70`), `isAssessedStepKind` (`:106-108`, the
  demo must **not** award mastery), and `highlightFor` in `TutorialShell.tsx:25-45`.
- **Catalog metadata.** `estimatedMinutes` for lesson 1 is currently `2` (`lessonCatalog.ts:13`); set it to the
  real length of the demonstration. The beginner path currently sums to 27 minutes
  (2+5+3+4+6+5+2, `lessonCatalog.ts:13,32,49,61,74,85,96`) against a landing promise of "about 15 minutes …
  about half an hour" (`Learn.tsx:13-14`, asserted verbatim by `Learn.test.tsx:60`). No test currently checks
  the sum. If the new total pushes past roughly 35 minutes, update the promise line and that assertion
  together, and consider adding a sum check to `catalog.test.ts`.
- Skip and Exit must remain available at every stage, and skipping must not mark mastery (R10).

**Location (confirmed).** New component under `src/components/tutorial/` (suggested `RoundDemo.tsx`) plus a
demo runner under `src/features/tutorial/` (suggested `roundDemo.ts`, modelled on `guidedRound.ts`);
`src/features/tutorial/lessonCatalog.ts:10-28`; `src/features/tutorial/scenarios.ts` (new scripts);
`src/features/tutorial/tutorialTypes.ts:93-129`; `src/features/tutorial/validateCatalog.ts`;
`src/features/tutorial/tutorialReducer.ts`; `src/components/tutorial/TutorialShell.tsx:25-45`.

**Acceptance criteria.**
- A unit test drives the demo runner for both hands to completion and asserts: the deal order alternates and
  starts with the non-dealer; both discards reach the crib; a starter is turned; the pegging sequence is
  legal and its scores match `explainPegPlay`; the show occurs in the order pone → dealer → crib with totals
  matching `scoreHandDetailed`; the dealer in hand 2 is the opposite seat from hand 1 and the crib ownership
  is inverted.
- A component test walks every stage via the Next control and asserts the `RoundMap` reaches each of the six
  phases in order, twice.
- A test asserts the `round-demo` step kind records **no** concept mastery
  (`isAssessedStepKind("round-demo") === false`) and that `submit` on it does not throw.
- A test asserts auto-advance does not start when `matchMedia("(prefers-reduced-motion: reduce)")` matches.
- `catalog.test.ts` and `Learn.test.tsx` still pass; if the promise line changed, its assertion changed with it.
- Manual: `/learn/shape-of-a-round` shows two whole hands with the roles swapping, the board moving at every
  score, and the round map visiting starter and crib.

---

### RM-6 — Discard lesson: coach on hand value, crib value and pegging value; show two numbers
**Priority: Major.** Traces to **U3a, U3b, U3c**; keeps **R4**.

**What is wrong now.** The engine computes the two quantities the user wants and then throws one of them away:
`game.ts:418-421` computes `eScore` (expected value of the four cards kept) and `cScore` (expected crib value
of the two thrown) and stores only `tScore = isPlayerCrib ? eScore + cScore : eScore - cScore` on
`DiscardOption` (`game.ts:383-387`). `describeDiscardComparison` (`tutorialCopy.ts:22-36`) therefore produces
one blended figure per keep: *"Chosen keep expected value 7.42; best keep 7.91."* The scenario prompts and
`reasons` (`scenarios.ts:157-186`) discuss only crib ownership and fives; neither "what your hand is worth"
nor "what the crib gains or loses" nor pegging quality is named anywhere.

**Required behaviour.**
1. **Expose both numbers on the engine option.** Extend `DiscardOption` to
   `{ keep: Array<Card>; discard: Array<Card>; score: number; handScore: number; cribScore: number }`, where
   `handScore` is the existing `eScore` and `cribScore` the existing `cScore`. `score` keeps its current
   definition and the sort order of `rankDiscards` must be **byte-identical** to today — the AI opponent
   selects its discard from this ranking (`gamePlayer.ts:201-215`) and difficulty must remain a
   strategy-only knob. This is an additive change; do not export `calcExpectedCribScore` unless a caller needs
   it.
2. **"Show the math" shows two numbers and the operator.** Replace the single-figure string with a structure
   that renders, for the learner's chosen throw:
   - the expected value of the four cards kept, one decimal place;
   - the expected value the two thrown cards add to the crib, one decimal place;
   - the sign — **plus** when the crib is the learner's, **minus** when it is the opponent's — and the net.
   Worked shape (exact wording may be adjusted, the three quantities and the sign may not):
   *"Your four cards are worth about **7.4** on average. The two you threw add about **4.1** to the crib.
   The crib is theirs, so that comes off: **7.4 − 4.1 = 3.3**."* When the crib is the learner's, the same
   sentence with "goes on" and `+`. Show the engine's best throw underneath in the same three-number form so
   the comparison is like-for-like.
3. **Plain language first (R4).** The coach's visible feedback stays free of numbers; the numbers live behind
   the existing `Show the math` disclosure (`CoachPanel.tsx:75-84`, wired at `TutorialShell.tsx:88-92`).
4. **Three-axis coaching copy.** Every discard scenario's `prompt`, `hints` and `reasons` must be rewritten so
   the learner is taught the decision as three questions, in this order:
   - **(a) What does my hand keep?** Which combinations survive the throw — the run, the pair, the fifteens.
   - **(b) What does the crib gain or lose?** If it is the learner's crib, what makes it likely to score
     (fives, touching cards, ten-value partners for a five); if it is the opponent's, what to keep out of it
     (fives above all, then touching cards and any pair).
   - **(c) How will this hand peg?** A keep with a spread of different values pegs better than four
     ten-value cards; low cards and cards that can make 15 and 31 give more options; a hand that can only
     make one count is easy to shut out.
   The three hint tiers should map to these three axes so `Hint` → `Another hint` → `Show me one group`
   walks the learner through (a), (b), (c) rather than restating the same point.
5. Both existing scenarios (`discard-theirs`, `discard-yours` — the same six cards with the crib on opposite
   sides, `scenarios.ts:158-186`) stay; only their copy changes. `acceptTopN` stays at 3 unless the rewritten
   reasons make a different band correct.
6. `DiscardExercise.tsx:19-21, 61-66` currently computes a `gradeDiscard` result and then renders a fixed
   sentence that ignores it. Either render the comparison it computes or delete the dead call.

**Location (confirmed).** `src/app/game.ts:383-426`, `src/features/tutorial/tutorialCopy.ts:22-36`,
`src/features/tutorial/tutorialGrading.ts:145-178`, `src/features/tutorial/scenarios.ts:156-187`,
`src/components/tutorial/DiscardExercise.tsx`, `src/components/tutorial/CoachPanel.tsx` (rendering only).

**Acceptance criteria.**
- An engine test asserts that for a known six-card hand, every `DiscardOption` satisfies
  `score === (isPlayerCrib ? handScore + cribScore : handScore - cribScore)` to within floating-point
  tolerance, for both values of `isPlayerCrib`.
- An engine test asserts the order and `score` values returned by `rankDiscards` are unchanged from before the
  change for a fixed fixture hand (guards AI parity).
- A copy test asserts the math string contains both numbers and the correct operator for each crib ownership.
- A component test submits a discard in `discard-theirs`, opens `Show the math`, and asserts all three
  quantities are present.
- A catalog test asserts every discard scenario's three hint tiers are distinct and that the prompt mentions
  the crib owner.
- Manual: `/learn/crib-and-discard`, throw `J♦ Q♥` in each of the two steps and confirm the numbers and the
  sign flip between the opponent's crib and your own.

---

### RM-7 — Navigation and orientation
**Priority: Major.** Traces to **U6**; keeps **R6, R8, R10**.

**What is wrong now** (each verified in source):

| # | Defect | Evidence |
| --- | --- | --- |
| a | The workspace heading is hard-coded `"Your hand"` on every step kind, including `explain`, `round-map`, `recap` and `guided-round` | `TutorialShell.tsx:124` |
| b | The progress bar is labelled from the 0-based index, so the first step reads `"0 of 6 steps · 0%"` directly beneath a header reading `"Step 1 of 6"` | `TutorialShell.tsx:98, 108, 178` |
| c | Going `Back` rebuilds the previous step with `emptyStepState`, discarding every group already counted there; returning forward starts it over | `tutorialReducer.ts:446-457` |
| d | `Skip this step` is an unstyled `btn-link` immediately beside the primary `Next`, advances silently, and is easy to hit by accident | `TutorialShell.tsx:181-183` |
| e | Finishing a **Quick Practice** lesson renders no completion screen at all: `isLast` is false (not on `BEGINNER_PATH`) and `nextId` is `undefined`, so both completion branches are skipped and the shell stays on the last step with `Next` silently routing to `/learn` | `Lesson.tsx:194-263`, `TutorialShell.tsx:187-193` |
| f | In the guided round the primary action (Confirm / Play / Continue) sits mid-page while `Restart this round` is below the log, so on a narrow viewport the visible control is the destructive one | `GuidedRoundView.tsx:88-176` vs `:210-214` |
| g | Completed phases in the round map are distinguished by colour alone (`className="done"`), with screen-reader text only on the current phase | `RoundMap.tsx:24-33` |
| h | `Back` is disabled on step 0 and the only exit is the header `Exit`, which is visually identical to `Rules` | `TutorialShell.tsx:111-114, 174-176` |

**Required behaviour.**
- (a) The workspace heading names the current activity — e.g. "Count this hand", "Choose two cards for the
  crib", "The play", "A coached round", or the step title for `explain`/`round-map`/`recap`. It must remain a
  single `<h2>`; the page keeps exactly one `<h1>`.
- (b) Header and progress bar agree. Use 1-based step numbering in both, or label the bar
  "N of M steps complete" computed from `completedStepIds`.
- (c) `Back` preserves the previous step's `found`, `earned`, `selected`, `hintLevel` and `attempts` — restore
  state rather than recreating it. Keep per-step state in the runner keyed by step id.
- (d) `Skip this step` gets a visible, non-primary button treatment and a confirmation or an inline note that
  it will not count as completed. Skipping must continue not to mark mastery (`Lesson.tsx:145-150`).
- (e) Every lesson that completes shows a completion screen. For a Quick Practice lesson the actions are
  `Practise again`, `Back to Learn`, and (if the beginner path is unfinished) `Continue the beginner path`.
- (f) Within a guided round, the primary action for the current pause is the first interactive element after
  the table, and `Restart this round` is visually secondary and separated from it.
- (g) Completed round-map phases carry visually-hidden text ("completed") and a non-colour marker, matching
  the treatment already used in the Learn lesson list (`Learn.tsx:78-83`).
- (h) On step 0, `Back` returns to `/learn` (relabelled, e.g. "Back to Learn") instead of being disabled, and
  `Exit` is visually distinguishable from `Rules`.

**Location (confirmed).** `src/components/tutorial/TutorialShell.tsx`,
`src/features/tutorial/tutorialReducer.ts:441-465`, `src/screens/Lesson.tsx:194-263`,
`src/components/tutorial/RoundMap.tsx`, `src/components/tutorial/GuidedRoundView.tsx`, `src/App.css`.

**Acceptance criteria.**
- A test asserts the workspace heading differs between a `score-practice` step and an `explain` step.
- A test asserts the progress label and the "Step N of M" header report the same step number.
- A test counts a group, goes `Back` then `Next`, and asserts the counted group and earned total survive.
- A test finishes a Quick Practice lesson and asserts a completion screen with the three actions renders.
- A test asserts completed round-map phases expose accessible "completed" text.
- Manual: walk lessons 1 → 7 without using the browser back button; at every screen the next action is
  obvious and the way out is obvious.

---

### RM-8 — Guided round passes the wrong totals to the show breakdowns
**Priority: Minor.** Traces to **U1e** (the show must display the hand's own score) and the observation below.

**What is wrong now.** `GuidedRoundView.tsx:179-198` renders the opponent's hand breakdown with
`total={view.scores.opponent}` and the crib's with `total={view.scores.player}` — those are cumulative **game**
scores, not the score of that hand or that crib. `ScoreExplanation` renders the prop as the total row and logs
a mismatch against its own derived figure (`ScoreExplanation.tsx:46-49`), so the learner is shown a
breakdown whose lines do not add up to its stated total.

**Required behaviour.** Each breakdown's total is the score of that hand or crib with the starter and the
correct `isCrib` flag — i.e. `scoreHandDetailed(...).total` for those exact cards, or the engine's
`scores["opponent-hand"]` / `scores["crib"]` equivalents. Expose them on the guided-round view rather than
recomputing in the component.

**Location (confirmed).** `src/components/tutorial/GuidedRoundView.tsx:179-198`,
`src/features/tutorial/guidedRound.ts:13-33, 64-93`.

**Acceptance criteria.** A test asserts the rendered total for the opponent's hand equals
`scoreHandDetailed(opponentHand, starter, false).total` and the crib's equals
`scoreHandDetailed(crib, starter, true).total`, and that `ScoreExplanation` logs no mismatch during a full
guided round.

---

### RM-9 — Catalog validation must prove every authored exercise is completable
**Priority: Minor.** Traces to **U2a/U2c** (regression protection). Depends on RM-1.

**What is wrong now.** `validateCatalog.ts` checks card legality, slugs, duplicates, unsatisfiable `require`
categories and script legality, but never asks whether a learner can actually finish a scenario through the
UI. That is why every counting exercise but one shipped uncompletable with a green suite.

**Required behaviour.** Add a check, run by `catalog.test.ts`, that for every `ScoreScenario` the set of
required groups is reachable under the interaction rules: every card id in every required group is present in
the scenario's selectable set (hand **plus starter**), and the groups are satisfiable in any order with reuse
allowed. Add a negative fixture (for example a scenario whose required group references a card not in the hand)
proving the check bites.

**Location (confirmed).** `src/features/tutorial/validateCatalog.ts`,
`src/features/tutorial/catalog.test.ts`.

**Acceptance criteria.** `validateCatalog()` still returns `[]` for the real catalog; the new negative fixture
produces the specific problem string; deliberately reverting RM-1's starter change makes a test fail.

---

## 5. Out of scope

- **The main `/play` table.** No change to `Cribbage.tsx`'s game logic, `gamePlayer.ts`, `gameSlice.ts`,
  `store.ts`, or the AI. The previous remediation noted the table appearing to stall at cut-for-deal under
  browser automation; that is unconfirmed, unrelated to the tutorial, and not addressed here.
- **The scoring kernel.** `scoreHand` / `scoreHandDetailed` / `explainPegPlay` stay as they are and remain the
  single source of truth. The only engine change sanctioned above is the additive `handScore` / `cribScore`
  fields on `DiscardOption`, which must not alter `rankDiscards`' ordering.
- **Shuffle and difficulty.** `StdDeck.shuffle` stays zero-argument; difficulty continues to affect strategy
  only.
- **Deferred V2 features.** Coach Mode during normal play, adaptive practice, muggins, badges/streaks,
  generated exercises, a real analytics backend, accounts or sync. The analytics adapter stays a null sink.
- **Backend, new dependencies, Docker/nginx, `README.md`.** None of this work requires them.
- **Test renaming for spec-ID traceability.** Not a functional gap.
- **The `GroupList` duplicate legacy class aliases** (`grouplist`, `lbl`, `pts`) — cosmetic, no behavioural
  effect.

---

## 6. Open questions and risks

Resolve these before or during the work; do not guess silently.

1. **RM-5 deck choice.** Should lesson 1's two demonstration hands use the same decks as the coached rounds
   (`first-round` / `second-round`, `scenarios.ts:230-278`) so the learner sees familiar deals later, or new
   decks so lessons 5 and 6 are not spoiled? Recommendation: new decks.
2. **RM-5 default pacing.** The user asked for animation; the original spec asked to avoid timers in lessons
   and let the learner advance manually. The proposal above makes step-through the default with opt-in
   auto-play. Confirm that is what "animated" means here, or specify that auto-play should be the default with
   a pause control.
3. **RM-5 learner participation.** Does the learner click anything in lesson 1 (e.g. "deal the next card"),
   or is it purely observational with a single Continue per stage?
4. **RM-5 redundancy.** With lesson 1 showing two complete hands from both seats, do lessons 5 and 6
   (`coached-round`, `coached-round-dealer`) still both earn their place, or should one be folded in? This
   affects the beginner path's minute total and the Learn promise line.
5. **RM-1 semantics of "Clear".** The user wrote *"as soon as a combo has been counted, the component cards
   should be selectable again. Or after pressing Clear. But Clear does not work."* The spec above reads that
   as: reuse is automatic **and** Clear must stop being a dead control, with a separate reset that re-opens
   the whole count. Confirm Clear should not itself un-count credited groups.
6. **RM-1 reuse indicator.** Should a reused card show how many counted combinations it belongs to
   (e.g. a small badge "in 2"), or only that it has been used at least once?
7. **RM-6 pegging advice is authored, not derived.** The tutorial is forbidden from importing `rankPlays`
   (asserted at `tutorialGrading.test.ts:34`) and the engine has no "pegging quality of a keep" helper, so the
   (c) axis of the discard coaching must be hand-written per scenario. Confirm authored copy is acceptable, or
   authorise a new pure helper in `game.ts` plus a relaxation of that boundary test.
8. **RM-4 / RM-5 board layout.** `CribbageBoard` renders a fixed 300×800 absolutely-positioned SVG overlay
   (`CribbageBoard.tsx:88-94`). Dropping it into a lesson column needs a scaling or layout decision, and it
   must not break the 320 px and 200 %-zoom requirements. Decide whether to scale the SVG, use a compact
   score strip with the board behind a disclosure, or restyle.
9. **RM-2 state ownership.** Reducer-owned (scenario-carrying action) versus component-owned (requires
   removing the `key={roundView}` remount at `Lesson.tsx:276`). Both are viable; pick one explicitly, because
   the remount currently destroys any local state in `GuidedRoundView` on every interaction.
10. **Cross-item breakage — RM-1 vs existing tests.** `HandScoringExercise.test.tsx:78-105` deliberately
    relies on credited cards leaving the tab order. RM-1 changes that. The test must be rewritten in the same
    change, not after it.
11. **Cross-item breakage — RM-4 vs existing tests.** Removing the opponent auto-resolution from
    `playLearnerCard` will break `PeggingExercise.test.tsx` and the sequence tests in
    `tutorialGrading.test.ts`. Decide whether to keep a `resolveOpponentTurns` export for tests or update them
    to step the opponent explicitly (preferred — two code paths invite drift).
12. **Cross-item breakage — RM-5 vs the exhaustiveness guard.** `assertNeverStepKind`
    (`tutorialReducer.ts:9-12`) throws for any `TutorialStep.kind` without a `submit` branch. A new
    `round-demo` kind must be added to `submit`, `passiveKind`, `isAssessedStepKind` and
    `TutorialShell.highlightFor` in the same change or the lesson will crash on any submit.
13. **Mastery implications.** With RM-1 and RM-2 unblocking the graded steps, concept mastery will start
    recording for the first time in practice. Confirm the lesson-7 pill thresholds
    (`Lesson.tsx:39-51`: `independentCorrect > 0 && hintsUsed < 2` → "ready") still read sensibly once
    multi-group counting steps can actually be completed — a step needing five correct submissions
    accumulates `hintsUsed` differently from one needing two.
14. **Unreconciled observation.** The user reports the coached round's pegging card "just disappears" and does
    not mention the count step dead-end (OBS-1) that follows immediately after. This is consistent — the
    invisible table is the first thing a learner hits — but it means the user may not yet have seen the show
    phase at all. Expect further feedback on the show once RM-2 and RM-3 land.

---

## 7. Suggested implementation order

Each increment should land green (`npx vitest run`, `npm run lint`, `npm run build`) and be exercised in a
real browser, not only in jsdom.

1. **Increment 1 — unblock counting.** RM-1, then RM-9. This is the single highest-value change: it makes
   lesson 2, both Quick Practice counting lessons and the lesson-7 checkpoint completable, and it is a
   prerequisite for the guided-round count. Rewrite `HandScoringExercise.test.tsx` in the same change.
2. **Increment 2 — unblock the coached round.** RM-2 (depends on 1), then RM-3, then RM-8. After this, lessons
   5 and 6 are completable end to end with a visible pegging table. RM-3 and RM-8 both touch the guided-round
   view type, so land them together.
3. **Increment 3 — pegging pacing.** RM-4. Independent of 1 and 2, but its horizontal trick row and
   score-callout components should be shared with RM-3, so doing it after increment 2 avoids building the same
   row twice.
4. **Increment 4 — discard coaching.** RM-6. Independent of the others; the engine field addition should land
   first as its own small, test-guarded change so AI parity can be proved in isolation before any copy moves.
5. **Increment 5 — the round demonstration.** RM-5. Largest and last, because it reuses the trick row, the
   score callout and the board integration built in increments 2–3, and because it is the only item that adds
   a new step kind and new content types. Resolve open questions 1–4 before starting.
6. **Increment 6 — navigation pass.** RM-7. Last deliberately: several of its items (the completion screen,
   the workspace heading, the round map's done state) depend on what increments 1–5 add, and doing it first
   would mean doing it twice.
