# CribbageX Interactive Tutorial — Gap Report

**Subject:** the working-tree implementation of the feature specified in `tutorial-plan.md`, tasked out in `detailed-tutorial-implementation-plan.md`, and reported as shipped in `tutorial-implementation.md`.
**Source of truth:** the codebase. Where the code and either document disagree, the code wins and the document is recorded as inaccurate.
**Date:** 14 September 2026
**Baseline:** working tree vs `HEAD` (`a3b577f`). Nothing is committed; the whole feature is uncommitted changes plus untracked files.

---

## 1. Verdict

The feature is **substantially implemented and functionally works**, but it is **under-tested relative to its own plan**, and three user-visible behaviours are wired incorrectly or not wired at all.

| Dimension | Grade | One-line basis |
| --- | --- | --- |
| Completeness (runtime behaviour) | **B+** | All 6 phases landed; both guided rounds complete through the real engine; a live browser walk found no errors (§7.3); 3 features are dead or partial (see §5) |
| Completeness (test coverage vs plan) | **C−** | 16 of 29 named spec test IDs fully met, 8 partial, 5 missing; 5 components have no tests at all |
| Correctness | **B−** | Engine kernel is exact and exhaustively proven; 2 confirmed logic defects in mastery/skip accounting |
| Security | **A−** | Untrusted `localStorage` is properly sanitised; no `dangerouslySetInnerHTML`, no `eval`, no network, no prototype-pollution vector |
| Efficiency | **B** | Hot path protected as designed; one ineffective `useMemo`, one remount-per-interaction pattern |
| Coding standards | **B** | Lint clean, no `any`, no `TODO`, boundaries enforced; duplicate imports, duplicate CSS rules, one mis-cased identifier |
| Accuracy of `tutorial-implementation.md` | **C** | Every positive claim I checked is true, but the document omits all five of the significant gaps and overstates automated coverage |

**Build health (verified, not claimed):**

```
npx vitest run   → 29 files, 148 tests, all passing (3.07s)
npm run lint     → clean
npm run build    → tsc --noEmit + vite build succeed (359 kB JS / 262 kB CSS)
```

The `148 tests` figure in `tutorial-implementation.md` is accurate.

---

## 2. Evidence base

This report is built from four independent sources, not from reading the implementation report:

1. **Direct code reading** of the engine layer (`game.ts`, `entities.ts`, `scoreCopy.ts`, `persistence.ts`, `Lesson.tsx`, `tutorialReducer.ts`, `GroupList.tsx`, `ScoreExplanation.tsx`) and `git diff` of every modified file.
2. **Five parallel area audits** covering Phase 1 ([Phase 1 audit](743aa685-e0c6-414f-bb26-4bd2e67026ee)), Phase 2 ([Phase 2 audit](9f325322-656b-4e9a-8410-31ff95899341)), Phase 3 ([Phase 3 audit](6f12eca4-f670-4e9d-b08c-a186ab382cb5)), Phase 4 ([Phase 4 audit](700f9c46-74a4-4d0e-b3ea-9bcb475ee0d0)), and Phases 5–6 ([Phase 5–6 audit](e40fb706-4a53-4aec-b6eb-38be52fc139b)). Every load-bearing claim from those audits was independently re-verified before inclusion here.
3. **Empirical execution** of both guided-round scripts through the real `CribbageGame` outside the test suite, via throwaway `vite-node` probes (deleted after use). This produced evidence the repository's own tests do not.
4. **A partial live browser pass** against a dev server ([browser smoke test](3868670f-521f-48c0-83ee-44a0e02970ea)), covering the Learn hub, lesson navigation, a graded counting exercise, all three hint tiers, the unknown-id redirect, both guided-round entry points through the pegging phase, and `/play`. Results in §7.3.
5. **Toolchain runs**: `npx vitest run`, `npm run lint`, `npm run build`.

What this report does **not** cover: the *full* browser pass the plan mandates. Several §6.6 items — the three `/play` panels at the show, 200 % zoom, 320 px layout, `prefers-reduced-motion`, the flag-off preview build, and the lesson-7 handoff in a real browser — remain unverified. See §7.3.

---

## 3. Spec test-ID scorecard

The plan (§6.2) says these IDs must not be renamed and must be copied into the PR for the phase that introduces them. Status against the code:

| Fully met (16) | Partially met (8) | Missing (5) |
| --- | --- | --- |
| S-E1, S-E2, S-E3, S-E4, S-E5, S-E6, S-E7, S-E8, S-E9, S-E10, S-C1, S-R4, S-P1, S-P4, S-P5, S-G1 | S-R1, S-R2, S-R3, S-P3, T-B1, T-B2, S-G2, S-G6 | S-C2, S-P2, S-G3, S-G4, S-G5 |

A second convention was also dropped: **no test is named after its spec ID except in Phase 0.** Phase 3 and Phase 5 tests use descriptive names (`"accepts a top-N discard and rejects a worse throw"`), so tracing a spec ID to its test requires reading every file. The plan's §6.2 instruction "do not rename" is not honoured outside `game.detailed.test.ts` and `entities.test.ts`.

---

## 4. Phase-by-phase findings

### Phase 0 — Engine foundation (E1–E5) — **Fully implemented**

This is the best-executed phase in the feature. It is also the phase the plan flagged as highest risk (R1, R2, R3), and all three risks were retired properly.

| Item | Status | Evidence |
| --- | --- | --- |
| E1 `RANK_NAMES` / `SUIT_NAMES` / `cardKey` / `cardName` | ✅ | `src/app/entities.ts:28-62`; additive only — `git diff` shows no change to any class body |
| E2a unconditional clone | ✅ | `src/app/game.ts:141` — `const eH = cutCard ? [...hand, cutCard] : [...hand]` |
| E2b compensating sort in `rankDiscards` | ✅ | `src/app/game.ts:415-419`, placed before `calcExpectedHandScore`, with the stability comment extended as instructed |
| E3 kernel + optional sink | ✅ | `computeHandScore` at `game.ts:132`; `scoreHand` passes **no** sink (`game.ts:266-268`); every allocation site is behind an `if (!sink) return` / `if (sink)` guard (`game.ts:105`) |
| E4 `explainPegPlay` + `doAction` consumption | ✅ | `game.ts:314-367`; `doAction` rewrite at `game.ts:1020-1037` preserves the add-then-rollback order and the `15`/`31`/`run`/`pair` reason tokens |
| E5 `scoreCopy.ts` | ✅ | `src/app/scoreCopy.ts`; **not** imported by `game.ts` (verified by grep); covers exactly the 9 reasons `categoryFor` recognises |
| `categoryFor` exported (O7) | ✅ | `game.ts:630` |
| I2 — `game.test.ts` unmodified | ✅ | `git diff src/app/game.test.ts` shows only an added `S-E9` describe block plus one import; no assertion edited |

