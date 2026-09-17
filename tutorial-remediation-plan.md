# CribbageX Interactive Tutorial — Remediation Implementation Plan

## Preamble

### What is being remediated

The interactive tutorial feature: `src/features/tutorial/`, `src/components/tutorial/`,
`src/screens/Learn.tsx`, `src/screens/Lesson.tsx`, plus three named shared files
(`src/app/game.ts`, `src/App.css`, `src/components/CribbageBoard.tsx` — the last is read-only, reuse only).

The tutorial's scaffolding is built and its scoring kernel is correct, but the learner-facing path is not
completable. Three dead ends sit on the required route:

1. Every hand-counting exercise except `pair-find` is mathematically impossible: a counted card is
   permanently `disabled`, and the starter card is not selectable at all, while the engine's scoring groups
   reuse cards and include the starter.
2. The coached round's "Count selected cards" button is a literal no-op, because
   `makeTutorialReducer`'s `submit` switch has `case "guided-round": return state`.
3. The coached round never renders the played pegging sequence, so a played card vanishes.

On top of that, Lesson 1 is six static text panels instead of a demonstration, the discard lesson exposes one
blended expected-value number instead of separating hand value from crib value, and the pegging exercise
stacks laid cards vertically and resolves the opponent's whole reply in the same tick as the learner's click.

### Verified baseline (measured, not assumed)

Run at the time of writing, on a clean tree:

- `npx vitest run` → **34 test files, 203 tests, all passing**, exit code 0.
- `npm run lint` → clean.
- `package.json` scripts that exist: `start`, `dev`, `build` (`tsc --noEmit && vite build`), `preview`,
  `test` (`vitest`, watch mode), `lint` (`eslint .`). **There is no `npm run test:ci`; use `npx vitest run`
  for a single non-watch pass.**

### End state after all phases

- Every counting exercise in the catalog is completable: a card may be reused across combinations, the
  starter is selectable, `Clear` is a live control, and `Start this count again` re-opens a count without
  faking mastery.
- Catalog validation proves mechanically that every authored counting scenario is reachable through the UI.
- The coached round shows a horizontal trick row with per-card ownership, retains a finished trick with a
  sentence explaining why it ended, waits for the learner before the opponent replies, shows each show
  breakdown against that hand's own score, and can be completed end to end from deal to
  "The training deal is finished."
- The pegging exercise lays cards in one horizontal row, advances one opponent action per
  `Let them play` press, announces every score explicitly, and moves pegs on a visible cribbage board.
- The discard lesson coaches three axes (hand value, crib value, pegging quality) and its
  `Show the math` disclosure shows hand EV, crib EV and the signed net.
- Lesson 1 is an engine-driven demonstration of **two complete hands** with the dealer and the crib
  swapping between them, stepping through deal → discard → starter → pegging → show(pone, dealer, crib).
- Navigation is coherent: the workspace heading names the activity, header and progress agree, `Back`
  preserves work, `Skip` is visually secondary and labelled as not counting, every lesson (including Quick
  Practice) ends on a completion screen, and step 0's `Back` leaves to `/learn`.

### Phase table

| # | Title | Remediation items | Depends on |
| --- | --- | --- | --- |
| 1 | Counting exercises: card reuse, selectable starter, working Clear | RM-1 | — |
| 2 | Catalog validation proves every count is reachable | RM-9 | Phase 1 |
| 3 | Shared trick row and board wrappers; guided-round table and show totals | RM-3 (items 1, 2, 4), RM-8 | Phase 2 |
| 4 | Guided round: retain finished tricks, let the learner pace the opponent | RM-3 (items 3, 5) | Phase 3 |
| 5 | Guided round: make the counting pause submittable | RM-2 | Phase 4 |
| 6 | Pegging exercise: horizontal row, learner-paced opponent, score callout, board | RM-4 | Phase 5 |
| 7 | Engine: expose hand EV and crib EV on `DiscardOption` | RM-6 (item 1) | Phase 6 |
| 8 | Discard lesson: three-axis coaching and the two-number disclosure | RM-6 (items 2–6) | Phase 7 |
| 9 | Round demonstration 1 of 3: content types, demo decks, validation, new step kind | RM-5 (content model, step kind) | Phase 8 |
| 10 | Round demonstration 2 of 3: the demo runner | RM-5 (engine) | Phase 9 |
| 11 | Round demonstration 3 of 3: the `RoundDemo` component and the new Lesson 1 | RM-5 (UI, catalog metadata) | Phase 10 |
| 12 | Navigation and orientation pass | RM-7 | Phase 11 |

Every remediation item in the specification is covered. Nothing is excluded, but two pieces of work the
specification marks as optional are deliberately **not** implemented — see decisions D1 below.

### Decisions taken where the specification left a choice

These resolve the specification's §6 open questions. Each decision is restated in full inside the phase
that depends on it, so an executor who sees only one phase still has it.