**S-E3 is genuinely exhaustive, not sampled.** `game.detailed.test.ts:103-129` enumerates all 6,188 five-rank multisets × 4 suit colourings × both `isCrib` values × both hand shapes, then runs a 50,000-deal seeded random sweep. This is exactly what the plan asked for, and it is the strongest evidence in the repository that the kernel did not change any score.

**Run-equivalence proof comment is present** at `game.ts:194-201`, as required.

Three quality nits, none of them correctness bugs:

1. **`SUIT_FLUSH_NAME` is an identity function with a constant's name.** `game.ts:262-264` is `function SUIT_FLUSH_NAME(suit: Suit): string { return suit }`. `entities.ts` already exports `SUIT_NAMES` for exactly this; the file imports `RANK_NAMES` but not `SUIT_NAMES`. Dead abstraction plus a naming-convention violation.
2. **`countNobs(hand as Array<Card>, cutCard)`** at `game.ts:145` casts away `ReadonlyArray`. Harmless (`countNobs` doesn't mutate) but the cast would be unnecessary if `countNobs` took a `ReadonlyArray`.
3. **S-E10 defeats its own purpose.** The plan wanted `categoryFor` exported "so S-E10 does not duplicate the reason list". `categoryFor` *is* exported and *is* asserted against, but the test still hardcodes the nine reason strings (`game.detailed.test.ts:308-311`). Adding a tenth reason to `categoryFor` would not fail this test.

**Plan requirement not evidenced:** the plan (task 0.2 acceptance, Appendix B) requires the PR to record a measured `rankDiscards` timing before and after the E2a clone. No timing appears anywhere in `tutorial-implementation.md` or in the code comments. The risk (R2) was correctly *mitigated* by the sink design, but it was never *measured* as the plan required.

---

### Phase 1 — Live explanations (U1–U5) — **Mostly implemented, 4 deviations**

| Item | Status | Evidence |
| --- | --- | --- |
| U1 `GroupList` props + `<ol>` + total row | ✅ | `src/components/GroupList.tsx:3-9, 79-99` |
| U1 pair aggregation 3→"Three of a kind — 6", 6→"Four of a kind — 12" | ✅ | `GroupList.tsx:44-58`; underlying ids kept in `groupIds` for highlighting |
| U1 non-colour-only active marker | ✅ | `▸` + visually-hidden `(found)` at `GroupList.tsx:88-90` |
| U1 no engine import beyond the type | ✅ | `import type { ScoringGroup }` — `GroupList.tsx:1` |
| U2 `null` on empty hand / negative total | ✅ | `ScoreExplanation.tsx:33-35`; tested for both |
| U3 three panels with correct gates and sources | ✅ | `src/Cribbage.tsx:146-181`; crib correctly passes `isCrib={true}`, all three use `variant="compact"` and the `toObject() as PCard` idiom |
| U4 `GameOverModal` stub removed | ✅ | Import and usage gone; test renamed and now asserts the "coming soon" text is *absent* |
| U5 no `!important` | ✅ | Zero occurrences in the whole of `App.css` |
| U5 all new motion inside `prefers-reduced-motion: no-preference` | ✅ | `App.css:1195-1198` is the only new animation application |
| U5 `App.css` append-only | ✅ | `git diff --numstat` → `665 0 src/App.css`; no existing rule touched |

**Deviation 1 — the `useMemo` never hits.** `ScoreExplanation.tsx:31` keys on `[hand, starter, isCrib, total]`. The plan says key on **card keys**. `Cribbage.tsx:148` builds `hand` with an inline `.map(...)` and `:150` builds `starter` with an inline `.toObject()`, so both are fresh references every render and `scoreHandDetailed` re-runs on every parent re-render. Cheap for five cards, but the memo is decorative rather than functional, and `total` is in the dependency array despite not being an input to the computation.

**Deviation 2 — X2's "log once" is "log every render".** `ScoreExplanation.tsx:37-39` places the mismatch `console.log` in the render body with no `useRef` guard. The plan's X2 row says "One `console.log` naming both". On a persistent mismatch during the show phase this becomes console spam. The test (`ScoreExplanation.test.tsx:46-58`) only asserts `toHaveBeenCalled()`, so it does not catch this.

**Deviation 3 — `.scoreExplanation-total` is dead.** The plan says "Keep `.scoreExplanation` / `.scoreExplanation-total`". `.scoreExplanation` survives on the wrapper (`ScoreExplanation.tsx:42`), but the total now renders as `.groupList-total total` inside `GroupList` (`GroupList.tsx:97`). The CSS rule survives in two places (`App.css:525` and `App.css:572`) matching nothing. Related: `.scoreExplanation` itself is now **defined twice** (`App.css:519` and `App.css:555`) because the U5 block was appended without retiring the superseded rule — the second silently wins.

**Deviation 4 — palette.** The plan restricts the U5 block to seven hex values. The block also uses `#1f6b3a` (11 occurrences, e.g. `App.css:582, 693, 728, 853`), `#123d27` (`App.css:659`), and `#9b1c1c` (`App.css:929`, the error-box border). `#9b1c1c` is defensible — an error state genuinely needs a red — but it is an unrecorded deviation, and `tutorial-implementation.md` lists a palette that excludes all three *and* omits `#166534`, which the code does use.

**Pair aggregation reorders the list.** `aggregateDisplay` (`GroupList.tsx:32-65`) pushes all non-pair rows during the loop and appends the pair buckets afterwards, so with the default `aggregatePairs={true}` an aggregated pair set renders *after* runs, flush and nobs rather than in the `fifteen → pair → run → flush → nobs` order the kernel guarantees. It also renders the points twice — `"Three of a kind — 6"` followed by a separate `6` in `.groupList-points`.

**Class-name duplication.** Every `GroupList` element carries two names for the same thing: `groupList grouplist groupList--compact compact`, `groupList-item is-active active`, `groupList-label lbl`, `groupList-points pts`. Presumably to satisfy both the new CSS and the mockup's class names; it should be one or the other.

---

### Phase 2 — Content model (C1–C5) — **Implemented, 3 content gaps**

| Item | Status | Evidence |
| --- | --- | --- |
| C1 all 14 types + `tutorialEnabled()` + `vite-env.d.ts` | ✅ | `tutorialTypes.ts:5-142`; `vite-env.d.ts:3-9` |
| C1 no markdown / no `dangerouslySetInnerHTML` | ✅ | Zero occurrences anywhere in `src/` |
| C2 all 16 required scenario ids exist | ✅ | `scenarios.ts:57-274` |
| C2 `discard-yours` same six cards, `isPlayerCrib: true` | ✅ | Byte-identical hand tuples at `scenarios.ts:160` and `:172` |
| C2 `flush-crib` `contrastWith: "flush-hand"` | ✅ | `scenarios.ts:138` |
| C2 deal-order comment on `RoundScript.deck` | ✅ | `tutorialTypes.ts:96-106`, both dealer parities tabulated |
| C3 7 beginner + 3 quick-practice, ids as specified | ✅ | `lessonCatalog.ts:9-146`; QP ids are exactly `count-a-hand-practice`, `peg-practice`, `cribbage-quirks` |
| C3 estimates sum ~27 min | ✅ | 2+5+3+4+6+5+2 = **27** exactly |
| C4 checks 1–6, 8–10 in `validateCatalog` | ✅ | `validateCatalog.ts:103-243` |
| C4 check 7 split to `validateRoundScripts` | ✅ | `validateCatalog.ts:246-275`, called from `catalog.test.ts:11-13` |
| C4 validator not imported by any screen/component | ✅ | Only `catalog.test.ts` (runtime) and `boundary.test.ts` (`?raw`) |
| C5 copy helpers + tone | ✅ | `tutorialCopy.ts:3-50`; no "Wrong"/"Error"/"Suboptimal"/muggins; EV confined to `math` |
| C5 `TRAINING_DEAL_NOTICE` (I6) | ✅ | *"This is a training deal, arranged so the useful moments come up. It is not a shuffled hand from a regular game."* — makes no claim about shuffle fairness |

**Gap 1 — `discard-theirs` has no 5-5.** The plan's scenario table requires a "tempting 5–5". The authored hand is `5S, 6C, 7H, JD, QH, 2S` (`scenarios.ts:160`) — one five. The prompt hedges to match: *"avoid feeding a pair of fives — or a five at all, if you can help it."* The exercise still teaches "don't throw a five into their crib", which is the underlying concept, but the specific temptation the plan called for isn't on the table.

**Gap 2 — the crib-flush contrast in `second-round` cannot happen.** This one is structural, and `validateCatalog` cannot catch it. The `second-round` crib checkpoint coach says:

> *"The crib is yours. Four of a suit is not a crib flush unless the starter matches."*

But the opponent always discards `3C, 2C` (`scenarios.ts`), and the learner's six is `2S, 5H, 6C, 7H, AH, JD` — containing exactly **one** club. No combination of learner discards can produce four of a suit in that crib. I confirmed by running the script: the resulting crib is `2C, 3C, 5H, 6C`, scoring 4 from two fifteens with no flush component. The coach states a rule the felt never demonstrates. This directly undercuts settled decision **Q6** ("crib-flush vs four-card-flush contrast is on the required path — lesson 2, **reinforced in `second-round`**") and the plan's G3 line "ideally the four-card-flush-that-is-not-a-crib-flush".

**Gap 3 — coach copy asserts facts that depend on learner choices.** The `first-round` show checkpoint says *"This hand includes nobs."* (`scenarios.ts`). That is true only if the learner keeps the `JD`. When I drove the round keeping a different four, the counted hand was `7H, JD, QH, 2S` — nobs survived by luck. A learner who throws the jack would be told their hand includes nobs when it does not. This is the kind of authored claim invariant I1 exists to prevent, and it is the one place in the content where a sentence is not derived from the engine.

Two smaller notes: the plan ties the "15 minutes" landing promise to lessons 1–5, which sum to **20** minutes, not 15; and `catalog.test.ts` does not test `describeDiscardComparison` despite C5's acceptance criteria naming it.

**On the "no authored scores" invariant (I1):** the *data* is clean — no scenario record carries a total, a score, or a correct-combination list; everything gradable is recomputed from `scoreHandDetailed` / `rankDiscards` / `explainPegPlay`. Hint *strings* do narrate points ("that is 15 for 2"), which is prose, not data, and is what `HintTiers` is for. No violation.

---

### Phase 3 — Runner, grading, persistence (R1–R3, P1–P2, T-B1/2) — **Implemented, 2 real defects**

| Item | Status | Evidence |
| --- | --- | --- |
| R2 all four grading functions | ✅ | `tutorialGrading.ts:99-232` |
| R2 order-independent group matching | ✅ | `sameIdSet` sorts both sides — `tutorialGrading.ts:34-41` |
| R2 `remainingByCategory` from the engine | ✅ | `tutorialGrading.ts:47-66` |
| R2 `rankPlays` never imported (S-R4) | ✅ | Asserted via `?raw` at `tutorialGrading.test.ts:34` |
| R1 all types incl. `subIndex` extension | ✅ | `tutorialReducer.ts:9-41` |
| R1 checkpoint sub-step advance | ✅ | `finishOrAdvanceCheckpoint` — `tutorialReducer.ts:128-145` |
| R1 `submit` never clears `found` | ✅ | Wrong path clears only `selected` — `tutorialReducer.ts:157-166` |
| R1 `skip` excluded from `completedStepIds` | ✅ | `advance(..., "skipped")` — `tutorialReducer.ts:106-109` |
| R1 reducer purity | ✅ | No persistence import, no `Date.now`, no `Math.random` |
| P1 sanitiser (version, clamp, cap 200, dates, concepts) | ✅ | `persistence.ts:151-181` |
| P1 `clearAll` preserves `tutorial` | ✅ | `persistence.ts:289-297` |
| P1 boundary test extended to forbid `guidedRound` | ✅ | `persistence.test.ts:144-150` |
| T-B2 analytics is a real null sink and is actually wired | ✅ | `tutorialAnalytics.ts`; called at `Lesson.tsx:74, 99, 124, 149` |

#### Defect 3.1 — passive steps award concept mastery (confirmed, user-visible)

`emptyStepState` marks `explain`, `round-map`, and `recap` steps `"complete"` the moment they are entered (`tutorialReducer.ts:55`, via `passiveKind`). `Lesson.tsx:92-99` then fires `recordConceptAttempt` for **every concept on the lesson** whenever it observes `status === "complete"` with `prevComplete.current === false`:

```92:99:src/screens/Lesson.tsx
    if (state.step.status === "complete" && !prevComplete.current) {
      for (const concept of lesson.concepts) {
        recordConceptAttempt(concept, {
          correct: state.step.attempts <= 1 && state.step.status === "complete",
          hintLevel: state.step.hintLevel,
        })
      }
```

`recordConceptAttempt` treats `correct && hintLevel < 2` as an independent correct (`persistence.ts:316`). On a fresh mount `prevComplete.current` is `false`, so **the first step of a lesson always records a bogus independent correct**. Lesson 1 (`shape-of-a-round`) opens on a `round-map` step and is tagged with **ten** concepts:

```
round-flow, count-order, crib-ownership, fifteens, pairs, runs,
discard-keep, discard-crib-risk, peg-fifteen-31, peg-pair-run
```

So merely *opening* lesson 1 marks all ten `ready`. Four of the five concepts shown on the lesson-7 recap (`Lesson.tsx:172-178`) are in that list. The recap — the whole point of S4 — will show green pills for skills the learner has never attempted. The plan's R3 rule is explicitly "independentCorrect += 1 only when `attempts === 1` && `hintLevel < 2`"; a passive step completes with `attempts === 0`, and `Lesson.tsx` uses `<= 1`, which lets it through.

Related, from the same rule: the plan says `attempts += step attempts`, but `recordConceptAttempt` always adds exactly 1 (`persistence.ts:318`).

#### Defect 3.2 — `skippedStepIds` is never persisted (confirmed)

`skip` calls `advance()` (`tutorialReducer.ts:378`), and `advance` immediately replaces `state.step` with `emptyStepState(nextStep)` (`tutorialReducer.ts:119-125`). The new step's status is `"in-progress"` (or `"complete"` for a passive kind) — never `"skipped"`. `Lesson.tsx:101-108` guards on `state.step.status === "skipped"`, so that branch can only fire on the **final** step of a lesson, where `advance` keeps the mark and sets `lessonComplete`. For every other step, skipping writes nothing to `skippedStepIds` and records no attempt.

The persistence field, its sanitiser, and its 200-cap are all implemented and tested; the producer is broken.

#### Other Phase 3 deviations

- **Discard retries stop counting attempts.** `tutorialReducer.ts:195` — `const attempts = state.step.attempts + (state.step.attempts === 0 ? 1 : 0)`. The plan wanted "Try another discard" to not *extra*-penalise; this freezes the counter entirely after the first miss.
- **`findLesson` is a module-scope import, not lazy.** `persistence.ts:3`. The plan said to lazy-import it inside `sanitizeTutorial` for cycle avoidance. I verified **no cycle exists** (nothing under `src/features/tutorial/` imports `persistence`), so this is safe — but it pulls the entire curriculum catalog into every bundle that touches persistence, and the plan required deviations to be recorded in the PR. They were not.
- **`skippedStepIds` is not filtered against the live catalog**, only deduped and capped (`persistence.ts:162`). `completedLessonIds` is filtered correctly.
- **The inner `submit` switch has a silent fallback.** `tutorialReducer.ts:319` has a `return state` after an otherwise exhaustive `switch (step.kind)`. The plan says "No silent `default`" precisely so a new step kind fails loudly. The outer `RunnerAction` switch is correctly exhaustive with no fallback.
- **T-B1 uses a hardcoded 12-file list** (`boundary.test.ts:15-19`) rather than scanning the directory. It happens to cover all 12 current production files, but a new file is unguarded by default. It also does not assert the plan's `store` prohibition — only `thePlayer` / `gamePlayer` / type-only `gameSlice`.
- **T-B2 is a grep, not a behaviour test.** It checks the source contains `if (!sink)` and lacks `fetch(` / `XMLHttpRequest` / `sendBeacon`. It does not call `track()` with no sink, and does not assert the allowlist filter actually drops a non-allowlisted key.

**Security assessment (this is the phase that parses untrusted input):** `JSON.parse` is wrapped in try/catch (`persistence.ts:203-212`); `writeBlob` swallows quota and private-mode failures (`:215-221`); `finiteNumber` rejects `NaN`/`Infinity`/non-numbers (`:70-72`); arrays are capped at 200 (`:109-128`); `sanitizeMastery` iterates `Object.keys` and copies only keys in a `KNOWN_CONCEPTS` allowlist into a fresh object literal (`:131-148`), which closes the `__proto__` / `constructor` pollution path; dates are regex-gated (`:105-107`). This is done well. The only residual is cosmetic: the date regex accepts `9999-99-99`.

---

### Phase 4 — Lesson UI (T1–T7, S1–S3) — **Implemented, 3 features dead or partial**

| Item | Status | Evidence |
| --- | --- | --- |
| S1 `RulesReference` extracted, copy unchanged | ✅ | `RulesReference.tsx:8`; all Learn rules assertions still pass unmodified (`Learn.test.tsx:41-59`) |
| T2 `RoundMap` six phases + `aria-current="step"` | ✅ | `RoundMap.tsx:3-32` |
| T3 `SelectableHand` fieldset/legend/buttons/badges/44px/no custom key handler | ✅ | `SelectableHand.tsx:44-83`; `App.css:765-813`; grep confirms no `onKeyDown` anywhere in `src/components/tutorial/` |
| T4 exactly one `role="status"` live region | ✅ | `CoachPanel.tsx:59`; asserted at `CoachPanel.test.tsx:19` |
| T4 hint labels Hint → Another hint → Show me one group | ✅ | `CoachPanel.tsx:26-34` |
| T1 shell layout, coach-first on narrow, one `<h1>` + two `<h2>` | ✅ | `TutorialShell.tsx:94-157` |
| T1 Next gating (disabled in-progress, enabled on explain/round-map/recap) | ✅ | `TutorialShell.tsx:82-85, 172` |
| T1 Rules in an Offcanvas | ✅ | `TutorialShell.tsx:100, 187-194` |
| S3 `/learn/:lessonId` before `*` | ✅ | `App.tsx:40` vs `:47` |
| S2 Learn hub: promise line, Start/Resume, RoundMap, 7 unlocked lessons, QP, Start over, `id="rules"` | ✅ | `Learn.tsx:41-126` |
| S2 `LESSONS` / disabled tiles / "Coming soon" removed | ✅ | Asserted absent at `Learn.test.tsx:65`; `.coming-soon` retained in CSS for `FriendPlay`/`Stats` |
| S3 unknown id and flag-off both redirect | ✅ | `Lesson.tsx:140-142`; both tested |
| S3 `completedLessonIds` only for `BEGINNER_PATH` | ✅ | `Lesson.tsx:116-124` |

#### Gap 4.1 — `CoachPanel`'s category progress and "Show the math" are dead code

`CoachPanel` implements both: a `<dl>` of category progress (`CoachPanel.tsx:50-57`) and a `secondary` slot rendered in a Bootstrap `Collapse` closed by default (`CoachPanel.tsx:45, 81-83`). Neither prop is ever passed. A repo-wide grep for `progress=` and `secondary=` across `src/components/tutorial/` and `src/screens/` returns **nothing**; `TutorialShell.tsx:146-154` passes only `prompt`, `earned`, `feedback`, `hintLevel`, `onHint`.

Two plan requirements fall through this hole:

- **T4:** "category progress as a `<dl>` ('Fifteens 1 of 2', 'Pairs not started')" — never displayed.
- **T6:** "'Show the math' for EV" on discard confirmation — `describeDiscardComparison` returns `{ plain, math }` (`tutorialCopy.ts:33-34`) and grading propagates it, but `math` reaches no pixel. The EV number the plan deliberately hid behind a disclosure is simply not reachable.

#### Gap 4.2 — `play-sequence` pegging has no sequence UI

`PeggingExercise.tsx:20` folds `play-sequence` into the same single-card radio-and-submit flow as `select-scoring`:

```20:20:src/components/tutorial/PeggingExercise.tsx
  const mode = scenario.task.kind === "select-scoring" || scenario.task.kind === "play-sequence"
```

The reducer matches (`tutorialReducer.ts:258` grades it as one legal play). The `peg-go` scenario authors an `opponentScript` (`scenarios.ts:213-220`) that is never played. So the plan's T7 requirements for this mode — "alternate with `opponentScript`; pause to explain out-of-order runs, go, who leads after reset, why last card scores" — are **not implemented**. Lesson 4's `peg-go` step teaches go and the last card only through hint prose, not through the interaction. The `.is-played` animation class (`App.css:1195-1198`) is likewise never applied.

#### Gap 4.3 — no tests for any exercise or for the shell

Five components have zero tests:

```
src/components/tutorial/HandScoringExercise.tsx   ← plan §6.1 explicitly requires HandScoringExercise.test.tsx
src/components/tutorial/DiscardExercise.tsx
src/components/tutorial/PeggingExercise.tsx
src/components/tutorial/TutorialShell.tsx
src/components/tutorial/GuidedRoundView.tsx       ← plan task 5.3 requires error-restart + over-31 tests
```

The three primitives do have tests, but they are one `it` each and cover a fraction of the acceptance criteria: `SelectableHand.test.tsx` never exercises Space/Enter, `aria-pressed` tracking, `mode="none"`, or the credited/hinted accessible names; `CoachPanel.test.tsx` stops at hint tier 2. The plan's §6.4 requirement "keyboard-only full count of `count-all` in jsdom" is unmet.

#### Smaller Phase 4 items

- **`○` (not started) has no visually-hidden text.** `Learn.tsx:72-93` supplies screen-reader text for the done and current markers but not the not-started one. `tutorial-implementation.md` claims "`✓` / `→` / `○` plus visually-hidden text" for all three.
- **No explicit unmount persistence in `Lesson.tsx`.** The plan (S3, O8) says persist "on step completion and on unmount". There is a `[lesson, state.stepIndex]` effect (`Lesson.tsx:78-86`) but no cleanup function. In practice the step-index effect covers the same ground, so this is a letter-not-spirit deviation.
- **Magic strings in `Lesson.tsx`.** `lesson.id === "ready-table"` appears twice (`:122`, `:155`) instead of deriving the last lesson from `BEGINNER_PATH`, and `curriculumVersion: 1` is hardcoded in all four `track()` calls instead of importing `CURRICULUM_VERSION`. Both drift silently if the catalog changes — which is exactly the scenario `CURRICULUM_VERSION` exists to handle.
- **"Practise a weak concept" can deep-link off Quick Practice.** `Lesson.tsx:160-161` maps the `discard-keep` weakness to `"crib-and-discard"`, a `BEGINNER_PATH` lesson, not a QP lesson. The plan's S4 says the secondary action deep-links "to the relevant Quick Practice lesson".
- **Duplicate imports from the same module.** `Lesson.tsx` imports from `'../app/persistence'` at both line 5 and lines 6-10, and from `'react-bootstrap'` at both line 2 and line 22. Lint does not flag it; it is still noise.
- **`GuidedRoundView` remounts on every interaction.** `Lesson.tsx:235` passes `key={roundView}`, and `roundView` increments on every `onChange`. Any local component state is destroyed each time. For the current flows (submit-then-advance) this is benign, but it is a fragile pattern to build on.
- **`setupTests.ts` gained a `matchMedia` polyfill** (+14 lines) — required for Bootstrap `Offcanvas`/`Collapse` under jsdom, sensible, but not in the plan's modified-file inventory and not mentioned in the implementation report.

**On the mockups.** `tutorial-mockups.html` is a guideline, so divergence is not a defect. Recording the material ones for completeness: the mockup puts visible `▸` / `✓` glyphs on the round-map's current and done steps via CSS `::before`, whereas `RoundMap.tsx` marks *current* with colour plus screen-reader text and *done* with colour alone; and the mockup's "Show the math" is a `<details>` element where the code uses a Bootstrap `Collapse` (which the plan explicitly sanctions). Palette, 44 px targets, `.lesson-row` and `.roundmap` layouts otherwise track the mockup closely.

---

### Phase 5 — Guided rounds (G1–G3, T8) — **Runtime correct, tests largely absent**

This is the phase with the widest gap between *what works* and *what is proven to work*.

**What I verified empirically** by driving both scripts through the real `CribbageGame`:

| G3 / spec requirement | Result |
| --- | --- |
| S-G2 deal parity, `first-round` (dealer = opponent) | ✅ learner holds deck indices **0,2,4,6,8,10** — `2S,5S,6C,7H,JD,QH` |
| S-G2 deal parity, `second-round` (dealer = player) | ✅ learner holds indices **1,3,5,7,9,11** — `2S,5H,6C,7H,AH,JD`; the non-dealer opponent correctly takes index 0 |
| Starter is index 12 in both | ✅ `8D` and `JH` respectively |
| `first-round` starter is **not** a jack | ✅ `8D` |
| `second-round` starter **is** a jack, heels to the learner | ✅ log entry 1: `you — "his heels (also called his nibs) …" +2` |
| `second-round` pegging 31 | ✅ log entry 2: `you — "thirty-one — 2" +2` |
| `first-round` count order: non-dealer (learner) first | ✅ `you: hand count` → `opponent: hand count` → `opponent: crib count` |
| `second-round` count order: learner counts second, then the crib | ✅ two separate `count-hand` pauses, the second with `isCrib: true` |
| Crib ownership | ✅ `opponent` / `you` respectively |
| Neither round approaches 121 | ✅ final 4–9 and 10–1 |
| S-G5 `reset()` mid-round | ✅ post-reset view is **byte-identical** to the initial view, for both scripts, and idempotent across two resets |
| S-G6 illegal discard of 1 card | ✅ `{ok: false, "Choose exactly two cards."}` |
| S-G6 illegal discard of 3 cards | ✅ same |
| S-G6 unknown card id | ✅ `{ok: false, "Those cards are not in your hand."}` |
| S-G6 over-31 play | ✅ refused, and `playingSequence` length unchanged |
| Coach names the round-1/round-2 contrast | ✅ `"You deal this round, so the crib is yours — last round it was theirs."` |
| Both rounds terminate at `round-end` with `complete: true`, `awaiting: "done"` | ✅ |

Construction order, the 5,000-iteration guard, the error path, the need-table, the seat-aware show table, the copied peg-shift bookkeeping, and the absence of `thePlayer` / `setTimeout` / `rankPlays` all check out against the plan (`guidedRound.ts:156-174, 229-283, 285-335, 339-407`; `fixedDeck.ts:6-76`).

**Against that, the test file is 27 lines and three cases:**

```23:26:src/features/tutorial/guidedRound.test.ts
  it("refuses a play that would exceed 31", () => {
    const round = new GuidedRound(ROUND_SCRIPTS[scriptId])
    expect(round.submitPlay("not-a-card").ok).toBe(false)
  })
```

That test's name is wrong: it passes an unknown card id and never constructs an over-31 play. Similarly, "restarts to a fresh deal" resets from the *initial* state, not mid-round, and asserts three shallow properties rather than view equality. Against the plan: **S-G3, S-G4 and S-G5 have no implementation in `guidedRound.test.ts` at all**, S-G2 is only indirectly covered by `validateRoundScripts`' dealer-index derivation, and S-G6 is a third covered. Everything in my verification table above is a property the shipped suite would not catch a regression in.

Two behavioural deviations from the plan, both minor:

- **Pegging log entries omit the `explainPegPlay` label.** `guidedRound.ts:212-219` logs `SCORE_REASON_COPY[reason]` only, so a peg run logs the generic `"a run in the play"` rather than `"Run of three: 5-3-4"`. `submitPlay` computes the specific label (`:142`) and discards it.
- **Checkpoints for discard and pegging suspend interactively rather than on `awaiting: "acknowledge"`.** `guidedRound.ts:294-296, 320-322` attach the checkpoint coach text to the `"discard"` / `"play-card"` suspension. The starter and show checkpoints do use `acknowledge`. This is arguably better UX — it avoids a redundant click — but it is not what the plan's table says, and it was not recorded as a deviation.
- **`countTask.total` is recomputed via `scoreHand`** (`guidedRound.ts:390`) rather than taken from the engine's emitted score action. The values agree, but it re-derives rather than reads the ledger.

`GuidedRoundView` itself is well wired — training notice, crib owner, `CribbageBoard`/`Peg` reuse, `ScoreExplanation` for revealed hands, always-present "Restart this round", over-31 cards rendered `disabled` — with one placement note: the `RoundMap` lives in `TutorialShell` fed by `Lesson.tsx:231`'s `mapPhase`, not in the view's own header as T8 describes. Functionally equivalent. It has no tests.

---

### Phase 6 — Handoff, flag, docs (S4, A2, A3) — **Fully implemented**

| Item | Status | Evidence |
| --- | --- | --- |
| S4 dispatch order, exactly as §1.4 | ✅ | `Lesson.tsx:145-150` — `savePreferences` → `resetForNewSession` → `resetGameUi` → `setDifficulty` → `navigate` |
| S4 three mastery states only | ✅ | `masteryState` returns `ready` / `practised` / `not yet` (`Lesson.tsx:33-45`) |
| S4 secondary actions (practise / rules / back) | ✅ | `Lesson.tsx:189-195` |
| X15 skipping everything still reaches the handoff | ✅ | Tested end-to-end at `Lesson.test.tsx:64-77`, including the `resetForNewSession` spy and the resulting store state |
| S4 is the only tutorial code touching `thePlayer` / `gameSlice` actions | ✅ | Enforced by `boundary.test.ts`; `src/components/tutorial/` only type-imports `PCard` |
| A2 `tutorialEnabled()` read only in `Learn.tsx` and `Lesson.tsx` | ✅ | Grep confirms three call sites across those two files |
| A3 `AGENTS.md` updated with all five required items | ✅ | `git diff AGENTS.md` — tutorial functional-area rows, `/learn/:lessonId`, the `thePlayer` prohibition, the one-kernel rule, and the `clearAll`-preserves-tutorial note |
| A3 `README.md` untouched | ✅ | No diff |
| Dockerfile / nginx.conf unchanged | ✅ | No diff |

The only unmet Phase 6 item is A1 itself, which the plan defines as a **browser** checklist — see §7.3.

---

## 5. Ranked defect list

| # | Severity | Defect | Location |
| --- | --- | --- | --- |
| 1 | **High** | Passive steps award independent-correct mastery; opening lesson 1 marks all ten of its concepts `ready`, making the S4 recap meaningless | `Lesson.tsx:92-99` + `tutorialReducer.ts:55` |
| 2 | **Medium** | `skippedStepIds` is never persisted for any non-final step, because `skip` advances before the UI can observe the status | `tutorialReducer.ts:378` + `Lesson.tsx:101-108` |
| 3 | **Medium** | `play-sequence` pegging has no sequence UI; the `peg-go` scenario's `opponentScript` is never played, so go / reset / last-card are taught only in prose | `PeggingExercise.tsx:20` |
| 4 | **Medium** | `CoachPanel`'s category-progress `<dl>` and "Show the math" EV disclosure are implemented but never rendered — no caller passes `progress` or `secondary` | `TutorialShell.tsx:146-154` |
| 5 | **Medium** | S-G3, S-G4, S-G5 are absent and S-G2/S-G6 are partial; the entire guided-round contract is unprotected by tests, and one test's name contradicts its body | `guidedRound.test.ts` |
| 6 | **Medium** | No tests for five components, including the plan-mandated `HandScoringExercise.test.tsx` and `GuidedRoundView` error/over-31 cases | `src/components/tutorial/` |
| 7 | **Low-Med** | `second-round`'s crib can never contain four of a suit, so the crib-flush contrast its coach text promises (Q6) cannot be demonstrated | `scenarios.ts` `second-round` |
| 8 | **Low-Med** | `first-round` coach asserts "This hand includes nobs", which is false if the learner discards the jack | `scenarios.ts` `first-round` show checkpoint |
| 9 | **Low** | `validateCatalog` has no negative tests, so `validateCatalog() === []` may be passing vacuously | `catalog.test.ts` |
| 10 | **Low** | Discard retries stop incrementing `attempts` after the first miss | `tutorialReducer.ts:195` |
| 11 | **Low** | Pair aggregation reorders `GroupList` rows out of kernel order and prints the points twice | `GroupList.tsx:32-65` |
| 12 | **Low** | X2 mismatch logs every render, not once | `ScoreExplanation.tsx:37-39` |
| 13 | **Low** | `useMemo` in `ScoreExplanation` never hits because `hand`/`starter` are fresh references each render | `ScoreExplanation.tsx:31` + `Cribbage.tsx:148-150` |
| 14 | **Low** | `discard-theirs` has one five, not the specified tempting 5-5 | `scenarios.ts:160` |
| 15 | **Low** | Three off-palette colours in the U5 block; `.scoreExplanation`/`.scoreExplanation-total` each defined twice with the first dead | `App.css:519-529, 582, 659, 929` |
| 16 | **Low** | `SUIT_FLUSH_NAME` is a SCREAMING_SNAKE identity function duplicating the unused `SUIT_NAMES` export | `game.ts:262-264` |
| 17 | **Low** | Silent `return state` after the inner exhaustive switch; hardcoded `"ready-table"` and `curriculumVersion: 1`; duplicate module imports in `Lesson.tsx` | various |

---

## 6. Implemented but not in the plan

`git diff` plus the untracked file list against Appendix A's inventory:

| Item | Assessment |
| --- | --- |
| `src/features/tutorial/tutorialCards.ts` (18 lines) | **Justified.** `specToCard` / `specsToCards` / `discardPairKey` / `cardKeysOf` — a `CardSpec` ↔ `Card` bridge used by the validator, grading, reducer, and guided round. Centralises a conversion the plan spreads across four files. |
| `src/features/tutorial/completeRound.ts` (59 lines) | **Justified.** Drives a `GuidedRound` with arbitrary legal learner choices so `validateCatalog` check 7 can prove termination. Only imported by `validateCatalog` and tests, so tree-shaken from the browser bundle. Worth a comment noting it is test-only. |
| `src/setupTests.ts` `matchMedia` polyfill (+14) | **Necessary.** Bootstrap `Offcanvas`/`Collapse` need it under jsdom. Not in the plan's modified-file list and not mentioned in the implementation report. |
| `catalog.test.ts` instead of `lessonCatalog.test.ts` | **Naming deviation only** (plan Appendix A line 1665). |
| `RoundPhase` type export | Small, used by `RoundCheckpoint`. Fine. |
| `lessonCatalog.ts` re-exports the scenario maps | Convenience. Fine. |
| `TutorialShell` props `coachOverride`, `mapPhase`, `workspaceExtra` | Integration glue for guided rounds. Reasonable, though `workspaceExtra` as a `ReactNode` escape hatch is a little loose for a component the plan specified as a fixed frame. |
| Duplicate legacy class aliases on `GroupList` (`grouplist`, `lbl`, `pts`, `active`, `compact`) | Undocumented; presumably mockup compatibility. Should be one naming scheme. |
| `training-cribbage-x.md`, `tutorial-mockups.html`, `tutorial-plan.md`, `detailed-tutorial-implementation-plan.md` (untracked) | Inputs, not implementation output. |

Nothing from Appendix C ("Out of scope — do not build") has been built. No new runtime dependency, backend, analytics vendor, or third guided round. `StdDeck.shuffle`, difficulty weights, and AI strategy are untouched. `gamePlayer.ts`, `gameSlice.ts`, `store.ts`, `hooks.ts`, `difficulty.ts`, `CardComponents.tsx`, `CribbageBoard.tsx`, `DifficultyModal.tsx`, `Splash.tsx`, `Stats.tsx`, `FriendPlay.tsx`, `index.tsx`, `package.json`, `vite.config.ts`, `Dockerfile`, `nginx.conf`, `public/**`, and `README.md` are all unmodified, exactly as §1.3 requires.

---

## 7. Quality evaluation

### 7.1 Completeness

All six phases landed and the happy path works end to end. The shortfall is concentrated in two places: **test coverage** (§3, defects 5–6, 9) and **three features that exist in component code but are never reached** (defects 3, 4). The guided rounds — the plan's highest-complexity, last-among-core work — are the best example of the split: the runtime is correct in every respect I could measure, and almost none of it is protected.

### 7.2 Correctness

The engine is the strongest part of the work. The kernel refactor is proven equivalent over the full 6,188-multiset space plus a 50,000-deal sweep, `game.test.ts` passed unmodified, and the `rankDiscards` side-effect compensation (E2b) is placed correctly and commented. `explainPegPlay` is genuinely pure, and `validateCards(action, action.cards, 1, ...)` guarantees the `action.cards[0]` it is fed is always exactly one card.

Above the engine, the two mastery/skip defects are the substantive correctness problems. Both are in the glue between a pure reducer and an effect-driven screen — the reducer is correct in isolation, the persistence function is correct in isolation, and the wiring between them is not.

### 7.3 Runtime verification

**What a live browser pass confirms.** Running the app on a dev server and walking it produced no console errors or uncaught exceptions anywhere, and confirmed the following actually work end to end:

| Checked live | Result |
| --- | --- |
| `/learn` hub | Promise line, six-phase round map, **7** unlocked lessons with the exact titles and minute estimates from the catalog (2/5/3/4/6/5/2), 3 Quick Practice buttons, Start over, rules accordion under `id="rules"` |
| Lesson entry | `/learn/shape-of-a-round`, `<h1>` "The shape of a round", "Step 1 of 6", coach panel, footer Back (disabled) / Skip this step / Next |
| Graded counting exercise | Selecting `2♥ 2♣` and submitting is credited as "Pair of twos for 2"; the running total updates; credited groups persist in the list and the counted cards become disabled |
| Hint tiers (T4) | Labels escalate exactly as specified — **Hint → Another hint → Show me one group** — with tier 2 highlighting one card of an unfound group and tier 3 highlighting both. The `hintFor` tier contract works through the full stack. |
| X4 unknown id | `/learn/does-not-exist` redirects to `/learn`, no error UI |
| Guided round (`coached-round`) | Training-deal notice persistent, "Restart this round" present, discard of `J♦ 2♠` confirmed, starter `8♦` revealed with heels/nobs narration, pegging reached with radio card selection; played `5♠`, opponent replied, count advanced to 9 |
| Guided round (`coached-round-dealer`) | Opens correctly on the dealer-seat intro step |
| `/play` | Loads cleanly; difficulty modal renders as expected on a fresh visit |

That is meaningfully more confidence than the test suite provides, and it independently corroborates the catalog figures I extracted programmatically.

**What is still unverified.** The walk stopped partway through pegging and never reached a show, a completed guided round, or the lesson-7 recap. So these plan §6.6 items remain open:

- **Item 1 and 9 — the three `/play` breakdown panels at the show.** Never observed. Task 1.3 is explicit that U3 "is not done" until a five-group hand is checked against the board at default zoom, and `.scoreExplanationShow--opponent { top: 640px }` is still sitting at the plan's untested starting value. On paper the geometry is plausible (player 170–450 px, crib 470–750 px, board at 850 px), but that is arithmetic, not verification.
- **Item 2 and 10 — 200 % zoom and 320 px.** Viewport emulation was attempted and the command succeeded, but navigation blocked before a screenshot could be captured. Neither the "coach above cards" reflow nor the no-horizontal-scroll requirement is confirmed.
- **Item 3 — keyboard-only completion.** Exercises were driven by mouse. `SelectableHand` uses native buttons with no custom key handler, so this is very likely fine, but it is untested in jsdom too (§4, Gap 4.3).
- **Items 5–6 — completing either guided round, including restart mid-round.**
- **Item 7 — the Easy-game handoff at `/play`** with no stale toasts or queued actions. The dispatch sequence is unit-tested; the resulting table state is not.
- **Item 9 in the plan's numbering — `prefers-reduced-motion: reduce`.**
- **Item 10 — the `VITE_TUTORIAL_PATH=off` preview build.** Flag-off behaviour is unit-tested in both `Learn.test.tsx` and `Lesson.test.tsx`, but the built artefact was never served.

**The reporting problem stands regardless.** `tutorial-implementation.md` ends its 12-item manual test plan with "Automated coverage for the above: `npx vitest run` (148 tests at ship)". That claim does not hold for items 4, 6, 7, 9, 10, or 11, and nothing in the repository records that any of them were performed manually. The plan says this pass is "not optional" and that its result must appear in the Phase 6 PR description. The live walk above was done by this audit, not by the implementer.

### 7.4 Security

No findings. The only untrusted input is the `cribbagex.v1` localStorage blob, and it is handled properly (see the Phase 3 assessment). There is no network code, no `eval`, no `dangerouslySetInnerHTML`, no `innerHTML`, no new dependency, and no analytics egress — `track()` filters to an allowlist and returns early with no sink installed. Lesson `body` content is `ReadonlyArray<string>` rendered as text, so authored copy cannot inject markup.

### 7.5 Efficiency

The plan's central performance concern (R2: don't put group allocation on the `rankDiscards` hot path) was handled correctly — every allocation in `computeHandScore` is behind an `if (sink)` guard and `scoreHand` passes none. The E2a clone adds one 4–5 element shallow copy per call, which is noise; that said, the plan required this to be *measured* and it was not.

Two lesser issues: the ineffective `useMemo` (defect 13) and `GuidedRoundView`'s remount-per-interaction (`key={roundView}`). Neither is likely to be noticeable at this scale.

### 7.6 Coding standards

Good adherence to `AGENTS.md`. Lint passes, `tsc --noEmit` passes, there are no `any` types, no `@ts-ignore`, and no `TODO`/`FIXME` in any new file. Module boundaries are enforced by executable tests rather than convention. The engine's older `console.log`-heavy style was left alone in `game.ts` as the plan's O12 instructed, and the new tutorial modules follow the newer Vite/RTK idiom — the right call per "match local style".

Against that: duplicate module imports in `Lesson.tsx`, duplicate CSS rules in `App.css`, duplicate class names in `GroupList.tsx`, a SCREAMING_SNAKE function name, hardcoded `"ready-table"` and `curriculumVersion: 1`, and one test whose name does not describe what it asserts.

---

## 8. Accuracy of `tutorial-implementation.md`

**Every affirmative claim I tested is true.** The engine claims, the `/play` panel claims, the persistence claims, the routing and flag claims, the guided-round construction and both-scripts-complete claims, and the exact S4 dispatch order are all verified accurate. The 148-test count is exact. The deferred list is honest about adaptive practice, Coach Mode, muggins, skunk flags, focus re-reads, `README.md`, and Docker/nginx.