- **D1 — No timers anywhere (resolves open questions 2 and 3; scopes RM-4 item 4 and RM-5 "Play it for
  me").** The specification offers auto-play/auto-pace as optional. It is not implemented. All advance is
  learner-driven: the pegging exercise advances one opponent action per `Let them play` press, and the
  Lesson 1 demonstration advances one beat per `Next` press. "Animated" is delivered by the existing
  card-entry animation (`src/App.css` `.selectable-card.is-played`, already guarded by
  `@media (prefers-reduced-motion: no-preference)`), which must be preserved. Consequently the
  specification's RM-5 acceptance criterion "auto-advance does not start when
  `matchMedia('(prefers-reduced-motion: reduce)')` matches" is dropped: there is no auto-advance to guard.
  No `setTimeout`, `setInterval`, or `requestAnimationFrame` may be introduced by any phase.
- **D2 — Lesson 1 uses two new decks (resolves open question 1).** Two new `ROUND_SCRIPTS` entries,
  `demo-hand-1` and `demo-hand-2`, are added. The coached-round decks `first-round` and `second-round` are
  not reused, so lessons 5 and 6 are not spoiled. The exact 13-card decks are given in Phase 9 and have
  been simulated against `CribbageGame`; every card, play and score they produce is listed there.
- **D3 — Lesson 1 participation (resolves open question 3).** The learner clicks once per dealt card during
  the deal (12 clicks per hand, matching U1a's "one at a time"), and once per beat elsewhere. A `Back`
  control re-watches the previous beat. The learner never discards or plays.
- **D4 — Lessons 5 and 6 both stay (resolves open question 4).** No lesson is folded in or removed.
  `estimatedMinutes` for lesson 1 changes from `2` to `8`, taking the beginner-path total from 27 to 33
  minutes. That is inside the landing promise's "about half an hour", so the promise line in
  `src/screens/Learn.tsx` and its assertion in `src/screens/Learn.test.tsx` are **not** changed.
- **D5 — `Clear` does not un-count (resolves open question 5).** `Clear` empties the pending selection only
  and is `disabled` when nothing is selected. A separate `Start this count again` control re-opens the whole
  count while preserving `attempts` and `hintLevel`.
- **D6 — Reuse indicator shows the count (resolves open question 6).** A card used in counted combinations
  keeps its double-border treatment, gains a visible `×N` badge, and its accessible name reads
  `"used in N counted combination(s)"`.
- **D7 — The discard lesson's pegging advice is authored copy (resolves open question 7).** No new engine
  helper is added and `rankPlays` is not imported by the tutorial. The boundary assertion at
  `src/features/tutorial/tutorialGrading.test.ts` (`expect(gradingSource).not.toMatch(/rankPlays/)`) stays.
- **D8 — Board layout: a scaled, clipped wrapper (resolves open question 8).** `CribbageBoard.tsx` is not
  modified. A new `src/components/tutorial/TutorialBoard.tsx` wraps it in a `position: relative`,
  300×800 box scaled to 45% inside a 135×360 clipping frame, and renders both scores numerically. This also
  fixes a real existing bug: `GuidedRoundView` renders `CribbageBoard` inside `.guided-round-meta`, which
  has no `position: relative`, so the board's absolutely-positioned peg SVG currently escapes its container.
- **D9 — RM-2 is reducer-owned (resolves open question 9).** Two new reducer actions carry the dynamic
  scenario as plain data: `{ type: "submit-count"; scenario: ScoreScenario }` and
  `{ type: "reveal-count"; scenario: ScoreScenario }`. The reducer stays pure and reuses
  `gradeScoreSelection`. The `key={roundView}` remount in `src/screens/Lesson.tsx` is **left in place** —
  it destroys only `GuidedRoundView`'s local `useState`, never reducer state.
- **D10 — `round-demo` is a passive step kind.** `passiveKind("round-demo")` returns `true`, so the step
  starts `complete` and the footer `Next` is always enabled; the learner can never be trapped inside the
  demonstration. `isAssessedStepKind("round-demo")` stays `false`, so the demo awards no mastery.
- **D11 — The specification's illustrative EV numbers are wrong; never hard-code EV figures.** RM-6 quotes
  "*Your four cards are worth about 7.4 … add about 4.1 to the crib*". The real engine values are much
  larger, because `calcExpectedHandScore` already includes the average starter contribution. Measured for
  `DISCARD_SCENARIOS["discard-theirs"]` throwing `J♦ Q♥`: hand EV **12.22**, crib EV **4.93**, net
  **7.29**. All copy must be built from the engine's numbers at run time, and no test may assert a specific
  EV magnitude.
- **D12 — Owner attribution is added as a parallel array, not by changing the existing type.**
  `GuidedRoundView.playingSequence` keeps its `ReadonlyArray<PCard>` type and a new
  `playingSequenceOwners: ReadonlyArray<"you" | "opponent">` is added alongside it. This avoids editing
  `src/features/tutorial/completeRound.ts` and several existing assertions in
  `src/features/tutorial/guidedRound.test.ts` that read `view.playingSequence` as `PCard[]`.

### Cross-cutting rules for every phase

1. Never import `thePlayer` or anything from `src/app/gamePlayer.ts` into `src/features/tutorial/` or
   `src/components/tutorial/`. `src/features/tutorial/boundary.test.ts` scans the raw source of twelve
   feature files for the strings `thePlayer` and `gamePlayer` and fails on a match. The single sanctioned
   exception already exists in `src/screens/Lesson.tsx` (the Easy-game handoff) and must not be copied.
2. Never author a score. Every point, group and label comes from `scoreHandDetailed`, `scoreHand`,
   `explainPegPlay` or `rankDiscards` in `src/app/game.ts`. Do not modify `scoreHand`,
   `scoreHandDetailed` or `explainPegPlay` in any phase.
3. Keep exactly one `<h1>` per page and exactly one `role="status"` / `aria-live` region per screen. The
   single live region is the coach's status box in `src/components/tutorial/CoachPanel.tsx`
   (`<div className={...} role="status" aria-live="polite">`). Do not add a second one.
4. Do not add dependencies, a backend, a formatter, Playwright, or Cypress. Do not touch `Dockerfile`,
   `nginx.conf`, `README.md`, `src/Cribbage.tsx`, `src/app/gamePlayer.ts`, `src/features/game/gameSlice.ts`,
   or `src/app/store.ts`.
5. `@typescript-eslint/no-unused-vars` is an error; unused names must be prefixed `_`.
6. After every phase, all three of these must pass: `npx vitest run` (zero failures), `npm run lint`
   (zero problems), `npm run build` (which runs `tsc --noEmit` first).

---

## Phase 1 — Counting exercises: card reuse, a selectable starter, and a working Clear

**Implements RM-1** (traces to U2a, U2b, U2c; unblocks R2).

### Goal

Make every counting exercise in the catalog finishable: a card that has been counted stays selectable, the
starter card is a selectable control in practice mode, `Clear` is never a dead button, and a new
`Start this count again` control re-opens a count without manufacturing a flawless mastery record.

### Context

`src/components/tutorial/HandScoringExercise.tsx` renders a counting exercise. It is used from
`src/components/tutorial/TutorialShell.tsx` for `score-example`, `score-practice` and `checkpoint` steps, and
from `src/components/tutorial/GuidedRoundView.tsx` for the coached round's counting pause. It takes props
`{ scenario: ScoreScenario; step: StepState; mode: "example" | "practice"; dispatch; hintedIds }`.

Current behaviour, and exactly what is wrong:

- `HandScoringExercise.tsx` line 28 derives credited state with
  `const credited = step.found.some((id) => id.includes(cardId))` — a **substring** test against a group id
  of the form `"fifteen:5H-KD"`. It cannot count how many groups a card belongs to and is fragile for
  multi-character ranks (`"10D"`).
- `src/components/tutorial/SelectableHand.tsx` line 77 renders
  `disabled={item.state === "disabled" || item.state === "credited"}`, so a counted card is permanently
  unclickable and drops out of the tab order.
- `HandScoringExercise.tsx` renders the starter through `SelectableHand` with `mode="none"`, which emits a
  static `<div>` (see `SelectableHand.tsx`, the `if (mode === "none")` branch), so the starter can never be
  part of a submission.
- `src/features/tutorial/tutorialReducer.ts`, `case "clear-selection"`, returns
  `{ ...state, step: { ...state.step, selected: [] } }`. But `submitScore` already sets `selected: []` on
  **both** the credited path and the rejected path, so at the moment the learner is stuck there is nothing
  pending and `Clear` is observably inert.

The grader is already correct and must not change. `gradeScoreSelection` in
`src/features/tutorial/tutorialGrading.ts` matches a submission against the exact `cardIds` set of an engine
group, refuses a group whose id is already in `found`, and `whyNotScore` already produces
"…that fifteen may already be counted". `categoryProgress` counts groups, not cards, and needs no change.

These are the engine's required groups, measured by running `scoreHandDetailed` over every catalog scenario.
Each row's total is what `step.earned` must reach:

| Scenario | Required groups (engine ids) | Total |
| --- | --- | --- |
| `pair-find` | `pair:2C-2H`, `pair:9D-9S` | 4 |
| `fifteen-multi` | `fifteen:2C-3C-10D`, `fifteen:2C-3C-KS`, `fifteen:5H-10D`, `fifteen:5H-KS` | 8 |
| `run-double` | `run:4H-5C-6S`, `run:4H-5D-6S` | 6 |
| `count-all` | `fifteen:7C-8S`, `fifteen:7D-8S`, `pair:7C-7D`, `run:6H-7C-8S`, `run:6H-7D-8S` | 12 |
| `checkpoint-count` | `fifteen:5D-10H`, `fifteen:5S-10H`, `pair:5D-5S`, `run:3H-4C-5D`, `run:3H-4C-5S` | 12 |

`fifteen-multi` needs the starter `3C` in two groups; `checkpoint-count` needs the starter `10H` in two
groups; `count-all` reuses `8S` in three groups. Only `pair-find` is currently completable.

Two decisions apply here and are restated in full:

- **D5:** `Clear` empties the pending selection only; it never un-counts a credited group. A separate
  `Start this count again` control resets `selected`, `found`, `earned`, `revealed` and `feedback` for the
  current step while **preserving** `attempts` and `hintLevel`. That preservation matters:
  `src/screens/Lesson.tsx` treats `state.step.attempts === 0` as the flawless signal, and
  `src/app/persistence.ts` `recordConceptAttempt` treats `outcome.hintLevel < 2` as unaided. Reusing the
  existing `restart-step` action would reset to `emptyStepState` and zero both counters, so a **new** action
  is required.
- **D6:** a card used in counted combinations keeps the existing double-border treatment
  (`src/App.css` `.selectable-card.is-credited`), gains a visible `×N` badge, and its accessible name reads
  `"used in N counted combination(s)"`. Do not encode reuse by colour alone.

### Steps

1. **`src/components/tutorial/SelectableHand.tsx` — add a reuse count to the card model.**
   Add an optional field to the exported `SelectableCard` type:
   `creditedCount?: number` — how many already-counted scoring groups contain this card; `undefined` or `0`
   means none. Do not remove or rename any existing field.

2. **`src/components/tutorial/SelectableHand.tsx` — stop disabling credited cards.**
   Change the `disabled` attribute on the rendered `<button>` from
   `item.state === "disabled" || item.state === "credited"` to `item.state === "disabled"`.
   A credited card must therefore be enabled, focusable by `Tab`, and clickable.

3. **`src/components/tutorial/SelectableHand.tsx` — rebuild the accessible name.**
   Replace the module-level `stateName(state)` helper with a helper that also takes the credited count, e.g.
   `describeState(state: SelectableCard["state"], creditedCount: number): string`, and returns:
   - `"not available"` when `state === "disabled"`;
   - `"hinted"` when `state === "hinted"`;
   - otherwise a comma-joined list: when `creditedCount > 0`, first
     `"used in 1 counted combination"` (singular for exactly 1) or
     `"used in N counted combinations"` (plural for 2 or more); then always
     `"selected"` when `state === "selected"`, else `"not selected"`.

   The full accessible name stays `` `${cardName(live)}, ${describeState(...)}` ``. So a credited,
   unselected five of hearts reads `"Five of hearts, used in 2 counted combinations, not selected"`, and the
   same card while selected reads `"Five of hearts, used in 1 counted combination, selected"`. The
   pre-existing names `"Five of hearts, not selected"`, `"Jack of spades, selected"`,
   `"Four of diamonds, hinted"` and `"Two of spades, not available"` must be unchanged for cards with no
   credited count. The string `"already counted"` disappears from the codebase.

4. **`src/components/tutorial/SelectableHand.tsx` — class names and the visible badge.**
   In the computed `className` array, drive the credited classes off the count rather than the state:
   include `"is-credited credited"` when `(item.creditedCount ?? 0) > 0`, and keep `"is-selected"` when
   `item.state === "selected"`. Both may apply at once. Inside the `<button>` (not the `mode === "none"`
   `<div>`), when `(item.creditedCount ?? 0) > 0`, render an extra element after the badge span:
   `<span className="selectable-card-uses" aria-hidden="true">×{item.creditedCount}</span>`.

5. **`src/App.css` — style the reuse badge.** Add a new rule after the existing
   `.selectable-card-badge, .pc-badge { … }` block:

   ```css
   .selectable-card-uses {
     font-size: 0.7rem;
     font-weight: 700;
     color: #c9b36a;
   }
   ```

   Do not change `.selectable-card.is-credited` or `.pc.credited`; the double border stays as the
   "used in a counted combination" marker.

6. **`src/features/tutorial/tutorialReducer.ts` — make `Clear` meaningful and add the count reset.**
   - Add `| { type: "restart-count" }` to the exported `RunnerAction` union.
   - Add a `case "restart-count":` to the reducer's outer `switch (action.type)` that returns
     `{ ...state, step: { ...state.step, selected: [], found: [], earned: 0, revealed: 0, feedback: null,
     status: "in-progress" } }`. It must **not** change `stepId`, `attempts`, `hintLevel`, `subIndex`,
     `stepIndex`, `completedStepIds`, `lessonComplete` or `lastSkippedStepId`.
   - Leave `case "clear-selection"` exactly as it is. Leave `restart-step` exactly as it is.

7. **`src/components/tutorial/HandScoringExercise.tsx` — count group membership exactly.**
   The component already computes
   `const detailed = scoreHandDetailed(specsToCards(scenario.hand), starterCard ?? undefined, scenario.isCrib)`.
   Derive the found groups once from that result:
   `const foundGroups = detailed.groups.filter((g) => step.found.includes(g.id))`.
   Replace the substring test in `toSelectable` with an exact membership count:
   for each card, `creditedCount = foundGroups.filter((g) => g.cardIds.includes(cardId)).length`.
   Pass `foundGroups` into `toSelectable` as a parameter rather than recomputing it. Remove the
   `id.includes(cardId)` expression entirely.

8. **`src/components/tutorial/HandScoringExercise.tsx` — card state precedence.**
   In `toSelectable`, compute state in this order, for `mode === "practice"`:
   `"selected"` if `step.selected.includes(cardId)`; else `"credited"` if `creditedCount > 0`; else
   `"hinted"` if `hintedIds.includes(cardId)`; else `"idle"`. Always set `creditedCount` on the returned
   object regardless of state. For `mode === "example"`, keep the existing behaviour: state is `"credited"`
   when `creditedCount > 0`, else `"idle"`; also set `creditedCount`.
   (Selection must now win over credited, because a credited card can be selected again.)

9. **`src/components/tutorial/HandScoringExercise.tsx` — make the starter selectable in practice mode.**
   The starter is currently rendered as a `SelectableHand` with `label="Starter"` and `mode="none"`.
   Change it so that:
   - when `mode === "practice"`, it renders with `mode="checkbox"`, `label="Starter"`, an `onToggle` that
     dispatches `{ type: "toggle-card", cardId: <the starter's cardKey> }`, and a `cards` array of one item
     built by the same `toSelectable` logic (so its `state` and `creditedCount` behave exactly like a hand
     card);
   - when `mode === "example"`, it keeps `mode="none"` and `state: "idle"` exactly as today.

   The starter stays in its own `SelectableHand` (its own `<fieldset>` with `<legend>Starter</legend>`); do
   not merge it into the hand group. The UI must not compute flush membership or any other rule — group
   membership is whatever `scoreHandDetailed` returns.

10. **`src/components/tutorial/HandScoringExercise.tsx` — the practice button row.**
    In the `mode === "practice"` branch of the `.btn-row`, keep the existing
    `Count selected cards` button (unchanged: `disabled={step.selected.length === 0}`, dispatches
    `{ type: "submit" }`). Then:
    - add `disabled={step.selected.length === 0}` to the existing `Clear` button;
    - add a third button after `Clear`, `type="button"`, `className="btn btn-outline-light"`, label exactly
      `Start this count again`, which dispatches `{ type: "restart-count" }`. It is always enabled in
      practice mode.

11. **`src/components/tutorial/SelectableHand.test.tsx` — rewrite the credited assertions.**
    In the test currently titled
    `"names the credited and hinted states, and disables credited/disabled cards"`:
    - rename it to `"names a reused card without disabling it, and still disables an unavailable card"`;
    - change the credited card fixture to
      `{ card: { suit: "clubs", rank: 9 }, cardId: "9C", state: "credited", creditedCount: 2 }`;
    - assert `screen.getByRole("button", { name: /nine of clubs, used in 2 counted combinations, not selected/i })`
      `.toBeEnabled()`;
    - add a second credited fixture with `creditedCount: 1` and `state: "selected"` and assert its name
      matches `/used in 1 counted combination, selected/i`;
    - keep the hinted and disabled assertions unchanged.

12. **`src/components/tutorial/HandScoringExercise.test.tsx` — replace the keyboard test and add
    completability coverage.**
    - Delete the `tabUntil` helper and its comment (it depends on credited cards leaving the tab order) and
      delete the test titled `"completes a full count-all exercise using only the keyboard (T3/§6.4)"`.
    - Generalise the `LiveHost` component so it takes a `scenarioId: string` prop, builds a single-step
      lesson `{ kind: "score-practice", id: "step", scenarioId, hintPolicy: "on-request" }`, drives it with
      the real `makeTutorialReducer` / `initialRunnerState`, renders `data-testid="earned"`,
      `data-testid="status"`, `data-testid="attempts"` and `data-testid="hintlevel"` from `state.step`, and
      renders `<HandScoringExercise scenario={SCORE_SCENARIOS[scenarioId]} step={state.step} mode="practice" dispatch={dispatch} />`.
    - Add a helper that, given a scenario, returns the required groups by calling `scoreHandDetailed` with
      `specsToCards(scenario.hand)`, the starter (via `specToCard`) and `scenario.isCrib`, then filtering by
      `scenario.require` when present — the same rule `requiredGroups` uses in `tutorialGrading.ts`. Add a
      second helper that maps a `cardKey` to that card's `cardName` by scanning
      `[...scenario.hand, ...(scenario.starter ? [scenario.starter] : [])]`, so the test can click a card by
      its accessible name.
    - Add a parameterised test using `it.each` over
      `[["pair-find", 4], ["fifteen-multi", 8], ["run-double", 6], ["count-all", 12], ["checkpoint-count", 12]]`
      that, for each required group in engine order, clicks every card of that group by accessible-name
      regex and then clicks `Count selected cards`; finally asserts `status` is `complete` and `earned` is
      the expected total.
    - Add a test named `"a counted card stays enabled, focusable and selectable"` that uses `pair-find`,
      counts the pair of twos, then asserts the two-of-hearts button is `toBeEnabled()`, that
      `await user.tab()` can reach it (focus it directly with `.focus()` then assert `toHaveFocus()` after a
      `user.tab()` sequence is not required — instead assert `element.tabIndex` is not `-1` and that
      `await user.click(element)` produces a `selected` accessible name).
    - Add a test named `"the starter is a button in practice mode and static in example mode"` that renders
      `HandScoringExercise` with `scenario = SCORE_SCENARIOS["fifteen-multi"]` (starter `3C`) and
      `mode="practice"` and asserts `screen.getByRole("button", { name: /three of clubs/i })` exists, then
      renders the same scenario with `mode="example"` and asserts
      `screen.queryByRole("button", { name: /three of clubs/i })` is `null`.
    - Extend the existing test
      `"practice mode: Clear dispatches clear-selection and Count is disabled with nothing selected"` to
      also assert `screen.getByRole("button", { name: /^clear$/i })` is `toBeDisabled()` when
      `step.selected` is `[]`, and add a second render with `step.selected: ["2H"]` asserting it is
      `toBeEnabled()`.
    - Add a test named `"Start this count again clears the count but keeps attempts and hint level"` that
      uses `count-all` through `LiveHost`, makes one deliberately wrong submission (select the six of hearts
      and the eight of spades, then `Count selected cards`), requests nothing else, counts one real group,
      clicks `Start this count again`, and asserts `earned` is `0`, `status` is `in-progress`, and
      `attempts` is still `1`.

13. **`src/features/tutorial/tutorialReducer.test.ts` — cover the new action.**
    Add a test named `"restart-count clears the count without zeroing attempts or hintLevel"` that builds
    the reducer for `findLesson("count-a-hand")` at step index 3 (`count-runs`, scenario `run-double`),
    dispatches a wrong submission and a `request-hint`, then a correct group, then `{ type: "restart-count" }`,
    and asserts `found` is `[]`, `earned` is `0`, `selected` is `[]`, `status` is `"in-progress"`,
    `attempts` is `1` and `hintLevel` is `1`.

### Do NOT

- Do not modify `src/features/tutorial/tutorialGrading.ts`. `gradeScoreSelection`, `whyNotScore`,
  `requiredGroups` and `categoryProgress` are already correct; duplicate-group protection lives there and
  must not be re-implemented in the component.
- Do not modify `src/app/game.ts`, `scoreHand`, or `scoreHandDetailed`.
- Do not change the `clear-selection` or `restart-step` reducer branches.
- Do not change `SelectableHand`'s `mode === "none"` branch: it must keep emitting a non-interactive `<div>`
  with no `role="button"`.
- Do not remove the `.selectable-card.is-credited` / `.pc.credited` double-border CSS.
- Do not touch `src/components/tutorial/PeggingExercise.tsx`, `DiscardExercise.tsx`, `GuidedRoundView.tsx`,
  `CoachPanel.tsx` or `TutorialShell.tsx` in this phase.
- Do not change any scenario in `src/features/tutorial/scenarios.ts` or any lesson in `lessonCatalog.ts`.

### Definition of done

- [ ] `npx vitest run` passes with zero failures.
- [ ] `npm run lint` reports zero problems.
- [ ] `npm run build` succeeds.
- [ ] `rg -n "already counted" src/` returns no matches.
- [ ] `rg -n "id.includes\(cardId\)" src/` returns no matches.
- [ ] `src/components/tutorial/HandScoringExercise.test.tsx` contains the `it.each` test that completes
      `pair-find` (4), `fifteen-multi` (8), `run-double` (6), `count-all` (12) and `checkpoint-count` (12)
      through the real reducer, and no longer contains a `tabUntil` helper.
- [ ] `src/components/tutorial/HandScoringExercise.test.tsx` contains the tests named
      `"a counted card stays enabled, focusable and selectable"`,
      `"the starter is a button in practice mode and static in example mode"` and
      `"Start this count again clears the count but keeps attempts and hint level"`.
- [ ] `src/features/tutorial/tutorialReducer.test.ts` contains
      `"restart-count clears the count without zeroing attempts or hintLevel"`.
- [ ] Manual: run `npm start`, open `http://localhost:3000/learn/count-a-hand`. Click `Skip this step`
      twice to reach step 3 of 9. The coach prompt reads
      "One card can sit in more than one fifteen. Find every fifteen." Confirm the `♣3` starter is rendered
      as a clickable card under a `Starter` legend. Click `♥5` then `♦10`, then `Count selected cards`; the
      coach shows "Counted so far: 2 points". Click `♥5` again — it is still clickable — then `♠K`, then
      `Count selected cards`; total is 4. Click `♣2`, `♣3`, `♦10`, `Count selected cards`; total is 6. Click
      `♣2`, `♣3`, `♠K`, `Count selected cards`; total is **8** and the footer `Next` becomes enabled.
- [ ] Manual, same screen: with nothing selected, `Clear` is greyed out and unclickable. Select one card;
      `Clear` becomes clickable and clicking it deselects. Click `Start this count again`; the
      "Counted so far" total returns to 0 points and every combination can be found again.

### Rollback note

Revert `src/components/tutorial/SelectableHand.tsx`, `src/components/tutorial/HandScoringExercise.tsx`,
`src/features/tutorial/tutorialReducer.ts`, `src/App.css`,
`src/components/tutorial/SelectableHand.test.tsx`,
`src/components/tutorial/HandScoringExercise.test.tsx` and
`src/features/tutorial/tutorialReducer.test.ts` to their previous contents. No other file changes in this
phase.

---

## Phase 2 — Catalog validation proves every counting scenario is reachable

**Implements RM-9** (traces to U2a/U2c as regression protection). **Requires Phase 1 complete.**

### Goal

Add a mechanical check, run by the existing catalog test, that every `ScoreScenario`'s required scoring
groups can actually be completed through the UI, and prove the check bites with a negative fixture.

### Context

`src/features/tutorial/validateCatalog.ts` exports `validateCatalog()`, which walks
`SCORE_SCENARIOS`, `DISCARD_SCENARIOS`, `PEG_SCENARIOS`, `ROUND_SCRIPTS`, `BEGINNER_PATH` and
`QUICK_PRACTICE` and returns a `ReadonlyArray<CatalogProblem>` where
`CatalogProblem = { where: string; problem: string }`. It calls per-scenario helpers that are exported
specifically so negative fixtures can prove they reject bad input: `uniqueSlug`, `checkCards`,
`checkScoreScenario`, `checkDiscardScenario`, `checkPegScenario`. `src/features/tutorial/catalog.test.ts`
asserts `validateCatalog()` equals `[]` for the real catalog and has a
`describe("catalog validators reject bad authoring (C4 negative fixtures)")` block that feeds deliberately
broken fixtures through those helpers.

What is missing: no check asks whether a scenario's required groups are reachable through the interaction
rules. That is exactly why every counting exercise but one shipped uncompletable with a green suite.

Phase 1 established the interaction rules that make a group reachable: the selectable set is the four hand
cards **plus the starter**, a card may be reused across groups, and groups may be completed in any order.
The check therefore reduces to: every `cardId` in every required group must be a member of the scenario's
selectable card-key set.

`checkScoreScenario(id, sc)` currently checks the record key, card legality, that
`scoreHandDetailed(...).total > 0`, and that each `sc.require` category exists in the hand.

### Steps

1. **`src/features/tutorial/validateCatalog.ts` — add the reachability check inside `checkScoreScenario`.**
   After the existing `sc.require` loop, and using the `result` from the `scoreHandDetailed` call already
   made in that function:
   - build `selectable`, a `Set<string>` of `cardKey` values for
     `[...sc.hand, ...(sc.starter ? [sc.starter] : [])]` (use `specToCard` and `cardKey`, both already
     imported);
   - compute the required groups the same way the rest of the function does: all of `result.groups` when
     `sc.require` is undefined, otherwise `result.groups.filter((g) => sc.require?.includes(g.category))`;
   - if there are zero required groups, add the problem
     `"no required scoring group is reachable"`;
   - for every required group, for every `cardId` in `g.cardIds` that is not in `selectable`, add the
     problem `` `group ${g.id} needs card ${cardId}, which is not selectable (hand plus starter)` ``.

   Keep every existing problem string byte-identical; only add new ones.

2. **`src/features/tutorial/catalog.test.ts` — add the negative fixture.**
   In the existing `describe("catalog validators reject bad authoring (C4 negative fixtures)")` block, add a
   test named `"checkScoreScenario flags a required group whose card is not selectable"`. Build a fixture
   from `SCORE_SCENARIOS["fifteen-multi"]` (hand `5H, 10D, KS, 2C`, starter `3C`, `require: ["fifteen"]`)
   with `starter: null`: with no starter, `scoreHandDetailed` produces only the fifteens inside the four hand
   cards, so this fixture must be constructed to still reference the starter. Do it this way instead —
   it is deterministic and needs no starter trickery: assert that `checkScoreScenario` returns no
   reachability problem for the real `fifteen-multi`, and then assert it **does** for a hand-substituted
   fixture built by taking `SCORE_SCENARIOS["checkpoint-count"]` and replacing `hand` with
   `[["hearts", 3], ["clubs", 4], ["diamonds", 5], ["spades", 5]]` and `starter` with `["hearts", 10]`
   (i.e. the real scenario) — this real one must pass. To get a failure, call the new check through a
   fixture whose `require` category is produced only with the starter while the starter is removed:
   use `SCORE_SCENARIOS["fifteen-multi"]` with `starter: null` and assert the returned problems include
   either `"no required scoring group is reachable"` or a `"not selectable"` message, using
   `expect(problems.some((p) => /not selectable|no required scoring group/.test(p.problem))).toBe(true)`.

3. **`src/features/tutorial/catalog.test.ts` — add the positive assertion for the real catalog.**
   In the existing `describe("catalog (C4)")` block, add a test named
   `"every score scenario's required groups are reachable from hand plus starter"` that iterates
   `Object.entries(SCORE_SCENARIOS)` and asserts, for each, that
   `checkScoreScenario(id, sc).filter((p) => /not selectable|no required scoring group/.test(p.problem))`
   equals `[]`.

4. **`src/features/tutorial/catalog.test.ts` — add the beginner-path duration invariant.**
   In `describe("catalog (C4)")`, add a test named
   `"the beginner path stays inside the landing promise of about half an hour"` that asserts
   `BEGINNER_PATH.reduce((sum, l) => sum + l.estimatedMinutes, 0)` is at most `35`. (It is 27 today; Phase 11
   raises it to 33. This test is what allows the promise line in `src/screens/Learn.tsx` to be left alone.)

### Do NOT

- Do not change any scenario data in `src/features/tutorial/scenarios.ts`.
- Do not change `validateRoundScripts`, `checkDiscardScenario`, `checkPegScenario`, `checkCards` or
  `uniqueSlug`.
- Do not alter or reorder any existing `CatalogProblem` message string; other tests match on them.
- Do not add a new exported function; the check belongs inside `checkScoreScenario`, which is already
  exported and already called by `validateCatalog`.
- Do not touch any component or the reducer in this phase.

### Definition of done

- [ ] `npx vitest run` passes with zero failures.
- [ ] `npm run lint` reports zero problems.
- [ ] `npm run build` succeeds.
- [ ] `src/features/tutorial/catalog.test.ts` contains tests named
      `"every score scenario's required groups are reachable from hand plus starter"`,
      `"checkScoreScenario flags a required group whose card is not selectable"` and
      `"the beginner path stays inside the landing promise of about half an hour"`.
- [ ] `validateCatalog()` still returns `[]`: the existing test `"has no authoring problems"` passes.
- [ ] Regression proof, performed by hand and then undone: temporarily revert Phase 1's starter change in
      `src/components/tutorial/HandScoringExercise.tsx` (put `mode="none"` back on the starter's
      `SelectableHand` in practice mode), run `npx vitest run`, and confirm the Phase 1 `it.each`
      completability test fails for `fifteen-multi` and `checkpoint-count`. Restore the change and confirm
      the suite is green again.

### Rollback note

Revert `src/features/tutorial/validateCatalog.ts` and `src/features/tutorial/catalog.test.ts`. Phase 1's
runtime behaviour is unaffected by this phase.

---

## Phase 3 — Shared trick row and board wrappers; the coached round's table and show totals

**Implements RM-3 items 1, 2 and 4, and RM-8** (traces to U5, U1e). **Requires Phase 2 complete.**

### Goal

Build the two presentational components that three later phases share — a horizontal trick row with
per-card ownership, and a scaled cribbage board — then use them in the coached round so a played card is
visible, and fix the coached round's show breakdowns so each total is that hand's own score.

### Context

`src/components/tutorial/GuidedRoundView.tsx` renders the coached round. During
`view.awaiting === "play-card"` it renders only a count chip (`<span className="count-chip">Count: {view.count}</span>`)
and the learner's remaining hand. `view.playingSequence` is populated by
`src/features/tutorial/guidedRound.ts` (`playingSequence: this.game.playingHand.hand.map(toPCard)`) and is
read by **no component**, so playing a card makes it vanish. Confirmed by driving the engine: playing `7♥`
takes the view sequence from `[]` to `[7♥, 4♦]` with count 11 while the screen shows only "Count: 11".

`GuidedRoundView.tsx` also renders `<CribbageBoard playerPeg={playerPeg} opponentPeg={opponentPeg} />`
inside `<div className="guided-round-meta">`. `src/components/CribbageBoard.tsx` renders an `<img>` plus an
`<svg style={{position:"absolute", top:0, left:0}} width={300} height={800}>` overlay. `.guided-round-meta`
in `src/App.css` has no `position: relative`, so that overlay is positioned against the wrong ancestor. This
is decision **D8**: fix it with a wrapper, and do not modify `CribbageBoard.tsx`.

RM-8: `GuidedRoundView.tsx` renders the opponent's hand breakdown with `total={view.scores.opponent}` and the
crib's with `total={view.scores.player}`. Those are cumulative **game** scores, not that hand's score.
`src/components/ScoreExplanation.tsx` derives its own total with `scoreHandDetailed` and
`console.log`s a mismatch, so the learner is shown a breakdown whose lines do not add up to its stated
total. Measured on the real scripts: for `first-round` the opponent's hand scores **3** while
`view.scores.opponent` is **9**; for `second-round` the crib scores **4** while `view.scores.player` is
**10**. `ScoreExplanation` also returns `null` when `total < 0`, which is why the new totals must be computed
from the cards rather than read from `game.scores['opponent-hand']` (that field is still `-1` while the round
is paused at "The opponent counts first").

Decision **D12** applies: `GuidedRoundView`'s `playingSequence` keeps its `ReadonlyArray<PCard>` type and a
parallel `playingSequenceOwners: ReadonlyArray<"you" | "opponent">` is added. Do not change
`playingSequence`'s type — `src/features/tutorial/completeRound.ts` and several assertions in
`src/features/tutorial/guidedRound.test.ts` read it as `PCard[]`.

Decision **D8** applies: the board wrapper scales a `position: relative` 300×800 box to 45% inside a
135×360 clipping frame and renders both scores numerically, because the board is small.

`src/App.css` already contains an unused flex rule `.peg-sequence` and an entry animation
`.selectable-card.is-played` guarded by `@media (prefers-reduced-motion: no-preference)`. Both are used by
this phase. `src/App.css` also contains a `.seq` **class usage** in `PeggingExercise.tsx` with **no matching
CSS rule** — that is Phase 6's problem, not this one.

### Steps

1. **`src/components/tutorial/SelectableHand.tsx` — export the suit glyph map.**
   Change `const SUIT_GLYPH: Record<Suit, string> = { … }` to `export const SUIT_GLYPH: …`. Change nothing
   else in this file. (`react-refresh/only-export-components` is switched off in `eslint.config.js`, so a
   non-component export here is allowed.)

2. **Create `src/components/tutorial/TrickRow.tsx`.**
   Exports:

   ```ts
   export type TrickCard = { card: PCard; by: "you" | "opponent" }
   export type TrickRowProps = {
     cards: ReadonlyArray<TrickCard>
     count: number
     label?: string
     previous?: { cards: ReadonlyArray<TrickCard>; reason: string }
   }
   export function TrickRow(props: TrickRowProps): JSX.Element
   ```

   Module-level `const deck = new StdDeck("rc")`, matching the pattern in `HandScoringExercise.tsx`.
   Import `Card`, `cardKey`, `cardName`, `rank_map` from `../../app/entities`, `SUIT_GLYPH` from
   `./SelectableHand`, and `PCard` as a type from `../../features/game/gameSlice`.

   Rendering rules:
   - When `previous` is given, render first a `<ul className="peg-sequence peg-sequence--previous" aria-label="The previous trick">`
     containing its cards, then `<p className="peg-trick-reason">{previous.reason}</p>`.
   - Then render `<div className="peg-strip">` containing
     `<span className="count-chip">Count: {count}</span>` followed by, when `cards.length > 0`, a single
     `<ul className="peg-sequence" aria-label={label ?? "Cards on the table"}>`; when `cards.length === 0`,
     render `<span className="meta">Nothing played yet.</span>` instead of the list.
   - Each card is one `<li className="peg-sequence-card" key={cardKey(live)}>` where
     `live = new Card(item.card.suit, item.card.rank)`, containing:
     a `<div>` whose className is `"selectable-card pc static"` plus `" is-played"` **only for the last card
     of the main row** (never for a card in `previous`), holding
     `<img className="selectable-card-face" src={deck.getFaceImageUri(live)} alt="" />`,
     `<span className="selectable-card-badge pc-badge" aria-hidden="true">{rank_map[rank]}{SUIT_GLYPH[suit]}</span>`
     and `<span className="visually-hidden">{`${cardName(live)}, played by ${item.by === "you" ? "you" : "them"}`}</span>`;
     followed by a sibling `<span className="peg-owner">{item.by === "you" ? "you" : "them"}</span>`.
   - There must be exactly one list element per row and **no `<fieldset>` anywhere inside `TrickRow`**.
   - `TrickRow` must not render any `role="status"`, `aria-live` or `<button>`.

3. **Create `src/components/tutorial/TutorialBoard.tsx`.**
   Exports:

   ```ts
   export type TutorialBoardProps = {
     playerPegPoints: ReadonlyArray<number>
     opponentPegPoints: ReadonlyArray<number>
     playerScore: number
     opponentScore: number
   }
   export function TutorialBoard(props: TutorialBoardProps): JSX.Element
   ```

   Import `{ CribbageBoard, Peg }` from `../CribbageBoard`. Render:

   ```
   <div className="tutorial-board-wrap">
     <div className="tutorial-board-frame">
       <div className="tutorial-board">
         <CribbageBoard
           playerPeg={new Peg(0, [...playerPegPoints])}
           opponentPeg={new Peg(1, [...opponentPegPoints])}
         />
       </div>
     </div>
     <p className="tutorial-board-scores">You {playerScore} · Them {opponentScore}</p>
   </div>
   ```

   The array spreads are required: `Peg`'s constructor writes into the array it is given when its length is
   below 2, and the caller's array must not be mutated.

4. **`src/App.css` — add the layout rules.** Append these after the existing `.peg-sequence` rule, and add
   the two declarations noted to the existing `.peg-sequence` rule itself (it is currently a bare flex rule
   and is about to be used on a `<ul>`):

   ```css
   /* add to the existing .peg-sequence rule */
   .peg-sequence {
     list-style: none;
     padding: 0;
   }

   .peg-sequence-card {
     display: flex;
     flex-direction: column;
     align-items: center;
     gap: 0.15rem;
   }

   .peg-owner {
     font-size: 0.7rem;
     color: #d9c48a;
   }

   .peg-sequence--previous {
     opacity: 0.55;
   }

   .peg-trick-reason {
     font-size: 0.78rem;
     color: #d9c48a;
     margin: 0 0 0.6rem;
   }

   .tutorial-board-wrap {
     display: flex;
     flex-wrap: wrap;
     align-items: flex-start;
     gap: 0.75rem;
     margin-bottom: 0.75rem;
   }

   .tutorial-board-frame {
     width: 135px;
     height: 360px;
     overflow: hidden;
     flex: 0 0 auto;
   }

   .tutorial-board {
     position: relative;
     width: 300px;
     height: 800px;
     transform: scale(0.45);
     transform-origin: top left;
   }

   .tutorial-board-scores {
     font-weight: 700;
     color: #f7e7b0;
     margin: 0;
   }
   ```

   Do not delete `.guided-round-meta`; it simply stops being used by `GuidedRoundView`.

5. **`src/features/tutorial/guidedRound.ts` — track play ownership.**
   - Add a private field `private playOwners: Array<"you" | "opponent"> = []`.
   - Reset it to `[]` in `boot()` alongside the other field resets.
   - In `pump`, immediately after `const produced = this.game.doAction(action)`, add: if
     `action.action === "play-card"` and
     `this.game.playingHand.hand.length === this.playOwners.length + 1`, push
     `action.subaction === "player" ? "you" : "opponent"` onto `this.playOwners`. (The length test is what
     makes this exact: a rejected over-31 play does not grow `playingHand`, so it does not grow the owners.)
   - In `pump`, after the `produced` loop and after the `this.game.gameOver` check, add: if
     `this.game.playingHand.hand.length === 0`, set `this.playOwners = []`.

6. **`src/features/tutorial/guidedRound.ts` — extend the exported view type.**
   Add two fields to `export type GuidedRoundView`:
   - `playingSequenceOwners: ReadonlyArray<"you" | "opponent">`
   - `showScores: { opponentHand: number; crib: number }`

   In `view()`, return `playingSequenceOwners: [...this.playOwners]`, and

   ```ts
   showScores: {
     opponentHand: revealShow ? scoreHand([...this.game.savedOpponentHand.hand], this.game.starter, false) : -1,
     crib: revealCrib ? scoreHand([...this.game.crib.hand], this.game.starter, true) : -1,
   },
   ```

   using the `revealShow` / `revealCrib` locals already computed at the top of `view()` and the `scoreHand`
   import that is already present. Pass array copies: `scoreHand` sorts the array it is given.
   Do **not** change the type or value of `playingSequence`.

7. **`src/components/tutorial/GuidedRoundView.tsx` — swap in the board wrapper.**
   Remove the `import { CribbageBoard, Peg } from '../CribbageBoard'` line and the two local
   `const playerPeg = new Peg(...)` / `const opponentPeg = new Peg(...)` declarations. Import
   `{ TutorialBoard } from './TutorialBoard'`. Replace the whole
   `<div className="guided-round-meta"> … </div>` block with:

   ```tsx
   <TutorialBoard
     playerPegPoints={view.pegPoints.player}
     opponentPegPoints={view.pegPoints.opponent}
     playerScore={view.scores.player}
     opponentScore={view.scores.opponent}
   />
   ```

8. **`src/components/tutorial/GuidedRoundView.tsx` — render the trick row throughout pegging.**
   Import `{ TrickRow } from './TrickRow'` and its `TrickCard` type. Near the top of the component body add:

   ```ts
   const trick: TrickCard[] = view.playingSequence.map((card, index) => ({
     card,
     by: view.playingSequenceOwners[index] ?? "opponent",
   }))
   ```

   Render `<TrickRow cards={trick} count={view.count} label="On the table" />` **once**, immediately after
   the starter block, guarded by `view.phase === "pegging"`. Delete the `<div className="peg-strip">` with
   the lone count chip from inside the `view.awaiting === "play-card"` branch — the count now lives in the
   trick row and must not be rendered twice.

9. **`src/components/tutorial/GuidedRoundView.tsx` — fix the show totals (RM-8).**
   Change the opponent `ScoreExplanation`'s `total={view.scores.opponent}` to
   `total={view.showScores.opponentHand}`, and the crib `ScoreExplanation`'s `total={view.scores.player}` to
   `total={view.showScores.crib}`. Change nothing else about those two blocks.

10. **Create `src/components/tutorial/TrickRow.test.tsx`.** Tests:
    - `"lays the cards in one horizontal list with no nested fieldset"` — render two cards
      (`{ suit: "hearts", rank: 7 }` by `"you"`, `{ suit: "diamonds", rank: 4 }` by `"opponent"`) with
      `count={11}`; assert `screen.getByText("Count: 11")` exists; assert
      `screen.getByRole("list", { name: /cards on the table/i })` exists and has exactly two
      `role="listitem"` children; assert `container.querySelectorAll("fieldset")` has length `0`.
    - `"attributes each card to a player in text"` — assert `screen.getByText(/seven of hearts, played by you/i)`
      and `screen.getByText(/four of diamonds, played by them/i)` are in the document, and that the visible
      owner labels `you` and `them` are both present.
    - `"animates only the newest card"` — assert exactly one element in the main row has the class
      `is-played`, and that it is the last `listitem`.
    - `"shows a previous trick with its reason"` — pass `previous` with one card and
      `reason: "That made 31 — 2 points. The count resets to 0."`; assert the reason text is present and
      that a `role="list"` named `/previous trick/i` exists.
    - `"says so when nothing has been played"` — pass `cards: []`; assert
      `screen.getByText(/nothing played yet/i)` and that no `role="list"` named `/cards on the table/i`
      exists.

11. **Create `src/components/tutorial/TutorialBoard.test.tsx`.** One test,
    `"renders the board and both scores"`: render with
    `playerPegPoints={[7, 4, 0]} opponentPegPoints={[2, 0, -1]} playerScore={7} opponentScore={2}`; assert
    `screen.getByAltText(/cribbage board with 3 tracks/i)` exists and
    `screen.getByText("You 7 · Them 2")` exists. Add a second assertion that the input arrays are not
    mutated: capture `const p = [7, 4, 0]`, pass it, and assert `p` still equals `[7, 4, 0]` after render.

12. **`src/components/tutorial/GuidedRoundView.test.tsx` — update the fixture and add coverage.**
    - Add `playingSequenceOwners: []` and `showScores: { opponentHand: -1, crib: -1 }` to the object
      returned by `baseView`.
    - Add a test named `"shows the played trick with each card attributed during pegging"` that builds a
      view with `phase: "pegging"`, `awaiting: "play-card"`, `count: 11`,
      `playingSequence: [{ suit: "hearts", rank: 7 }, { suit: "diamonds", rank: 4 }]`,
      `playingSequenceOwners: ["you", "opponent"]` and a two-card `playerHand`, and asserts
      `screen.getByText(/seven of hearts, played by you/i)` and
      `screen.getByText(/four of diamonds, played by them/i)` are present and that `screen.getAllByText(/^Count: 11$/)`
      has length `1`.

13. **`src/features/tutorial/guidedRound.test.ts` — add ownership and show-total coverage.**
    - In the shared `describe.each` block, add a test named
      `"attributes every card in the trick to the player who laid it"` that discards the first two card ids,
      walks to `awaiting: "play-card"` with the existing `runToNextChoice` helper, and asserts
      `view.playingSequenceOwners.length === view.playingSequence.length` at that point; then, after the
      learner plays one legal card and `runToNextChoice` again, asserts the same equality still holds and
      that `view.playingSequenceOwners.includes("you")` is `true`.
    - Add a test named `"reports each show total as that hand's own score, not the game score"` that drives
      `first-round` to completion the same way the existing
      `"has the non-dealer (learner) lead the pegging and score…"` test does (discard `["5S", "6C"]`, play
      `7H, JD, QH, 2S`, `completeCount()`), then asserts
      `view.showScores.opponentHand === scoreHandDetailed([...opponentHandCards], starterCard, false).total`
      and `view.showScores.crib === scoreHandDetailed([...cribCards], starterCard, true).total`, building the
      `Card` objects with `specToCard`. Import `scoreHandDetailed` from `../../app/game` for this.

### Do NOT

- Do not modify `src/components/CribbageBoard.tsx`.
- Do not change the type of `GuidedRoundView.playingSequence`; add the parallel owners array instead.
- Do not modify `src/features/tutorial/completeRound.ts` in this phase.
- Do not modify `src/components/ScoreExplanation.tsx` or `src/components/GroupList.tsx`.
- Do not change `scoreHand`, `scoreHandDetailed`, or anything else in `src/app/game.ts`.
- Do not add `role="status"` or `aria-live` to `TrickRow` or `TutorialBoard`; the coach panel keeps the only
  live region.
- Do not touch `PeggingExercise.tsx` yet — it still uses its own vertical `.seq` markup and is Phase 6's job.
- Do not introduce any timer (decision D1).
- Do not change `GuidedRound`'s `awaiting` union or add opponent pacing in this phase; that is Phase 4.

### Definition of done

- [ ] `npx vitest run` passes with zero failures.
- [ ] `npm run lint` reports zero problems.
- [ ] `npm run build` succeeds.
- [ ] `src/components/tutorial/TrickRow.tsx` and `src/components/tutorial/TutorialBoard.tsx` exist, and
      `rg -n "CribbageBoard" src/components/tutorial/` matches only `TutorialBoard.tsx`.
- [ ] `src/components/tutorial/TrickRow.test.tsx` contains the five tests named in step 10 and
      `src/components/tutorial/TutorialBoard.test.tsx` contains `"renders the board and both scores"`.
- [ ] `src/features/tutorial/guidedRound.test.ts` contains
      `"attributes every card in the trick to the player who laid it"` and
      `"reports each show total as that hand's own score, not the game score"`.
- [ ] Manual: `npm start`, open `http://localhost:3000/learn/coached-round`, click `Next` once to leave the
      `A training deal` explain step, then work to the pegging phase (`Confirm two discards` with any two
      cards, then `Continue` through the starter). Lead any card. **Your card appears face up in a single
      horizontal row** labelled with `you` beneath it, the opponent's reply appears to its right labelled
      `them`, and the `Count:` chip sits to the left of the row.
- [ ] Manual, same screen: the cribbage board appears as a small board in the left column with the peg dots
      **on** the board image (not floating elsewhere on the page), with a `You N · Them M` line beside it.
- [ ] Manual, same screen: continue to the show. The heading `Opponent` breakdown's `Total` equals the sum of
      its own listed lines, and so does the `Crib` breakdown's. Open the browser console and confirm no
      `ScoreExplanation total mismatch` line is logged during the round.
- [ ] Manual responsive check: with the browser devtools device toolbar set to width 320 px and then 1280 px,
      the laid cards remain in a single row that wraps rather than stacking one card per line.

### Rollback note

Revert `src/features/tutorial/guidedRound.ts`, `src/components/tutorial/GuidedRoundView.tsx`,
`src/components/tutorial/SelectableHand.tsx`, `src/App.css`,
`src/components/tutorial/GuidedRoundView.test.tsx`, `src/features/tutorial/guidedRound.test.ts`, and delete
`src/components/tutorial/TrickRow.tsx`, `TutorialBoard.tsx`, `TrickRow.test.tsx` and
`TutorialBoard.test.tsx`.

---

## Phase 4 — Coached round: keep finished tricks visible, and let the learner pace the opponent

**Implements RM-3 items 3 and 5** (traces to U5, U4b, U4d). **Requires Phase 3 complete.**

### Goal

Stop a completed trick from vanishing silently — retain it, dimmed, with a sentence saying why it ended —
and make the opponent's reply wait for an explicit `Let them play` press instead of landing in the same tick
as the learner's click.

### Context

`src/features/tutorial/guidedRound.ts` defines `class GuidedRound` with a private `pump(incoming: GameAction[])`
loop that drives an isolated `CribbageGame` over a `FixedDeck`. Its `awaiting` field is typed
`"acknowledge" | "discard" | "play-card" | "count-hand" | "done" | "error"` and is surfaced on the exported
`GuidedRoundView` type. `handleNeed(action)` satisfies `need-*` actions: for `need-play-card` with
`subaction === "opponent"` it picks the next legal card from `this.script.opponentPlays` (falling back to the
first legal card in hand with a `console.log`) and queues it **immediately**, returning `false` so the pump
keeps running. That is why the opponent's reply lands in the same tick as the learner's play.

When a trick ends the engine emits `last-card`, whose handler in `src/app/game.ts` moves `playingHand` into
`discardHand`. So `view.playingSequence` returns to `[]` and the whole exchange disappears with no
explanation. In `src/app/game.ts` the `last-card` handler awards 1 point only when the count was below 31
(at exactly 31 the 2 points were already awarded by the `31` peg event).

Phase 3 added a private `playOwners: Array<"you" | "opponent">` to `GuidedRound`, pushed to after each
successful `play-card` and cleared when `playingHand` empties, plus the view fields
`playingSequenceOwners` and `showScores`. Phase 3 also added
`src/components/tutorial/TrickRow.tsx`, whose props are
`{ cards: ReadonlyArray<{ card: PCard; by: "you" | "opponent" }>; count: number; label?: string; previous?: { cards: …; reason: string } }`
and which renders `previous` as a dimmed `.peg-sequence--previous` list followed by
`<p className="peg-trick-reason">`.

Decision **D1** applies: there is no timer anywhere. The pause is released only by a learner press.

Two collateral consumers read `awaiting` and will hang on a new value unless updated in this same phase:
`src/features/tutorial/completeRound.ts` (its `while` loop returns
`{ ok: false, reason: 'stuck at …' }` for an unhandled `awaiting`, and it is called by
`validateRoundScripts` from `src/features/tutorial/catalog.test.ts`), and the `runToNextChoice` helper in
`src/features/tutorial/guidedRound.test.ts` (which currently only skips `"acknowledge"`).

### Steps

1. **`src/features/tutorial/guidedRound.ts` — widen `awaiting` and add the new view fields.**
   - Change the `awaiting` member of `export type GuidedRoundView` to
     `"acknowledge" | "discard" | "play-card" | "opponent-play" | "count-hand" | "done" | "error"`.
   - Add three fields to that type:
     `lastTrick: ReadonlyArray<PCard>`, `lastTrickOwners: ReadonlyArray<"you" | "opponent">`,
     `lastTrickReason: string`.
   - Change the private field declaration `private awaiting: GuidedRoundView["awaiting"] = "acknowledge"`
     only if TypeScript requires it; it already derives from the view type.

2. **`src/features/tutorial/guidedRound.ts` — add the private state.**
   Add private fields, and reset every one of them in `boot()`:
   - `private trickCards: PCard[] = []`
   - `private lastTrick: PCard[] = []`
   - `private lastTrickOwners: Array<"you" | "opponent"> = []`
   - `private lastTrickReason = ""`
   - `private pendingOpponentPlay: GameAction | null = null`
   - `private opponentTurnReleased = false`

   `pendingOpponentPlay` and `opponentTurnReleased` are **separate** from the existing `pending` and
   `resumePending` fields, which belong to show interception (`interceptShow`, `completeCount`,
   `acknowledge`). Do not reuse those.

3. **`src/features/tutorial/guidedRound.ts` — maintain `trickCards` beside `playOwners`.**
   In `pump`, at the same place Phase 3 pushes to `this.playOwners` (immediately after
   `const produced = this.game.doAction(action)`, when `action.action === "play-card"` and
   `this.game.playingHand.hand.length === this.playOwners.length + 1`), also push
   `toPCard(action.cards[0])` onto `this.trickCards`. The two arrays must always have equal length.

4. **`src/features/tutorial/guidedRound.ts` — snapshot a finished trick instead of dropping it.**
   At the top of each `pump` loop iteration, after `const action = this.queue.shift() as GameAction`, capture
   `const countBefore = this.game.playingHand.sum()`.
   Replace Phase 3's "clear the owners when `playingHand` empties" step with this: if
   `this.game.playingHand.hand.length === 0 && this.trickCards.length > 0`, then
   - set `this.lastTrick = [...this.trickCards]` and `this.lastTrickOwners = [...this.playOwners]`;
   - set `this.lastTrickReason` to
     `"That made 31 — 2 points. The count resets to 0."` when `countBefore === 31`, otherwise
     `` `Nobody could play past ${countBefore}. The last card scores 1. The count resets to 0.` ``;
   - then set `this.trickCards = []` and `this.playOwners = []`.

5. **`src/features/tutorial/guidedRound.ts` — expose the snapshot.**
   In `view()`, return `lastTrick: [...this.lastTrick]`,
   `lastTrickOwners: [...this.lastTrickOwners]` and `lastTrickReason: this.lastTrickReason`. Return copies,
   matching the existing comment on `log` about callers holding a view across later mutating calls.

6. **`src/features/tutorial/guidedRound.ts` — pause before every opponent play.**
   In `handleNeed`, inside the `action.action === "need-play-card"` branch, in the
   `action.subaction === "opponent"` case, before the existing card-choosing code, insert:

   ```ts
   if (!this.opponentTurnReleased) {
     this.pendingOpponentPlay = action
     this.awaiting = "opponent-play"
     this.coach = "Their turn. Press “Let them play” when you are ready."
     return true
   }
   this.opponentTurnReleased = false
   ```

   Leave the card-choosing code, the `console.log` fallback, `this.opponentPlayIndex += 1` and the
   `return false` exactly as they are.

7. **`src/features/tutorial/guidedRound.ts` — add the public release method.**
   Add a public method next to `acknowledge()`:

   ```ts
   letOpponentPlay(): void
   ```

   It returns immediately unless `this.awaiting === "opponent-play"` and `this.pendingOpponentPlay` is
   non-null. Otherwise it takes the action, sets `this.pendingOpponentPlay = null`, sets
   `this.opponentTurnReleased = true`, and calls `this.pump([action])`.

8. **`src/features/tutorial/completeRound.ts` — handle the new pause.**
   In the `while` loop, after the `view.awaiting === "acknowledge"` branch, add:

   ```ts
   if (view.awaiting === "opponent-play") {
     round.letOpponentPlay()
     continue
   }
   ```

   Raise the loop guard from `guard++ < 400` to `guard++ < 800`, because every opponent play now costs an
   extra iteration.

9. **`src/components/tutorial/GuidedRoundView.tsx` — render the previous trick.**
   Build the previous-trick prop next to the `trick` array Phase 3 added:

   ```ts
   const previousTrick = view.lastTrick.length > 0
     ? {
         cards: view.lastTrick.map((card, index) => ({
           card,
           by: view.lastTrickOwners[index] ?? "opponent",
         })),
         reason: view.lastTrickReason,
       }
     : undefined
   ```

   Pass it to the existing `TrickRow` as `previous={previousTrick}`.

10. **`src/components/tutorial/GuidedRoundView.tsx` — add the `Let them play` control.**
    Add a new block, immediately after the `view.awaiting === "play-card"` block, rendered when
    `view.awaiting === "opponent-play"`:

    ```tsx
    <button
      type="button"
      className="btn btn-warning"
      aria-label="Let the opponent play their card"
      onClick={() => { round.letOpponentPlay(); refresh() }}
    >
      Let them play
    </button>
    ```

    Use the existing `refresh` closure already defined in the component (it calls `onChange()` and dispatches
    `complete-guided-round` when `view.complete`).

11. **`src/features/tutorial/guidedRound.test.ts` — teach the walker about the new pause.**
    Change the `runToNextChoice` helper's loop to release opponent turns as well as acknowledgements:

    ```ts
    while ((view.awaiting === "acknowledge" || view.awaiting === "opponent-play") && guard++ < 40) {
      if (view.awaiting === "acknowledge") { round.acknowledge() } else { round.letOpponentPlay() }
      view = round.view()
    }
    ```

    The guard rises from 20 to 40. Change nothing else about the helper or any existing assertion.

12. **`src/features/tutorial/guidedRound.test.ts` — add pacing and retention coverage.**
    In the shared `describe.each` block add:
    - `"waits for letOpponentPlay before the opponent replies"` — construct the round, discard the first two
      card ids, walk with `runToNextChoice` to `awaiting: "play-card"`, snapshot
      `const before = round.view()`, submit the first legal play, then assert **without** calling
      `runToNextChoice` that `round.view().awaiting` is `"opponent-play"` and that
      `round.view().playingSequence.length === before.playingSequence.length + 1` (the learner's card landed,
      the opponent's did not). Then call `round.letOpponentPlay()` once and assert the sequence grew by
      exactly one more card, or that `awaiting` is no longer `"opponent-play"`.
    - `"letOpponentPlay is a no-op unless the round is waiting for it"` — on a fresh round (which is
      `awaiting: "acknowledge"`), assert `round.letOpponentPlay()` leaves `round.view()` deep-equal to the
      view captured before the call.

    In the `describe("first-round …")` block add
    `"retains the finished trick with a reason instead of clearing it silently"` — drive `first-round` with
    discard `["5S", "6C"]` and plays `7H, JD, QH, 2S` (walking with `runToNextChoice` between plays) and
    assert that at some point `round.view().lastTrick.length` is greater than `0`,
    `round.view().lastTrickOwners.length === round.view().lastTrick.length`, and
    `round.view().lastTrickReason` matches `/resets to 0/`.

13. **`src/components/tutorial/GuidedRoundView.test.tsx` — update the fixture and add coverage.**
    - Add `lastTrick: []`, `lastTrickOwners: []` and `lastTrickReason: ""` to the object returned by
      `baseView`.
    - Add `letOpponentPlay: vi.fn()` to the object returned by `fakeRound()`.
    - Add a test named `"offers Let them play while the opponent is to act, and nothing else advances"`:
      build a view with `awaiting: "opponent-play"`, render, assert
      `screen.getByRole("button", { name: /let the opponent play their card/i })` exists, assert
      `screen.queryByRole("button", { name: /^play this card$/i })` is `null`, click the button and assert
      `round.letOpponentPlay` was called and `onChange` was called.
    - Add a test named `"keeps the finished trick on screen with its reason"`: build a view with
      `phase: "pegging"`, `awaiting: "opponent-play"`, `playingSequence: []`,
      `lastTrick: [{ suit: "hearts", rank: 7 }, { suit: "clubs", rank: 10 }]`,
      `lastTrickOwners: ["you", "opponent"]`,
      `lastTrickReason: "That made 31 — 2 points. The count resets to 0."`; assert the reason text is
      present, that a `role="list"` named `/previous trick/i` exists, and that
      `screen.getByText(/nothing played yet/i)` is present for the new empty trick.

### Do NOT

- Do not reuse `this.pending`, `this.resumePending` or `acknowledge()` for opponent pacing; the show
  interception depends on those and will skip a pause if they are shared.
- Do not add a timer, `setTimeout`, or an auto-play toggle (decision D1).
- Do not change `GuidedRound.submitPlay`, `submitDiscard`, `acknowledge` or `completeCount` signatures.
- Do not change the type of `playingSequence`.
- Do not modify `src/app/game.ts`; the 31-versus-go distinction is read from the count, not re-implemented.
- Do not touch `src/components/tutorial/PeggingExercise.tsx` or `HandScoringExercise.tsx` in this phase.
- Do not change the coached round's counting behaviour; the count pause is still a dead end until Phase 5,
  and that is expected at the end of this phase.

### Definition of done

- [ ] `npx vitest run` passes with zero failures, including `src/features/tutorial/catalog.test.ts`'s
      `"completes both guided-round scripts"` (which now goes through `letOpponentPlay`).
- [ ] `npm run lint` reports zero problems.
- [ ] `npm run build` succeeds.
- [ ] `rg -n "opponent-play" src/` matches `guidedRound.ts`, `completeRound.ts`, `GuidedRoundView.tsx`,
      `guidedRound.test.ts` and `GuidedRoundView.test.tsx`, and nothing else.
- [ ] `rg -n "setTimeout|setInterval|requestAnimationFrame" src/features/tutorial/ src/components/tutorial/`
      returns no matches.
- [ ] `src/features/tutorial/guidedRound.test.ts` contains
      `"waits for letOpponentPlay before the opponent replies"`,
      `"letOpponentPlay is a no-op unless the round is waiting for it"` and
      `"retains the finished trick with a reason instead of clearing it silently"`.
- [ ] `src/components/tutorial/GuidedRoundView.test.tsx` contains
      `"offers Let them play while the opponent is to act, and nothing else advances"` and
      `"keeps the finished trick on screen with its reason"`.
- [ ] Manual: `npm start`, `http://localhost:3000/learn/coached-round`, `Next`, `Confirm two discards` with
      any two cards, `Continue` past the starter. Choose a card and press `Play this card`. **Only your card
      appears** and the primary button now reads `Let them play`. Press it once: exactly one opponent card
      appears and the count updates. Repeat to the end of the pegging phase; at the trick that ends, the
      finished cards stay on screen dimmed above the new row, with a sentence ending
      `The count resets to 0.`

### Rollback note

Revert `src/features/tutorial/guidedRound.ts`, `src/features/tutorial/completeRound.ts`,
`src/components/tutorial/GuidedRoundView.tsx`, `src/features/tutorial/guidedRound.test.ts` and
`src/components/tutorial/GuidedRoundView.test.tsx`. Phase 3's components and CSS stay and remain correct.

---

## Phase 5 — Coached round: make the counting pause submittable

**Implements RM-2** (traces to OBS-1; required for U1e and R3). **Requires Phase 4 complete.**

### Goal

Make the coached round's counting pause behave like a `score-practice` step so both coached rounds can be
finished, and add an unconditional `Show me the count` escape so the learner can never be trapped there
again.

### Context

`src/components/tutorial/GuidedRoundView.tsx` renders a `HandScoringExercise` for the
`view.awaiting === "count-hand"` pause. It builds a synthetic `ScoreScenario` from `view.countTask`
(`id: "guided-count"`, `concepts: ["fifteens"]`, the four cards as a tuple, the starter, `isCrib`, the
coach text as `prompt`, and three generic hints) and passes it the runner's `state.step` — which belongs to
a `guided-round` step.

`HandScoringExercise`'s `Count selected cards` button dispatches `{ type: "submit" }`, and
`src/features/tutorial/tutorialReducer.ts`'s `submit` switch contains
`case "explain": case "round-map": case "recap": case "guided-round": return state`. Verified with a reducer
probe: on the `coach-first` step, after a `toggle-card`, `reducer(state, { type: "submit" })` returns the
**identical object** — `status` stays `"in-progress"`, `found` stays `[]`, `earned` stays `0`.
`GuidedRoundView` only renders its `Continue` button when `step.status === "complete"`, and that status is
set only by `complete-guided-round` (which fires when the whole round is already over). So the round
dead-ends permanently at the first show pause, and the learner's only escapes are `Restart this round` or
`Skip this step`.

Decision **D9** applies, restated in full: this is solved **in the reducer**. Two new actions carry the
dynamic scenario as plain data, so the reducer stays pure and reuses `gradeScoreSelection`:
`{ type: "submit-count"; scenario: ScoreScenario }` and `{ type: "reveal-count"; scenario: ScoreScenario }`.
The `key={roundView}` remount in `src/screens/Lesson.tsx` is **left in place**; it destroys only
`GuidedRoundView`'s local `useState` (`discardIds`, `playId`), never reducer state.

Critically, neither new action may set `step.status` to `"complete"`. `TutorialShell`'s footer `Next` is
enabled whenever `state.step.status !== "in-progress"`, so completing a mid-round count must not unlock
`Next` and let the learner leave the round marked complete. The round's completion signal stays
`complete-guided-round`, dispatched from `GuidedRoundView`'s `refresh` closure when `view.complete`.

Phase 1 added the reducer action `{ type: "restart-count" }`, which clears `selected`, `found`, `earned`,
`revealed` and `feedback` and sets `status: "in-progress"` while preserving `attempts` and `hintLevel`. A
guided round has more than one counting pause (the learner's hand, and their crib when they deal), so that
action is what clears the count between pauses.

Per the original specification, the learner counts **their own** hand and their own crib. The opponent's hand
and a crib that is not theirs are demonstrated through `acknowledge` pauses, which
`src/features/tutorial/guidedRound.ts` (`interceptShow` / `pauseAck`) already implements correctly and which
must not change.

### Steps

1. **`src/features/tutorial/tutorialReducer.ts` — declare the two actions.**
   Add `ScoreScenario` to the existing type-only import from `./tutorialTypes`. Add to the exported
   `RunnerAction` union:

   ```ts
   | { type: "submit-count"; scenario: ScoreScenario }
   | { type: "reveal-count"; scenario: ScoreScenario }
   ```

2. **`src/features/tutorial/tutorialReducer.ts` — implement `submit-count`.**
   Add `case "submit-count":` to the outer `switch (action.type)`. It returns `state` unchanged unless
   `step.kind === "guided-round"`. Otherwise it calls
   `gradeScoreSelection(action.scenario, state.step.selected, state.step.found)` (already imported) and:
   - when `grade.credited` is `false`, returns
     `{ ...state, step: { ...state.step, attempts: state.step.attempts + 1, selected: [],
     feedback: { tone: "retry", text: grade.message } } }`;
   - when `grade.credited` is `true`, returns `{ ...state, step: { ...state.step,
     found: [...state.step.found, ...grade.matched.map((g) => g.id)],
     earned: state.step.earned + grade.matched.reduce((s, g) => s + g.points, 0),
     selected: [], feedback: { tone: "good", text: grade.message } } }`.

   It must **never** set `status`, and must never call `advance` or `finishOrAdvanceCheckpoint`.

3. **`src/features/tutorial/tutorialReducer.ts` — implement `reveal-count`.**
   Add `case "reveal-count":`. It returns `state` unchanged unless `step.kind === "guided-round"`. Otherwise
   it calls `gradeScoreSelection(action.scenario, [], [])` to obtain `grade.required`, then returns
   `{ ...state, step: { ...state.step, selected: [], found: grade.required.map((g) => g.id),
   earned: grade.required.reduce((s, g) => s + g.points, 0), revealed: grade.required.length,
   hintLevel: 3, feedback: { tone: "neutral", text: "Here is the whole count." } } }`.
   Setting `hintLevel: 3` is what records this route as assisted rather than independent
   (`src/app/persistence.ts` `recordConceptAttempt` treats `hintLevel < 2` as unaided). It must never set
   `status`.

4. **`src/components/tutorial/HandScoringExercise.tsx` — let the host choose the submit action.**
   Add an optional prop to `HandScoringExerciseProps`: `submitAs?: "submit" | "submit-count"`, defaulting to
   `"submit"`. In the practice branch, the `Count selected cards` button's `onClick` dispatches
   `{ type: "submit-count", scenario }` when `submitAs === "submit-count"`, and `{ type: "submit" }`
   otherwise. Change nothing else in the component: `Clear`, `Start this count again`, the starter, the
   credited counting and the `GroupList` all stay as Phase 1 left them.

5. **`src/components/tutorial/GuidedRoundView.tsx` — compute the count's required groups.**
   Import `scoreHandDetailed` from `../../app/game` and `specsToCards` from
   `../../features/tutorial/tutorialCards`. Next to the existing `countScenario` construction, add:

   ```ts
   const countRequired = countScenario
     ? scoreHandDetailed(
         specsToCards(countScenario.hand),
         countScenario.starter ? specToCard(countScenario.starter) : undefined,
         countScenario.isCrib,
       ).groups
     : []
   const countComplete = countRequired.length > 0
     && countRequired.every((g) => step.found.includes(g.id))
   ```

   `specToCard` is already imported in this file. The synthetic `countScenario` has no `require` field, so
   every group is required.

6. **`src/components/tutorial/GuidedRoundView.tsx` — rewire the count block.**
   In the `view.awaiting === "count-hand" && countScenario` branch:
   - pass `submitAs="submit-count"` to `HandScoringExercise`;
   - add a button that is **always** rendered in this branch, `type="button"`,
     `className="btn btn-outline-light"`, label exactly `Show me the count`, dispatching
     `{ type: "reveal-count", scenario: countScenario }`;
   - replace the `step.status === "complete"` gate on the `Continue` button with `countComplete`, and change
     its `onClick` to `() => { round.completeCount(); dispatch({ type: "restart-count" }); refresh() }`.

   Order the three controls: the exercise (which contains `Count selected cards`, `Clear` and
   `Start this count again`), then `Show me the count`, then `Continue` when it is available.

7. **`src/components/tutorial/GuidedRoundView.test.tsx` — replace the Continue-gate test.**
   Delete the test named
   `"shows Continue for count-hand only once the count step is complete, and it completes the count"` and
   replace it with `"shows Continue only once every group in the count has been found"`. Keep its existing
   `countTask` fixture (hand `5♥ 6♣ 7♦ 8♠`, `starter: null`, `isCrib: false`). Compute the required group ids
   inside the test with `scoreHandDetailed` over those four cards (do not hard-code the ids), assert no
   `Continue` button with `found: []`, then rerender with `step={{ ...emptyStep, found: <those ids> }}` and
   assert `Continue` appears, click it, and assert `round.completeCount` was called and `onChange` was
   called.

8. **`src/components/tutorial/GuidedRoundView.test.tsx` — cover the escape hatch.**
   Add a test named `"Show me the count reveals the whole count and then offers Continue"`. Build a live host
   inside the test file: a component that creates
   `const lesson: Lesson = { id: "t", title: "t", estimatedMinutes: 1, concepts: ["fifteens"], steps: [{ kind: "guided-round", id: "step", scriptId: "first-round" }] }`,
   drives it with `useReducer(makeTutorialReducer(lesson), initialRunnerState(lesson))`, and renders
   `<GuidedRoundView round={fakeRound()} view={<the count view>} step={state.step} dispatch={dispatch} onChange={vi.fn()} />`.
   Click `Show me the count`, then assert a `Continue` button is present without any correct submission
   having been made.

9. **`src/components/tutorial/GuidedRoundView.test.tsx` — add the end-to-end round test.**
   Add a `describe("GuidedRoundView end to end")` block with a helper host component:

   ```tsx
   function RoundHost({ scriptId, roundRef, onComplete }: {
     scriptId: string
     roundRef: { current: GuidedRound | null }
     onComplete: () => void
   })
   ```

   It builds a one-step guided-round lesson for `scriptId`, drives it with the real
   `makeTutorialReducer` / `initialRunnerState`, creates `new GuidedRound(ROUND_SCRIPTS[scriptId])` into
   `roundRef.current` on first render, keeps a `roundView` counter in `useState`, and renders
   `<p data-testid="awaiting">{roundRef.current.view().awaiting}</p>` plus
   `<GuidedRoundView key={roundView} round={roundRef.current} view={roundRef.current.view()} step={state.step} dispatch={spyDispatch} onChange={() => setRoundView((n) => n + 1)} />`,
   where `spyDispatch` calls `onComplete()` when the action type is `"complete-guided-round"` and then
   forwards to `dispatch`.

   Then add `it.each(["first-round", "second-round"])("completes %s from deal to done", …)` which loops up to
   200 times, each iteration reading `roundRef.current.view()` and acting:
   - `awaiting === "done"` → break;
   - `awaiting === "acknowledge"` → click the `Continue` button;
   - `awaiting === "opponent-play"` → click `Let them play`;
   - `awaiting === "discard"` → click the first two card buttons in the `Choose two cards for the crib`
     fieldset, then `Confirm two discards`;
   - `awaiting === "play-card"` → click the first enabled `role="radio"` card, then `Play this card`;
   - `awaiting === "count-hand"` → read `view.countTask`, compute its required groups with
     `scoreHandDetailed`, and for each group not yet in `step.found`, click each of its cards by
     accessible-name regex (build the `cardKey → cardName` map from `countTask.hand` plus `countTask.starter`
     using `new Card(...)` and `cardName`) then click `Count selected cards`; finally click `Continue`.

   Assert after the loop that `roundRef.current.view().awaiting` is `"done"`, that
   `roundRef.current.view().complete` is `true`, and that the `complete-guided-round` counter is exactly `1`.

### Do NOT

- Do not let `submit-count` or `reveal-count` set `step.status`, call `advance`, or call
  `finishOrAdvanceCheckpoint`.
- Do not remove `case "guided-round": return state` from the `submit` switch, and do not remove
  `assertNeverStepKind`.
- Do not remove the `key={roundView}` prop from `src/screens/Lesson.tsx`.
- Do not give `GuidedRoundView` its own `useReducer`.
- Do not change `GuidedRound`'s `acknowledge` / `pauseAck` behaviour: the opponent's hand and a crib that is
  not the learner's stay demonstrated, not counted.
- Do not change `gradeScoreSelection`, `requiredGroups` or anything else in
  `src/features/tutorial/tutorialGrading.ts`.
- Do not modify `src/features/tutorial/guidedRound.ts` in this phase.
- Do not touch `src/components/tutorial/PeggingExercise.tsx`.

### Definition of done

- [ ] `npx vitest run` passes with zero failures.
- [ ] `npm run lint` reports zero problems.
- [ ] `npm run build` succeeds.
- [ ] `src/components/tutorial/GuidedRoundView.test.tsx` contains
      `"shows Continue only once every group in the count has been found"`,
      `"Show me the count reveals the whole count and then offers Continue"`, and a
      `describe("GuidedRoundView end to end")` whose `it.each` completes both `first-round` and
      `second-round` and asserts `complete-guided-round` was dispatched exactly once.
- [ ] `rg -n "step.status === \"complete\"" src/components/tutorial/GuidedRoundView.tsx` returns no matches.
- [ ] Manual: `npm start`, `http://localhost:3000/learn/coached-round`. Complete the round with no use of
      `Skip this step` and no use of `Restart this round`: discard two cards, peg out the hand (pressing
      `Let them play` for each opponent card), then at the show count your own hand by selecting each
      combination and pressing `Count selected cards`. When the last group is credited a `Continue` button
      appears; press it. Continue through the opponent's hand and the crib until the coach reads
      **"The training deal is finished."**
- [ ] Manual: `http://localhost:3000/learn/coached-round-dealer`, same, and confirm there are **two** count
      pauses (your hand, then your crib) and that both complete.
- [ ] Manual: on either coached round, at a count pause press `Show me the count` without selecting anything.
      The full breakdown appears under `Counted so far` and `Continue` becomes available.

### Rollback note

Revert `src/features/tutorial/tutorialReducer.ts`, `src/components/tutorial/HandScoringExercise.tsx`,
`src/components/tutorial/GuidedRoundView.tsx` and `src/components/tutorial/GuidedRoundView.test.tsx`.
Phases 1–4 remain intact and the round returns to dead-ending at the first count.

---

## Phase 6 — Pegging exercise: horizontal row, learner-paced opponent, explicit scores, and a board

**Implements RM-4** (traces to U4a, U4b, U4c, U4d; keeps R5, R6). **Requires Phase 5 complete.**

### Goal

Lay the pegging exercise's cards in one horizontal row, advance the opponent by exactly one action per
`Let them play` press, announce every score explicitly, and show both pegs moving on a cribbage board.

### Context

`src/components/tutorial/PeggingExercise.tsx` has two branches. The inner `PlaySequenceExercise` component
handles `scenario.task.kind === "play-sequence"`; the outer `PeggingExercise` handles `"select-legal"` and
`"select-scoring"`. **Both** wrap every laid card in its own `<fieldset className="selectable-hand">` (a
`SelectableHand` with `mode="none"`) inside a `<div className="seq">`. There is **no `.seq` rule anywhere in
`src/App.css`** — confirmed by search — so the block-level fieldsets stack vertically. That is defect U4a.

`src/features/tutorial/tutorialGrading.ts` contains the play-sequence turn engine. `playLearnerCard` ends with
`return { state: resolveOpponentTurns(afterPlay(state, "learner", card, result)), ok: true }`, and
`resolveOpponentTurns` loops `opponentStep` until it is the learner's turn again or the exchange is done.
`learnerGo` does the same. `PlaySequenceExercise` applies the whole resolved state in one `setState`, so the
learner's card, every opponent reply, every score, any go and any count reset all appear simultaneously.
That is defects U4b and U4d.

Scores appear only as rows in a `<ul className="roundlog">`, which `src/App.css` caps at
`max-height: 180px; overflow: auto`. `PeggingExercise.tsx` imports neither `CribbageBoard` nor `Peg`. That is
defect U4c.

Available from earlier phases:
- `src/components/tutorial/TrickRow.tsx` — props
  `{ cards: ReadonlyArray<{ card: PCard; by: "you" | "opponent" }>; count: number; label?: string;
  previous?: { cards: ReadonlyArray<…>; reason: string } }`. It renders one `<ul className="peg-sequence">`
  with a `.count-chip`, attributes each card in text, animates only the last card of the main row, and
  contains no `<fieldset>`.
- `src/components/tutorial/TutorialBoard.tsx` — props
  `{ playerPegPoints: ReadonlyArray<number>; opponentPegPoints: ReadonlyArray<number>; playerScore: number;
  opponentScore: number }`. It renders `CribbageBoard` in a scaled, clipped, `position: relative` frame plus a
  `You N · Them M` line.

Decision **D1** applies, restated in full: **no timers.** The specification's optional
`Play at normal speed` auto-pace toggle is **not** implemented. There is no `setTimeout`, no
`setInterval`, no `requestAnimationFrame`, and no `matchMedia` call in this phase. The only motion is the
existing card-entry animation `.selectable-card.is-played` in `src/App.css`, which is already guarded by
`@media (prefers-reduced-motion: no-preference)` and which `TrickRow` applies to the newest card.

Accessibility constraint: exactly one `role="status"` / `aria-live` region per screen, and it is the coach's
status box in `src/components/tutorial/CoachPanel.tsx`. The score callout must therefore be a **plain,
non-live** element, and its announcement must be routed to the coach through the reducer. Note that
`PeggingExercise.tsx` currently renders `<p className="status retry" role="status">{error}</p>` for its local
error — that is a pre-existing second live region and this phase removes its `role="status"` attribute.

Peg bookkeeping follows the three-slot shift used everywhere else in this codebase
(`src/features/tutorial/guidedRound.ts` `applyScore`, and `src/app/gamePlayer.ts`):
`pga[2] = pga[1]; pga[1] = pga[0]; pga[0] += score`.

Frozen number: the `peg-go` scenario's total must stay **10**. `state.earned` in this engine sums the points
of *both* sides' events (`afterPlay` adds `result.total` regardless of who played), which is a pre-existing
quirk that must not change: 2 (learner's fifteen) + 3 (opponent's run of three) + 4 (learner's run of four)
+ 1 (last card) = 10. Per-side peg totals for the same exchange are learner **7** and opponent **3**.

### Steps

1. **`src/features/tutorial/tutorialGrading.ts` — extend `PegSequenceState`.**
   Add four fields to the exported `PegSequenceState` type:
   - `activeOwners: ReadonlyArray<PegSequenceParty>` — one entry per card in `active`, same order;
   - `pegPoints: { learner: number[]; opponent: number[] }`;
   - `lastActive: ReadonlyArray<Card>` and `lastActiveOwners: ReadonlyArray<PegSequenceParty>` — the trick
     that most recently ended;
   - `lastTrickReason: string`.

2. **`src/features/tutorial/tutorialGrading.ts` — initialise them.**
   In `initPegSequence`, set `activeOwners: active.map(() => "opponent" as PegSequenceParty)` — the
   scenario's pre-played `sequence` was laid before the learner's turn, so it is attributed to the opponent —
   plus `pegPoints: { learner: [0, -1, -1], opponent: [0, -1, -1] }`, `lastActive: []`,
   `lastActiveOwners: []` and `lastTrickReason: ""`.

3. **`src/features/tutorial/tutorialGrading.ts` — maintain them in `afterPlay`.**
   In `afterPlay(state, by, card, result)`, additionally return
   `activeOwners: [...state.activeOwners, by]` and, when `result.total > 0`, a `pegPoints` object in which the
   `by` side's array has had the three-slot shift applied
   (`next[2] = prev[1]; next[1] = prev[0]; next[0] = prev[0] + result.total`) and the other side's array is
   copied unchanged. When `result.total === 0`, copy both arrays unchanged. Never mutate the incoming arrays.

4. **`src/features/tutorial/tutorialGrading.ts` — maintain them in `afterGo`.**
   In the `consecutiveGoes < 2` early-return branch, carry `activeOwners`, `pegPoints`, `lastActive`,
   `lastActiveOwners` and `lastTrickReason` through unchanged. In the reset branch (both sides have said go):
   - set `lastActive: [...state.active]` and `lastActiveOwners: [...state.activeOwners]`;
   - set `lastTrickReason` to `resetEvent.message` (the string the function already builds);
   - set `activeOwners: []` alongside the existing `active: []`;
   - apply the three-slot shift for `bonus` to `state.lastPlayedBy`'s side of `pegPoints` when `bonus > 0`,
     copying both arrays otherwise.

5. **`src/features/tutorial/tutorialGrading.ts` — split the turn engine.**
   - Change `playLearnerCard`'s success return to
     `return { state: afterPlay(state, "learner", card, result), ok: true }`. Update its doc comment: it now
     plays only the learner's card and hands the turn over.
   - Change `learnerGo` to `return afterGo(state, "learner")` (keeping its existing
     `if (state.done || state.turn !== "learner") { return state }` guard).
   - Rename the private `opponentStep` to an exported
     `export function opponentTurn(state: PegSequenceState): PegSequenceState`, and add a guard at the top:
     `if (state.done || state.turn !== "opponent") { return state }`. Its body is otherwise unchanged — it
     plays the next scripted card, or says go when the script is exhausted, or skips an illegal scripted card
     and says go, exactly as today.
   - **Delete `resolveOpponentTurns` entirely.** There must be no second code path that resolves a chain.

6. **`src/components/tutorial/PeggingExercise.tsx` — the play-sequence trick row and board.**
   In `PlaySequenceExercise`:
   - import `{ TrickRow }` from `./TrickRow`, `{ TutorialBoard }` from `./TutorialBoard`, and
     `opponentTurn` from `../../features/tutorial/tutorialGrading`;
   - delete the `<div className="seq">` block and the per-card `SelectableHand` inside it;
   - add a helper in the module that maps a `PegSequenceParty` to `TrickRow`'s owner type:
     `"learner" → "you"`, `"opponent" → "opponent"`;
   - render, in place of the old `.peg-strip` block:

     ```tsx
     <TrickRow
       cards={state.active.map((card, index) => ({
         card: { suit: card.suit, rank: card.rank },
         by: ownerOf(state.activeOwners[index]),
       }))}
       count={state.count}
       label="On the table"
       previous={state.lastActive.length > 0 ? {
         cards: state.lastActive.map((card, index) => ({
           card: { suit: card.suit, rank: card.rank },
           by: ownerOf(state.lastActiveOwners[index]),
         })),
         reason: state.lastTrickReason,
       } : undefined}
     />
     ```

   - render `<TutorialBoard playerPegPoints={state.pegPoints.learner} opponentPegPoints={state.pegPoints.opponent} playerScore={state.pegPoints.learner[0]} opponentScore={state.pegPoints.opponent[0]} />`
     immediately after the trick row.

7. **`src/components/tutorial/PeggingExercise.tsx` — the `Let them play` control.**
   Replace the single `Play this card` / `Say go` button row with a three-way choice, in this precedence:
   - when `state.turn === "opponent" && !state.done`: render one primary button,
     `type="button"`, `className="btn btn-warning"`, `aria-label="Let the opponent play their card"`, label
     exactly `Let them play`, whose `onClick` computes `const next = opponentTurn(state)`, calls
     `setSelectedId(null)`, `setError(null)`, `setState(next)` and then announces any score (step 9);
   - else when `mustGo`: the existing `Say go` button, whose `onClick` now computes
     `const next = learnerGo(state)` and announces any score;
   - else: the existing `Play this card` button, unchanged except that it announces any score after
     `setState(result.state)`.

   The learner's hand `SelectableHand` keeps its existing behaviour, including disabling every card while
   `state.turn !== "learner"`.

8. **`src/features/tutorial/tutorialReducer.ts` — add the coach announcement action.**
   Add `| { type: "peg-note"; tone: "good" | "neutral"; text: string }` to `RunnerAction`, and a
   `case "peg-note":` that returns `state` unchanged unless `step.kind === "peg-practice"` or
   `step.kind === "checkpoint"`, and otherwise returns
   `{ ...state, step: { ...state.step, feedback: { tone: action.tone, text: action.text } } }`. It must change
   nothing else — not `attempts`, not `status`, not `found`, not `earned`.

9. **`src/components/tutorial/PeggingExercise.tsx` — the score callout and its announcement.**
   Add a module-level helper that, given the previous and next `PegSequenceState`, returns the newly appended
   event with `points > 0`, or `null`: compare `next.events.length` against `prev.events.length` and scan only
   the new tail. Then:
   - in each of the three click handlers, after computing the next state, call that helper and, when it
     returns an event, dispatch
     `{ type: "peg-note", tone: "good", text: <callout text> }` where the callout text is
     `` `${event.message} — ${event.points} ${event.points === 1 ? "point" : "points"} to ${event.by === "learner" ? "you" : "them"}.` ``
     (`event.message` is already `describePegOutcome`'s string, which names the `explainPegPlay` labels);
   - render the callout visibly from state: derive `const callout` from the last event in `state.events` with
     `points > 0` and, when present, render
     `<p className="peg-callout">{`${callout.message} — ${callout.points} ${callout.points === 1 ? "point" : "points"} to ${callout.by === "learner" ? "you" : "them"}.`}</p>`
     immediately below the board. It stays visible until a later scoring event replaces it.
   - remove `role="status"` from the local error paragraph, leaving
     `<p className="status retry">{error}</p>`, so the coach panel keeps the only live region.

10. **`src/components/tutorial/PeggingExercise.tsx` — the select-legal / select-scoring trick row.**
    In the outer `PeggingExercise` function, delete its `<div className="seq">` block and the per-card
    `SelectableHand`, and replace the whole `<div className="peg-strip">` with

    ```tsx
    <TrickRow
      cards={sequence.map((card) => ({ card: { suit: card.suit, rank: card.rank }, by: "opponent" }))}
      count={count}
      label="On the table"
    />
    ```

    (The pre-played `scenario.sequence` is attributed to the opponent, matching step 2.) Leave the rest of
    that branch — the hand, the `Check these cards` / `Play this card` button and the per-card legality
    `<p className="meta">` lines — unchanged.

11. **`src/App.css` — add the callout style.** Add after the `.peg-trick-reason` rule from Phase 3:

    ```css
    .peg-callout {
      border: 2px solid #f7e7b0;
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      margin: 0.6rem 0;
      color: #f7e7b0;
      font-weight: 700;
    }
    ```

    Do not add a `.seq` rule — the class is gone.

12. **`src/features/tutorial/tutorialGrading.test.ts` — step the opponent explicitly.**
    - Add `opponentTurn` to the import list from `./tutorialGrading`.
    - Rewrite the test
      `"plays the peg-go scripted exchange through fifteen, a growing run, and a go that resets and scores the last card (T7)"`
      to interleave explicit opponent turns, asserting after each call:
      `initPegSequence` → `count` 8, `turn` `"learner"`, legal ids `["7C", "9S"]`;
      `playLearnerCard(scenario, state, "7C")` → `count` 15, `turn` `"opponent"`, `events` points `[2]`;
      `opponentTurn(state)` → `count` 21, `turn` `"learner"`, `events` points `[2, 3]`;
      `playLearnerCard(scenario, state, "9S")` → `count` 30, `turn` `"opponent"`, `events` points
      `[2, 3, 4]`;
      `opponentTurn(state)` → `turn` `"learner"`, `done` `false`, `learnerLegalCardIds` length 0;
      `learnerGo(state)` → `done` `true`, `count` 0, `active` length 0, `events` points
      `[2, 3, 4, 0, 0, 1]`, `earned` **10**.
    - Add assertions to the same test that `state.pegPoints.learner[0]` is `7` and
      `state.pegPoints.opponent[0]` is `3` at the end, and that `state.lastActive.length` is `4` with
      `state.lastTrickReason` matching `/resets to 0/`.
    - Rewrite `"lets the learner explicitly say go when they hold no legal card"` to use the same explicit
      `opponentTurn` interleaving, and keep its final assertion that `learnerGo(state)` on a finished state
      is a no-op.
    - Add a test named `"opponentTurn is a no-op when it is not the opponent's turn"` asserting
      `opponentTurn(initPegSequence(scenario))` deep-equals its input.
    - Keep the existing `expect(gradingSource).not.toMatch(/rankPlays/)` assertion untouched.

13. **`src/components/tutorial/PeggingExercise.test.tsx` — rewrite the play-sequence test and add coverage.**
    Replace the test
    `"play-sequence: alternates with the opponentScript, narrates go, and reports completion once (T7)"`
    with `"play-sequence: the opponent only moves when the learner lets them, and the total is unchanged"`,
    which for `PEG_SCENARIOS["peg-go"]`:
    - asserts `screen.getByText("Count: 8")`;
    - selects the seven of clubs and clicks `Play this card`;
    - asserts `screen.getByText("Count: 15")`, asserts the six of diamonds is **not** in the trick row
      (`expect(screen.queryByText(/six of diamonds, played by them/i)).toBeNull()`), and asserts the primary
      button is now `Let them play`;
    - clicks `Let them play` once and asserts `screen.getByText("Count: 21")` and that the six of diamonds is
      now attributed to `them`;
    - selects the nine of spades, clicks `Play this card`, asserts `Count: 30`;
    - clicks `Let them play`, then clicks `Say go`;
    - asserts `dispatch` was called with `{ type: "complete-peg-sequence", earned: 10 }` exactly once.

    Add these tests:
    - `"lays the cards in one horizontal row with no nested fieldset"` — render the `peg-legal` scenario and
      assert `screen.getByRole("list", { name: /cards on the table/i })` has three `listitem` children and
      that the trick row contains no `<fieldset>`.
    - `"announces a scoring play with the engine's label and the points"` — after the seven of clubs is
      played in `peg-go`, assert an element with class `peg-callout` is in the document whose text contains
      `15` and `2 points to you`, and assert `dispatch` was called with an action whose `type` is
      `"peg-note"` and whose `text` contains `2 points to you`.
    - `"moves the learner's peg on the board after a scoring play"` — assert
      `screen.getByAltText(/cribbage board with 3 tracks/i)` is present before the first play and that the
      `You N · Them M` line reads `You 0 · Them 0` initially and `You 2 · Them 0` after the seven of clubs
      scores.

### Do NOT

- Do not add any timer, auto-pace toggle, `matchMedia` call, or `Play at normal speed` control (decision D1).
- Do not keep or re-add `resolveOpponentTurns`, and do not export it "for tests".
- Do not change the `peg-go` earned total of `10`, and do not change how `state.earned` accumulates.
- Do not change `explainPegPlay`, `gradePegChoice`, `learnerLegalCardIds`, `describePegOutcome`, or the
  go / count-reset / last-card rules.
- Do not add a `.seq` CSS rule; remove the class usage instead.
- Do not add a second `role="status"` or `aria-live` region; remove the one on the local error paragraph.
- Do not modify `src/components/CribbageBoard.tsx`, `src/components/tutorial/TrickRow.tsx` or
  `src/components/tutorial/TutorialBoard.tsx`.
- Do not modify `src/features/tutorial/guidedRound.ts` or `GuidedRoundView.tsx` in this phase.
- Do not change any scenario in `src/features/tutorial/scenarios.ts`.

### Definition of done

- [ ] `npx vitest run` passes with zero failures.
- [ ] `npm run lint` reports zero problems.
- [ ] `npm run build` succeeds.
- [ ] `rg -n "resolveOpponentTurns" src/` returns no matches.
- [ ] `rg -n "className=\"seq\"|className='seq'" src/` returns no matches.
- [ ] `rg -n "setTimeout|setInterval|requestAnimationFrame|matchMedia" src/features/tutorial/ src/components/tutorial/`
      returns no matches.
- [ ] `rg -n "role=\"status\"" src/components/tutorial/` matches only `CoachPanel.tsx`.
- [ ] `src/features/tutorial/tutorialGrading.test.ts` contains
      `"opponentTurn is a no-op when it is not the opponent's turn"` and its rewritten `peg-go` test asserts
      `earned` is `10`, `pegPoints.learner[0]` is `7` and `pegPoints.opponent[0]` is `3`.
- [ ] `src/components/tutorial/PeggingExercise.test.tsx` contains
      `"play-sequence: the opponent only moves when the learner lets them, and the total is unchanged"`,
      `"lays the cards in one horizontal row with no nested fieldset"`,
      `"announces a scoring play with the engine's label and the points"` and
      `"moves the learner's peg on the board after a scoring play"`.
- [ ] Manual: `npm start`, `http://localhost:3000/learn/peg-to-31`. Click `Next`, then `Skip this step`
      twice to reach the fourth step (the `peg-go` play-sequence). The `8♥` already on the table sits in a
      single horizontal row beside `Count: 8`, with `them` beneath it, and a small cribbage board reading
      `You 0 · Them 0` sits below.
- [ ] Manual, same screen: select `7♣`, press `Play this card`. The seven lands **alone** beside the eight,
      the count reads 15, a boxed callout reads `That scores 2. 15 for 2. The count is now 15. — 2 points to
      you.` (or the engine's equivalent label), the board line reads `You 2 · Them 0`, and the primary button
      now reads `Let them play`. Press it once: `6♦` lands, the count reads 21, and the callout names the run
      of three for the opponent. Play `9♠`, press `Let them play`, then press `Say go`; the finished trick
      stays on screen dimmed with a sentence ending `The count resets to 0.` and the exercise reports
      `Total from this sequence: 10.`

### Rollback note

Revert `src/features/tutorial/tutorialGrading.ts`, `src/components/tutorial/PeggingExercise.tsx`,
`src/features/tutorial/tutorialReducer.ts`, `src/App.css`,
`src/features/tutorial/tutorialGrading.test.ts` and `src/components/tutorial/PeggingExercise.test.tsx`.
Phases 1–5 are independent of this phase.

---

## Phase 7 — Engine: expose hand EV and crib EV on `DiscardOption`

**Implements RM-6 item 1.** **Requires Phase 6 complete.**

### Goal

Make the two halves of a discard's expected value readable by callers, so Phase 8 can show the learner two
numbers instead of one. Behaviour of the AI must not change at all.

### Context

`src/app/game.ts` declares:

```ts
export type DiscardOption = {
  keep: Array<Card>
  discard: Array<Card>
  score: number          // existing tScore: eScore ± cScore
}
```

`rankDiscards(hand, otherCardsSeen, isPlayerCrib)` iterates the 15 four-of-six `selections`, and for each
one computes `const eScore = calcExpectedHandScore(eH, cardsSeen, suitsSeen)` and
`const cScore = calcExpectedCribScore(cH, cardsSeen, suitsSeen, isPlayerCrib)`, then
`const tScore = isPlayerCrib ? eScore + cScore : eScore - cScore`, and pushes
`{ keep: eH, discard: cH, score: tScore }`. Both `eScore` and `cScore` are already computed on every
iteration and then thrown away. This phase only stops throwing them away.

`DiscardOption` values are constructed in exactly one place — that `options.push` call. Confirmed by search:
the only other references to the type are `import type { DiscardOption … }` in
`src/features/tutorial/tutorialGrading.ts` and `src/features/tutorial/tutorialCopy.ts`, and
`getBestHand`, which reads `rankDiscards(...)[0].keep`. Adding two required fields therefore cannot break
any other construction site.

Semantics to record in comments, because they are not obvious:
- `handScore` is `calcExpectedHandScore` for the four kept cards — it **already includes the average
  contribution of an unseen starter**, which is why its magnitude is around 12 for a strong keep and not
  around 7.
- `cribScore` is `calcExpectedCribScore` for the two thrown cards **evaluated for that crib's owner**: the
  `isPlayerCrib` flag changes the internal calculation, so the same two cards do not produce the same
  `cribScore` in both directions. It is always reported as a positive expectation; the sign that turns it
  into a gain or a loss lives in `score`.

Verified reference values for `DISCARD_SCENARIOS["discard-theirs"]` / `["discard-yours"]`
(hand `5♠ 5♦ 6♣ 7♥ J♦ Q♥`, obtained by running `rankDiscards`):

| Throw | `isPlayerCrib` | `handScore` | `cribScore` | `score` |
| --- | --- | --- | --- | --- |
| `J♦ Q♥` | `false` | 12.217 | 4.931 | 7.286 |
| `6♣ 7♥` | `false` | 12.674 | 5.418 | 7.256 |
| `6♣ 7♥` | `true` | 12.674 | 4.789 | 17.463 |
| `J♦ Q♥` | `true` | 12.217 | 4.077 | 16.294 |

These are for the plan reader's understanding. Per decision **D11**, restated: **no test and no user-facing
string may hard-code an expected-value magnitude.** Assertions must be relational.

### Steps

1. **`src/app/game.ts` — widen the type.** Add two required fields to `DiscardOption`:
   `handScore: number` and `cribScore: number`. Put a short comment on each recording the semantics above:
   that `handScore` already includes the average unseen-starter contribution, and that `cribScore` is
   evaluated for the crib's owner and is always a positive expectation whose sign lives in `score`.

2. **`src/app/game.ts` — populate them.** In `rankDiscards`, change the single `options.push(...)` call to
   `options.push({ keep: eH, discard: cH, score: tScore, handScore: eScore, cribScore: cScore })`.
   Change nothing else in the function: the `eH.sort((c1, c2) => c1.rank - c2.rank)` call, the existing
   `console.log`, the `options.sort((a, b) => b.score - a.score)` stable sort, and the comments about v0.2
   parity all stay exactly as they are.

3. **`src/app/game.test.ts` — add a consistency test.** Inside the existing
   `describe("T1 rankDiscards", …)` block, add
   `it("reports hand and crib expectation that reconstruct the ranked score", …)`. It iterates the existing
   module-level `T1_FIXTURES` array (already present in this file, 30 entries of
   `{ hand, isPlayerCrib, keep }`), calls `rankDiscards(hand, [], fixture.isPlayerCrib)`, and for every one
   of the 15 options asserts:
   - `Number.isFinite(opt.handScore)` and `Number.isFinite(opt.cribScore)` are `true`;
   - `opt.handScore` is greater than `0` and `opt.cribScore` is greater than `0`;
   - `opt.score` is within `1e-9` of `fixture.isPlayerCrib ? opt.handScore + opt.cribScore
     : opt.handScore - opt.cribScore` (use `expect(Math.abs(diff)).toBeLessThan(1e-9)`).

   Assert no specific magnitudes.

4. **`src/app/game.test.ts` — leave the parity test alone.** The existing test
   `"keeps the frozen Expert discard on a few dozen hands and is 15 descending"` is the AI-parity guard: it
   already asserts, for all 30 fixtures, that `ranked[0].keep` equals the frozen expected keep and that
   `score` is non-increasing across the 15 options. Do not modify it. It passing unchanged after step 2 is
   the proof that ordering and score values did not move.

### Do NOT

- Do not change `calcExpectedHandScore`, `calcExpectedCribScore`, `p1Costs`, `selections`, `getBestHand`,
  `rankPlays`, `playBestCard1`, or `scoreHand`.
- Do not change the `isPlayerCrib ? eScore + cScore : eScore - cScore` expression or the sort comparators.
- Do not remove or "clean up" the `console.log` in `rankDiscards`; other code in this repository logs the
  same way and removing it is out of scope.
- Do not make `handScore` or `cribScore` optional — every construction site sets them.
- Do not export `calcExpectedCribScore`.
- Do not touch `src/app/gamePlayer.ts`, `src/features/tutorial/`, or any component in this phase.
- Do not assert any expected-value magnitude in any test (decision D11).

### Definition of done

- [ ] `npx vitest run` passes with zero failures, including `src/app/gamePlayer.test.ts` and the unchanged
      `"keeps the frozen Expert discard on a few dozen hands and is 15 descending"` test.
- [ ] `npm run lint` reports zero problems.
- [ ] `npm run build` succeeds.
- [ ] `rg -n "handScore|cribScore" src/app/game.ts` shows the two new type fields and the single
      `options.push` site, and nothing else.
- [ ] `src/app/game.test.ts` contains
      `"reports hand and crib expectation that reconstruct the ranked score"`.
- [ ] `rg -n "12\.2|4\.9|7\.4|4\.1" src/app/game.test.ts` returns no matches (no hard-coded EV magnitudes).

### Rollback note

Revert `src/app/game.ts` and `src/app/game.test.ts`. Phases 1–6 do not read `handScore` or `cribScore`.

---

## Phase 8 — Discard lesson: three-axis coaching and the two-number disclosure

**Implements RM-6 items 2–6** (traces to U3, R4). **Requires Phase 7 complete.**

### Goal

Rewrite the discard lesson's coaching so it explains *why* one throw beats another along three axes — value
kept in hand, value given to or gained in the crib, and pegging quality — and make `Show the math` disclose
the hand number and the crib number separately instead of one opaque total.

### Context

Phase 7 added `handScore: number` and `cribScore: number` to `DiscardOption` in `src/app/game.ts`, populated
by `rankDiscards`. `handScore` is the expected score of the four kept cards and already includes the average
unseen-starter contribution. `cribScore` is the expected value of the two thrown cards in that crib,
evaluated for that crib's owner, always reported as a positive expectation. `score` is
`isPlayerCrib ? handScore + cribScore : handScore - cribScore`.

Current copy pipeline:
- `src/features/tutorial/tutorialCopy.ts` exports
  `describeDiscardComparison(chosen, best, isPlayerCrib): { plain: string; math: string }`. Its `math` is
  today the single line `` `Chosen keep expected value ${chosen.score.toFixed(2)}; best keep ${best.score.toFixed(2)}.` ``
  Its `plain` is a two-branch string keyed on whether the chosen keep equals the best keep.
- `src/features/tutorial/tutorialGrading.ts` `gradeDiscard` returns
  `plain: authored ?? generated.plain` (so a `scenario.reasons[key]` entry overrides the generated prose) and
  `math: generated.math`.
- `src/features/tutorial/tutorialReducer.ts` `submitDiscard` writes them to
  `step.feedback = { tone, text: grade.plain, math: grade.math }`. It does **not** clear `step.selected`.
- `src/components/tutorial/TutorialShell.tsx` renders `<p className="coach-math">{state.step.feedback.math}</p>`
  as `secondary` when the scenario has an `isPlayerCrib` field and `feedback.math` is set.
- `src/components/tutorial/CoachPanel.tsx` puts `secondary` behind a `Show the math` `btn-link` and a
  `<Collapse>`. `.coach-math` already exists in `src/App.css`.
- `src/components/tutorial/DiscardExercise.tsx` computes `grade` and renders a `<div className="discard-compare">`
  containing only the sentence `Your throw compared with the engine's favourite keep. The numbers sit behind
  Show the math.` Its `grade` expression falls back to `Object.keys(scenario.reasons)[0]?.split("-")` when
  `step.selected.length !== 2`, which can report a rank for a throw the learner did not make once
  `Try another discard` has cleared the selection. This phase removes that fallback.

Both discard scenarios in `src/features/tutorial/scenarios.ts` use the same six cards,
`5♠ 5♦ 6♣ 7♥ J♦ Q♥`, with `acceptTopN: 3`. Verified engine rankings:

- `discard-theirs` (`isPlayerCrib: false`): **1st** throw `J♦ Q♥` (hand 12.217, their crib 4.931, net 7.286);
  **2nd** throw `6♣ 7♥` (hand 12.674, their crib 5.418, net 7.256); **15th** throw `5♦ 5♠` (net −6.368).
- `discard-yours` (`isPlayerCrib: true`): **1st** throw `6♣ 7♥` (hand 12.674, your crib 4.789, total 17.463);
  **2nd** throw `J♦ Q♥` (hand 12.217, your crib 4.077, total 16.294).

That is the teaching point the copy must carry: **the two hand numbers are identical in both scenarios; the
decision flips purely because the crib term changes sign and because touching cards are worth more in a crib
you own.** Keeping `5-5-J-Q` is worth slightly more in hand, but throwing `6-7` hands the opponent connected
cards; and holding `5-5-6-7` also pegs better, because a hand of fives and ten-value cards must keep leading
into fifteens.

Decision **D7** applies, restated in full: **the pegging axis is authored prose only.** No new engine helper
is added, `rankPlays` is not imported anywhere under `src/features/tutorial/`, and the boundary assertion
`expect(gradingSource).not.toMatch(/rankPlays/)` in `src/features/tutorial/tutorialGrading.test.ts` stays and
must keep passing.

Decision **D11** applies, restated in full: **no authored string and no test may contain an expected-value
magnitude.** Every number the learner sees must be produced at run time from `handScore`, `cribScore` and
`score`. Authored copy describes direction ("slightly more", "concedes less"), never figures.

Existing tests that this phase must update:
- `src/components/tutorial/DiscardExercise.test.tsx`
  `"accepts the top-ranked throw end to end via the real reducer, then offers to try another"` asserts
  `expect(screen.getByText(/engine's favourite keep/i)).toBeInTheDocument()`. That sentence is being replaced.
- `src/features/tutorial/catalog.test.ts` runs the whole catalog through `validateCatalog` and asserts zero
  problems; the new validation rules added here must therefore hold for the rewritten scenarios.

### Steps

1. **`src/features/tutorial/tutorialCopy.ts` — add a per-option math formatter.**
   Add an exported function `describeDiscardMath(option: DiscardOption, isPlayerCrib: boolean): string`
   returning exactly

   ```
   hand <H> <plus|minus> crib <C> = <T>
   ```

   where `<H>` is `option.handScore.toFixed(1)`, `<C>` is `option.cribScore.toFixed(1)`, `<T>` is
   `option.score.toFixed(1)`, and the connective is the word `plus` when `isPlayerCrib` is `true` and the word
   `minus` when it is `false`. Use those English words, not the symbols `+`/`−`.

2. **`src/features/tutorial/tutorialCopy.ts` — rewrite `describeDiscardComparison`'s `math`.**
   Keep the signature `(chosen: DiscardOption, best: DiscardOption, isPlayerCrib: boolean): { plain: string; math: string }`
   and keep the existing `crib` and `sameKeep` locals. Build `math` as three sentences:
   - a lead sentence naming the two numbers and the sign, exactly:
     `` `Two numbers decide this. Your four cards have an expected score, and the two you throw have an expected value in ${crib}. Because it is ${crib}, the crib number is ${isPlayerCrib ? "added" : "subtracted"}.` ``
   - `` `Your throw: ${describeDiscardMath(chosen, isPlayerCrib)}.` ``
   - `` `Engine's best throw: ${describeDiscardMath(best, isPlayerCrib)}.` ``

   Join the three with a single space.

3. **`src/features/tutorial/tutorialCopy.ts` — rewrite `describeDiscardComparison`'s `plain` to name three
   axes.** Replace both branches:
   - when `sameKeep` is `true`:
     `` `That is the throw the engine likes best for ${crib}. It balances three things: the score your four cards keep, what your two cards are worth in ${crib}, and whether your four cards give you a spread of ranks to peg with.` ``
   - when `sameKeep` is `false`:
     `` `Another throw does better on balance for ${crib}. Weigh three things: the score your four cards keep, what your two cards are worth in ${crib}, and whether your four cards give you a spread of ranks to peg with. Press Show the math for the first two as numbers.` ``

   Do not put any figure in either branch.

4. **`src/features/tutorial/scenarios.ts` — rewrite `DISCARD_SCENARIOS["discard-theirs"]`.**
   Keep `id`, `concepts`, `hand`, `isPlayerCrib: false` and `acceptTopN: 3` exactly as they are. Replace
   `prompt`, `hints` and `reasons` with:

   - `prompt`:
     `"This is the opponent's crib, so the two cards you throw work against you. Weigh three things before you choose: the score your four cards keep, what your two cards are worth in their crib, and whether your four cards give you a spread of ranks to peg with. Press Show the math after you confirm to see the first two as numbers."`
   - `hints` (a three-tier tuple; the type is `HintTiers = readonly [string, string, string]`, so keep the
     `as const` style used by the other entries in this file):
     1. `"Start with your own hand. Which four cards hold the most scoring shapes on their own?"`
     2. `"Now look at the two you would let go. This is their crib, so whatever those two are worth comes off your total."`
     3. `"Throw the jack and the queen. Keeping 5-5-6-7 gives their crib almost nothing, and its connected ranks peg better than a fistful of ten-value cards."`
   - `reasons` — keep both existing keys, `"JD-QH"` and `"6C-7H"`, and replace their text:
     - `"JD-QH"`:
       `"Best throw. Keeping 5-5-J-Q would score a shade more in your hand, but a jack and a queen are exactly the raw material their crib wants. Keeping 5-5-6-7 concedes less, and the six and seven give you mid-range ranks to peg with instead of cards that hand the opponent easy fifteens."`
     - `"6C-7H"`:
       `"Accepted, and this is the strongest keep on hand value alone. But six and seven are touching cards, and touching cards in their crib build runs for them. You are also left leading fives and ten-value cards, which is awkward pegging."`

5. **`src/features/tutorial/scenarios.ts` — rewrite `DISCARD_SCENARIOS["discard-yours"]`.**
   Keep `id`, `concepts`, `hand`, `isPlayerCrib: true` and `acceptTopN: 3` exactly as they are. Replace
   `prompt`, `hints` and `reasons` with:

   - `prompt`:
     `"The same six cards, but the crib is yours now, so the two cards you throw come back to you. Your hand numbers have not changed at all — only the sign on the crib has. Weigh the score your four cards keep, what your two cards add to your own crib, and whether your four cards peg well. Press Show the math after you confirm."`
   - `hints`:
     1. `"Your hand numbers are exactly what they were last time. Only the crib term has changed sign."`
     2. `"The crib is yours, so ask which two cards do the most work once they arrive there."`
     3. `"Throw the six and the seven. Touching cards build runs in a crib you own, and 5-5-J-Q is the higher-scoring keep anyway."`
   - `reasons` — keep both existing keys and replace their text:
     - `"6C-7H"`:
       `"Best throw. Two touching cards are productive in a crib you own, and 5-5-J-Q is already the higher-scoring keep. Notice the reversal: this was only the second-best throw when the crib belonged to the opponent, and nothing changed but the crib term."`
     - `"JD-QH"`:
       `"Accepted, and it was the best throw into their crib. But a jack and a queen do less in your own crib than a touching six and seven, so here it comes second."`

6. **`src/features/tutorial/validateCatalog.ts` — enforce the new copy contract.**
   In `checkDiscardScenario(id, sc)`, after the existing checks, add three rules that call the existing
   `add(problems, where, …)` helper:
   - if `sc.hints.length !== 3` add `"hints must have exactly three tiers"`;
   - if `new Set(sc.hints).size !== sc.hints.length` add `"hint tiers must be distinct"`;
   - if `!sc.prompt.includes(sc.isPlayerCrib ? "your crib" : "their crib")` add
     `` `prompt must name the crib owner ("${sc.isPlayerCrib ? "your crib" : "their crib"}")` ``;
   - if `!/peg/i.test(sc.prompt)` add `"prompt must mention pegging"`.

   Do not change `checkScoreScenario`, `checkPegScenario`, or the `rankDiscards`-returns-15 and
   `reasons`-key checks already present.

7. **`src/components/tutorial/DiscardExercise.tsx` — show the rank, drop the wrong-throw fallback.**
   - Change the `grade` computation to
     `const grade = step.selected.length === 2 ? gradeDiscard(scenario, step.selected) : null`, removing the
     `Object.keys(scenario.reasons)[0]?.split("-")` fallback entirely.
   - Replace the sentence inside `<div className="discard-compare">` with two paragraphs:
     `<p>Your throw ranks {grade.rankOfChoice} of 15 for {scenario.isPlayerCrib ? "your crib" : "their crib"}.</p>`
     and
     `<p>Press Show the math on the coach panel for your hand number and your crib number.</p>`
   - Leave the `owner` line, the `SelectableHand`, the `locked` guard, the `Confirm two discards` button and
     the `Try another discard` button exactly as they are.

8. **`src/features/tutorial/tutorialCopy.test.ts` — cover the new math string.**
   If this file does not exist, create it. Add a `describe("describeDiscardComparison")` with two tests, both
   using `rankDiscards(specsToCards(DISCARD_SCENARIOS[id].hand), [], DISCARD_SCENARIOS[id].isPlayerCrib)` to
   obtain real options:
   - `"shows the hand number, the crib number and the signed total for their crib"` — for `discard-theirs`,
     assert the returned `math` matches `/hand \d+\.\d minus crib \d+\.\d = \d+\.\d/` and contains
     `"subtracted"` and `"their crib"`.
   - `"adds the crib number when the crib is the learner's"` — for `discard-yours`, assert `math` matches
     `/hand \d+\.\d plus crib \d+\.\d = \d+\.\d/` and contains `"added"` and `"your crib"`.

   Add a third test `"plain copy names all three axes and carries no figures"` asserting the `plain` string
   contains `"peg"`, contains `"crib"`, and does **not** match `/\d/`.

9. **`src/components/tutorial/DiscardExercise.test.tsx` — update the replaced assertion.**
   In `"accepts the top-ranked throw end to end via the real reducer, then offers to try another"`, replace
   `expect(screen.getByText(/engine's favourite keep/i)).toBeInTheDocument()` with
   `expect(screen.getByText(/ranks 1 of 15 for their crib/i)).toBeInTheDocument()`. Leave the rest of the
   test, including the `status` assertion and the `Try another discard` click, unchanged.

10. **`src/components/tutorial/DiscardExercise.test.tsx` — add a reversal test.**
    Add `it("ranks the same throw differently depending on whose crib it is", …)` which renders
    `DiscardExercise` for `discard-theirs` with `step={{ ...emptyStep, selected: ["JD", "QH"], attempts: 1, feedback: { tone: "good", text: "x" } }}`
    and asserts `/ranks 1 of 15 for their crib/i` is present, then renders for `discard-yours` with the same
    selection and asserts `/ranks 2 of 15 for your crib/i` is present.

11. **`src/features/tutorial/catalog.test.ts` — add a negative fixture for the new rules.**
    Add `it("rejects a discard scenario whose hint tiers repeat or whose prompt hides the crib owner", …)`
    which calls the exported `checkDiscardScenario("bad", { …DISCARD_SCENARIOS["discard-theirs"],
    prompt: "Choose two cards.", hints: ["a", "a", "b"] })` and asserts the returned problems array contains
    entries mentioning `"distinct"`, `"crib owner"` and `"pegging"`.

### Do NOT

- Do not put any expected-value number into `scenarios.ts`, into any hint, prompt or reason, or into any test
  assertion (decision D11). Numbers appear only via `toFixed(1)` at run time.
- Do not import `rankPlays` anywhere under `src/features/tutorial/`, and do not add a pegging-strength engine
  helper (decision D7). Do not remove or weaken the
  `expect(gradingSource).not.toMatch(/rankPlays/)` assertion in
  `src/features/tutorial/tutorialGrading.test.ts`.
- Do not change `src/app/game.ts`, `rankDiscards`, `acceptTopN`, or either scenario's `hand`, `id`,
  `concepts` or `isPlayerCrib`.
- Do not remove either `reasons` key from either scenario — `checkDiscardScenario` requires an entry for the
  engine's best throw, and the best throw differs between the two scenarios (`J♦ Q♥` for `discard-theirs`,
  `6♣ 7♥` for `discard-yours`).
- Do not move the two numbers out from behind `Show the math` into the always-visible coach prompt, and do
  not change `CoachPanel.tsx` or the `.coach-math` rule in `src/App.css`.
- Do not change `submitDiscard` in `src/features/tutorial/tutorialReducer.ts`, and in particular do not make
  it clear `step.selected` — `DiscardExercise` depends on the selection surviving submission.
- Do not touch anything under `src/components/tutorial/` other than `DiscardExercise.tsx` and its test.

### Definition of done

- [ ] `npx vitest run` passes with zero failures, including `src/features/tutorial/catalog.test.ts`.
- [ ] `npm run lint` reports zero problems.
- [ ] `npm run build` succeeds.
- [ ] `rg -n "rankPlays" src/features/tutorial/` matches only the boundary assertion inside
      `tutorialGrading.test.ts`.
- [ ] `rg -n "[0-9]+\.[0-9]" src/features/tutorial/scenarios.ts` returns no matches.
- [ ] `src/features/tutorial/tutorialCopy.test.ts` contains
      `"shows the hand number, the crib number and the signed total for their crib"`,
      `"adds the crib number when the crib is the learner's"` and
      `"plain copy names all three axes and carries no figures"`.
- [ ] `src/components/tutorial/DiscardExercise.test.tsx` contains
      `"ranks the same throw differently depending on whose crib it is"`.
- [ ] `src/features/tutorial/catalog.test.ts` contains
      `"rejects a discard scenario whose hint tiers repeat or whose prompt hides the crib owner"`.
- [ ] Manual: `npm start`, `http://localhost:3000/learn/discard-basics`. Click `Next` until the coach prompt
      reads `This is the opponent's crib, so the two cards you throw work against you.` …
- [ ] Manual, same screen: select `J♦` and `Q♥`, press `Confirm two discards`. The exercise reads
      `Your throw ranks 1 of 15 for their crib.` and the coach reads the `"JD-QH"` reason beginning
      `Best throw. Keeping 5-5-J-Q would score a shade more in your hand`.
- [ ] Manual, same screen: press `Show the math`. The disclosure reads
      `Two numbers decide this. … Because it is their crib, the crib number is subtracted. Your throw: hand
      12.2 minus crib 4.9 = 7.3. Engine's best throw: hand 12.2 minus crib 4.9 = 7.3.`
- [ ] Manual: advance to the `discard-yours` step (the coach prompt begins `The same six cards, but the crib
      is yours now`). Select `J♦` and `Q♥` and confirm: the exercise reads
      `Your throw ranks 2 of 15 for your crib.` and `Show the math` reads `… the crib number is added. Your
      throw: hand 12.2 plus crib 4.1 = 16.3. Engine's best throw: hand 12.7 plus crib 4.8 = 17.5.`

### Rollback note

Revert `src/features/tutorial/tutorialCopy.ts`, `src/features/tutorial/scenarios.ts`,
`src/features/tutorial/validateCatalog.ts`, `src/components/tutorial/DiscardExercise.tsx`,
`src/features/tutorial/tutorialCopy.test.ts`, `src/components/tutorial/DiscardExercise.test.tsx` and
`src/features/tutorial/catalog.test.ts`. Phase 7's engine fields are unused but harmless if this phase is
reverted.

---

## Phase 9 — Round demonstration 1 of 3: content types, demo decks, validation, new step kind

**Implements the content model and step kind for RM-5** (traces to U1a–U1e and the role swap). **Requires
Phase 8 complete.**

### Goal

Add the two verified demonstration decks, the two optional `RoundScript` fields that describe the learner's
scripted side, the new `round-demo` step kind, and the validation that proves all of it is legal. No UI
changes and no lesson changes in this phase: after it, everything compiles and the full suite passes with the
new content present but not yet reachable.

### Context

`src/features/tutorial/tutorialTypes.ts` declares:

```ts
export type RoundScript = {
  id: string
  dealer: PlayerEvent
  deck: readonly [ CardSpec × 13 ]
  opponentDiscard: readonly [CardSpec, CardSpec]
  opponentPlays: ReadonlyArray<CardSpec>
  checkpoints: ReadonlyArray<RoundCheckpoint>
}
```

and documents the deal order in a comment that must be preserved:

```
dealer = "opponent"   index : 0  1  2  3  4  5  6  7  8  9 10 11 | 12
                      to    : P  O  P  O  P  O  P  O  P  O  P  O | starter
dealer = "player"     index : 0  1  2  3  4  5  6  7  8  9 10 11 | 12
                      to    : O  P  O  P  O  P  O  P  O  P  O  P | starter
```

`src/app/game.ts` deals with one `deal-card` `GameAction` per card, alternating, starting with the
non-dealer, until each hand holds six — verified in the `case "dealing"` block. That is what makes a
card-by-card demonstration possible.

`ROUND_SCRIPTS` in `src/features/tutorial/scenarios.ts` currently holds exactly two entries, `first-round`
and `second-round`, used by lessons 5 and 6. Decision **D2** applies, restated in full: **the demonstration
uses two new decks, `demo-hand-1` and `demo-hand-2`. `first-round` and `second-round` are not reused**, so
lessons 5 and 6 are not spoiled.

`src/features/tutorial/validateCatalog.ts` `validateRoundScripts(completeRound)` iterates **every** entry in
`ROUND_SCRIPTS`, checks `opponentDiscard` against the opponent's dealt six, checks that `opponentPlays`
equals the opponent's kept four as a sorted key list, and then drives the script through the `completeRound`
callback. `src/features/tutorial/completeRound.ts` runs a script through `GuidedRound` picking arbitrary legal
learner choices. Both new decks have been driven through that exact path and both return `{ ok: true }`, so
adding them to `ROUND_SCRIPTS` will not break `src/features/tutorial/catalog.test.ts`.

The two decks have been simulated against `CribbageGame`. Their full verified traces:

**`demo-hand-1` — the opponent deals, so the learner is the non-dealer (pone).**
Deck, in engine deal order:
`4♥, 2♣, 5♠, 3♠, 6♦, 8♦, 7♣, 8♥, 9♥, Q♠, K♦, J♣, 10♠`
- learner is dealt `4♥ 5♠ 6♦ 7♣ 9♥ K♦` (indices 0, 2, 4, 6, 8, 10) and throws `9♥ K♦`
- opponent is dealt `2♣ 3♠ 8♦ 8♥ Q♠ J♣` (indices 1, 3, 5, 7, 9, 11) and throws `Q♠ J♣`
- starter `10♠` — **not** a jack, so there is no his heels
- play: you `6♦` (6) · them `8♥` (14) · you `7♣` (21) **run of three, 3 to you** · them `3♠` (24) · you `5♠`
  (29) · them `2♣` (**31, 2 to them**) · count resets · you `4♥` (4) · them `8♦` (12) ·
  **last card, 1 to them**
- show: your hand `4♥ 5♠ 6♦ 7♣` with `10♠` scores **8** (you count first, as pone); their hand
  `2♣ 3♠ 8♦ 8♥` scores **4**; the crib `9♥ J♣ Q♠ K♦` with `10♠` is a run of five, **5 to them**
- hand totals: you 11, them 12

**`demo-hand-2` — the learner deals, so the roles and the crib have swapped.**
Deck, in engine deal order:
`6♣, 5♣, 7♥, 5♥, 8♦, 10♦, 9♠, K♠, 4♠, 2♠, A♣, 3♣, J♥`
- opponent is dealt `6♣ 7♥ 8♦ 9♠ 4♠ A♣` (indices 0, 2, 4, 6, 8, 10) and throws `4♠ A♣`
- learner is dealt `5♣ 5♥ 10♦ K♠ 2♠ 3♣` (indices 1, 3, 5, 7, 9, 11) and throws `2♠ 3♣`
- starter `J♥` — a jack, so **his heels pays 2 to you, the dealer**
- play: them `6♣` (6) · you `5♣` (11) · them `7♥` (18) **run of three, 3 to them** · you `5♥` (23) · them
  `8♦` (**31, 2 to them**) · count resets · you `K♠` (10) · them `9♠` (19) · you `10♦` (29) ·
  **last card, 1 to you**
- show: their hand `6♣ 7♥ 8♦ 9♠` with `J♥` scores **8** (they count first, as pone); your hand
  `5♣ 5♥ 10♦ K♠` with `J♥` scores **14**; your crib `A♣ 2♠ 3♣ 4♠` with `J♥` scores **8**
- hand totals: you 25, them 13

Decision **D10** applies, restated in full: `round-demo` is a **passive** step kind.
`passiveKind("round-demo")` returns `true`, so `emptyStepState` gives it `status: "complete"` and the footer
`Next` button is always enabled — the learner can never be trapped inside the demonstration.
`isAssessedStepKind("round-demo")` stays `false`, so the demonstration awards no concept mastery.

`src/features/tutorial/tutorialReducer.ts` has an exhaustiveness guard: the `submit` switch ends with
`default: assertNeverStepKind(step)`, which throws at run time for an unhandled kind. A new member of the
`TutorialStep` union therefore requires a new `case` there or the build fails.

### Steps

1. **`src/features/tutorial/tutorialTypes.ts` — extend `RoundScript`.**
   Add two **optional** fields after `opponentPlays`:
   - `playerDiscard?: readonly [CardSpec, CardSpec]` — the two cards the learner's seat throws in a
     demonstration;
   - `playerPlays?: ReadonlyArray<CardSpec>` — the learner's seat's pegging plays, in order.

   Document with a comment that these are set only on demonstration scripts, that the coached rounds
   (`first-round`, `second-round`) leave them undefined because the learner chooses there, and that when one
   is present the other must be too.

2. **`src/features/tutorial/tutorialTypes.ts` — add the step kind.**
   Add to the `TutorialStep` union, immediately after the `guided-round` member:
   `| { kind: "round-demo"; id: string; scriptIds: readonly [string, string] }`.
   Comment that the two ids are demonstrated in order and that the second one must reverse the dealer.

3. **`src/features/tutorial/scenarios.ts` — add `demo-hand-1` to `ROUND_SCRIPTS`.**
   Insert a third entry, matching the formatting of the existing two (deck laid out two `CardSpec`s per
   source line):

   ```ts
   "demo-hand-1": {
     id: "demo-hand-1",
     dealer: "opponent",
     deck: [
       ["hearts", 4], ["clubs", 2],
       ["spades", 5], ["spades", 3],
       ["diamonds", 6], ["diamonds", 8],
       ["clubs", 7], ["hearts", 8],
       ["hearts", 9], ["spades", 12],
       ["diamonds", 13], ["clubs", 11],
       ["spades", 10],
     ],
     opponentDiscard: [["spades", 12], ["clubs", 11]],
     opponentPlays: [["hearts", 8], ["spades", 3], ["clubs", 2], ["diamonds", 8]],
     playerDiscard: [["hearts", 9], ["diamonds", 13]],
     playerPlays: [["diamonds", 6], ["clubs", 7], ["spades", 5], ["hearts", 4]],
     checkpoints: [ … six entries, one per phase … ],
   },
   ```

   The `checkpoints` array must contain one entry for each of the six `RoundPhase` values
   `"deal"`, `"discard"`, `"starter"`, `"pegging"`, `"show"`, `"crib"`, each with a `concepts` array and a
   `coach` string. Use exactly this copy:
   - `deal`, concepts `["round-flow"]`:
     `"Six cards each, dealt one at a time, starting with the player who is not dealing. They deal this hand, so you are the non-dealer."`
   - `discard`, concepts `["crib-ownership", "discard-keep"]`:
     `"Both players throw two cards face down. Those four cards are the crib, and this hand the crib belongs to them."`
   - `starter`, concepts `["his-heels"]`:
     `"The deck is cut and the starter is turned. It is the ten of spades — not a jack, so nobody scores his heels."`
   - `pegging`, concepts `["peg-fifteen-31", "peg-pair-run", "peg-go-last-card"]`:
     `"You lead, because you are not the dealer. Watch the count climb, watch a run score in the play, and watch the count reset after 31."`
   - `show`, concepts `["count-order"]`:
     `"The non-dealer counts first, so you count first. Then they count. Every hand uses the starter as a fifth card."`
   - `crib`, concepts `["crib-ownership"]`:
     `"The crib is counted last, and it belongs to the dealer — them, this hand."`

4. **`src/features/tutorial/scenarios.ts` — add `demo-hand-2` to `ROUND_SCRIPTS`.**
   Insert a fourth entry:

   ```ts
   "demo-hand-2": {
     id: "demo-hand-2",
     dealer: "player",
     deck: [
       ["clubs", 6], ["clubs", 5],
       ["hearts", 7], ["hearts", 5],
       ["diamonds", 8], ["diamonds", 10],
       ["spades", 9], ["spades", 13],
       ["spades", 4], ["spades", 2],
       ["clubs", 1], ["clubs", 3],
       ["hearts", 11],
     ],
     opponentDiscard: [["spades", 4], ["clubs", 1]],
     opponentPlays: [["clubs", 6], ["hearts", 7], ["diamonds", 8], ["spades", 9]],
     playerDiscard: [["spades", 2], ["clubs", 3]],
     playerPlays: [["clubs", 5], ["hearts", 5], ["spades", 13], ["diamonds", 10]],
     checkpoints: [ … six entries, one per phase … ],
   },
   ```

   Checkpoint copy, which must name the swap:
   - `deal`, concepts `["round-flow"]`:
     `"Second hand, and the deal has passed to you. The cards still go out one at a time to the non-dealer first — which is them now."`
   - `discard`, concepts `["crib-ownership", "discard-keep"]`:
     `"Both players throw two again, but this crib is yours. The same job, the opposite consequence."`
   - `starter`, concepts `["his-heels"]`:
     `"The starter is the jack of hearts. A jack turned as the starter is his heels, and it pays 2 to the dealer — that is you."`
   - `pegging`, concepts `["peg-fifteen-31", "peg-pair-run", "peg-go-last-card"]`:
     `"They lead this hand, because they are not the dealer. You play second, and the last card of the play is yours."`
   - `show`, concepts `["count-order"]`:
     `"They count first now, because they are the non-dealer. You count second."`
   - `crib`, concepts `["crib-ownership"]`:
     `"The crib is counted last and it is yours this hand. Compare that with the first hand, where it was theirs."`

5. **`src/features/tutorial/validateCatalog.ts` — add an exported seat check.**
   Add `export function checkPlayerSeat(script: RoundScript): ReadonlyArray<CatalogProblem>`. It:
   - returns an empty array when both `script.playerDiscard` and `script.playerPlays` are `undefined`;
   - adds `"playerDiscard and playerPlays must be set together"` when exactly one is present;
   - otherwise computes the learner's dealt six as `script.dealer === "player" ? [1,3,5,7,9,11] : [0,2,4,6,8,10]`
     mapped over `script.deck` (mirroring the index tables in `tutorialTypes.ts`), and:
     - for each card in `playerDiscard` not in that six, adds
       `` `playerDiscard ${cardKey(...)} is not in the learner's six` ``;
     - computes the kept four by removing the two discards, and adds
       `` `playerPlays ${playKeys} !== kept four ${keptKeys}` `` when the sorted comma-joined `cardKey` lists
       differ. Use the same `cardKey(specToCard(spec))` / `.sort().join(",")` construction the existing
       `opponentPlays` check in `validateRoundScripts` uses.

   Use the file's existing `add(problems, where, message)` helper with `where` = `` `script:${script.id}` ``.

6. **`src/features/tutorial/validateCatalog.ts` — call it.**
   Inside `validateRoundScripts`'s `for (const script of Object.values(ROUND_SCRIPTS))` loop, immediately
   before the `completeRound(script.id)` call, add `problems.push(...checkPlayerSeat(script))`.

7. **`src/features/tutorial/validateCatalog.ts` — validate `round-demo` steps.**
   In `validateCatalog`, inside the existing `for (const step of lesson.steps)` loop, next to the
   `step.kind === "guided-round"` check, add a `step.kind === "round-demo"` branch that, for each id in
   `step.scriptIds`:
   - adds `` `unknown scriptId ${id}` `` when `!ROUND_SCRIPTS[id]`;
   - adds `` `demo script ${id} needs playerDiscard and playerPlays` `` when the script exists but either
     field is `undefined`.

   Then add, when both scripts exist, a check that
   `ROUND_SCRIPTS[step.scriptIds[0]].dealer !== ROUND_SCRIPTS[step.scriptIds[1]].dealer`, adding
   `"the two demo scripts must have opposite dealers"` otherwise. Use `where` = `` `step:${step.id}` ``.

8. **`src/features/tutorial/tutorialReducer.ts` — make `round-demo` passive.**
   Change `passiveKind` to
   `return kind === "explain" || kind === "round-map" || kind === "recap" || kind === "round-demo"`.
   Add `case "round-demo":` alongside the existing `case "explain": case "round-map": case "recap":
   case "guided-round": return state` group in the `submit` switch. Do not change `isAssessedStepKind`,
   `stepConcepts`, or `assertNeverStepKind`.

9. **`src/components/tutorial/TutorialShell.tsx` — map the new kind onto the round map.**
   In `highlightFor`, add `if (step.kind === "round-demo") { return "deal" }` immediately after the existing
   `guided-round` branch. Change nothing else: the `prompt` chain already falls through to
   `"Follow the coach."` for any kind that is not `explain` / `round-map` / `recap`, and
   `nextEnabled` is already satisfied because the step's status starts as `"complete"`.

10. **`src/features/tutorial/catalog.test.ts` — assert the new content and the new checks.**
    - Add `it("has four round scripts, two of them demonstration decks with a scripted learner seat", …)`
      asserting `Object.keys(ROUND_SCRIPTS)` has length 4 and contains `"demo-hand-1"` and `"demo-hand-2"`,
      that both demo scripts have defined `playerDiscard` and `playerPlays`, that `demo-hand-1.dealer` is
      `"opponent"` and `demo-hand-2.dealer` is `"player"`, and that `first-round.playerDiscard` and
      `second-round.playerDiscard` are both `undefined`.
    - Add `it("rejects a demo script whose scripted learner plays are not the kept four", …)` calling the
      exported `checkPlayerSeat({ ...ROUND_SCRIPTS["demo-hand-1"], playerPlays: [["hearts", 9]] })` and
      asserting the returned array is non-empty and its first `message` contains `"kept four"`.
    - Add `it("rejects a demo script that sets only one of the two learner fields", …)` calling
      `checkPlayerSeat({ ...ROUND_SCRIPTS["demo-hand-1"], playerPlays: undefined })` and asserting the
      message contains `"must be set together"`.
    - Leave the existing whole-catalog assertion (`expect(validateCatalog()).toEqual([])`) and the
      `validateRoundScripts(completeRound)` assertion unchanged; both must still pass with the two new decks
      present.

11. **`src/features/tutorial/tutorialReducer.test.ts` — cover the new kind.**
    Add `it("treats round-demo as a passive, unassessed step", …)` asserting
    `isAssessedStepKind("round-demo")` is `false` and that
    `emptyStepState({ kind: "round-demo", id: "d", scriptIds: ["demo-hand-1", "demo-hand-2"] }).status`
    is `"complete"`.

### Do NOT

- Do not change `first-round` or `second-round` in any way, and do not set `playerDiscard` or `playerPlays` on
  them.
- Do not alter any card in the two new decks. They have been simulated; a single changed card invalidates
  every trace and score in the Context section and can make the round illegal.
- Do not make `playerDiscard` or `playerPlays` required on `RoundScript`.
- Do not modify `src/features/tutorial/guidedRound.ts`, `src/features/tutorial/completeRound.ts`, or
  `src/app/game.ts`.
- Do not add a `round-demo` step to any lesson in `src/features/tutorial/lessonCatalog.ts` in this phase, and
  do not change lesson 1. That happens in Phase 11.
- Do not create the demo runner or any component in this phase.
- Do not delete or weaken the `default: assertNeverStepKind(step)` guard in the reducer's `submit` switch.
- Do not change `isAssessedStepKind`.

### Definition of done

- [ ] `npx vitest run` passes with zero failures, including `src/features/tutorial/catalog.test.ts`'s
      existing `validateCatalog()` and `validateRoundScripts(completeRound)` assertions.
- [ ] `npm run lint` reports zero problems.
- [ ] `npm run build` succeeds.
- [ ] `rg -n "demo-hand-1|demo-hand-2" src/features/tutorial/scenarios.ts` shows both keys.
- [ ] `src/features/tutorial/catalog.test.ts` contains
      `"has four round scripts, two of them demonstration decks with a scripted learner seat"`,
      `"rejects a demo script whose scripted learner plays are not the kept four"` and
      `"rejects a demo script that sets only one of the two learner fields"`.
- [ ] `src/features/tutorial/tutorialReducer.test.ts` contains
      `"treats round-demo as a passive, unassessed step"`.
- [ ] Manual: `npm start`, `http://localhost:3000/learn/coached-round` and
      `http://localhost:3000/learn/coached-round-dealer` still open and their coached rounds still complete
      exactly as they did after Phase 5 — the two new decks must not have leaked into lessons 5 and 6.

### Rollback note

Revert `src/features/tutorial/tutorialTypes.ts`, `src/features/tutorial/scenarios.ts`,
`src/features/tutorial/validateCatalog.ts`, `src/features/tutorial/tutorialReducer.ts`,
`src/components/tutorial/TutorialShell.tsx`, `src/features/tutorial/catalog.test.ts` and
`src/features/tutorial/tutorialReducer.test.ts`. Nothing in Phases 1–8 reads the new fields or kind.

---

## Phase 10 — Round demonstration 2 of 3: the demo runner

**Implements the engine half of RM-5** (traces to U1a–U1e). **Requires Phase 9 complete.**

### Goal

Add `src/features/tutorial/roundDemo.ts`: a headless, engine-driven runner that plays two scripted hands one
visible beat at a time, so the learner sees the deal, the discard, the cut, every pegging card, and all three
show counts. No UI in this phase — the runner ships with unit tests only.

### Context

Phase 9 added to `src/features/tutorial/tutorialTypes.ts`:
- optional `RoundScript` fields `playerDiscard?: readonly [CardSpec, CardSpec]` and
  `playerPlays?: ReadonlyArray<CardSpec>`;
- the step kind `{ kind: "round-demo"; id: string; scriptIds: readonly [string, string] }`.

Phase 9 added to `ROUND_SCRIPTS` in `src/features/tutorial/scenarios.ts` two fully scripted decks whose
verified traces are:

**`demo-hand-1`** — dealer `"opponent"`; deck `4♥, 2♣, 5♠, 3♠, 6♦, 8♦, 7♣, 8♥, 9♥, Q♠, K♦, J♣, 10♠`; learner
throws `9♥ K♦`; opponent throws `Q♠ J♣`; starter `10♠` (no his heels); play order
`you 6♦ · them 8♥ · you 7♣ (run of three, 3 to you) · them 3♠ · you 5♠ · them 2♣ (31, 2 to them) · reset ·
you 4♥ · them 8♦ (last card, 1 to them)`; show `you 8, them 4, their crib 5`; hand totals `you 11, them 12`.

**`demo-hand-2`** — dealer `"player"`; deck `6♣, 5♣, 7♥, 5♥, 8♦, 10♦, 9♠, K♠, 4♠, 2♠, A♣, 3♣, J♥`; opponent
throws `4♠ A♣`; learner throws `2♠ 3♣`; starter `J♥` (**his heels, 2 to you**); play order
`them 6♣ · you 5♣ · them 7♥ (run of three, 3 to them) · you 5♥ · them 8♦ (31, 2 to them) · reset · you K♠ ·
them 9♠ · you 10♦ (last card, 1 to you)`; show `them 8, you 14, your crib 8`; hand totals `you 25, them 13`.

Existing pieces this runner must reuse rather than reinvent:
- `src/features/tutorial/fixedDeck.ts` `FixedDeck(deck, deckCode)` — deals the 13 scripted cards from the
  front in order. `dealOne()` returns the next card.
- `src/app/game.ts` `CribbageGame(deck)`, `GameAction(action, subaction)`, `GameStage`. Setting
  `game.dealer = script.dealer` before the first `new GameAction("start-round")` is how
  `src/features/tutorial/guidedRound.ts` seats the players; do the same.
- The engine emits **one `deal-card` action per card**, alternating, starting with the non-dealer, until each
  hand holds six. That is what makes card-by-card dealing possible.
- `src/features/tutorial/guidedRound.ts` is the reference implementation for the pump loop, the
  `need-discard` / `need-play-card` / `need-starter-card` handling, the `applyScore` three-slot peg shift
  (`pga[2] = pga[1]; pga[1] = pga[0]; pga[0] += action.score`), the `RoundLogEntry` shape
  (`{ id, who, text, points }` with ids `` `log-${n}` ``), and the `SCORE_REASON_COPY` /
  `explainPegPlay(...).events.map(e => e.label)` label preference. Read it and follow its structure.
  **Do not modify it.**
- `src/features/tutorial/tutorialCards.ts` `specToCard(spec)`, `specsToCards(specs)`.
- `src/app/entities.ts` `cardKey(card)`.
- `src/app/game.ts` `scoreHand(hand, starter, isCrib)` for show totals.
- `src/features/game/gameSlice.ts` `PCard` = `{ suit, rank }`. `guidedRound.ts`'s private
  `toPCard(card)` helper shows the conversion.

Decision **D1** applies, restated in full: **no timers.** There is no `setTimeout`, `setInterval`,
`requestAnimationFrame`, `matchMedia`, or auto-advance. The runner exposes `advance()` and the UI calls it
once per learner press.

Decision **D2/D3** applies, restated in full: the two hands run as **two separate `CribbageGame` and
`FixedDeck` instances**, one per script id. `FixedDeck` rebuilds its whole 13-card sequence on reset, so a
single game cannot serve two hands. The runner carries the cumulative score and peg positions forward from
hand 1 into hand 2 itself, rather than relying on the engine's `round-end` dealer flip.

`back()` is implemented by **deterministic replay**: reset to beat 0 and call the internal advance step
`n - 1` times. Everything is scripted, so replay is exact. Do not attempt to invert engine state.

### Steps

1. **Create `src/features/tutorial/roundDemo.ts` — declare the view types.** Export:

   ```ts
   export type DemoStage = "deal" | "discard" | "starter" | "pegging" | "show" | "done"
   export type DemoOwner = "you" | "opponent"
   export type DemoBreakdown = {
     title: string
     hand: ReadonlyArray<PCard>
     starter: PCard | null
     isCrib: boolean
     total: number
   }
   export type DemoView = {
     handNumber: 1 | 2
     stage: DemoStage
     phase: RoundPhase
     coach: string
     playerHand: ReadonlyArray<PCard>
     opponentHand: ReadonlyArray<PCard>
     crib: ReadonlyArray<PCard>
     starter: PCard | null
     trick: ReadonlyArray<{ card: PCard; by: DemoOwner }>
     lastTrick: ReadonlyArray<{ card: PCard; by: DemoOwner }>
     lastTrickReason: string
     count: number
     dealer: DemoOwner
     scores: { player: number; opponent: number }
     pegPoints: { player: number[]; opponent: number[] }
     breakdown: DemoBreakdown | null
     log: ReadonlyArray<RoundLogEntry>
     beatIndex: number
     atStart: boolean
     atEnd: boolean
   }
   ```

   Import `RoundLogEntry` from `./guidedRound` (it is already exported there) rather than declaring a second
   log type.

2. **Add the `RoundDemo` class.** Constructor
   `constructor(scriptIds: readonly [string, string], deckCode: string = "rc")`. It resolves both scripts from
   `ROUND_SCRIPTS` and throws `new Error(...)` naming the id if either is missing or lacks `playerDiscard` /
   `playerPlays`. Public methods: `view(): DemoView`, `advance(): void`, `back(): void`, `reset(): void`.

3. **Private state.** Hold: `handIndex` (`0 | 1`), `deck`, `game`, `queue: GameAction[]`, `stage: DemoStage`,
   `coach: string`, `trick` / `lastTrick` (arrays of `{ card: PCard; by: DemoOwner }`), `lastTrickReason`,
   `carriedScores: { player: number; opponent: number }` (points banked from finished hands),
   `pegPoints: { player: number[]; opponent: number[] }` initialised to `[0, -1, -1]` each, `log`, `logSeq`,
   `breakdown`, `beatIndex`, `playIndex` per side, and `done: boolean`.

4. **Implement the beat model.** One `advance()` press produces exactly one visible beat. Per hand, in order:
   - **beats 1–12** — one `deal-card` action each. `stage` is `"deal"`. After each, `playerHand` /
     `opponentHand` grow by one card. Both hands are reported face up in the view regardless of the engine's
     `isFaceUp` flag — the view returns `{ suit, rank }` pairs and the component decides how to draw them.
   - **beat 13** — resolve **both** discards from `script.playerDiscard` and `script.opponentDiscard` and set
     `stage` to `"discard"`. Both throws land in the same beat, so the learner sees the crib form at once.
   - **beat 14** — satisfy `need-starter-card` from `this.deck.dealOne()` and set `stage` to `"starter"`. Any
     his-heels score produced here is applied and logged in this beat.
   - **beats 15–22** — one `play-card` action each, alternating as the engine asks, taking the next legal card
     from `script.playerPlays` / `script.opponentPlays` for the requested side. `stage` is `"pegging"`. Each
     played card is appended to `trick` with its owner. When the engine's `playingHand` becomes empty after a
     beat, move `trick` into `lastTrick`, set `lastTrickReason` to `"The count reached 31, so it resets to 0."`
     when the count before the reset was 31 and to `"Neither player could play, so the count resets to 0."`
     otherwise, and clear `trick`. Both demo hands play all eight cards, so there are exactly eight play
     beats per hand.
   - **beat 23** — `show-non-dealer`. `stage` becomes `"show"` and `breakdown` is set for the hand that is
     being counted.
   - **beat 24** — `show-dealer`. `breakdown` is replaced.
   - **beat 25** — `show-crib`. `breakdown` is replaced.
   - **beat 26** — `round-end`. If `handIndex` is `0`, bank the finished hand's scores into `carriedScores`,
     then boot hand 2 from the second script id, reset `trick` / `lastTrick` / `breakdown` / `playIndex`,
     keep `pegPoints`, `log` and `carriedScores`, set `handNumber` to `2`, and set `stage` to `"deal"`. If
     `handIndex` is `1`, set `stage` to `"done"` and `done` to `true`.

   Implement this by pumping the engine's action queue and stopping as soon as one beat-producing action has
   been applied — mirror `guidedRound.pump`'s structure and add a local `beatDone` flag. `need-discard`,
   `need-play-card` and `need-starter-card` are satisfied from the scripts without pausing; the beat boundary
   is the resulting `discard` / `play-card` / `starter-card` action, except that the **second** `discard` of a
   hand is the boundary (so both discards land together).

5. **`breakdown` contents.** For `show-non-dealer` and `show-dealer`, the counted hand is
   `game.savedPlayerHand.hand` when the counting side is the learner and `game.savedOpponentHand.hand` when it
   is the opponent; `isCrib` is `false`. For `show-crib` the hand is `game.crib.hand` and `isCrib` is `true`.
   `total` is `scoreHand(hand, game.starter, isCrib)`. `title` is `"Your hand"`, `"Their hand"`,
   `"Your crib"` or `"Their crib"`, chosen from the script's dealer.

6. **`scores`.** `view().scores` returns
   `{ player: carriedScores.player + game.scores.player, opponent: carriedScores.opponent + game.scores.opponent }`,
   so the number the board shows is cumulative across both hands. Never read `game.scores` alone.

7. **`coach`.** On entering each stage, set `coach` from the current script's
   `checkpoints.find((c) => c.phase === <phase>)?.coach`, falling back to a short generic line
   (`"Watch the cards go out."` for `deal`, `"Watch the crib form."` for `discard`,
   `"The starter is turned."` for `starter`, `"Watch the count."` for `pegging`,
   `"Now the hands are counted."` for `show`, `"The crib is counted last."` for `crib`). When `stage` is
   `"done"`, set `coach` to exactly `"That is two whole hands. The deal, the crib and the counting order all
   swapped between them."`. `phase` in the view maps `stage` onto `RoundPhase`: `"deal" → "deal"`,
   `"discard" → "discard"`, `"starter" → "starter"`, `"pegging" → "pegging"`, `"show" → "show"` for beats 23
   and 24 and `"crib"` for beat 25, `"done" → "crib"`.

8. **`advance()` / `back()` / `reset()` semantics.**
   - `advance()` is a no-op when `done` is `true`.
   - `advance()` increments `beatIndex` by 1 on every beat it produces, counting continuously across both
     hands (so hand 2's first deal beat is `beatIndex` 27).
   - `reset()` reboots from hand 1 beat 0, clearing `carriedScores`, `pegPoints`, `log` and `beatIndex`.
   - `back()` records `const target = Math.max(0, this.beatIndex - 1)`, calls `reset()`, then calls the
     internal single-beat step `target` times. It is a no-op when `beatIndex` is `0`.
   - `atStart` is `beatIndex === 0`; `atEnd` is `done`.

9. **Guard the pump.** Bound the internal `while` loop at 5000 iterations like `guidedRound.pump` does, and
   on overrun set `stage` to `"done"`, `done` to `true`, and `coach` to
   `"The demonstration stopped unexpectedly."`. Treat an `error` action from the engine the same way.

10. **Create `src/features/tutorial/roundDemo.test.ts`.** Add a `describe("RoundDemo")` with:
    - `it("deals twelve cards one at a time before the crib forms", …)` — construct
      `new RoundDemo(["demo-hand-1", "demo-hand-2"])`, assert `view().stage` is `"deal"` and both hands are
      empty, then call `advance()` twelve times asserting after each call that
      `playerHand.length + opponentHand.length` equals the number of calls made, and that `stage` is still
      `"deal"` and `crib` is empty. After the thirteenth `advance()`, assert `stage` is `"discard"` and
      `crib.length` is `4`.
    - `it("turns the ten of spades in the first hand and the jack of hearts in the second", …)` — advance to
      the starter beat of hand 1 and assert `view().starter` equals `{ suit: "spades", rank: 10 }` and that no
      log entry mentions his heels; then drive to the end of hand 1 and into hand 2's starter beat and assert
      `view().starter` equals `{ suit: "hearts", rank: 11 }` and that `view().log` contains an entry with
      `who: "you"` and `points: 2`.
    - `it("shows every pegging card with its owner and resets the count after 31", …)` — drive hand 1 to the
      end of its play and assert the ordered `by`/card pairs are
      `you 6♦, them 8♥, you 7♣, them 3♠, you 5♠, them 2♣` for the first trick (captured from `lastTrick`
      after the reset) and `you 4♥, them 8♦` for the second, and that `lastTrickReason` after the reset
      contains `"31"`.
    - `it("shows three breakdowns per hand with the totals the engine computes", …)` — drive hand 1 through
      its three show beats and assert `breakdown.total` is `8`, then `4`, then `5`, with titles
      `"Your hand"`, `"Their hand"`, `"Their crib"`; then drive hand 2 and assert `8`, `14`, `8` with titles
      `"Their hand"`, `"Your hand"`, `"Your crib"`.
    - `it("reaches a finished state whose cumulative score is you 36, them 25", …)` — call `advance()` in a
      loop bounded at 200 iterations until `view().atEnd`, then assert `view().stage` is `"done"`,
      `view().handNumber` is `2`, and `view().scores` deep-equals `{ player: 36, opponent: 25 }`
      (hand 1 gave you 11 / them 12, hand 2 gave you 25 / them 13).
    - `it("back replays to the previous beat and reset returns to the start", …)` — advance five times,
      capture `view()`, advance once more, call `back()`, and assert the resulting `view()` deep-equals the
      captured one; then call `reset()` and assert `beatIndex` is `0`, `atStart` is `true` and both hands are
      empty.
    - `it("throws when a script id is missing or has no scripted learner seat", …)` — assert
      `() => new RoundDemo(["first-round", "second-round"])` throws (those scripts have no `playerDiscard`),
      and that `() => new RoundDemo(["nope", "demo-hand-2"])` throws.

### Do NOT

- Do not modify `src/features/tutorial/guidedRound.ts`, `src/features/tutorial/completeRound.ts`,
  `src/features/tutorial/fixedDeck.ts`, `src/app/game.ts`, or `src/features/tutorial/scenarios.ts`.
- Do not reuse a single `CribbageGame` across both hands, and do not call `resetGame` or rely on
  `round-end`'s dealer flip.
- Do not add any timer, `matchMedia` call, or auto-advance (decision D1).
- Do not put a `Card`, `Hand`, or `CribbageGame` instance in the returned `DemoView`; return `PCard` pairs and
  plain numbers only.
- Do not create any React component or touch `src/screens/` or `src/components/` in this phase.
- Do not add a `round-demo` step to any lesson in this phase.
- Do not import `thePlayer` from `src/app/gamePlayer.ts` — the tutorial must never touch that singleton.
- Do not attempt to invert engine state for `back()`; replay from `reset()`.

### Definition of done

- [ ] `npx vitest run` passes with zero failures.
- [ ] `npm run lint` reports zero problems.
- [ ] `npm run build` succeeds.
- [ ] `src/features/tutorial/roundDemo.test.ts` exists and contains all seven named tests listed in step 10.
- [ ] `rg -n "setTimeout|setInterval|requestAnimationFrame|matchMedia|thePlayer" src/features/tutorial/roundDemo.ts`
      returns no matches.
- [ ] `rg -n "roundDemo" src/components/ src/screens/` returns no matches (the runner is not wired up yet).

### Rollback note

Delete `src/features/tutorial/roundDemo.ts` and `src/features/tutorial/roundDemo.test.ts`. Nothing else
imports them, so Phases 1–9 are unaffected.

---

## Phase 11 — Round demonstration 3 of 3: the `RoundDemo` view and the new Lesson 1

**Implements the UI and catalog half of RM-5** (traces to U1a–U1e and the role swap). **Requires Phase 10
complete.**

### Goal

Render the demonstration on screen, replace Lesson 1's five static slides with it, and wire it into
`src/screens/Lesson.tsx` so the learner walks two whole hands one press at a time.

### Context

Phase 9 added the step kind `{ kind: "round-demo"; id: string; scriptIds: readonly [string, string] }` to
`src/features/tutorial/tutorialTypes.ts`, made `passiveKind("round-demo")` return `true` (so the step's
`status` starts as `"complete"` and the footer `Next` is always enabled), added
`if (step.kind === "round-demo") { return "deal" }` to `highlightFor` in
`src/components/tutorial/TutorialShell.tsx`, and added the two demonstration decks `demo-hand-1` and
`demo-hand-2` to `ROUND_SCRIPTS` in `src/features/tutorial/scenarios.ts`.

Phase 10 added `src/features/tutorial/roundDemo.ts`, exporting the class `RoundDemo` and the types
`DemoStage`, `DemoOwner`, `DemoBreakdown` and `DemoView`. Its public surface is:
- `new RoundDemo(scriptIds: readonly [string, string], deckCode?: string)` — throws for an unknown script or
  one without `playerDiscard` / `playerPlays`;
- `view(): DemoView`, `advance(): void`, `back(): void`, `reset(): void`.

`DemoView` fields, all of them plain data:
`handNumber` (`1 | 2`), `stage` (`"deal" | "discard" | "starter" | "pegging" | "show" | "done"`), `phase`
(a `RoundPhase`), `coach`, `playerHand`, `opponentHand`, `crib`, `starter`, `trick`
(`ReadonlyArray<{ card: PCard; by: "you" | "opponent" }>`), `lastTrick` (same shape), `lastTrickReason`,
`count`, `dealer`, `scores` (`{ player, opponent }`, cumulative across both hands),
`pegPoints` (`{ player: number[]; opponent: number[] }`), `breakdown`
(`{ title, hand, starter, isCrib, total } | null`), `log` (`RoundLogEntry[]`), `beatIndex`, `atStart`,
`atEnd`.

Components available from earlier phases, to be reused rather than re-implemented:
- `src/components/tutorial/TrickRow.tsx` — props
  `{ cards: ReadonlyArray<{ card: PCard; by: "you" | "opponent" }>; count: number; label?: string;
  previous?: { cards: ReadonlyArray<{ card: PCard; by: "you" | "opponent" }>; reason: string } }`.
  Renders one horizontal `<ul className="peg-sequence">` with a `.count-chip`, names each card's owner in
  text, and animates only the newest card of the main row.
- `src/components/tutorial/TutorialBoard.tsx` — props
  `{ playerPegPoints: ReadonlyArray<number>; opponentPegPoints: ReadonlyArray<number>; playerScore: number;
  opponentScore: number }`. Renders `CribbageBoard` inside a scaled, clipped, `position: relative` frame plus
  a `You N · Them M` line.

Existing components to reuse for the rest of the table:
- `src/components/tutorial/SelectableHand.tsx` — `SelectableHand` accepts
  `{ deck, label, mode, cards, onToggle? }`. Passing `mode="none"` renders a non-interactive fieldset of card
  faces. `src/components/tutorial/GuidedRoundView.tsx` shows the call shape; each entry is
  `{ card: { suit, rank }, cardId, state: "idle" }` and `cardId` comes from
  `cardKey(specToCard([suit, rank]))`.
- `src/components/ScoreExplanation.tsx` — `ScoreExplanation` accepts
  `{ hand: Array<PCard>; starter: PCard | null; isCrib: boolean; total: number; title?: string;
  variant?: "compact" | "list" }` and derives its own group list with `scoreHandDetailed`. Pass
  `variant="list"` for the show breakdowns.

`src/components/tutorial/RoundMap.tsx` currently takes only `{ current?: RoundPhase | null }` and renders an
`<ol className="roundmap">` of the six phases. `src/components/tutorial/TutorialShell.tsx` renders it as
`<RoundMap current={mapPhase ?? highlightFor(lesson, state)} />` and accepts `mapPhase?: RoundPhase`,
`coachOverride?: string` and `workspaceExtra?: ReactNode` props.

`src/screens/Lesson.tsx` already demonstrates the pattern this phase copies for the demo. For a
`guided-round` step it keeps `const roundRef = useRef<GuidedRound | null>(null)`, a
`const [roundView, setRoundView] = useState(0)` counter, an effect that constructs the round when
`step?.kind === "guided-round"` and nulls the ref otherwise, and then passes
`coachOverride={...roundRef.current?.view().coach}`, `mapPhase={...roundRef.current?.view().phase}` and a
`workspaceExtra={<GuidedRoundView key={roundView} … onChange={() => setRoundView((n) => n + 1)} />}`.

Lesson 1 today is `BEGINNER_PATH[0]` in `src/features/tutorial/lessonCatalog.ts`:
`id: "shape-of-a-round"`, `title: "The shape of a round"`, `estimatedMinutes: 2`, ten `concepts`, and six
steps with ids `shape-deal`, `shape-discard`, `shape-pegging`, `shape-show` (four `round-map` steps),
`shape-board` (an `explain`) and `shape-recap` (a `recap`).

Constraints that the new structure must satisfy, all verified in
`src/features/tutorial/validateCatalog.ts`:
- the final step of every lesson must be `recap` or `checkpoint`;
- every step id must be unique across the whole catalog;
- `teachesConcepts` returns `lesson.concepts` for an `explain` or `round-map` step and `step.concepts` for a
  `recap`, and returns `[]` for `round-demo`. Lesson 1 must therefore keep at least one `explain` step so it
  still counts as the teaching lesson for its ten concepts — otherwise the `checkpoint-order` rule fails for
  every concept assessed in lessons 2 to 7.

Decisions **D3** and **D4** apply, restated in full. **D3:** the learner clicks once per beat — twelve clicks
to deal each hand, then one per discard round, cut, played card and show count — and a `Back` control
re-watches the previous beat. The learner never discards or plays in the demonstration. **D4:** lesson 1's
`estimatedMinutes` becomes `8`, taking the beginner-path total from 27 to 33 minutes. That is still inside the
landing promise on `src/screens/Learn.tsx`, so the promise copy and its assertion in
`src/screens/Learn.test.tsx` are **not** changed.

Decision **D1** applies, restated in full: **no timers.** No `setTimeout`, `setInterval`,
`requestAnimationFrame`, `matchMedia` call, auto-advance or `Play it for me` control. All motion comes from
the existing `.selectable-card.is-played` CSS animation, already guarded by
`@media (prefers-reduced-motion: no-preference)` in `src/App.css`, which `TrickRow` applies to the newest
card.

Existing tests this phase must update:
- `src/screens/Lesson.test.tsx` `"persists every skipped step id, not only the last one in the lesson (defect 2)"`
  asserts `skippedStepIds` contains `"shape-deal"` then `"shape-discard"`. Both ids disappear.
- `src/screens/Lesson.test.tsx` `"does not award concept mastery just for opening a passive step (defect 1)"`
  carries a comment saying lesson 1 opens on a `round-map` step. The assertion
  (`conceptMastery` is `{}`) still holds because the new first step is an `explain`, which is also passive and
  unassessed; only the comment needs correcting.
- `src/features/tutorial/tutorialReducer.test.ts` builds its fixture with `findLesson("shape-of-a-round")`.
  Read it before editing and adjust any assertion that depends on lesson 1 having six steps.

### Steps

1. **`src/components/tutorial/RoundMap.tsx` — add an optional caption.**
   Add `caption?: string` to `RoundMapProps`. When it is a non-empty string, render
   `<p className="roundmap-caption">{caption}</p>` immediately after the `<ol className="roundmap">`, wrapping
   both in a `<>…</>` fragment. When it is absent, the output is byte-identical to today's. Do not change the
   phase list, the `done` class, or the `aria-current` handling.

2. **`src/components/tutorial/TutorialShell.tsx` — pass the caption through.**
   Add `mapCaption?: string` to `TutorialShellProps` and forward it as
   `<RoundMap current={mapPhase ?? highlightFor(lesson, state)} caption={mapCaption} />`. Change nothing else
   in this file.

3. **Create `src/components/tutorial/RoundDemo.tsx`.** Export
   `export type RoundDemoProps = { demo: RoundDemo; view: DemoView; onChange: () => void }` and
   `export function RoundDemo_View(props)` — name the component `RoundDemoView` to avoid colliding with the
   `RoundDemo` class imported from `../../features/tutorial/roundDemo`. It renders, in this order:

   1. a `<p className="meta">` reading `` `Hand ${view.handNumber} of 2 — ${view.dealer === "you" ? "you deal" : "they deal"}.` ``;
   2. the opponent's cards as a `SelectableHand` with `mode="none"` and
      `label="Their cards"`, always face up;
   3. the crib as a `SelectableHand` with `mode="none"` and `label="The crib"`, rendered only when
      `view.crib.length > 0`;
   4. the starter as a `SelectableHand` with `mode="none"` and `label="Starter"`, rendered only when
      `view.starter` is not `null`;
   5. the learner's cards as a `SelectableHand` with `mode="none"` and `label="Your cards"`;
   6. `<TrickRow cards={view.trick} count={view.count} label="On the table" previous={view.lastTrick.length > 0 ? { cards: view.lastTrick, reason: view.lastTrickReason } : undefined} />`,
      rendered only when `view.trick.length > 0 || view.lastTrick.length > 0`;
   7. the navigation row (step 4 below) — it must be the first interactive element after the table;
   8. `<TutorialBoard playerPegPoints={view.pegPoints.player} opponentPegPoints={view.pegPoints.opponent} playerScore={view.scores.player} opponentScore={view.scores.opponent} />`;
   9. `<ScoreExplanation hand={[...view.breakdown.hand]} starter={view.breakdown.starter} isCrib={view.breakdown.isCrib} total={view.breakdown.total} title={view.breakdown.title} variant="list" />`,
      rendered only when `view.breakdown` is not `null`. Spread the hand into a new array because
      `ScoreExplanationProps.hand` is `Array<PCard>`, not a readonly array;
   10. the running log as `<ul className="roundlog">` with one `<li key={entry.id}>` per `view.log` entry
       reading `` `${entry.who === "you" ? "You" : "They"}: ${entry.text}` `` and, when `entry.points > 0`,
       `` ` — ${entry.points}` ``. Mirror the markup `GuidedRoundView.tsx` already uses for its log.

   Use `const deck = new StdDeck("rc")` at module scope for the `SelectableHand` `deck` prop, exactly as
   `GuidedRoundView.tsx` and `DiscardExercise.tsx` do. Build each `cardId` with
   `cardKey(specToCard([card.suit, card.rank]))`.

4. **`src/components/tutorial/RoundDemo.tsx` — the navigation row.**
   Render `<div className="btn-row">` containing exactly three controls:
   - `Back one step` — `type="button"`, `className="btn btn-outline-light"`, `disabled={view.atStart}`,
     `onClick={() => { demo.back(); onChange() }}`;
   - `Start again` — `type="button"`, `className="btn btn-outline-secondary"`,
     `onClick={() => { demo.reset(); onChange() }}`;
   - the primary advance button — `type="button"`, `className="btn btn-warning"`, `disabled={view.atEnd}`,
     `onClick={() => { demo.advance(); onChange() }}`, whose label depends on `view.stage`:
     `"deal"` → `Deal the next card`; `"discard"` → `Cut for the starter`; `"starter"` → `Start the play`;
     `"pegging"` → `Play the next card`; `"show"` → `Count the next hand`; `"done"` → `The demonstration is
     over`.

   Add no other buttons. The coach sentence is not rendered here — `Lesson.tsx` feeds `view.coach` to the
   coach panel through `coachOverride`.

5. **Create `src/components/tutorial/RoundDemo.test.tsx`.** Add a `describe("RoundDemoView")` with:
   - `it("labels the advance button for the current stage", …)` — construct
     `new RoundDemo(["demo-hand-1", "demo-hand-2"])`, render with its `view()`, and assert
     `screen.getByRole("button", { name: /deal the next card/i })` exists and
     `screen.getByRole("button", { name: /back one step/i })` is disabled.
   - `it("advances the demo and reports the change", …)` — render with a `vi.fn()` `onChange`, click
     `Deal the next card`, and assert `onChange` was called once and the underlying `demo.view().beatIndex`
     is `1`.
   - `it("shows both hands face up and names each played card's owner", …)` — advance the demo past the
     starter and two plays, rerender, and assert both `Your cards` and `Their cards` fieldsets are present
     (`screen.getByRole("group", { name: /your cards/i })` and `/their cards/i`) and that the trick row names
     the six of diamonds as played by you.
   - `it("renders a show breakdown whose total is the engine's total", …)` — advance to hand 1's first show
     beat and assert the rendered breakdown title is `Your hand` and that the text `8` appears within it.
   - `it("renders the cribbage board with the cumulative score", …)` — drive to `atEnd` in a loop bounded at
     200 iterations and assert the board line reads `You 36 · Them 25`.

6. **`src/features/tutorial/lessonCatalog.ts` — replace Lesson 1's steps.**
   In `BEGINNER_PATH[0]`, keep `id: "shape-of-a-round"`, `title: "The shape of a round"` and the ten
   `concepts` exactly as they are. Change `estimatedMinutes` from `2` to `8`. Replace all six steps with
   exactly three:

   ```ts
   { kind: "explain", id: "shape-intro", title: "One round, start to finish", highlight: "deal", body: [
     "Cribbage is a two-player race to 121 points, played in rounds. Each round has six parts: the deal, the discard, the starter, the play, the show, and the crib.",
     "Rather than list them, the next screen deals two whole hands in front of you, one card and one decision at a time. Nothing is asked of you — press the button to see the next thing happen.",
     "Watch for one thing in particular. Between the first hand and the second, the deal passes over, and with it the crib and the order of counting.",
   ] },
   { kind: "round-demo", id: "shape-demo", scriptIds: ["demo-hand-1", "demo-hand-2"] },
   { kind: "recap", id: "shape-recap", concepts: ["round-flow", "count-order"], body: [
     "A round runs deal, discard, starter, play, show, crib.",
     "The non-dealer counts first, then the dealer, then the crib. The crib belongs to whoever dealt.",
     "The deal alternates, so both of those jobs swap every hand.",
   ] },
   ```

   The ids `shape-deal`, `shape-discard`, `shape-pegging`, `shape-show` and `shape-board` disappear.
   `shape-recap` is deliberately reused so no persisted step id is orphaned.

7. **`src/screens/Lesson.tsx` — hold a demo instance.**
   Import `RoundDemo` from `../features/tutorial/roundDemo` and `RoundDemoView` from
   `../components/tutorial/RoundDemo`. Add `const demoRef = useRef<RoundDemo | null>(null)` and
   `const [demoView, setDemoView] = useState(0)` beside the existing `roundRef` / `roundView`. Add an effect,
   modelled exactly on the existing `guided-round` effect, that constructs
   `new RoundDemo(step.scriptIds)` into `demoRef.current` when `step?.kind === "round-demo"` and
   `!demoRef.current` (then calls `setDemoView((n) => n + 1)`), and sets `demoRef.current = null` otherwise.

8. **`src/screens/Lesson.tsx` — render it.**
   Extend the props passed to `TutorialShell`:
   - `coachOverride` becomes `step?.kind === "guided-round" ? roundRef.current?.view().coach : step?.kind === "round-demo" ? demoRef.current?.view().coach : undefined`;
   - `mapPhase` gains the same third branch returning `demoRef.current?.view().phase`;
   - add `mapCaption={step?.kind === "round-demo" && demoRef.current ? `Hand ${demoRef.current.view().handNumber} of 2` : undefined}`;
   - `workspaceExtra` gains a branch that renders, when `step?.kind === "round-demo" && demoRef.current`,
     `<RoundDemoView key={demoView} demo={demoRef.current} view={demoRef.current.view()} onChange={() => setDemoView((n) => n + 1)} />`.

   Do not dispatch anything from `onChange` — the step is passive and already `complete`, so there is no
   completion signal to send.

9. **`src/screens/Lesson.test.tsx` — update the two lesson-1 tests.**
   - In `"persists every skipped step id, not only the last one in the lesson (defect 2)"`, change the two
     expected ids from `"shape-deal"` / `"shape-discard"` to `"shape-intro"` / `"shape-demo"`, and change the
     `arrayContaining` argument to `["shape-intro", "shape-demo"]`. Update the inline comment from
     `"Step 0 (round-map) is not the last step of the lesson."` to
     `"Step 0 (explain) is not the last step of the lesson."`.
   - In `"does not award concept mastery just for opening a passive step (defect 1)"`, change the comment
     `"Lesson 1 opens on a round-map step"` to `"Lesson 1 opens on an explain step"`. Leave the assertion
     alone.

10. **`src/screens/Lesson.test.tsx` — add a demonstration test.**
    Add `it("walks the lesson-1 demonstration into the deal", …)` which renders `renderLesson("shape-of-a-round")`,
    clicks `Next` once to reach the `round-demo` step, asserts `screen.getByText(/Hand 1 of 2/)` is present and
    that the primary button reads `Deal the next card`, clicks it twelve times, and then asserts the primary
    button reads `Cut for the starter` after one further click. Use the existing `renderLesson` helper at the
    top of the file.

11. **`src/features/tutorial/catalog.test.ts` — freeze the lesson-1 shape and the time promise.**
    Add `it("lesson 1 is an explain, a two-hand demonstration and a recap", …)` asserting
    `BEGINNER_PATH[0].steps.map((s) => s.kind)` deep-equals `["explain", "round-demo", "recap"]`, that the
    middle step's `scriptIds` deep-equals `["demo-hand-1", "demo-hand-2"]`, and that
    `BEGINNER_PATH[0].estimatedMinutes` is `8`.
    Add `it("the beginner path still fits inside about half an hour", …)` asserting
    `BEGINNER_PATH.reduce((s, l) => s + l.estimatedMinutes, 0)` is at most `35`.

12. **`src/App.css` — style the map caption.** Add a `.roundmap-caption` rule with
    `font-size: 0.8rem; color: #d9c48a; margin: 0.3rem 0 0;` next to the existing `.roundmap` rules. Add no
    other CSS in this phase.

### Do NOT

- Do not add any timer, `matchMedia` call, auto-advance, or `Play it for me` control (decision D1).
- Do not modify `src/features/tutorial/roundDemo.ts`, `src/features/tutorial/guidedRound.ts`,
  `src/components/tutorial/TrickRow.tsx`, `src/components/tutorial/TutorialBoard.tsx`,
  `src/components/CribbageBoard.tsx`, `src/components/ScoreExplanation.tsx`, or
  `src/components/tutorial/SelectableHand.tsx`.
- Do not let the learner discard or play in the demonstration; there are exactly three buttons, listed in
  step 4.
- Do not change lesson 1's `id`, `title` or `concepts`, and do not remove its `explain` step — dropping it
  breaks the `checkpoint-order` validation for every concept lessons 2 to 7 assess.
- Do not reuse the step ids `shape-deal`, `shape-discard`, `shape-pegging`, `shape-show` or `shape-board` for
  anything, and do not rename `shape-recap`.
- Do not change the beginner-path promise copy in `src/screens/Learn.tsx` or its assertion in
  `src/screens/Learn.test.tsx` (decision D4).
- Do not change any other lesson's `estimatedMinutes`.
- Do not touch `src/features/tutorial/scenarios.ts` — the decks are already correct.
- Do not import `thePlayer` in any file this phase touches other than the pre-existing import in
  `src/screens/Lesson.tsx`, which is only for the Easy-game handoff.
- Do not dispatch a reducer action from `RoundDemoView`.

### Definition of done

- [ ] `npx vitest run` passes with zero failures, including `src/features/tutorial/catalog.test.ts`,
      `src/screens/Lesson.test.tsx` and `src/screens/Learn.test.tsx`.
- [ ] `npm run lint` reports zero problems.
- [ ] `npm run build` succeeds.
- [ ] `rg -n "shape-deal|shape-discard|shape-pegging|shape-show|shape-board" src/` returns no matches.
- [ ] `rg -n "setTimeout|setInterval|requestAnimationFrame|matchMedia" src/components/tutorial/RoundDemo.tsx src/screens/Lesson.tsx`
      returns no matches.
- [ ] `src/components/tutorial/RoundDemo.test.tsx` exists and contains all five named tests from step 5.
- [ ] `src/features/tutorial/catalog.test.ts` contains
      `"lesson 1 is an explain, a two-hand demonstration and a recap"` and
      `"the beginner path still fits inside about half an hour"`.
- [ ] Manual: `npm start`, `http://localhost:3000/learn`. The first lesson card reads `8 min`.
- [ ] Manual: click the first lesson card. The workspace shows the heading `One round, start to finish` and
      three paragraphs; the footer reads `Step 1 of 3`. Click `Next`.
- [ ] Manual: the demonstration appears. It reads `Hand 1 of 2 — they deal.`, the round map caption reads
      `Hand 1 of 2`, the coach reads `Six cards each, dealt one at a time, starting with the player who is not
      dealing. They deal this hand, so you are the non-dealer.`, and `Back one step` is disabled. Press
      `Deal the next card` twelve times: your row fills to six cards and theirs to six.
- [ ] Manual: press `Cut for the starter`. Four cards appear under `The crib`. Press it again (now labelled
      `Cut for the starter`) — the starter `10♠` appears and the coach says nobody scores his heels.
- [ ] Manual: press `Play the next card` eight times. The cards land one at a time in a single horizontal row
      with owners named, the count chip climbs, the log gains `You: Run of three` worth 3, then a 31 worth 2
      to them, and after the reset the finished trick stays on screen dimmed with a sentence containing `31`.
- [ ] Manual: press `Count the next hand` three times. The breakdowns read `Your hand` total 8, `Their hand`
      total 4, `Their crib` total 5.
- [ ] Manual: press the primary button once more. The caption becomes `Hand 2 of 2`, the header line reads
      `Hand 2 of 2 — you deal.`, and the board shows `You 11 · Them 12`. Walk hand 2 the same way: the starter
      is `J♥`, the coach names his heels paying you 2, and the three breakdowns read `Their hand` 8,
      `Your hand` 14, `Your crib` 8.
- [ ] Manual: at the end the primary button reads `The demonstration is over` and is disabled, the board reads
      `You 36 · Them 25`, and the coach reads `That is two whole hands. The deal, the crib and the counting
      order all swapped between them.` Press `Back one step`; the demonstration returns to the previous beat.
      Press `Next` in the footer to reach the recap.

### Rollback note

Revert `src/features/tutorial/lessonCatalog.ts`, `src/screens/Lesson.tsx`,
`src/components/tutorial/TutorialShell.tsx`, `src/components/tutorial/RoundMap.tsx`, `src/App.css`,
`src/screens/Lesson.test.tsx` and `src/features/tutorial/catalog.test.ts`, and delete
`src/components/tutorial/RoundDemo.tsx` and `src/components/tutorial/RoundDemo.test.tsx`. Lesson 1 returns to
its five static slides; Phases 1 to 10 are unaffected.

---

## Phase 12 — Navigation and orientation pass

**Implements RM-7 items a–h** (traces to U6; keeps R6, R8, R10). **Requires Phase 11 complete.**

### Goal

Make the lesson shell orient the learner: the workspace heading names the current activity, the header and the
progress bar agree, `Back` preserves work, `Skip` looks and reads like a secondary action, every lesson ends on
a completion screen, the coached round's primary control comes before its destructive one, completed round-map
phases are announced rather than just coloured, and step 0 offers a way out instead of a disabled button.

### Context

Eight verified defects, each addressed by one step below.

**(a) The workspace heading is hard-coded.** `src/components/tutorial/TutorialShell.tsx` renders
`<h2 id="workspace-heading">Your hand</h2>` for every step kind, including `explain`, `round-map`, `recap`,
`guided-round` and `round-demo`. The page must keep exactly one `<h1>` (the lesson title) and exactly one
`<h2 id="workspace-heading">`; the existing test
`"renders exactly one h1 and shows step count"` in `src/components/tutorial/TutorialShell.test.tsx` asserts the
`<h1>` count and must keep passing.

**(b) Header and progress bar disagree.** The header renders
`<span className="tutorial-stepmeta stepcount" aria-label={`Step ${state.stepIndex + 1} of ${lesson.steps.length}`}>`
— 1-based. The footer renders
`<ProgressBar now={percent} label={`${state.stepIndex} of ${lesson.steps.length} steps · ${percent}%`} />`
with `const percent = Math.round((state.stepIndex / Math.max(1, lesson.steps.length)) * 100)` — 0-based, so
step 1 of 6 sits above `0 of 6 steps · 0%`.

**(c) `Back` destroys work.** `src/features/tutorial/tutorialReducer.ts` `case "back"` returns
`step: emptyStepState(lesson.steps[prev])`, and `advance` likewise builds the next step with
`emptyStepState(lesson.steps[nextIndex])`. Every counted group, the earned total, the hint level and the
attempt count on the step you leave are discarded, so `Back` then `Next` restarts the step from scratch.
`RunnerState` today is
`{ lessonId, stepIndex, step, completedStepIds, lessonComplete, lastSkippedStepId }`.

**(d) `Skip this step` is an unstyled link beside the primary button.** It is
`<button type="button" className="btn-link" onClick={() => dispatch({ type: "skip" })}>Skip this step</button>`
sitting inside the same `.tutorial-footer-actions btn-row` as the `Next` button, with no indication that
skipping does not count as completion.

**(e) Quick Practice lessons show no completion screen.** `src/screens/Lesson.tsx` has two completion
branches: `state.lessonComplete && isLast` (the readiness screen) and `state.lessonComplete && nextId` (the
`{title} complete` card). For a `QUICK_PRACTICE` lesson, `nextLessonId(id)` returns `undefined` because
`lessonIndex` searches `BEGINNER_PATH` only, and `isLast` is
`lesson.id === lastBeginnerLessonId || (!nextId && BEGINNER_PATH.some((item) => item.id === lesson.id))`, whose
second clause is false for the same reason. Both branches are skipped, so the shell stays on the last step and
`Next` silently navigates to `/learn`. The three `QUICK_PRACTICE` lesson ids are
`count-a-hand-practice`, `peg-practice` and `cribbage-quirks`.

**(f) The coached round's destructive control competes with its primary one.** In
`src/components/tutorial/GuidedRoundView.tsx` the pause controls (`Confirm two discards`, `Play this card`,
`Let them play`, `Count selected cards`, `Show me the count`, `Continue`) sit in the middle of the component
while `Restart this round` sits below the round log.

**(g) Completed round-map phases are colour-only.** `src/components/tutorial/RoundMap.tsx` marks a finished
phase with `className={done ? "done" : undefined}` and adds visually-hidden text only for the current phase
(`<span className="visually-hidden"> — current phase</span>`). `src/screens/Learn.tsx` already shows the
pattern to copy: a `<span className="mark" aria-hidden="true">` glyph beside a `<span className="visually-hidden">`
status word.

**(h) Step 0 has no way back, and `Exit` looks like `Rules`.** The footer renders
`<Button variant="outline-light" onClick={() => dispatch({ type: "back" })} disabled={state.stepIndex === 0}>Back</Button>`,
and the header renders `Rules` and `Exit` as two identical `variant="outline-light"` buttons. `TutorialShell`
already receives an `onExit: () => void` prop, which `src/screens/Lesson.tsx` supplies as
`() => navigate("/learn")`.

Step kinds that exist after Phase 11, for the heading map: `explain`, `round-map`, `score-example`,
`score-practice`, `discard-practice`, `peg-practice`, `guided-round`, `round-demo`, `checkpoint`, `recap`.

`src/components/tutorial/TutorialShell.tsx` already computes a `scenario` memo that resolves to the current
`ScoreScenario`, `DiscardScenario` or `PegScenario` (or `undefined`), including for a `checkpoint` step via
`step.scenarioIds[state.step.subIndex]`. Reuse it; do not add a second lookup.

Existing tests that this phase must update:
- `src/components/tutorial/TutorialShell.test.tsx`
  `"disables Back on the first step and Next while a graded step is in-progress"` asserts
  `screen.getByRole("button", { name: "Back" })` is disabled on step 0. Step 0's button is being relabelled.
- `src/components/tutorial/RoundMap.test.tsx` — read it before editing; it may assert the current markup.
- `src/features/tutorial/tutorialReducer.test.ts` — `RunnerState` gains a field, so any test constructing a
  literal `RunnerState` needs the new field.

R10 must be preserved: skipping still must not award mastery. That logic lives in `src/screens/Lesson.tsx`'s
`lastSkippedStepId` effect, which records `{ correct: false, hintLevel: 0 }`, and must not change.

### Steps

1. **(a) `src/components/tutorial/TutorialShell.tsx` — name the activity.**
   Add a module-level function
   `function workspaceHeading(step: TutorialStep, scenario: ReturnType<...> | undefined): string` (import
   `TutorialStep` as a type from `../../features/tutorial/tutorialTypes`) returning:
   - `explain`, `round-map` → `step.title`
   - `recap` → `"Recap"`
   - `score-example` → `"Watch this count"`
   - `score-practice` → `"Count this hand"`
   - `discard-practice` → `"Throw two cards to the crib"`
   - `peg-practice` → `"The play"`
   - `guided-round` → `"A coached round"`
   - `round-demo` → `"A demonstration round"`
   - `checkpoint` → `"Count this hand"` when the resolved `scenario` has a `hand` field and an `isCrib` field,
     `"Throw two cards to the crib"` when it has an `isPlayerCrib` field, `"The play"` when it has a `task`
     field, and `"Checkpoint"` otherwise.

   Replace `<h2 id="workspace-heading">Your hand</h2>` with
   `<h2 id="workspace-heading">{workspaceHeading(step, scenario)}</h2>`. Use `"Throw two cards to the crib"`
   verbatim — it must not duplicate the `SelectableHand` legend text
   `Choose two cards for your crib` / `Choose two cards for their crib` rendered by
   `src/components/tutorial/DiscardExercise.tsx`, or accessible-name queries in the existing tests become
   ambiguous.

2. **(b) `src/components/tutorial/TutorialShell.tsx` — make the progress bar agree with the header.**
   Change `percent` to `Math.round(((state.stepIndex + 1) / Math.max(1, lesson.steps.length)) * 100)` and the
   `ProgressBar` label to `` `Step ${state.stepIndex + 1} of ${lesson.steps.length} · ${percent}%` ``. Leave
   the header `<span>`'s `aria-label` and visible text exactly as they are, so both now report the same 1-based
   step number.

3. **(c) `src/features/tutorial/tutorialReducer.ts` — keep per-step state keyed by step id.**
   - Add `stepStates: Readonly<Record<string, StepState>>` to the exported `RunnerState` type, documented as
     "state for every step the learner has left, so `Back` and `Next` restore work instead of discarding it".
   - Initialise it to `{}` in `initialRunnerState`.
   - In `advance(lesson, state, mark)`, compute
     `const stepStates = { ...state.stepStates, [state.step.stepId]: { ...state.step, status: mark } }`,
     include it in **both** return objects, and change the non-terminal return's `step` from
     `emptyStepState(lesson.steps[nextIndex])` to
     `state.stepStates[lesson.steps[nextIndex].id] ?? emptyStepState(lesson.steps[nextIndex])`.
   - In `case "back"`, when `state.stepIndex > 0`, save the current step the same way and restore
     `state.stepStates[lesson.steps[prev].id] ?? emptyStepState(lesson.steps[prev])`.
   - In `case "restart-step"`, additionally return a `stepStates` object with the current `state.step.stepId`
     key removed, so restarting really clears the saved copy.
   - `case "restart-lesson"` already returns `initialRunnerState(lesson, 0)`, which now clears `stepStates`;
     leave it alone.

4. **(h) `src/features/tutorial/tutorialReducer.ts` — make step-0 `back` inert.**
   Change the `state.stepIndex === 0` branch of `case "back"` from
   `return { ...state, step: emptyStepState(step) }` to `return state`. Step 0's `Back` is being replaced in
   the UI by a link out to `/learn`, so this branch becomes unreachable; returning the state unchanged means a
   stray dispatch can no longer wipe the learner's work.

5. **(d) `src/components/tutorial/TutorialShell.tsx` — make `Skip` a visible secondary action.**
   Replace the `btn-link` skip button with
   `<Button variant="outline-secondary" onClick={() => dispatch({ type: "skip" })}>Skip this step</Button>`
   and add, immediately before it inside `.tutorial-footer-actions`,
   `<span className="skip-note">Skipping does not count as completed.</span>`. Keep the dispatched action
   exactly `{ type: "skip" }` and keep the accessible name exactly `Skip this step`, because several existing
   tests click `getByRole("button", { name: /skip this step/i })`.

6. **(h) `src/components/tutorial/TutorialShell.tsx` — give step 0 a way out, and separate `Exit`.**
   Replace the footer `Back` button with a conditional: when `state.stepIndex === 0`, render
   `<Button variant="outline-light" onClick={onExit}>Back to Learn</Button>`; otherwise render the existing
   `<Button variant="outline-light" onClick={() => dispatch({ type: "back" })}>Back</Button>` with **no**
   `disabled` prop. In the header, change the `Exit` button's variant from `outline-light` to `secondary`,
   leaving `Rules` as `outline-light`.

7. **(g) `src/components/tutorial/RoundMap.tsx` — announce completed phases.**
   Inside the `<li>`, when `done` is `true`, render `<span className="mark" aria-hidden="true">✓</span>`
   immediately before the `<span className="step">`, and add
   `<span className="visually-hidden"> — completed</span>` inside the `<span className="step">` after the
   label. Keep the `done` class, the `aria-current="step"` attribute, the `— current phase` text and the
   `caption` prop added in Phase 11 exactly as they are.

8. **(f) `src/components/tutorial/GuidedRoundView.tsx` — order the controls.**
   Move the JSX block that renders the current pause's controls so that it is the first interactive element
   after the element rendered by `<TrickRow …>`, ahead of the board, the score meta and the round log. Then
   move `Restart this round` into a `<div className="guided-round-secondary">` placed after the round log, and
   change its class from whatever it has to `btn btn-outline-secondary`. Do not change any button's label,
   accessible name, or `onClick`; this step is purely reordering and restyling.

9. **(e) `src/screens/Lesson.tsx` — add the Quick Practice completion screen.**
   Insert a third completion branch **after** the `state.lessonComplete && nextId` branch and **before** the
   final `return <TutorialShell … />`:

   ```tsx
   if (state.lessonComplete) { … }
   ```

   It renders the same `card-surface` shell the `{title} complete` branch uses, with
   `<h1>{lesson.title} complete</h1>`, a `<p>` reading
   `Practice does not change your progress on the beginner path.`, and a `.btn-row` with exactly:
   - `<Button variant="warning" onClick={() => dispatch({ type: "restart-lesson" })}>Practise again</Button>`
   - a `Continue the beginner path` button, rendered only when
     `loadTutorialProgress().completedLessonIds.length < BEGINNER_PATH.length`, navigating to
     `` `/learn/${loadTutorialProgress().currentLessonId ?? BEGINNER_PATH[0].id}` ``
   - `<Button variant="outline-light" onClick={() => navigate("/learn")}>Back to Learn</Button>`

   Because this branch is reached only when neither `isLast` nor `nextId` matched, it cannot shadow the
   readiness screen or the beginner-path hand-off.

10. **`src/App.css` — add the three new rules.** Append, next to the existing `.tutorial-footer` and
    `.roundmap` rules:

    ```css
    .skip-note {
      font-size: 0.75rem;
      color: #d9c48a;
      margin-right: 0.5rem;
    }

    .guided-round-secondary {
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(247, 231, 176, 0.25);
    }

    .roundmap li .mark {
      margin-right: 0.2rem;
      color: #f7e7b0;
    }
    ```

    Do not remove or alter the existing `@media (prefers-reduced-motion: no-preference)` guard around
    `.selectable-card.is-played`.

11. **`src/components/tutorial/TutorialShell.test.tsx` — cover (a), (b), (d) and (h).**
    - Add `it("names the current activity in the workspace heading", …)`: render at step index 0 (the
      fixture's `explain` step, titled `Intro`) and assert the `<h2>` with id `workspace-heading` has text
      `Intro`; then rerender at step index 1 (a `score-practice` step) and assert the same `<h2>` reads
      `Count this hand`. Assert in both cases that `screen.getAllByRole("heading", { level: 1 })` has
      length 1.
    - Add `it("reports the same step number in the header and the progress bar", …)`: render at step index 0
      and assert `screen.getByLabelText(/step 1 of 2/i)` exists and
      `screen.getByText(/Step 1 of 2 · 50%/)` exists.
    - Rewrite `"disables Back on the first step and Next while a graded step is in-progress"` as
      `"offers a way out of step 0 and enables Back afterwards"`: at step index 0 assert there is **no**
      button named exactly `Back`, that a button named `Back to Learn` exists, and that clicking it calls the
      `onExit` spy; at step index 1 assert a button named `Back` exists and is enabled. Keep the two existing
      `Next` assertions (enabled on the passive `explain` step, disabled on the in-progress `score-practice`
      step) inside this test.
    - Add `it("marks Skip as not counting toward completion", …)`: assert
      `screen.getByText(/Skipping does not count as completed\./)` is present and that
      `screen.getByRole("button", { name: /skip this step/i })` still dispatches `{ type: "skip" }`.
    - Leave `"shows the coach prompt for the current step and a single status live region"` untouched; it must
      still find exactly one `role="status"`.

12. **`src/features/tutorial/tutorialReducer.test.ts` — cover (c).**
    Add `it("Back then Next restores the counted groups, earned total, hints and attempts", …)` using
    `findLesson("count-a-hand-practice")` (four `score-practice` steps then a `recap`). Drive step 0
    (`qp-pairs`, scenario `pair-find`) to credit one group with `toggle-card` plus `submit`, capture
    `state.step.found`, `state.step.earned`, `state.step.hintLevel` and `state.step.attempts`, dispatch
    `{ type: "next" }` then `{ type: "back" }`, and assert all four values are identical to the captured ones
    and that `state.stepIndex` is back to `0`.
    Add `it("restart-step clears the saved copy so the step really starts over", …)` asserting that after the
    same setup, `{ type: "restart-step" }` leaves `state.step.found` empty and `state.stepStates` without a
    `qp-pairs` key.

13. **`src/screens/Lesson.tsx` — do not double-record mastery.**
    Because `Back` now restores a completed step, the mastery effect can fire a second time for the same step.
    Add `const recordedStepIds = useRef<Set<string>>(new Set())` and, inside the effect that calls
    `recordConceptAttempt` for a completed assessed step, return early when
    `recordedStepIds.current.has(state.step.stepId)`, and add the id to the set immediately before recording.
    Leave the `prevComplete` ref, the `track("tutorial_step_completed", …)` call, and the whole
    `lastSkippedStepId` skip effect exactly as they are — skipping must keep recording
    `{ correct: false, hintLevel: 0 }` (R10).

14. **`src/screens/Lesson.test.tsx` — cover (e).**
    Add `it("shows a completion screen with three actions after a Quick Practice lesson", …)`:
    `renderLesson("peg-practice")`, click `Skip this step` four times (three `peg-practice` steps then the
    `recap`), click `Next`, then assert a `<h1>` reading `Pegging practice complete`, and buttons named
    `Practise again`, `Continue the beginner path` and `Back to Learn`. Then click `Practise again` and assert
    `screen.getByLabelText(/step 1 of 4/i)` is present.
    Add `it("records a mastery attempt only once even after Back and Next", …)`:
    `renderLesson("count-a-hand-practice")`, solve step 0's two pairs, click `Back`, click `Next`, and assert
    `loadTutorialProgress().conceptMastery.pairs?.attempts` is `1`.

15. **`src/components/tutorial/RoundMap.test.tsx` — cover (g).**
    Add `it("announces completed phases to a screen reader", …)`: render `<RoundMap current="pegging" />` and
    assert `screen.getAllByText(/— completed/)` has length `3` (deal, discard and starter precede pegging) and
    that `screen.getByText(/— current phase/)` is present. Update any existing assertion in the file that
    breaks because of the new `✓` glyph or the new text nodes.

### Do NOT

- Do not add a second `<h1>` or a second `<h2 id="workspace-heading">`, and do not add another
  `role="status"` / `aria-live` region — `src/components/tutorial/CoachPanel.tsx` owns the only one (R6).
- Do not change the accessible name of `Skip this step`, `Next`, `Rules`, `Confirm two discards`,
  `Play this card`, `Let them play`, `Count selected cards`, `Show me the count` or `Continue`; existing tests
  query them by name.
- Do not change the mastery or skip accounting in `src/screens/Lesson.tsx` beyond adding the
  `recordedStepIds` guard: skipping must still record `{ correct: false, hintLevel: 0 }` and must never award
  independent-correct credit (R10).
- Do not make `Back` clear `state.step` in any code path.
- Do not change `isAssessedStepKind`, `stepConcepts`, `passiveKind`, `emptyStepState`'s field list, or
  `finishOrAdvanceCheckpoint`.
- Do not change the readiness screen or the `{title} complete` branch in `src/screens/Lesson.tsx`; add the
  third branch after them.
- Do not modify `src/features/tutorial/lessonCatalog.ts`, `src/features/tutorial/scenarios.ts`,
  `src/features/tutorial/roundDemo.ts`, `src/features/tutorial/guidedRound.ts`,
  `src/features/tutorial/tutorialGrading.ts`, or `src/app/game.ts`.
- In `src/components/tutorial/GuidedRoundView.tsx`, reorder and restyle only. Do not change any label,
  handler, gate condition or piece of state.
- Do not change the beginner-path promise copy in `src/screens/Learn.tsx`.
- Do not add a timer or an animation (decision D1), and do not remove the existing
  `@media (prefers-reduced-motion: no-preference)` guard in `src/App.css`.

### Definition of done

- [ ] `npx vitest run` passes with zero failures.
- [ ] `npm run lint` reports zero problems.
- [ ] `npm run build` succeeds.
- [ ] `rg -n "Your hand<" src/components/tutorial/TutorialShell.tsx` returns no matches.
- [ ] `rg -n "role=\"status\"|aria-live" src/components/tutorial/` matches only `CoachPanel.tsx`.
- [ ] `src/components/tutorial/TutorialShell.test.tsx` contains
      `"names the current activity in the workspace heading"`,
      `"reports the same step number in the header and the progress bar"`,
      `"offers a way out of step 0 and enables Back afterwards"` and
      `"marks Skip as not counting toward completion"`.
- [ ] `src/features/tutorial/tutorialReducer.test.ts` contains
      `"Back then Next restores the counted groups, earned total, hints and attempts"` and
      `"restart-step clears the saved copy so the step really starts over"`.
- [ ] `src/screens/Lesson.test.tsx` contains
      `"shows a completion screen with three actions after a Quick Practice lesson"` and
      `"records a mastery attempt only once even after Back and Next"`.
- [ ] `src/components/tutorial/RoundMap.test.tsx` contains
      `"announces completed phases to a screen reader"`.
- [ ] Manual: `npm start`, `http://localhost:3000/learn/count-a-hand`. On step 1 the workspace heading reads
      `Watch this count`; the footer reads `Step 1 of 9` and the progress bar reads `Step 1 of 9 · 11%`; the
      first footer button reads `Back to Learn` and clicking it lands on `/learn`.
- [ ] Manual: return to `http://localhost:3000/learn/count-a-hand`, click `Next` to step 2. The heading reads
      `Count this hand`. Count one pair, note the `Counted so far` list, click `Back`, then click `Next`. The
      counted pair and the earned total are still there.
- [ ] Manual: on the same screen the footer shows the sentence `Skipping does not count as completed.` beside
      an outlined `Skip this step` button, and the header's `Exit` button is filled grey while `Rules` is
      outlined.
- [ ] Manual: `http://localhost:3000/learn/peg-practice`. Press `Skip this step` four times then `Next`. A
      screen headed `Pegging practice complete` appears with `Practise again`,
      `Continue the beginner path` and `Back to Learn`.
- [ ] Manual: `http://localhost:3000/learn/coached-round`, click `Next`. In the coached round the pause's
      primary button is the first control below the table, and `Restart this round` sits below the log above a
      horizontal rule, styled grey rather than gold.
- [ ] Manual: on any lesson screen, the round-map strip shows a `✓` before each completed phase.

### Rollback note

Revert `src/components/tutorial/TutorialShell.tsx`, `src/features/tutorial/tutorialReducer.ts`,
`src/components/tutorial/RoundMap.tsx`, `src/components/tutorial/GuidedRoundView.tsx`,
`src/screens/Lesson.tsx`, `src/App.css`, `src/components/tutorial/TutorialShell.test.tsx`,
`src/features/tutorial/tutorialReducer.test.ts`, `src/screens/Lesson.test.tsx` and
`src/components/tutorial/RoundMap.test.tsx`. All functional remediation from Phases 1 to 11 survives; only
navigation polish is lost.

---

## Final acceptance

Run this section once, after Phase 12 is complete. Every command and every check must pass. Do not treat the
remediation as finished while any box is unticked.

### Commands

Run from the repository root, in this order:

```bash
npm install
npm run lint          # must report zero problems
npm run build         # tsc --noEmit && vite build; must exit 0 and write dist/
npx vitest run        # must report zero failing tests and zero unhandled errors
```

- [ ] `npm run lint` exits 0 with no warnings. Unused imports and variables fail lint unless prefixed `_`.
- [ ] `npm run build` exits 0.
- [ ] `npx vitest run` exits 0. The baseline before this remediation was 34 test files and 203 tests passing;
      the final count must be **greater** than that in both files and tests, and **zero** tests may be skipped
      or marked `todo`.

### Repository-wide invariants

Each of these is a single command with a stated required result.

- [ ] No timers were introduced anywhere in the tutorial (decision D1):
      `rg -n "setTimeout|setInterval|requestAnimationFrame|matchMedia" src/features/tutorial/ src/components/tutorial/`
      returns **no matches**.
- [ ] Exactly one live region on a lesson screen (R6):
      `rg -n "role=\"status\"|aria-live" src/components/tutorial/` matches **only**
      `src/components/tutorial/CoachPanel.tsx`.
- [ ] The tutorial never touches the game singleton (R8):
      `rg -n "thePlayer" src/features/tutorial/ src/components/tutorial/` returns **no matches**, and
      `rg -n "thePlayer" src/screens/Lesson.tsx` matches only the Easy-game handoff import and its use inside
      `handoff`.
- [ ] The tutorial derives no answers of its own (R7): `npx vitest run src/features/tutorial/boundary.test.ts`
      passes, and `rg -n "rankPlays" src/features/tutorial/` matches only the boundary assertion inside
      `src/features/tutorial/tutorialGrading.test.ts`.
- [ ] The vertical pegging strip is gone (RM-4):
      `rg -n "className=\"seq\"|className='seq'" src/` returns **no matches**.
- [ ] The dead opponent-chain resolver is gone (RM-4): `rg -n "resolveOpponentTurns" src/` returns **no
      matches**.
- [ ] No hard-coded expected-value magnitudes (decision D11):
      `rg -n "[0-9]+\.[0-9]" src/features/tutorial/scenarios.ts` returns **no matches**.
- [ ] Lesson 1's old static slides are gone (RM-5):
      `rg -n "shape-deal|shape-discard|shape-pegging|shape-show|shape-board" src/` returns **no matches**.
- [ ] The board wrapper, not `CribbageBoard`, absorbed the layout fix (decision D8):
      `git diff --stat -- src/components/CribbageBoard.tsx` shows **no changes** across the whole remediation.
- [ ] Every scripted round and every authored scenario validates:
      `npx vitest run src/features/tutorial/catalog.test.ts` passes, including the whole-catalog
      `validateCatalog()` assertion and the `validateRoundScripts(completeRound)` assertion over all four
      round scripts.
- [ ] The AI's discard behaviour is unchanged (RM-6): `npx vitest run src/app/game.test.ts src/app/gamePlayer.test.ts`
      passes, including the untouched
      `"keeps the frozen Expert discard on a few dozen hands and is 15 descending"` test.

### Manual walkthrough

Run `npm start` and use `http://localhost:3000` in a browser. Work through this list in order, using only
in-page controls — **do not** use the browser's back button at any point. Every step states the exact
observation required.

**Counting (RM-1, RM-9)**

- [ ] Go to `/learn/count-a-hand`, click `Next` to reach the second step (`Count this hand`, scenario
      `pair-find`: `2♥ 2♣ 9♦ 9♠` with starter `K♥`). Select `2♥` and `2♣`, press `Count selected cards`. Both
      twos keep a double border and each shows a `×1` badge. Select `2♥` again — it highlights as selected
      rather than being inert.
- [ ] Press `Clear`. The pending selection empties, the credited pair keeps its `×1` badges and the
      `Counted so far` list still shows the pair. `Clear` is now disabled.
- [ ] Press `Start this count again`. `Counted so far` empties and the earned total returns to 0.
- [ ] Advance to the multi-group scenario and confirm the starter card is selectable and can be part of a
      credited combination.

**Coached rounds (RM-2, RM-3, RM-8)**

- [ ] Go to `/learn/coached-round`, click `Next`. Discard two cards. During the play, each card lands in a
      single horizontal row beside the running count with its owner named in text, and the opponent replies
      only after you press `Let them play`.
- [ ] After a trick ends, the finished trick stays visible, dimmed, above a sentence explaining why it ended
      (either `The count reached 31…` or `Neither player could play…`).
- [ ] At the show, count your own hand: select each combination and press `Count selected cards`. When the
      last group is credited, `Continue` appears. Press it.
- [ ] The opponent's hand breakdown's stated total equals the sum of its own listed lines (not a cumulative
      game score), and so does the crib's.
- [ ] Continue to the end without pressing `Skip this step` or `Restart this round`. The coach reads
      **`The training deal is finished.`**
- [ ] Repeat for `/learn/coached-round-dealer`. It has **two** count pauses — your hand and your crib — and
      both complete. Confirm `Show me the count` also works there.

**Pegging exercise (RM-4)**

- [ ] Go to `/learn/peg-to-31`, reach the fourth step (the `peg-go` play-sequence). The already-played `8♥`
      sits in a single horizontal row beside `Count: 8`, and a small cribbage board reads `You 0 · Them 0`.
- [ ] Play `7♣`. The seven lands alone, the count reads 15, a boxed callout names the fifteen and `2 points to
      you`, the board reads `You 2 · Them 0`, and the primary button now reads `Let them play`.
- [ ] Press `Let them play` once. Exactly one opponent card lands, the count reads 21, and the callout names
      the opponent's run of three.
- [ ] Finish the exchange (`9♠`, `Let them play`, `Say go`). The exercise reports
      `Total from this sequence: 10.`

**Discard lesson (RM-6)**

- [ ] Go to `/learn/crib-and-discard`, click `Next`. The coach prompt names `their crib` and mentions pegging.
- [ ] Throw `J♦` and `Q♥`. The exercise reads `Your throw ranks 1 of 15 for their crib.` and the coach gives
      the authored reason beginning `Best throw.`
- [ ] Press `Show the math`. Two numbers appear with an explicit sign, in the form
      `hand 12.2 minus crib 4.9 = 7.3`, plus the engine's best throw for comparison.
- [ ] Click `Next` to the `discard-yours` step. Throw `J♦` and `Q♥` again: it now reads
      `Your throw ranks 2 of 15 for your crib.`, and `Show the math` reads `plus crib` rather than
      `minus crib`.

**Lesson 1 demonstration (RM-5)**

- [ ] Go to `/learn`. The first lesson card reads `8 min`.
- [ ] Open it. The workspace heading reads `One round, start to finish` and the footer reads `Step 1 of 3`.
      Click `Next`.
- [ ] The demonstration reads `Hand 1 of 2 — they deal.` Press `Deal the next card` twelve times: both rows
      fill to six cards, one card per press.
- [ ] Press the primary button to form the crib (four cards appear), then again to turn the starter `10♠`; the
      coach says nobody scores his heels.
- [ ] Press `Play the next card` eight times. Cards land one at a time in a horizontal row with owners named,
      the count chip climbs, your run of three scores 3, their 31 scores 2, and after the reset the finished
      trick stays visible with a sentence containing `31`.
- [ ] Press `Count the next hand` three times. The breakdowns read `Your hand` **8**, `Their hand` **4**,
      `Their crib` **5**.
- [ ] Press the primary button again. The caption becomes `Hand 2 of 2`, the header line reads
      `Hand 2 of 2 — you deal.`, and the board reads `You 11 · Them 12`.
- [ ] Walk hand 2 the same way. The starter is `J♥`, the coach names his heels paying **you** 2, and the three
      breakdowns read `Their hand` **8**, `Your hand` **14**, `Your crib` **8**.
- [ ] At the end the primary button reads `The demonstration is over` and is disabled, the board reads
      `You 36 · Them 25`, and the coach reads `That is two whole hands. The deal, the crib and the counting
      order all swapped between them.`
- [ ] Press `Back one step`: the demonstration returns to the previous beat. Press `Start again`: it returns to
      an empty deal. Press `Next` in the footer to reach the recap.

**Navigation (RM-7)**

- [ ] On every lesson screen the workspace `<h2>` names the current activity (`Watch this count`,
      `Count this hand`, `Throw two cards to the crib`, `The play`, `A coached round`,
      `A demonstration round`, or the step title) and there is exactly one `<h1>` (the lesson title).
- [ ] On any step the footer progress bar and the header report the same step number, e.g. header
      `Step 1 of 9` and bar `Step 1 of 9 · 11%`.
- [ ] Count one group on a `score-practice` step, press `Back`, then `Next`. The counted group and the earned
      total survive.
- [ ] On step 0 of any lesson the first footer button reads `Back to Learn` and lands on `/learn`.
- [ ] The footer shows `Skipping does not count as completed.` beside an outlined `Skip this step` button, and
      the header's `Exit` is filled grey while `Rules` is outlined.
- [ ] Finish `/learn/peg-practice` by skipping through it. A screen headed `Pegging practice complete` appears
      with `Practise again`, `Continue the beginner path` and `Back to Learn`.
- [ ] The round-map strip shows a `✓` before each completed phase.
- [ ] Walk lessons 1 through 7 in order using only in-page controls. At every screen there is an obvious next
      action and an obvious way out, and no screen dead-ends.

**Regression outside the tutorial**

- [ ] Go to `/play`. Cut for deal, discard two, peg a full hand, complete the show, and start a new game. The
      table behaves exactly as it did before the remediation — no tutorial change may alter the game screen.
- [ ] Reload the page mid-lesson. Progress resumes at the persisted step (`localStorage` key
      `cribbagex.v1`).

### Remediation item traceability

Every item in the specification is implemented. Confirm each row before signing off.

| Item | Phase(s) | Verified by |
| --- | --- | --- |
| RM-1 — counting: card reuse, selectable starter, working `Clear` | 1 | Counting manual checks; `HandScoringExercise.test.tsx`, `SelectableHand.test.tsx` |
| RM-2 — coached round's count pause is submittable | 5 | Coached-round manual checks; `GuidedRoundView.test.tsx` end-to-end block |
| RM-3 — coached round's table, trick retention, opponent pacing | 3, 4 | Coached-round manual checks; `guidedRound.test.ts`, `TrickRow.test.tsx` |
| RM-4 — pegging exercise: row, pacing, callout, board | 6 | Pegging manual checks; `PeggingExercise.test.tsx`, `tutorialGrading.test.ts` |
| RM-5 — Lesson 1 is a two-hand animated demonstration | 9, 10, 11 | Lesson-1 manual checks; `roundDemo.test.ts`, `RoundDemo.test.tsx`, `catalog.test.ts` |
| RM-6 — discard lesson: three axes and two numbers | 7, 8 | Discard manual checks; `game.test.ts`, `tutorialCopy.test.ts`, `DiscardExercise.test.tsx` |
| RM-7 — navigation and orientation (items a–h) | 12 | Navigation manual checks; `TutorialShell.test.tsx`, `tutorialReducer.test.ts`, `Lesson.test.tsx`, `RoundMap.test.tsx` |
| RM-8 — show breakdowns use each hand's own total | 3 | Coached-round breakdown check; `guidedRound.test.ts`, `GuidedRoundView.test.tsx` |
| RM-9 — catalog validation proves every count is reachable | 2 | `catalog.test.ts` reachability check and its negative fixture |

Two pieces of work the specification marks as **optional** are deliberately not implemented, per decision D1
recorded in the preamble: the pegging exercise's `Play at normal speed` auto-pace toggle, and Lesson 1's
`Play it for me` auto-advance. Because there is no auto-advance anywhere, the specification's RM-5 criterion
"auto-advance does not start when `matchMedia('(prefers-reduced-motion: reduce)')` matches" has nothing to
guard and is dropped; the existing reduced-motion guard around `.selectable-card.is-played` in `src/App.css`
is preserved and verified above.