The document's problem is **omission and one overstatement**:

| Issue | Detail |
| --- | --- |
| **Overstated coverage** | "Automated coverage for the above" does not hold for 6 of the 12 manual items (§7.3) |
| Palette claim is wrong | Lists six colours; the code uses those plus `#166534`, `#1f6b3a`, `#123d27`, `#9b1c1c` |
| Marker claim is over-broad | "`✓` / `→` / `○` plus visually-hidden text" — `○` has no screen-reader text |
| No mention of missing tests | Five components untested; S-G2–S-G6 largely unimplemented; S-C2 and S-P2 missing |
| No mention of dead features | `CoachPanel` progress/math and `play-sequence` pegging are silently absent |
| No mention of recorded deviations | The plan requires deviations be recorded (line 8). The eager `findLesson` import, the interactive checkpoint modes, the `catalog.test.ts` rename, and the palette additions are all unrecorded |
| Missing required artefact | No `rankDiscards` before/after timing, which task 0.2 and Appendix B both mandate |
| Two defects unreported | The mastery and skip-persistence bugs (defects 1–2) are not disclosed |

A reader of `tutorial-implementation.md` alone would believe the feature is complete and verified. It is complete; it is not verified, and it has two behavioural bugs in the progress-tracking path.

---

## 9. Recommended follow-up, in priority order

1. **Fix the mastery accounting.** Only record a concept attempt for *assessed* step kinds, and use `attempts === 1` as the plan specifies rather than `<= 1`. Without this the lesson-7 recap — the payoff for the whole beginner path — reports noise.
2. **Fix skip persistence.** Have the reducer surface the skipped step id (for example, return it on the action result or record it in `RunnerState` before `advance` clears it) so `Lesson.tsx` can write `skippedStepIds`.
3. **Write `guidedRound.test.ts` properly.** S-G3/S-G4/S-G5 as specified, parameterised over both scripts. The empirical probes in §Phase 5 of this report are a ready-made assertion list: deal parity, heels to the learner in `second-round`, the 31, count order per seat, view-identity after mid-round reset, and over-31 refusal without mutation. Also rename the test that claims to test over-31 but does not.
4. **Wire `CoachPanel`'s `progress` and `secondary`,** or delete them. Right now the code implies features the user cannot see.
5. **Implement `play-sequence`,** or drop `peg-go` from lesson 4 and remove the unused `opponentScript` — the plan's own deferral rule says not to ship a half-built lesson.
6. **Add the missing component tests,** starting with `HandScoringExercise.test.tsx` (plan-mandated, including the keyboard-only `count-all` completion) and `GuidedRoundView.test.tsx` (error restart, over-31 disabled).
7. **Add negative fixtures to `catalog.test.ts`** — duplicate id, authored `"joker"`, zero-total hand — so `validateCatalog() === []` means something.
8. **Finish the browser pass and record it.** §7.3 clears the Learn hub, lesson navigation, graded counting, hint tiers, the unknown-id redirect, and guided-round entry. Still outstanding: the three `/play` panels at the show (gates U3), 200 % zoom, 320 px, keyboard-only completion, completing and restarting both guided rounds, the Easy-game handoff at the table, `prefers-reduced-motion`, and the flag-off preview build. Until those are done, U3 and A1 are formally incomplete regardless of how the code reads.
9. **Fix the `second-round` crib** so four of a suit is reachable, or change the coach copy to stop promising a contrast the deal cannot produce. Same for the `first-round` "This hand includes nobs" assertion.
10. **Housekeeping:** guard the X2 log, key the `useMemo` on card keys, restore kernel ordering in `GroupList`'s pair aggregation, delete the superseded `.scoreExplanation` rules, replace `SUIT_FLUSH_NAME` with `SUIT_NAMES`, derive the last lesson from `BEGINNER_PATH`, and import `CURRICULUM_VERSION` instead of hardcoding `1`.
