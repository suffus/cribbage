# CribbageX Interactive Tutorial — Detailed Implementation Plan

**Status:** Ready to implement  
**Source specification:** [`tutorial-plan.md`](tutorial-plan.md) (v0.4.0, draft for architectural review)  
**Target version:** v0.4.0  
**Audience:** A developer (or coding agent) picking up any single task

This plan converts the specification into tickets. Binding decisions (`D1`–`D12`), invariants (`I1`–`I8`), and work-item IDs (`E1`, `C2`, `G4`, …) are those of the spec. Do not re-litigate them. If a ticket must deviate, record why in the PR.

**How to use this document.** Each task is written so you can start it without reading the whole spec first. The spec remains the contract for types, copy tone, and enumeration rules. When this plan and the spec disagree on a *settled product question*, the spec's section 17 wins. When they disagree on *how to sequence or slice the work*, this plan wins.

---

## How to pick up a task

1. Read the task's **Goal**, **Files**, **Acceptance criteria**, and **Do not**.
2. Read only the spec sections listed under **Spec**.
3. Implement. Do not leave `TODO` comments for required behaviour.
4. Run the task's **Verify** commands. A phase is not done until its exit criteria are green.
5. After any UI change, do the listed browser checks — a screenshot is not verification.

**Global verify (every phase exit):**

```bash
npm run lint
npx vitest run
npm run build
```

**Global constraints (never violate):**

| ID | Rule |
| --- | --- |
| I1 | Every tutorial answer, hint, and grade is derived from `src/app/game.ts`. No authored score totals or "correct combination" lists. |
| I2 | Existing score totals stay byte-identical. `src/app/game.test.ts` assertions must pass **unmodified**. If one fails, stop and find the cause. |
| I3 | The tutorial never imports `thePlayer` / `gamePlayer.ts`. It constructs its own `CribbageGame`. The Easy-game handoff in `Lesson.tsx` is the single exception (spec S4). |
| I4 | No `Card`, `Hand`, `CribbageGame`, or `Deck` instance enters Redux or `localStorage`. Tutorial view models use `PCard` or `cardKey` strings. |
| I5 | No timers in lessons. Every advance is a user action. Ignore `GameAction.schedule`. |
| I6 | Guided rounds are labelled training deals. Never imply anything about shuffle fairness. |
| I7 | No new runtime dependency, backend, account, CMS, or analytics vendor. |
| I8 | Corrupt tutorial progress degrades to "not started" and never invalidates `preferences` or `stats`. |

**There is no database and no API.** The "data model" in this plan is TypeScript types plus one `localStorage` blob (`cribbagex.v1`). Do not add a backend.

---

## 1. Architecture Overview

### 1.1 What already exists

CribbageX is a static SPA: React 18, Redux Toolkit as a thin adapter, Vite 6, no server. The live table path is:

```text
User click / timer
  → dispatch(userPlay({ action, cards }))
  → gameSlice.userPlay
  → thePlayer.playAction          (module singleton)
  → CribbageGame.doAction
  → GamePlayer.handleAction       (AI, delays, peg updates)
  → merged GamePlayingState
```

Today's learning surface is a static accordion at `/learn` plus four disabled "Coming soon" tiles (`src/screens/Learn.tsx`). `scoreHand` returns a number. `ScoreExplanation` is a stub. Pegging scores are computed inline in `doAction` (`src/app/game.ts` ~762–811) and the participating cards are discarded. Persistence (`src/app/persistence.ts`, key `cribbagex.v1`) has `preferences` and `stats` only.

### 1.2 What this feature adds

Two connected deliverables, shipped in that order so the first is valuable even if the curriculum slips:

1. **Explainable scoring everywhere.** One scoring kernel with an optional group sink. The live table shows point-by-point breakdowns for the player's hand, the opponent's hand, and the crib.
2. **A skippable Beginner Path** at `/learn/:lessonId`: seven lessons from a worked example, through graded exercises, through two deterministic training deals (one from each seat), to a checkpoint, then into a normal Easy game.

The tutorial is a **parallel runtime**, not an extension of the live table:

| Concern | Live table | Tutorial |
| --- | --- | --- |
| Engine owner | `thePlayer` singleton | A private `CribbageGame` inside `GuidedRound` |
| UI state | Redux `gameSlice` | Local `useReducer` (`tutorialReducer`) |
| Timing | `GameAction.schedule` + `setTimeout` | None. Synchronous pump on user actions |
| Cards in state | Mutable `Card` instances (table only) | `PCard` / `cardKey` strings |
| Deck | `StdDeck` (real shuffle) | `FixedDeck` (scripted, `shuffle` is a no-op restore) |
| Persistence | `preferences`, `stats` | New optional `tutorial` member of the same blob |

### 1.3 Module boundaries (import direction — do not invert)

```text
src/app/entities.ts            ← no tutorial imports
src/app/game.ts                ← entities only                 (E1–E4)
src/app/scoreCopy.ts           ← game types only               (E5; not imported by game.ts)
src/app/persistence.ts         ← game types + tutorial types   (P1; lazy-import findLesson)
src/features/tutorial/*        ← app/* + PCard type only
src/components/GroupList.tsx   ← ScoringGroup type only
src/components/ScoreExplanation.tsx ← GroupList + scoreHandDetailed
src/components/tutorial/*      ← features/tutorial + app/* + components/*
src/screens/Learn.tsx          ← catalog + tutorial components
src/screens/Lesson.tsx         ← tutorial + persistence + (S4 only) thePlayer/gameSlice
src/screens/RulesReference.tsx ← existing accordion copy
```

`src/features/tutorial/*` must not import `src/app/gamePlayer.ts` or `src/features/game/gameSlice.ts` beyond the `PCard` type. Enforced by `src/features/tutorial/boundary.test.ts`.

**Explicitly unchanged:** `gamePlayer.ts`, `gameSlice.ts` (except being *called* from `Lesson.tsx` via existing `resetGameUi` / `setDifficulty`), `store.ts`, `hooks.ts`, `difficulty.ts`, `useCardMetrics.ts`, `CardComponents.tsx`, `CribbageBoard.tsx`, `DifficultyModal.tsx`, `Splash.tsx`, `Stats.tsx`, `FriendPlay.tsx`, `index.tsx`, `package.json` dependencies, `vite.config.ts`, `Dockerfile`, `nginx.conf`, `public/**`. `README.md` stays stale CRA text.

### 1.4 Data flow

**Live explanations (phase 1):**

```text
CribbageGame.scores + saved hands
  → Cribbage.tsx maps Card.toObject() as PCard
  → ScoreExplanation (useMemo → scoreHandDetailed)
  → GroupList
```

**Lesson (phases 2–4):**

```text
/learn/:lessonId
  → findLesson(id)
  → useReducer(makeTutorialReducer(lesson), initialRunnerState(lesson, resumeIndex))
  → TutorialShell
       ├─ workspace: HandScoringExercise | DiscardExercise | PeggingExercise | GuidedRoundView
       └─ CoachPanel
  → submit → tutorialGrading.* → engine (scoreHandDetailed / rankDiscards / explainPegPlay)
  → on step complete / unmount → saveTutorialProgress + recordConceptAttempt
```

**Guided round (phase 5):**

```text
GuidedRound(script)
  → FixedDeck + CribbageGame(dealer preset) + pump(start-round)
  → need-discard / need-play-card / need-starter-card
       opponent → script
       player   → suspend (awaiting)
  → view() → GuidedRoundView (presentational)
  → learner submitDiscard / submitPlay / completeCount / acknowledge
  → pump continues synchronously
```

**Handoff (phase 6) — order is load-bearing:**

```text
savePreferences({ difficulty: "easy" })
thePlayer.resetForNewSession()
dispatch(resetGameUi())          // returns initialState; difficultyChosen: false
dispatch(setDifficulty("easy"))  // easy AND difficultyChosen: true
navigate("/play")
```

`resetGameUi` must come *before* `setDifficulty`. Setting `difficultyChosen: true` suppresses `DifficultyModal`, which means `Cribbage.tsx`'s `useEffect` on `!difficultyChosen` will **not** call `resetForNewSession` — hence the explicit call. This is the only tutorial code that may touch `thePlayer` or `gameSlice` actions, and it lives in `src/screens/Lesson.tsx`, not under `src/features/tutorial/`.

### 1.5 Component relationships

```text
Learn (/learn)
  ├─ Beginner-path panel (flag on) ──► /learn/:lessonId
  └─ RulesReference (id="rules")

Lesson (/learn/:lessonId)
  └─ TutorialShell
       ├─ RoundMap
       ├─ workspace (one of T5–T8)
       │    └─ SelectableHand + GroupList / ScoreExplanation
       ├─ CoachPanel
       └─ Rules Offcanvas → RulesReference (same component)

Cribbage (/play)                    ← unchanged state machine
  └─ ScoreExplanation × 3 → GroupList
```

---

## 2. Implementation Phases

Each phase is independently reviewable and leaves `main` green. Phase 0 is the only phase that can break existing gameplay; it lands alone. Phase 1 is user-visible value with no curriculum. Phases 2–3 are pure logic. Phase 5 is the highest-complexity piece and is last among the core work so a schedule slip degrades to "explanations plus lessons 1–4 and 7" rather than "nothing". `second-round` (lesson 6) is the only deferrable item in the release — if deferred, **remove** it from `BEGINNER_PATH`; do not ship a half-built lesson.

```text
Phase 0  Engine foundation          E1 E2 E3 E4 E5     ──┐
                                                          │
Phase 1  Live explanations          U1–U5                │  can start after E3
                                                          │
Phase 2  Content model              C1–C5                │  C1 anytime; C2/C4 need E3/E4
                                                          │
Phase 3  Runner + persistence       R1 R2 R3 P1 P2    ───┤  needs C1 + E3/E4
                                                          │
Phase 4  Lesson UI                  T1–T7 S1 S2 S3       │  needs 2 + 3
                                                          │
Phase 5  Guided rounds              G1 G2 G3 T8          │  needs 3; T8 after T1–T5
                                                          │
Phase 6  Handoff, flag, docs        S4 A1 A2 A3          ┘  last
```

Work that can overlap without blocking:

- After **E3** lands: Phase 1 UI and Phase 2 types/catalog authoring can proceed in parallel.
- **C1** (types only) can start on day one; it does not need the kernel.
- **P1** can start once **C1** exists (lazy `findLesson` can be stubbed until C3).
- **T1–T4** (shell, map, cards, coach) can start as soon as C1 + R1 types exist, using fixture lessons.
- **G1** (`FixedDeck`) can start as soon as C1's `CardSpec` exists; it does not need the runner.

### Phase exit criteria (from the spec, operationalised)

| Phase | Work items | Exit criteria |
| --- | --- | --- |
| **0** | E1–E5 | `game.test.ts` unmodified and green; S-E1…S-E10 pass; no UI files in the diff. |
| **1** | U1–U5 | One completed `/play` round shows three correct breakdowns; browser at 100% and 200% zoom; `ScoreExplanation` / `GameOverModal` tests updated. |
| **2** | C1–C5 | `validateCatalog()` returns `[]`; seven lessons, both scripts, all required scenarios exist; no UI. |
| **3** | R1–R3, P1–P2 | Reducer + grading tests pass; a lesson can be driven to completion with no DOM; persistence sanitisation tests pass; boundary test passes. |
| **4** | T1–T7, S1–S3 | Lessons 1–4 and 7 completable in the browser, keyboard-only, at 320px and 200% zoom. Learn landing shows Start/Resume. |
| **5** | G1–G3, T8 | S-G1…S-G6 pass for **both** scripts; both rounds completable and restartable in the browser; training-deal notice always visible. |
| **6** | S4, A1–A3 | Easy-game handoff has no stale state; full browser pass (spec 14.5) recorded; `AGENTS.md` updated; flag-off build verified. |

---

## 3. Detailed Tasks

Task IDs are stable. A PR may land one task or a listed bundle. **Suggested first ticket:** `0.1` + `0.2` together (E1+E2+E3). Do not include E4/E5 or any UI in that first PR.

---

### Phase 0 — Engine foundation

No UI. Highest-risk change in the feature. Land as its own reviewable commit.

#### Task 0.1 — Card identity helpers (E1)

**Goal.** Add three pure exports so every later module can name a card without mutating `Card`.

**Spec:** §4 E1  
**Depends on:** none  
**Files:** create `src/app/entities.test.ts`; modify `src/app/entities.ts` only (add exports; **do not** change `Card`, `Hand`, `StdDeck`, or `Deck`).

```ts
export const RANK_NAMES: Record<Rank, string>
export const SUIT_NAMES: Record<Suit, string>
export function cardKey(card: Card): string   // "5H", "10D", "JS"
export function cardName(card: Card): string  // "five of hearts"
```

**Key decisions.**

- `cardKey` is `rank_map[rank] + suit_map[suit]`. Matches deck-art filenames under `/img/decks/{code}/`. Do not add an `id` field to `Card` (spec 2.3.4).
- Not unique for the synthetic `"joker"`-suit cards used by EV helpers — that is fine; those never appear in lessons.
- `cardName` is lower-case; callers capitalise via CSS or sentence construction.
- Both are total functions over the declared `Rank` / `Suit` unions.

**Acceptance criteria.**

- [ ] S-E1: `cardKey` is unique across all 52 real cards and matches the art filename form (`AH.png` → `"AH"`).
- [ ] `cardName(new Card("hearts", 5)) === "five of hearts"`.
- [ ] No class body in `entities.ts` changes.

**Verify:** `npx vitest run src/app/entities.test.ts`

---

#### Task 0.2 — Pure scoring kernel + `scoreHandDetailed` (E2, E3)

**Goal.** One kernel, two façades. `scoreHand` keeps its exact signature and allocation profile. `scoreHandDetailed` returns structured groups. Inputs are never mutated.

**Spec:** §4 E2, E3, and the run-equivalence proof  
**Depends on:** 0.1  
**Files:** `src/app/game.ts`; create `src/app/game.detailed.test.ts`. **Do not** modify `src/app/game.test.ts` assertions.

**This is the highest-risk change. Both halves of E2 must land in the same commit.**

**E2a — stop mutating the caller's array.** Today, when `cutCard === undefined`, `eH = hand` aliases the caller and `eH.sort(...)` reorders it (`game.ts` 49–59). `calcExpectedHandScore` therefore leaves `rankDiscards`' `keep` array rank-sorted as a side effect. `T1_FIXTURES` assert that order.

Replace with an **unconditional shallow clone** before sorting:

```ts
const eH = cutCard ? [...hand, cutCard] : [...hand]
eH.sort((c1, c2) => c1.rank - c2.rank)
```

**E2b — compensate in `rankDiscards`.** Immediately after building `eH` and before scoring (`game.ts` ~168):

```ts
s.forEach((n) => eH.push(hand[n]))
eH.sort((c1, c2) => c1.rank - c2.rank)  // was a side effect of scoreHand; now explicit
```

Comparator is **rank-only** (not rank-then-suit). `Array.prototype.sort` is specified stable; that stability is what produces the current order for equal ranks. Extend the existing stability comment on `rankDiscards`.

**E3 — extract the kernel.**

```ts
function computeHandScore(
  hand: ReadonlyArray<Card>,
  cutCard: Card | undefined,
  isCrib: boolean,
  sink?: Array<ScoringGroup>,
): number

export function scoreHand(hand: Array<Card>, cutCard: Card | undefined, isCrib: boolean): number
  // calls computeHandScore with no sink; same signature as today

export function scoreHandDetailed(
  hand: ReadonlyArray<Card>,
  cutCard: Card | undefined,
  isCrib: boolean,
): HandScoreResult
```

When `sink` is `undefined`, allocate **no** group objects and **no** label strings. `rankDiscards` performs ~18,000 `scoreHand` calls per discard (Auto Select + every AI discard). A naïve `scoreHand = scoreHandDetailed(...).total` is an unacceptable regression (spec 2.3.2).

**Enumeration rules** (must reproduce current totals exactly):

| Category | Rule | Points |
| --- | --- | --- |
| `fifteen` | Every subset of size ≥ 2 whose `Card.value` sum is 15. Uses existing `nonUnarySubsetsOf5` / `nonUnarySubsetsOf4`. A 2-card pair is emitted as `pair` only (match `scoreSubset`'s early return). | 2 each |
| `pair` | Every unordered pair of equal rank. Atomic. Three of a kind → 3 groups (6); four of a kind → 6 groups (12). Display aggregation is UI (U1). | 2 each |
| `run` | Sort by rank ascending (stable). Maximal chains where consecutive sorted ranks differ by 0 or 1. For distinct ranks `r…r+k` with `k+1 ≥ 3` and multiplicity `m_i`, emit the Cartesian product: `∏ m_i` groups, each worth `k+1`. | `k+1` each |
| `flush` | From the **four hand cards only** (`hand[0].suit`). Non-crib: 4, plus starter id and 5 if starter matches. Crib: 5 only when all four *and* starter match; else 0. | 4, 5, or 0 |
| `nobs` | `countNobs === 1` → one group with the jack's `cardKey`. His heels / `his-nibs` is **not** a hand-scoring group. | 1 |

Paste the spec's run-equivalence proof into a comment on the run branch.

**Group contract.**

```ts
export type ScoringCategory = "fifteen" | "pair" | "run" | "flush" | "nobs"
export type ScoringGroup = {
  id: string                    // `${category}:${cardIds.join("-")}`
  category: ScoringCategory
  cardIds: ReadonlyArray<string> // cardKey, ascending rank then suit
  points: number
  label: string                 // "5 + K = 15", "Pair of fives", "Run of three: 4-5-6", …
}
export type HandScoreResult = {
  total: number
  groups: ReadonlyArray<ScoringGroup>
  isCrib: boolean
  starterIncluded: boolean
}
```

- Empty hand → `{ total: 0, groups: [], isCrib, starterIncluded: false }`. Never throw. (Today `hand[0].suit` throws; B8.)
- No starter → `starterIncluded: false`, four-card scoring, flush capped at 4.
- Group order: `fifteen`, `pair`, `run` (longest first), `flush`, `nobs`; within a category, ascending by `cardIds.join()`.
- Labels are plain language, no punctuation-only output.

**Acceptance criteria.**

- [ ] `T1 rankDiscards` and `ranking wrappers stay Expert` in `game.test.ts` pass **unmodified**.
- [ ] S-E2: `scoreHand` and `scoreHandDetailed` do not reorder or mutate the argument, with and without a starter.
- [ ] S-E3: `scoreHandDetailed(...).total === scoreHand(...)` exhaustively over all 6,188 five-card rank multisets (`C(13+5-1, 5)`), under at least four suit patterns (all-same, three-same, two-two, all-different), `isCrib` both ways, plus a 50,000-deal random sweep from a real deck.
- [ ] S-E4: run-group sums equal the legacy formula for every case in the proof (`3/6/9/12` and `4/8/5`).
- [ ] S-E5 named fixtures: 29-hand (four fives + nobs → 8 groups, total 29); a card in two fifteens; a double run; a double-double run; four-card hand flush with off-suit starter; the same four as a crib (0 and 5); nobs present/absent.
- [ ] S-E6: group `id`s unique within a result; order deterministic across runs.
- [ ] S-E7: `scoreHandDetailed([], undefined, false)` → total 0, no throw.
- [ ] PR description records a local `rankDiscards` timing on one six-card hand before and after (not a CI assertion). `scoreHand` must pass no sink — confirm in review.

**How to generate the 6,188 rank multisets.** Combinations-with-repetition of 13 ranks taken 5 at a time. For each multiset, instantiate four suit colourings. Compare totals only in the hot assertion; inspect groups in the named fixtures.

**Do not.** Change `scoreHand`'s signature. Fork a second scoring implementation. Allocate groups on the no-sink path. Touch any `.tsx` file.

**Verify:** `npx vitest run src/app/game.test.ts src/app/game.detailed.test.ts`

---

#### Task 0.3 — `explainPegPlay` and `doAction` consumption (E4)

**Goal.** Pure pegging explanation. `doAction`'s `play-card` branch calls it once and maps events to the existing `scoreAction` reason tokens.

**Spec:** §4 E4, E4a, E4b  
**Depends on:** 0.1 (cardKey); can land after or with 0.2  
**Files:** `src/app/game.ts`; extend `src/app/game.detailed.test.ts`; extend `src/app/game.test.ts` **only** with S-E9 (add tests; do not edit existing assertions).

```ts
export type PegCategory = "fifteen" | "thirty-one" | "run" | "pair"
export type PegEvent = {
  category: PegCategory
  points: number
  cardIds: ReadonlyArray<string>  // play order
  label: string
}
export type PegPlayResult = {
  legal: boolean
  newCount: number                // even when illegal ("that would make 34")
  events: ReadonlyArray<PegEvent>
  total: number
}
export function explainPegPlay(
  playingSequence: ReadonlyArray<Card>,
  card: Card,
): PegPlayResult
```

**Rules.**

- Pure. May build a throwaway `Hand` to reuse `calcTailRunScore` / `calcTailPairScore` (already non-mutating). Do not mutate `playingSequence`.
- `legal = sum(values) + card.value <= 31`. Illegal → `events: []`, `total: 0`.
- Event order is **fifteen, thirty-one, run, pair** — the exact order `doAction` currently pushes scores (lines 776–790). Order is observable because scores apply sequentially and can cross 121.
- `run` `cardIds`: trailing `n` cards **in play order** (so the coach can show 5-3-4).
- `pair` `cardIds`: trailing equal-rank cards.
- `fifteen` / `thirty-one` `cardIds`: the whole sequence including the played card.
- Go and the last card stay in `doAction` (E4b). They are state-machine decisions, not play-score events.

**E4a — rewrite the `playing` / `play-card` branch.** After the existing validate + add-to-`playingHand` + over-31 rollback:

```ts
const result = explainPegPlay(/* sequence before this card */, action.cards[0])
// or: explainPegPlay on the hand-minus-this-card, plus the card
```

Map `result.events` to `this.scoreAction(...)` with the current tokens: `"15"`, `"31"`, `"run"`, `"pair"`. Consult `result.legal` for the over-31 rollback (still remove the card from `playingHand` inside `doAction`). **Do not score twice.**

**Acceptance criteria.**

- [ ] S-E8: 15, 31, pair/triple/quad (2/6/12), in-order and out-of-order runs, illegal play reports `legal: false` with the would-be count, canonical event order.
- [ ] S-E9: for 200 random pegging positions, `doAction` score actions equal `explainPegPlay(...).events` in reason order and point value.
- [ ] Every existing pegging test in `game.test.ts` still passes unmodified.
- [ ] `categoryFor` still recognises the same reason strings.

**Do not.** Move last-card / go into this helper. Change reason tokens. Use `rankPlays` here — it is an EV heuristic, not a scorer (spec 2.3.1).

**Verify:** `npx vitest run src/app/game.test.ts src/app/game.detailed.test.ts`

---

#### Task 0.4 — Shared score copy (E5)

**Goal.** Learner-facing (and toast-available) strings keyed by every `GameAction.reason` that `categoryFor` recognises.

**Spec:** §4 E5  
**Depends on:** 0.3 (so the reason set is final)  
**Files:** create `src/app/scoreCopy.ts`. Do **not** import this from `game.ts` (keep the engine copy-free).

**Decision (this plan).** Put the map in `scoreCopy.ts`, not `game.ts`. GuidedRound, the coach, and any future toast layer all need it; the spec allows a new file once the map is more than a handful of lines, and forbids `game.ts` importing copy.

```ts
export const SCORE_REASON_COPY: Record<string, string>
// "15"              → "fifteen — 2"
// "31"              → "thirty-one — 2"
// "run"             → "a run in the play"
// "pair"            → "a pair in the play"
// "the-last-card"   → "the last card — 1"
// "his-nibs"        → "his heels (his nibs) — the starter is a jack, 2 to the dealer"
// "show-non-dealer" / "show-dealer" → "hand count"
// "show-crib"       → "crib count"
```

**Decision (this plan).** Export a `SCORE_REASON_TOKENS` constant (or export `categoryFor`) so S-E10 does not duplicate the reason list. Prefer exporting `categoryFor` — it already exists at `game.ts:378` and is the source of truth.

**Acceptance criteria.**

- [ ] S-E10: every reason `categoryFor` recognises has an entry.
- [ ] Player-facing copy says "his heels (also called his nibs)". Code identifiers stay `his-nibs`.

**Verify:** `npx vitest run src/app/game.detailed.test.ts`

**Phase 0 done when:** lint, full vitest, and build are green; `git diff src/app/game.test.ts` shows only the additive S-E9 block (or is empty if S-E9 was deferred into the same file's new describe).

---

### Phase 1 — Live explanations

Ships user value with no curriculum. Spec Q1: this is its own release if needed.

#### Task 1.1 — `GroupList` (U1)

**Goal.** One presentational list for `ScoringGroup[]`, used by the table, the modal (if ever), and every lesson.

**Spec:** §5 U1  
**Depends on:** 0.2 (type only — can stub the type if 0.2 is in the same branch)  
**Files:** create `src/components/GroupList.tsx`, `src/components/GroupList.test.tsx`.

```ts
export type GroupListProps = {
  groups: ReadonlyArray<ScoringGroup>
  total: number
  activeGroupIds?: ReadonlyArray<string>
  variant?: "compact" | "list"
  aggregatePairs?: boolean   // default true
}
```

**Rules.**

- Render an `<ol>` of `label` + points, then a labelled total row.
- Points are never colour-alone; every row carries the numeral.
- `aggregatePairs`: 3 same-rank pair groups → "Three of a kind — 6"; 6 → "Four of a kind — 12". Underlying group ids remain the highlight keys.
- No engine imports beyond the `ScoringGroup` type.

**Acceptance criteria.**

- [ ] Known 29-hand renders eight atomic groups when `aggregatePairs={false}`, and aggregated pair copy when default.
- [ ] Active ids get a non-colour-only marker (outline or text).
- [ ] Compact and list variants both show the total numeral.

**Verify:** `npx vitest run src/components/GroupList.test.tsx`

---

#### Task 1.2 — Upgrade `ScoreExplanation` (U2)

**Goal.** Keep the current prop contract as a **superset**. Derive groups from `PCard`s via the engine.

**Spec:** §5 U2  
**Depends on:** 0.2, 1.1  
**Files:** `src/components/ScoreExplanation.tsx`, `src/components/ScoreExplanation.test.tsx`.

```ts
export type ScoreExplanationProps = {
  hand: Array<PCard>
  starter: PCard | null
  isCrib: boolean
  total: number
  title?: string
  variant?: "compact" | "list"
}
```

**Behaviour.**

- Return `null` when `hand.length === 0` **or** `total < 0`. The second guard matters: `game.scores['player-hand' | 'opponent-hand' | 'crib']` are `-1` between rounds (`resetGame`, `game.ts:961`).
- Map `PCard → new Card(suit, rank)` and call `scoreHandDetailed` inside `useMemo` keyed on card keys, `isCrib`, and the starter.
- Render optional `title`, then `<GroupList>`.
- Display the **prop** `total` (engine ledger). If it disagrees with the derived total, still show the prop and `console.log` both values once (existing diagnostic style).
- Keep `.scoreExplanation` / `.scoreExplanation-total`.

**Acceptance criteria.**

- [ ] Existing `Cribbage.tsx` call site compiles unchanged.
- [ ] Replace the "coming soon" test with group + total assertions for a known hand.
- [ ] Empty-hand → `null`. Negative total → `null`.

**Do not.** Pass `Card` instances as props (I4).

**Verify:** `npx vitest run src/components/ScoreExplanation.test.tsx`

---

#### Task 1.3 — Three table panels + CSS (U3, U5)

**Goal.** Show breakdowns for player, opponent, and crib at the show, without overlapping the board.

**Spec:** §5 U3, U5  
**Depends on:** 1.2  
**Files:** `src/Cribbage.tsx`, `src/App.css`.

| Panel | Gate | `hand` | `starter` | `isCrib` | `total` |
| --- | --- | --- | --- | --- | --- |
| Your hand (exists) | `uiState.showPlayer` | `game.savedPlayerHand.hand` | `game.starter` | `false` | `game.scores['player-hand']` |
| Opponent (new) | `uiState.showOpponent` | `game.savedOpponentHand.hand` | `game.starter` | `false` | `game.scores['opponent-hand']` |
| Crib (new) | `uiState.showCrib` | `game.crib.hand` | `game.starter` | `true` | `game.scores['crib']` |

Convert with the existing `c.toObject() as PCard` idiom. `variant="compact"`.

**Layout.** `.scoreExplanationShow` is at `top: 250px; left: 170px` (`App.css:531`). Add:

- `.scoreExplanationShow--crib` — starting `top: 250px; left: 470px`
- `.scoreExplanationShow--opponent` — starting `top: 640px; left: 170px`

These are starting values only. **U3 is not done** until a five-group hand at default zoom and at 200% does not overlap the board (`left: 850px`), the pegging row, or another panel.

**Fallback (decide during this task, not later):** if three panels cannot fit, ship a single panel with a segmented control (You / Opponent / Crib). Record the choice in the PR.

**U5 CSS block** — append to `App.css` under the existing section-header convention:

```css
/* ---------------------------------------------------------------------------
   Score breakdown + tutorial
   --------------------------------------------------------------------------- */
```

Palette only: `#0d3b24`, `#14532d`, `#166534`, `#f4efe2`, `#f7e7b0`, `#d9c48a`, `#c9b36a`. All motion inside `@media (prefers-reduced-motion: no-preference)`. No `!important`. Tap targets ≥ 44×44 CSS px for every new interactive control (none expected in this task).

**Acceptance criteria.**

- [ ] Browser: complete one `/play` round; three panels appear at the show; each total matches the numeral beside the hand.
- [ ] Browser at 200% zoom: panels remain readable and do not cover the cards.
- [ ] Cards never cross the prop boundary as `Card` instances.

**Verify:** `npm start` → play one full round at 100% and 200%. Plus `npx vitest run src/Cribbage.test.tsx` (must stay green).

---

#### Task 1.4 — Remove the `GameOverModal` stub (U4)

**Goal.** Delete the empty-hand `<ScoreExplanation>` that would throw once U2 is real (`hand[0].suit`).

**Spec:** §5 U4, gap B8  
**Depends on:** 1.2 (so the stub is no longer the only "explanation" in the repo)  
**Files:** `src/components/GameOverModal.tsx`, `src/components/GameOverModal.test.tsx`.

The modal already shows the per-category ledger. A per-hand breakdown there has no hand to explain.

**Acceptance criteria.**

- [ ] `ScoreExplanation` import and usage are gone.
- [ ] Test "shows raw totals, rounds, difficulty, and the explanation slot" no longer asserts "point-by-point breakdown coming soon"; rename the case.
- [ ] Ledger totals, Play Again, and Back to Menu still pass.

**Verify:** `npx vitest run src/components/GameOverModal.test.tsx`

**Phase 1 done when:** one live round shows three correct breakdowns; Game Over no longer mentions "coming soon"; lint/test/build green.

---

### Phase 2 — Content model

Pure TypeScript data. No UI. New directory `src/features/tutorial/`.

#### Task 2.1 — Types and flag helper (C1, part of A2)

**Goal.** Every tutorial type in one file. Compile-time curriculum version.

**Spec:** §6 C1, §11 A2 (`tutorialEnabled`)  
**Depends on:** 0.2 (`ScoringCategory`), entities `Rank`/`Suit`, game `PlayerEvent`  
**Files:** create `src/features/tutorial/tutorialTypes.ts`; modify `src/vite-env.d.ts`.

Copy the types from spec §6 C1 verbatim: `CURRICULUM_VERSION = 1`, `ConceptId`, `REQUIRED_CONCEPTS`, `CHECKPOINT_CONCEPTS`, `CardSpec`, `HintTiers`, `ScoreScenario`, `DiscardScenario`, `PegScenario`, `RoundCheckpoint`, `RoundScript`, `HintPolicy`, `TutorialStep`, `Lesson`.

Also export:

```ts
export function tutorialEnabled(): boolean {
  return import.meta.env.VITE_TUTORIAL_PATH !== "off"
}
```

Add to `src/vite-env.d.ts`:

```ts
interface ImportMetaEnv {
  readonly VITE_TUTORIAL_PATH?: "on" | "off"
}
interface ImportMeta { readonly env: ImportMetaEnv }
```

**Decisions already settled.** `body` is `ReadonlyArray<string>` of paragraphs — no markdown, no `dangerouslySetInnerHTML`. Lesson and step `id`s are persisted; changing one requires bumping `CURRICULUM_VERSION`. No scenario stores a score or a correct combination.

**Acceptance criteria.**

- [ ] File compiles. No runtime behaviour yet.
- [ ] `REQUIRED_CONCEPTS` and `CHECKPOINT_CONCEPTS` are exported arrays (C4 will enforce them).

**Verify:** `npx tsc --noEmit` (or `npm run build`).

---

#### Task 2.2 — Copy helpers (C5)

**Goal.** Engine facts → learner sentences. Tone is binding.

**Spec:** §6 C5  
**Depends on:** 0.2, 0.3, 2.1  
**Files:** create `src/features/tutorial/tutorialCopy.ts` (and a small unit test beside it or inside `tutorialGrading.test.ts` later).

```ts
export function describeGroup(g: ScoringGroup): string
export function describeMissingCategory(c: ScoringCategory): string
export function describeDiscardComparison(
  chosen: DiscardOption, best: DiscardOption, isPlayerCrib: boolean,
): { plain: string; math: string }
export function describePegOutcome(r: PegPlayResult): string
export const TRAINING_DEAL_NOTICE: string  // I6
```

**Tone (code-reviewable).**

- Use: "That makes 15, so it scores 2." / "You found all the pairs. There is still one run." / "Legal play, but another card scores now — want a clue?" / "Because this is their crib, avoid feeding a pair of fives."
- Never use: "Wrong", "Error", "Suboptimal", a bare EV number as the only explanation, or muggins language.
- EV numbers live in `math` only, revealed behind "Show the math".

**Acceptance criteria.**

- [ ] `describeGroup` reuses `g.label` and adds "for N".
- [ ] `TRAINING_DEAL_NOTICE` cannot be read as a claim about shuffle fairness.
- [ ] Unit tests cover one fifteen, one discard comparison (own crib vs their crib), and one illegal peg.

**Verify:** targeted vitest on the new test file.

---

#### Task 2.3 — Scenarios and lesson catalog (C2, C3)

**Goal.** Author the MVP content. No scores in the data.

**Spec:** §6 C2, C3, G3 (round contents)  
**Depends on:** 2.1; C4 (2.4) will reject bad authoring, so write 2.3 and 2.4 together  
**Files:** `src/features/tutorial/scenarios.ts`, `src/features/tutorial/lessonCatalog.ts`.

**Required scenario ids (do not remove; you may add):**

| Id | Kind | Teaches |
| --- | --- | --- |
| `fifteen-worked` | score-example | fifteens |
| `pair-find` | score-practice | pairs (`require: ["pair"]`) |
| `fifteen-multi` | score-practice | fifteens; one card in two 15s |
| `run-double` | score-practice | double run |
| `count-all` | score-practice | fifteens + pairs + runs, total 7–12 |
| `nobs-vs-heels` | score-example | nobs + his-heels (see note) |
| `flush-hand` | score-example | four-card flush, off-suit starter → 4 |
| `flush-crib` | score-example | same four as crib; `contrastWith: "flush-hand"` |
| `checkpoint-count` | score-practice | independent full count |
| `discard-theirs` | discard-practice | opponent's crib; tempting 5–5; `acceptTopN: 3` |
| `discard-yours` | discard-practice | **same six cards**, `isPlayerCrib: true` |
| `peg-legal` | peg-practice | count 26; `select-legal` |
| `peg-scoring` | peg-practice | 15 or pair vs legal blank; `select-scoring` |
| `peg-go` | peg-practice | go + reset + last card; `play-sequence` |
| `first-round` | round script | non-dealer seat (G3) |
| `second-round` | round script | dealer seat (G3) |

**`nobs-vs-heels` authoring (this plan).** One `ScoreScenario` whose hand+starter produces nobs (jack matching starter suit). His heels is **not** produced by `scoreHandDetailed` (2.3.7). Narrate the contrast in the scenario `prompt` plus a second displayed starter-jack (not scored) — or as adjacent body on the `score-example` step. Do not invent a `his-heels` scoring category.

**Deal-order for `RoundScript.deck` (D12, G1).** 13 cards, authored in **engine deal order**, dealt from the **front**. Non-dealer always receives index 0:

```text
dealer = "opponent"  (first-round)
index : 0  1  2  3  4  5  6  7  8  9 10 11 | 12
to    : P  O  P  O  P  O  P  O  P  O  P  O | starter

dealer = "player"    (second-round)
index : 0  1  2  3  4  5  6  7  8  9 10 11 | 12
to    : O  P  O  P  O  P  O  P  O  P  O  P | starter
```

Put this table in a comment on `RoundScript.deck`. A jack at index 12 in `second-round` pays his heels **to the learner**.

**G3 teaching moments the scripts must contain** (also asserted later in S-G4):

`first-round` (`dealer: "opponent"`): obvious discard into *their* crib; starter is **not** a jack; learner leads and scores a 15 or pair; a go and the last-card point; learner show hand with ≥3 groups across ≥2 categories including nobs; count order non-dealer first.

`second-round` (`dealer: "player"`): discard into *your* crib (right answer differs from round 1); starter **is** a jack (heels to learner); opponent leads; a pegging 31; learner counts second, then the crib (ideally the four-card-flush-that-is-not-a-crib-flush); coach names the contrast ("last round this was theirs").

Neither script may approach 121.

**Catalog exports.**

```ts
export const BEGINNER_PATH: ReadonlyArray<Lesson>     // 7 lessons, ids in spec C3
export const QUICK_PRACTICE: ReadonlyArray<Lesson>    // count-a-hand-practice, peg-practice, cribbage-quirks
export function findLesson(id: string): Lesson | undefined
export function lessonIndex(id: string): number       // -1 if absent
export function nextLessonId(id: string): string | undefined
export const ALL_LESSONS: ReadonlyArray<Lesson>
```

Lesson sequence and step kinds are fixed in spec C3. Estimates sum to ~27 minutes. Landing copy must **not** promise 15 minutes for the whole path: *"Learn your first round in about 15 minutes, or the whole path in about half an hour."* The 15-minute claim is lessons 1–5.

**Learn-page time promise (S2) depends on this.** If you change estimates, update that sentence.

**Acceptance criteria.**

- [ ] All ids in the table exist.
- [ ] `nextLessonId` walks `BEGINNER_PATH` exactly once and ends `undefined`.
- [ ] Quick Practice reuses existing scenarios; no new content.
- [ ] `validateCatalog()` (task 2.4) returns `[]`.

**Do not.** Hard-code a total or a correct discard pair. Use `"joker"` as a suit. Author `FixedDeck` arrays in reverse (`StdDeck` pops from the back; we do not).

---

#### Task 2.4 — Catalog validator (C4)

**Goal.** A pure function used **only by tests**. If a future rules change invalidates a scenario, CI fails.

**Spec:** §6 C4  
**Depends on:** 2.3, 0.2, 0.3; check 7 needs G2 — **split the validator**.  
**Files:** `src/features/tutorial/validateCatalog.ts`, `src/features/tutorial/lessonCatalog.test.ts`.

**Decision (this plan).** Implement checks 1–6, 8–10 in this task. Implement check 7 (full-round `CribbageGame` completion) in Phase 5 once `GuidedRound` exists, as `validateRoundScripts()` called from the same test. Do not import `validateCatalog` from any screen or component (keeps it out of the browser bundle).

```ts
export type CatalogProblem = { where: string; problem: string }
export function validateCatalog(): ReadonlyArray<CatalogProblem>  // empty = valid
```

| # | Check |
| --- | --- |
| 1 | Lesson, step, and scenario ids unique and `/^[a-z0-9-]+$/` |
| 2 | Every `scenarioId` / `scriptId` exists |
| 3 | Real suit+rank; no duplicate `cardKey` within a scenario |
| 4 | Every `ScoreScenario` has `scoreHandDetailed(...).total > 0` and covers each `require` category |
| 5 | Every `DiscardScenario`: `rankDiscards` length 15; `acceptTopN` in 1..15; every `reasons` key is a legal two-card subset; the engine's **best** discard has a `reasons` entry |
| 6 | Peg sequence ≤ 31; hand/script cards distinct from sequence; `explainPegPlay` reports `legal` for each scripted play in order |
| 7 | *(Phase 5)* 13 distinct cards; `opponentDiscard` ⊂ opponent's six (derived from dealer parity, not trusted); `opponentPlays` is exactly the kept four; round completes with no `error` |
| 8 | Every `CHECKPOINT_CONCEPTS` item has an earlier `explain` / `score-example` / `round-map` than the first assessing step |
| 9 | Every `REQUIRED_CONCEPTS` item appears on some lesson |
| 10 | Every lesson's final step is `recap` or `checkpoint` |

**Acceptance criteria.**

- [ ] S-C1: `validateCatalog()` returns `[]`.
- [ ] S-C2: every `BEGINNER_PATH` id resolves; `nextLessonId` walks once.
- [ ] A deliberately broken fixture (duplicate id, authored `"joker"`, zero-total hand) produces a `CatalogProblem` — keep these as extra cases, not as mutations of the live catalog.

**Verify:** `npx vitest run src/features/tutorial/lessonCatalog.test.ts`

**Phase 2 done when:** catalog validates; no `.tsx` files added except any already landed in Phase 1.

---

### Phase 3 — Runner, grading, persistence

#### Task 3.1 — Grading (R2)

**Goal.** The only module allowed to decide whether a learner is right. Every function delegates to the engine.

**Spec:** §7 R2  
**Depends on:** 0.2, 0.3, 2.1, 2.2  
**Files:** `src/features/tutorial/tutorialGrading.ts`, `src/features/tutorial/tutorialGrading.test.ts`.

Implement `gradeScoreSelection`, `gradeDiscard`, `gradePegChoice`, `hintFor` exactly as specified.

**Rules that are easy to get wrong.**

- Match groups by **sorted** `cardIds` sets (selection order is irrelevant).
- `remainingByCategory` is computed from `scoreHandDetailed`, never from scenario metadata.
- `gradeDiscard` uses `rankDiscards(hand, [], scenario.isPlayerCrib)` and matches the discard pair's card keys. `plain` prefers `scenario.reasons[key]`.
- `gradePegChoice.bestScoringCardIds` is the max `explainPegPlay(...).total` across the hand. **`rankPlays` must not be imported for grading** (S-R4). It may only phrase an optional strategic aside, and that number must not be presented as points.
- Hint tier 1 = text; tier 2 = text + one card from an unfound group; tier 3 = all cards of one unfound group (worked example).

**Acceptance criteria.**

- [ ] S-R2: out-of-order valid group credited; non-scoring subset refused with a derived reason; `remainingByCategory` decrements; fully found hand is complete.
- [ ] S-R3: engine-best discard is rank 1; worst of 15 is `accepted: false`; authored `reasons` wins.
- [ ] S-R4: module source does not import `rankPlays` (assert via `?raw` or a grep in the test).

**Verify:** `npx vitest run src/features/tutorial/tutorialGrading.test.ts`

---

#### Task 3.2 — Runner reducer (R1, R3)

**Goal.** Pure, synchronous, serialisable lesson state. No timers. No engine objects.

**Spec:** §7 R1, R3  
**Depends on:** 3.1, 2.1  
**Files:** `src/features/tutorial/tutorialReducer.ts`, `src/features/tutorial/tutorialReducer.test.ts`.

Copy `Feedback`, `StepState`, `RunnerState`, `RunnerAction`, `initialRunnerState`, `makeTutorialReducer` from the spec.

**Decision (this plan) — checkpoint sub-steps.** Spec `TutorialStep` kind `checkpoint` carries `scenarioIds: string[]` (count + discard + peg). `StepState` as specified has no pointer into that list. Add:

```ts
subIndex: number   // 0 .. scenarioIds.length-1 for checkpoint; 0 otherwise
```

`submit` that completes the current checkpoint scenario increments `subIndex` (and resets `selected` / `found` / `hintLevel` / `earned` for the next scenario) until the last scenario, then sets `status: "complete"`. This is a necessary extension of the spec, not a new product decision.

**Behaviour.**

- `submit` grades via R2 and **never** clears `found`. Wrong: increment `attempts`, `retry` feedback that explains why the subset does not score, clear only `selected`.
- Correct: append matched group ids to `found`, add points to `earned`, `status: "complete"` when every required group is found.
- `request-hint` increments `hintLevel` up to 3; idempotent at 3.
- `skip` sets `status: "skipped"` and advances. Skipped steps must **not** enter `completedStepIds` and must not count as mastery.
- `next` past the last step sets `lessonComplete: true`.
- `back` restarts the previous step from a clean `StepState` (no partial replay).
- `guided-round` steps are inert here: the reducer only records `status` when the round reports completion (a `complete-round` action, or `Lesson.tsx` dispatches `next` after `GuidedRound.view().complete`). Add `{ type: "complete-guided-round" }` if you need an explicit signal — prefer that over magically completing on `next`.
- Exhaustive `switch` on `RunnerAction` and `TutorialStep["kind"]`. No silent `default`.

**R3 — mastery accounting** (called from `Lesson.tsx` on step completion, not inside the reducer if that would import persistence; either is fine as long as the reducer stays pure):

- `independentCorrect` += 1 only when `attempts === 1 && hintLevel < 2`.
- `hintsUsed` += final `hintLevel`.
- `attempts` += step `attempts`.
- Skipped: record an attempt, no independent correct.

**Acceptance criteria.**

- [ ] S-R1: all bullets in spec 14.1 S-R1, plus checkpoint `subIndex` advances through three scenarios without marking the lesson complete early.
- [ ] A full `BEGINNER_PATH` lesson (e.g. `count-a-hand`) can be driven to `lessonComplete` with no DOM, using only reducer actions and grading.

**Verify:** `npx vitest run src/features/tutorial/tutorialReducer.test.ts`

---

#### Task 3.3 — Persistence and resume (P1, P2)

**Goal.** Third top-level member of `cribbagex.v1`. Untrusted input. `clearAll` no longer wipes tutorial progress.

**Spec:** §7 P1, P2, I8, Q3  
**Depends on:** 2.1; lazy-import `findLesson` from 2.3  
**Files:** `src/app/persistence.ts`, `src/app/persistence.test.ts`.

```ts
export type ConceptMastery = { attempts: number; independentCorrect: number; hintsUsed: number }
export type TutorialProgress = {
  curriculumVersion: number
  startedAt?: string              // YYYY-MM-DD only
  completedAt?: string
  completedLessonIds: string[]
  skippedStepIds: string[]
  currentLessonId?: string
  currentStepIndex: number
  conceptMastery: Partial<Record<ConceptId, ConceptMastery>>
}
export function loadTutorialProgress(): TutorialProgress
export function saveTutorialProgress(patch: Partial<TutorialProgress>): void
export function recordConceptAttempt(concept: ConceptId, outcome: { correct: boolean; hintLevel: number }): void
export function clearTutorialProgress(): void
```

**Sanitiser rules (treat as a spec).**

- `sanitizeBlob` still discards a blob missing `preferences` or `stats` (`persistence.test.ts:72`). Add `tutorial: sanitizeTutorial(src.tutorial)`. A malformed `tutorial` must **never** invalidate the blob.
- Version mismatch → default progress with the new `CURRICULUM_VERSION`. No partial migration in v1.
- Id arrays: strings, de-duplicated, filtered against the live catalog, capped (e.g. 200).
- `currentLessonId`: dropped unless `findLesson` resolves it.
- `currentStepIndex`: `finiteNumber`, floored, clamped to `0 .. steps.length-1`, else 0.
- `conceptMastery`: known `ConceptId`s only; values `finiteNumber` ≥ 0.
- Dates kept only if `/^\d{4}-\d{2}-\d{2}$/`.
- `saveTutorialProgress` merges over `currentBlob().tutorial` and uses existing `writeBlob` try/catch (quota / private mode is silent).
- `savePreferences` and `recordCompletedGame` must round-trip `tutorial` untouched.
- **`clearAll` now:** clear preferences + stats, **preserve** `tutorial`, write the reduced blob back. Session stats still reset. `clearTutorialProgress` is the Learn-page "Start over". Existing assertions at `persistence.test.ts:53` and `:88` continue to hold.

**Cycle avoidance.** Do not import the catalog at module scope if that creates a cycle. Lazy-import `findLesson` inside `sanitizeTutorial`.

**Extend the boundary test** (`persistence.test.ts:139`): still forbid `gameSlice` and `gamePlayer`; also forbid `guidedRound`.

**P2 resume.** Restore `currentLessonId` + `currentStepIndex`; start that step from a clean `StepState`. Partial answers are not persisted. Refresh mid-guided-round restarts the round from the deal (UI notice before the round begins). Missing lesson → first incomplete `BEGINNER_PATH` lesson, else lesson 1.

**Quick Practice vs progress (this plan).** Completing a `QUICK_PRACTICE` lesson must **not** append to `completedLessonIds`. `currentLessonId` may point at a QP lesson for resume. Path markers on `/learn` only consider `BEGINNER_PATH` ids.

**Acceptance criteria.**

- [ ] S-P1…S-P5 all pass (legacy blob, round-trip, malformed member, version mismatch, `clearAll` preserves tutorial / `clearTutorialProgress` is the inverse).
- [ ] Existing persistence tests still pass, including "clears both stores" (prefs + stats; tutorial is out of that case's scope unless you add progress first).
- [ ] After this task, `Stats.tsx` "Clear statistics" no longer destroys tutorial progress. Add a persistence-level test; a Stats UI test is optional.

**Do not.** Change the storage key. Add a second key. Import `gamePlayer`.

**Verify:** `npx vitest run src/app/persistence.test.ts src/screens/Stats.test.tsx`

**Phase 3 done when:** a lesson is completable in a unit test with no DOM; persistence is resilient; T-B1 can be written (and should be, as `src/features/tutorial/boundary.test.ts`) even before UI exists.

---

#### Task 3.4 — Boundary + analytics seam (T-B1, A2 analytics)

**Goal.** Lock the import graph. Ship a no-op analytics interface so lesson code never grows vendor calls.

**Spec:** §3.1, §11 A2, T-B1, T-B2  
**Depends on:** tutorial files existing  
**Files:** `src/features/tutorial/boundary.test.ts`, `src/features/tutorial/tutorialAnalytics.ts`.

Analytics: `TutorialEventName`, `TutorialEvent`, `AnalyticsSink`, `setAnalyticsSink`, `track`. No sink installed. Allowlisted props only: `attemptBand`, `hintBand`, `durationBand`, `lessonId`, `stepKind`, `curriculumVersion`. Forbidden: card sequences, timestamps, free text, identifiers.

**Acceptance criteria.**

- [ ] T-B1: no file under `src/features/tutorial/` imports `gamePlayer`, `thePlayer`, `store`, or `gameSlice` except the `PCard` type. Use the `?raw` idiom from `persistence.test.ts:139`.
- [ ] T-B2: `track` with no sink is a no-op; source contains no `fetch`, `XMLHttpRequest`, `navigator.sendBeacon`, or vendor hostname; only allowlisted keys appear.

**Verify:** `npx vitest run src/features/tutorial/boundary.test.ts`

---

### Phase 4 — Lesson UI

New directory `src/components/tutorial/`. React Bootstrap + normal flow. `.tutorial-*` classes in the U5 `App.css` block. Palette and reduced-motion rules as in U5.

Accessibility (A1) is acceptance, not polish. Every T-task must meet the A1 items it touches.

#### Task 4.1 — Extract `RulesReference` (S1)

**Goal.** One copy of the rules accordion, used by Learn and the lesson Offcanvas.

**Spec:** §10 S1  
**Depends on:** none (can start anytime)  
**Files:** create `src/screens/RulesReference.tsx`; modify `src/screens/Learn.tsx` (render it inside `id="rules"`); `src/screens/Learn.test.tsx` stays green.

**Do not change the copy.** `Learn.test.tsx` asserts crib flush, his heels, "race to 121", "the low card deals first", and difficulty labels/descriptions.

**Acceptance criteria.**

- [ ] Existing Learn rules tests pass against the new location.
- [ ] `RulesReference` is a named export with no Learn-page chrome.

**Verify:** `npx vitest run src/screens/Learn.test.tsx`

---

#### Task 4.2 — Primitive UI: `RoundMap`, `SelectableHand`, `CoachPanel` (T2, T3, T4)

**Goal.** Shared, accessible controls. No lesson routing yet.

**Spec:** §9 T2, T3, T4; §11 A1  
**Depends on:** 0.1 (`cardName`), 2.1  
**Files:** `src/components/tutorial/RoundMap.tsx`, `SelectableHand.tsx`, `CoachPanel.tsx` and their tests.

**RoundMap.** `Deal → Discard → Starter → Pegging → Show → Crib`. `aria-current="step"` on the highlight. Text marker, not colour alone. Phase names always visible. Reused by the shell, the Learn landing, and the guided-round header.

**SelectableHand.** This is **not** an extension of `CardHand` (B5, 2.3.5). Existing table components stay as they are.

- `<fieldset>` / `<legend>` + one `<button type="button">` per card.
- `aria-pressed` (checkbox) or `role="radio"` + `aria-checked` (radio).
- Accessible name from `cardName` plus state (`"five of hearts, selected"`, `"five of hearts, already counted"`) via a visually-hidden span. Image `alt=""`.
- Visible text badge (`5♥`) so rank/suit never depend on art or colour.
- Faces from `deck.getFaceImageUri(new Card(suit, rank))`. Lessons pass `new StdDeck("rc")`.
- Flex wrap, min 44×44, `:focus-visible`. Native `Space`/`Enter` — no custom key handler.
- `credited` / `hinted`: outline **and** accessible name, never hue alone.
- No absolute positioning. No mutation of passed `PCard`s.

**CoachPanel.** Prompt `<p>`; category progress as a `<dl>` ("Fifteens 1 of 2", "Pairs not started"). Feedback in **one** `aria-live="polite"` `role="status"` region (feedback + running total only). Hint button label: "Hint" → "Another hint" → "Show me one group". "Show the math" is a Bootstrap `Collapse`, closed by default.

**Acceptance criteria.**

- [ ] SelectableHand: one button per card; name contains rank, suit, state; Space toggles; `aria-pressed` tracks selection; `mode="none"` renders no buttons.
- [ ] CoachPanel: a single `role="status"`; hint label changes by tier.
- [ ] RoundMap: current phase is announced to AT via `aria-current`.

**Verify:** `npx vitest run src/components/tutorial/`

---

#### Task 4.3 — Exercises (T5, T6, T7)

**Goal.** Graded workspace components driven by reducer state + dispatch.

**Spec:** §9 T5–T7  
**Depends on:** 4.2, 3.1, 3.2, 2.3  
**Files:** `HandScoringExercise.tsx`, `DiscardExercise.tsx`, `PeggingExercise.tsx` + tests.

**HandScoringExercise** — `score-example`, `score-practice`, checkpoint counting, and the guided-round show (`awaiting: "count-hand"`).

- Starter above the hand (`SelectableHand` `mode="none"`).
- "Count selected cards" / "Clear".
- Credited groups stay in `GroupList` with `activeGroupIds`.
- `score-example` reveals nothing until "Show the next combination" (E3 group order + `label`).
- Wrong subset: derived why (value sum, ranks differ, not consecutive) — not authored.
- Triple / four of a kind: copy tells the learner to select **each pair** (X18).

**DiscardExercise.**

- State crib owner **before** selection is possible.
- Exactly two selections; "Confirm two discards" disabled otherwise.
- On confirm: learner keep vs engine best keep, `plain` first, "Show the math" for EV, "Try another discard" that does not extra-penalise beyond the first submission.

**PeggingExercise.**

- Persistent running count as text beside the sequence.
- `select-legal`: multi-select; mark each card legal/illegal with the resulting count.
- `select-scoring`: single-select; `explainPegPlay`; name the combination.
- `play-sequence`: alternate with `opponentScript`; pause to explain out-of-order runs, go, who leads after reset, why last card scores.
- Motion only on the played card, and only inside `prefers-reduced-motion: no-preference`.

**Acceptance criteria.**

- [ ] HandScoringExercise: correct group stays credited; wrong subset keeps prior credit and shows a reason; running total matches `GroupList`; three hint tiers escalate; keyboard-only full count.
- [ ] Discard: confirm disabled at 0/1/3 selections; authored reason shown for the best discard.
- [ ] Peg: illegal card reports the would-be count; scoring choice names fifteen/pair/run from `explainPegPlay`, not `rankPlays`.

**Verify:** component tests + keyboard completion of `count-all` in jsdom.

---

#### Task 4.4 — `TutorialShell` (T1)

**Goal.** Frame for every step: header, round map, workspace + coach, footer.

**Spec:** §9 T1; A1  
**Depends on:** 4.1, 4.2, 4.3, 3.2  
**Files:** `src/components/tutorial/TutorialShell.tsx`.

Layout: `Container` + `Row`/`Col` (`md={8}` workspace, `md={4}` coach). On narrow screens the coach comes **first** (`order-md-last` on the workspace) so the instruction is above the cards.

- Header: `<h1>` = lesson title; "Step n of m" + `aria-label`. Exit → `/learn`. Rules → Offcanvas with `RulesReference` (not a new tab; not `/learn#rules`). Offcanvas returns focus to its trigger.
- Footer: `ProgressBar` with `label` text (not colour alone); Back; Next disabled until `status !== "in-progress"` except for `explain` / `round-map` / `recap`; "Skip this step" always available.
- Keyboard order: header → round map → workspace cards → coach → footer.
- Headings: one `<h1>`, `<h2>` for workspace and coach.

**Acceptance criteria.**

- [ ] Next stays disabled on an in-progress practice step and is enabled on explain/recap.
- [ ] Skip never marks the step complete (reducer already guarantees this; UI must dispatch `skip`).
- [ ] 320px: coach above cards; footer reachable; no horizontal scroll of the workspace.

**Verify:** render inside a MemoryRouter with a fixture lesson; plus the Phase 4 browser pass.

---

#### Task 4.5 — Learn landing + lesson route (S2, S3)

**Goal.** `/learn` becomes the path hub. `/learn/:lessonId` runs a lesson.

**Spec:** §10 S2, S3, D9  
**Depends on:** 4.4, 3.3, 2.3  
**Files:** `src/screens/Learn.tsx`, `src/screens/Learn.test.tsx`, create `src/screens/Lesson.tsx`, `src/screens/Lesson.test.tsx`, `src/App.tsx`.

**App.tsx** — add **before** the `*` route:

```tsx
<Route path='/learn' element={<Learn />} />
<Route path='/learn/:lessonId' element={<Lesson />} />
```

`*` → `/` must not be relied on: `/learn/nonsense` matches the parameterised route.

**Learn landing (top to bottom).**

1. Existing `.screen-header` (`Learn Cribbage` + Back) — unchanged.
2. Beginner-path panel **only when** `tutorialEnabled()`:
   - Promise line from C3 (15 minutes for first round, half an hour for the path).
   - Primary: `Start beginner path`, or `Resume: {title}, step {n}` when `currentLessonId` resolves.
   - `<RoundMap />` with no phase highlighted.
   - Seven lessons, never locked: `✓` complete / `→` current / `○` not started, each with visually-hidden text; title; minutes; button → `/learn/{id}`.
   - Quick Practice buttons.
   - `Start over` → confirm → `clearTutorialProgress()`.
3. Rules section `id="rules"` → `<RulesReference />`.

**Removed:** `LESSONS` constant, four disabled tiles, "Coming soon" on this page. Keep `.coming-soon` in CSS — `Stats.tsx` still uses it.

Progress: `useState(loadTutorialProgress)` (same idiom as `Stats.tsx:24`). Re-read on focus is **not** required for MVP.

**Lesson.tsx.**

- `useParams()` → `findLesson`. Unknown id **or flag off** → `<Navigate to="/learn" replace />`.
- `useReducer(makeTutorialReducer(lesson), initialRunnerState(lesson, resumeIndex))`.
- Persist on step completion and on unmount.
- `recordConceptAttempt` per completed step (R3).
- `lessonComplete` → append to `completedLessonIds` **if** the lesson is on `BEGINNER_PATH`; show a complete panel with `Next lesson` or (last lesson) a placeholder until S4.
- Not wrapped in `GameLayout` (its `<h1>CRIBBAGE</h1>` would duplicate the lesson heading).

**Acceptance criteria.**

- [ ] Learn.test.tsx: drop disabled-tile / coming-soon assertions; add beginner-path panel, seven links, navigation to `/learn/shape-of-a-round`. Keep every rules-copy assertion.
- [ ] Learn: Start vs Resume; flag-off renders only the rules reference (test via mocking `tutorialEnabled` or `import.meta.env`).
- [ ] Lesson: unknown id redirects; resume opens at the persisted step.
- [ ] `App.test.tsx` splash smoke still passes.

**Verify:** `npx vitest run src/screens/Learn.test.tsx src/screens/Lesson.test.tsx src/App.test.tsx`  
**Browser:** start the path, complete lesson 2 by keyboard only; refresh mid-lesson 2; resume at the same step, clean.

**Phase 4 done when:** lessons 1–4 and 7 are completable in the browser (lesson 7's recap/handoff can be a stub until Phase 6); 320px and 200% zoom hold.

---

### Phase 5 — Guided rounds

Highest complexity. `GuidedRound` is a plain class (D3, I3, I4) because it owns mutable engine objects.

#### Task 5.1 — `FixedDeck` (G1)

**Goal.** A `Deck` that deals a 13-card script from the **front** and whose `shuffle` restores that order.

**Spec:** §8 G1, D12  
**Depends on:** 2.1 (`CardSpec`)  
**Files:** `src/features/tutorial/fixedDeck.ts`, `src/features/tutorial/fixedDeck.test.ts`.

Implement every `Deck` member as specified. Document in a comment that `StdDeck.dealOne` **pops from the back** and `FixedDeck.dealOne` **shifts from the front**, which is why scripts are authored in deal order.

`CardSpec` → `Card` **once per `reset()`**, fresh instances, because `Card.selected` and `Card.isFaceUp` are mutable.

**Acceptance criteria.**

- [ ] S-G1: `shuffle()` is order-preserving; `reset()` restores all 13 as **new** `Card` instances; `dealOne` is front; `removeCard` matches suit+rank.
- [ ] `dealRandomCard` aliases `dealOne` (determinism if `dealOpponentCut` is ever hit).
- [ ] Image URIs delegate to a private `StdDeck(deckCode)`.

**Verify:** `npx vitest run src/features/tutorial/fixedDeck.test.ts`

---

#### Task 5.2 — `GuidedRound` (G2, G3)

**Goal.** Isolated, synchronous, restartable training deal. Productised `pumpUntil` from `game.test.ts:165`.

**Spec:** §8 G2, G3; construction sequence is load-bearing  
**Depends on:** 5.1, 0.3, 0.4, 2.3  
**Files:** `src/features/tutorial/guidedRound.ts`, `src/features/tutorial/guidedRound.test.ts`; finish `validateCatalog` check 7.

**Construction order (do not reorder):**

1. `this.deck = new FixedDeck(script.deck, deckCode)`
2. `this.game = new CribbageGame(this.deck)`
3. `this.game.dealer = script.dealer` — **before** the first action. A fresh game has `gameOver === false`, so `resetGame()` preserves `dealer` (`game.ts:947`). That makes `start-round` skip cut-for-deal.
4. `this.pump([new GameAction("start-round")])`

**Pump.** Local queue. `need-*` answered from the script or by suspending. Everything else → `game.doAction`. Ignore `schedule`. Hard guard 5,000. Any `error` or guard hit → `awaiting: "error"`, coach shows `action.reason`, offer restart. Never wedge the SPA.

| Need | Opponent | Player |
| --- | --- | --- |
| `need-discard` | `script.opponentDiscard` | suspend `awaiting: "discard"` |
| `need-play-card` | next legal card from `script.opponentPlays` (else first legal in hand + diagnostic) | suspend `awaiting: "play-card"` |
| `need-starter-card` | runner `deck.dealOne()` (index 12) | same |

**Peg bookkeeping.** Copy (do not import) the shift in `GamePlayer.handleAction` (`gamePlayer.ts:96–99`) so `CribbageBoard` / `Peg` reuse without change. Each `score` appends a `RoundLogEntry` from `SCORE_REASON_COPY` plus, for pegging, `explainPegPlay`'s label.

**Checkpoints.** After each phase in `script.checkpoints`, stop with `awaiting: "acknowledge"` and the checkpoint `coach`.

**Seat-aware counting (this plan — G2's "show-non-dealer = learner" is first-round-only).**

| Engine action | `first-round` (learner is non-dealer) | `second-round` (learner is dealer) |
| --- | --- | --- |
| `show-non-dealer` | `awaiting: "count-hand"` for the player hand | Show opponent hand + Continue (`acknowledge`) |
| `show-dealer` | Show opponent hand + Continue | `awaiting: "count-hand"` for the player hand |
| `show-crib` | Show crib + Continue | `awaiting: "count-hand"` for the crib (`isCrib: true`) |

`countTask` is populated from the relevant saved hand / crib, `game.starter`, and the engine's emitted score total. `completeCount()` resumes the pump. Terminate at `round-end`: `complete: true`, `awaiting: "done"`. Do **not** start a second deal. Never reach `ending`.

`submitDiscard` / `submitPlay`: resolve ids against the current hand (same lookup as `GamePlayer.playAction` ~283), return `{ ok: false, message }` on bad count / unknown card / over-31. Use `explainPegPlay` for the message. **Never** send an illegal play to the engine (X11).

`reset()` rebuilds `FixedDeck` and `CribbageGame` from scratch. No reused `Card` instances.

**Acceptance criteria.**

- [ ] S-G2: deal alternation parameterised over **both** scripts.
- [ ] S-G3: drive each script end-to-end through the real engine; stages `starting → dealing → selection → playing → showing`; crib ownership; pegging score at each learner play; three show totals against `scoreHand`; `complete: true` at `round-end`.
- [ ] S-G4: every numbered G3 requirement, per round (see task 2.3).
- [ ] S-G5: `reset()` mid-round returns an identical initial view twice (no leaked `selected` / `isFaceUp`), both scripts.
- [ ] S-G6: illegal `submitPlay` does not mutate `playingHand`; illegal discard (1 or 3 cards) is refused.
- [ ] `validateCatalog` check 7 is now live.

**Do not.** Import `thePlayer`. Use `setTimeout`. Call `rankPlays` for scoring copy.

**Verify:** `npx vitest run src/features/tutorial/guidedRound.test.ts src/features/tutorial/lessonCatalog.test.ts`

---

#### Task 5.3 — `GuidedRoundView` (T8)

**Goal.** Presentational wrapper over `GuidedRound.view()`.

**Spec:** §9 T8  
**Depends on:** 5.2, 4.2, 4.3, 1.2  
**Files:** `src/components/tutorial/GuidedRoundView.tsx`; wire into `TutorialShell` / `Lesson.tsx` for `kind: "guided-round"`.

- Header: `RoundMap`, crib owner, persistent `TRAINING_DEAL_NOTICE` (I6).
- Reuse `CribbageBoard` + `Peg` with `view().pegPoints`; `ScoreExplanation` for opponent hand and crib when revealed.
- Discard → DiscardExercise-style selection; play → `SelectableHand mode="radio"`; learner count → T5.
- `Restart this round` always present; **only** recovery from `awaiting: "error"`.
- Before the round: notice that a refresh restarts the deal (P2, X14).

**Acceptance criteria.**

- [ ] Browser: complete `first-round` (cut skipped, discard, learner leads, go, show count, crib shown). Restart mid-round and complete again.
- [ ] Browser: complete `second-round` (learner deals, jack starter + heels, opponent leads, a 31, learner counts second and then the crib).
- [ ] Training-deal notice is visible the whole time.
- [ ] `prefers-reduced-motion: reduce`: no animation.

**Verify:** browser pass items 5–6 in spec 14.5. Component tests for error-state restart and disabled play of an over-31 card.

**Phase 5 done when:** S-G1…S-G6 green for both scripts; both rounds completable and restartable in the browser.

**Deferral rule.** If schedule pressure hits, drop `second-round` **and** lesson `coached-round-dealer` from `BEGINNER_PATH` in the same PR. Do not leave a tile that opens a broken lesson.

---

### Phase 6 — Handoff, flag, docs

#### Task 6.1 — Completion handoff (S4)

**Goal.** Lesson 7 recap plus a one-way door into a clean Easy game.

**Spec:** §10 S4  
**Depends on:** 4.5, 5.3, 3.3  
**Files:** `src/screens/Lesson.tsx`, `src/screens/Lesson.test.tsx`.

Recap shows concept-level results from `conceptMastery` with **three** states only: `ready` (independent), `practised` (assisted), `not yet` (skipped or unattempted).

Primary **Play your first Easy game** runs the exact sequence in §1.4. Secondary: `Practise a weak concept` (deep-link to the relevant Quick Practice lesson), `Rules reference` (Offcanvas), `Back to Learn`.

Skipping every step still shows the handoff button (X15). Never trap a learner in the tutorial.

**Acceptance criteria.**

- [ ] Lesson test: completing the last step shows the handoff; the dispatch sequence leaves the store with `difficulty: "easy"`, `difficultyChosen: true`; `resetForNewSession` is called (spy).
- [ ] Browser: `/play` opens with no difficulty modal, Easy in effect, no stale toasts or queued actions.

**This is the only task allowed to import `thePlayer` or `gameSlice` actions, and only from `Lesson.tsx`.**

**Verify:** `npx vitest run src/screens/Lesson.test.tsx` + browser item 7.

---

#### Task 6.2 — Flag-off path and `vite-env` (A2 remainder)

**Goal.** `VITE_TUTORIAL_PATH=off` restores today's rules-only Learn page.

**Spec:** D9, A2  
**Depends on:** 4.5 (reads the flag)  
**Files:** already declared in 2.1; verify Learn + Lesson + a preview build.

When off: Learn renders the header + `RulesReference` only (no path panel). `/learn/:lessonId` redirects to `/learn`.

**Acceptance criteria.**

- [ ] `VITE_TUTORIAL_PATH=off npm run build && npm run preview` — `/learn` is the rules page; `/learn/count-a-hand` redirects.
- [ ] Default (unset or `"on"`) enables the path.

**Verify:** preview build + existing Learn test with mocked flag.

---

#### Task 6.3 — Accessibility sweep and `AGENTS.md` (A1, A3)

**Goal.** A1 is a checklist, not a hope. Update contributor guidance.

**Spec:** §11 A1, A3  
**Depends on:** all UI tasks  
**Files:** `AGENTS.md` only (plus any a11y bugs found).

`AGENTS.md` additions:

- Functional-area rows for `src/features/tutorial/` and `src/components/tutorial/`.
- Route `/learn/:lessonId`.
- Rules: "the tutorial must never use `thePlayer`" (except the S4 handoff in `Lesson.tsx`) and "`scoreHand` / `scoreHandDetailed` share one kernel — do not fork the rules".
- Persistence: `tutorial` member; `clearAll` preserves tutorial progress.

**Do not** edit `README.md`.

**A1 checklist** (browser, spec 14.5 items 3, 8, 9):

1. Every lesson card is a real `<button>` whose name includes rank, suit, and state.
2. Rank and suit readable without colour and without art.
3. One `aria-live="polite"` `role="status"` per screen; card movement is not announced.
4. Visible focus; focus order = visual order; only the Rules Offcanvas traps focus, and it restores it.
5. Tap targets ≥ 44×44.
6. Full keyboard completion of every lesson type.
7. All motion inside `prefers-reduced-motion: no-preference`; no timer advances.
8. Usable at 320px and 200% zoom without horizontal workspace scroll.
9. One `<h1>` (lesson title); `<h2>` for workspace and coach.

**Verify:** walk spec 14.5 in full, then:

```bash
npm run lint
npx vitest run
npm run build
docker build -t cribbagex .
# run image; GET /learn/count-a-hand must serve index.html (existing nginx try_files)
```

nginx is unchanged; this is a regression check, not a config change.

---

## 4. Data Model

There is **no database, no ORM, and no HTTP API**. All contracts below are TypeScript types plus one `localStorage` document.

### 4.1 Engine types (new, `src/app/game.ts`)

Already specified in tasks 0.2 and 0.3. Summary:

| Type | Role |
| --- | --- |
| `ScoringCategory` | `"fifteen" \| "pair" \| "run" \| "flush" \| "nobs"` |
| `ScoringGroup` | One atomic scoring combination + stable `id` |
| `HandScoreResult` | `{ total, groups, isCrib, starterIncluded }` |
| `PegCategory` | `"fifteen" \| "thirty-one" \| "run" \| "pair"` |
| `PegEvent` / `PegPlayResult` | One play's legality, count, and events |

Existing types reused unchanged: `Card`, `PCard` (`{ suit, rank }`), `DiscardOption`, `PlayOption`, `GameAction`, `GameStage`, `PlayerEvent`.

### 4.2 Persistence blob (`cribbagex.v1`)

Storage key does **not** change. The existing sanitiser already tolerates additive members.

```ts
type StoredV1 = {
  preferences: StoredPreferences          // existing { difficulty }
  stats: StoredStats                      // existing games / wins / lifetime breakdowns
  tutorial: TutorialProgress              // new; always present after a write
}

export type ConceptMastery = {
  attempts: number
  independentCorrect: number
  hintsUsed: number
}

export type TutorialProgress = {
  curriculumVersion: number               // must equal CURRICULUM_VERSION (1) or reset
  startedAt?: string                      // YYYY-MM-DD only
  completedAt?: string
  completedLessonIds: string[]            // BEGINNER_PATH ids only
  skippedStepIds: string[]
  currentLessonId?: string
  currentStepIndex: number
  conceptMastery: Partial<Record<ConceptId, ConceptMastery>>
}
```

**Default progress** (legacy blob, missing member, version mismatch, or failed sanitise):

```ts
{
  curriculumVersion: CURRICULUM_VERSION,  // 1
  completedLessonIds: [],
  skippedStepIds: [],
  currentStepIndex: 0,
  conceptMastery: {},
}
```

**Write API** (no HTTP):

| Function | Contract |
| --- | --- |
| `loadTutorialProgress()` | Always returns a sanitised `TutorialProgress`. Never throws. |
| `saveTutorialProgress(patch)` | Deep-merge over current `tutorial`; `writeBlob` swallows quota / private-mode errors. |
| `recordConceptAttempt(concept, { correct, hintLevel })` | Updates one `ConceptMastery` row using R3 rules. |
| `clearTutorialProgress()` | Replaces `tutorial` with the default; leaves prefs/stats. |
| `clearAll()` | **Changed:** clears prefs + stats + session stats; **preserves** `tutorial`; writes the reduced blob. |

`savePreferences` and `recordCompletedGame` must round-trip `tutorial` untouched. A blob missing `preferences` or `stats` is still discarded wholesale (`persistence.test.ts:72`).

### 4.3 Curriculum records (compile-time data, not a CMS)

Authoring form is `CardSpec = readonly [Suit, Rank]`, the same tuple style as `T1_FIXTURES`. Runtime identity is `cardKey`.

| Record | Key | Loaded by |
| --- | --- | --- |
| `SCORE_SCENARIOS` | scenario id | score-example / score-practice / checkpoint |
| `DISCARD_SCENARIOS` | scenario id | discard-practice |
| `PEG_SCENARIOS` | scenario id | peg-practice |
| `ROUND_SCRIPTS` | script id | guided-round |
| `BEGINNER_PATH` | ordered `Lesson[]` | Learn landing, resume, `nextLessonId` |
| `QUICK_PRACTICE` | ordered `Lesson[]` | Learn landing; not path progress |

`Lesson.id` and `TutorialStep.id` are the compatibility surface. Changing one requires `CURRICULUM_VERSION += 1`, which wipes stored progress (no v1 migrator).

### 4.4 Runner state (in-memory only, not persisted)

```ts
type StepState = {
  stepId: string
  selected: ReadonlyArray<string>         // cardKeys
  found: ReadonlyArray<string>            // ScoringGroup ids or peg event keys
  attempts: number
  hintLevel: 0 | 1 | 2 | 3
  revealed: number
  status: "in-progress" | "complete" | "skipped"
  feedback: Feedback | null
  earned: number
  subIndex: number                        // checkpoint pointer (this plan)
}

type RunnerState = {
  lessonId: string
  stepIndex: number
  step: StepState
  completedStepIds: ReadonlyArray<string>
  lessonComplete: boolean
}
```

A refresh restores only `currentLessonId` + `currentStepIndex`. Interactive fields start clean (I5, P2). `GuidedRound`'s `CribbageGame` is never serialised.

### 4.5 Guided-round view model

`GuidedRound.view()` returns a serialisable `GuidedRoundView` (all `PCard` / numbers / strings). The class instance stays outside React state; the screen holds it in a `useRef` and copies `view()` into React state after each mutating call.

### 4.6 Analytics events (in-process, null sink)

```ts
type TutorialEventName =
  | "tutorial_path_viewed" | "tutorial_started" | "tutorial_step_completed"
  | "tutorial_lesson_completed" | "tutorial_completed" | "coach_game_started"

type TutorialEvent = {
  name: TutorialEventName
  props?: Readonly<Record<string, string | number>>
}
```

Allowlisted `props` keys only: `attemptBand` (`"1" | "2" | "3+"`), `hintBand` (`"none" | "1" | "2-3"`), `durationBand`, `lessonId`, `stepKind`, `curriculumVersion`. No network. No vendor. No sink installed in this release.

### 4.7 Feature flag

`import.meta.env.VITE_TUTORIAL_PATH`: `"on"` | `"off"` | unset. `tutorialEnabled()` is `!== "off"` (default on). Read only in `Learn.tsx` and `Lesson.tsx`.

---

## 5. Edge Cases & Error Handling

These are the spec's X-cases, written as implementation instructions. Each maps to a test or a browser check.

| # | Failure | Required behaviour | Where to implement | Test |
| --- | --- | --- | --- | --- |
| X1 | `scoreHandDetailed` on an empty hand | `{ total: 0, groups: [] }`. Never throw. | `computeHandScore` guard before `hand[0].suit` | S-E7 |
| X2 | `ScoreExplanation` prop total ≠ derived total | Show the **prop**. One `console.log` naming both. Never two numerals. | `ScoreExplanation` | ScoreExplanation test + a unit that stubs a mismatch |
| X3 | Hand scored between rounds (`scores['player-hand'] === -1`) | Component returns `null` | `ScoreExplanation` `total < 0` | ScoreExplanation test |
| X4 | `/learn/does-not-exist` | `<Navigate to="/learn" replace />`. No error UI. | `Lesson.tsx` | Lesson.test |
| X5 | Stored lesson id gone, or step index out of range | Sanitise away; resume first incomplete `BEGINNER_PATH` lesson, else lesson 1 | `sanitizeTutorial` + `Lesson` init | S-P3, P2 |
| X6 | `curriculumVersion` mismatch | Reset **tutorial only**. Prefs/stats untouched. Learn shows "Start beginner path". | `sanitizeTutorial` | S-P4 |
| X7 | `localStorage` missing, full, or throwing | Existing `readBlob`/`writeBlob` try/catch. Tutorial runs; progress does not persist. No user-facing error. | already in `persistence.ts` | existing T9 cases |
| X8 | Corrupt `tutorial` (wrong types, injected keys, 10k-element arrays, `Infinity`) | Defaults / clamped / capped. Blob remains valid. | `sanitizeTutorial` | S-P3 |
| X9 | Selection is not a scoring subset | Derived why (sum / ranks / adjacency). `found` and earned stay. Attempt counted once. | R2 + R1 | S-R2 |
| X10 | Double-toggle or empty submit | Toggle semantics. Submit disabled while empty or wrong size. | T5/T6 + reducer | component tests |
| X11 | Over-31 play in the guided round | `submitPlay` → `{ ok: false }` with `explainPegPlay.newCount`. Engine never sees the action. | `GuidedRound` | S-G6 |
| X12 | Scripted opponent card illegal at run time | First legal card in hand + `console.log`. `validateCatalog` check 6/7 fails in CI so it is fixed at source. | G2 pump | S-G3 + C4 |
| X13 | Pump exceeds 5,000 or engine emits `error` | `awaiting: "error"`. Coach shows the reason. Restart is the only recovery. SPA must not crash. | G2, T8 | guidedRound + GuidedRoundView |
| X14 | Refresh mid-step or mid-round | Same step, clean `StepState`; round restarts from the deal. Notice before the round begins. | P2, T8, Lesson | Lesson.test + browser 4 |
| X15 | Learner skips every step | Path shows incomplete. No concept is `ready`. Handoff button still works. | S2, S4 | Lesson.test |
| X16 | Two tabs write progress | Last write wins. Acceptable; do not add a lock. | — | document only |
| X17 | Deck art 404 | Text badge (T3) keeps the card identifiable. No layout collapse. | T3 CSS | visual / SelectableHand |
| X18 | Triple or four of a kind in a count | Atomic pair groups. `GroupList` aggregates the display. Learner submits one pair at a time. Copy: "select each pair". | U1, T5, C5 | GroupList + HandScoringExercise |
| X19 | Jack as starter | Coach narrates `his-nibs` via `SCORE_REASON_COPY`. Never part of the hand count. | G2, E5 | S-G4 second-round |
| X20 | `prefers-reduced-motion: reduce` | No animation. State changes are instantaneous. | U5, T7, T8 | browser 9 |

**Additional failure modes this plan adds.**

| Case | Handling |
| --- | --- |
| `validateCatalog` imported by a screen | Forbidden. Bundle-size and I1 risk. Boundary/review check. |
| `rankDiscards` console noise during grading | Existing `console.log` in `rankDiscards` will fire on every discard exercise. Do **not** strip it in this feature (unrelated cleanup). Tests should not assert on those logs. |
| `GameOverModal` still passing `hand={[]}` after U2 but before U4 | Land U4 in the same PR as U2, or land U2's empty-hand `null` **before** any call-site change. U2's guard makes the stub safe; still delete it in 1.4. |
| Handoff without `resetForNewSession` | First Easy game inherits queued AI actions / toasts. The Lesson test must spy the call. |
| `resetGameUi` after `setDifficulty` (wrong order) | Modal reappears or difficulty is lost. Follow §1.4 exactly. |
| Authoring `FixedDeck` in `StdDeck` (back) order | Learner gets the opponent's cards. Check 7 + S-G2 catch this. |
| Checkpoint without `subIndex` | Lesson 7 cannot sequence three exercise kinds. Use the extension in 3.2. |

---

## 6. Testing Strategy

Stack: Vitest 3 + jsdom + Testing Library, as in `vite.config.ts`. **No Playwright, no Cypress** (`AGENTS.md`). Engine tests call `scoreHandDetailed` / `explainPegPlay` / `CribbageGame.doAction` directly. Tutorial tests must **not** need `thePlayer.resetForNewSession()` — that fact is itself T-B1.

### 6.1 Per-phase automated tests

| Phase | New / updated files | Must stay unmodified |
| --- | --- | --- |
| 0 | `entities.test.ts`, `game.detailed.test.ts`; additive S-E9 in `game.test.ts` | All **existing** `game.test.ts` assertions, especially `T1 rankDiscards` |
| 1 | `GroupList.test.tsx`; rewrite `ScoreExplanation.test.tsx`; trim `GameOverModal.test.tsx` | `Cribbage.test.tsx` (still green) |
| 2 | `lessonCatalog.test.ts` | — |
| 3 | `tutorialReducer.test.ts`, `tutorialGrading.test.ts`, `boundary.test.ts`; extend `persistence.test.ts` (S-P1…S-P5) | Existing T9 persistence cases |
| 4 | `SelectableHand.test.tsx`, `HandScoringExercise.test.tsx`, `Lesson.test.tsx`; rewrite Learn disabled-tile case | Learn rules-copy assertions |
| 5 | `fixedDeck.test.ts`, `guidedRound.test.ts`; C4 check 7 | — |
| 6 | Handoff cases in `Lesson.test.tsx` | — |

### 6.2 Spec test IDs (do not rename)

Copy this checklist into the PR for the phase that introduces each id.

**Engine:** S-E1…S-E10 (spec 14.1). S-E3 is the expensive one — keep it in `game.detailed.test.ts`, not in the hot `game.test.ts` file. If it is slow locally, it still runs in `npx vitest run`; do not gate it behind an env flag.

**Catalog / runner:** S-C1, S-C2, S-R1…S-R4, S-P1…S-P5, T-B1, T-B2.

**Guided round:** S-G1…S-G6, each parameterised over **both** scripts where the spec says so.

### 6.3 Existing tests that must change (and how)

| File / case | Change |
| --- | --- |
| `Learn.test.tsx` — disabled tiles / coming soon | Drop those assertions. Add path panel, seven links, navigation to `/learn/shape-of-a-round`. Keep every rules-copy assertion. |
| `ScoreExplanation.test.tsx` | Replace "coming soon" with groups + total for a known hand; add empty-hand and negative-total `null` cases. |
| `GameOverModal.test.tsx` — explanation slot | Remove "point-by-point breakdown coming soon"; rename the case. |
| `persistence.test.ts` — "clears both stores" | Keep as is. Add S-P1…S-P5 as **new** cases. |
| `game.test.ts` | **No assertion edits.** If one fails, the kernel is wrong — stop. |

### 6.4 Component / interaction tests (jsdom)

- `SelectableHand`: button per card; name has rank, suit, state; Space toggles; `mode="none"` → no buttons.
- `HandScoringExercise`: credit sticks; wrong subset explains and keeps prior credit; total matches `GroupList`; three hint tiers; keyboard-only full count.
- `CoachPanel`: one `role="status"`; hint label by tier.
- `Lesson`: unknown id redirects; resume at persisted step; last step shows handoff; store ends at `difficulty: "easy"`, `difficultyChosen: true`; `resetForNewSession` spy.
- `Learn`: Start vs Resume; flag off → rules only.

### 6.5 What is not automated

Visual placement of the three table panels (U3) and lesson layout at 200% zoom. Both are gated by the browser pass.

### 6.6 Manual browser pass (not optional)

Run `npm start` (`http://localhost:3000`) and walk spec 14.5:

1. `/play` — one full round; three panels at the show; no overlap; totals match the hand numerals.
2. `/play` at 200% zoom — panels readable, cards not covered.
3. `/learn` — start the path; complete lesson 2 **keyboard only**; confirm live-region announcements (screen reader if available).
4. Refresh mid-lesson 2 and mid-guided-round; both resume at the right step (round restarts from the deal).
5. Complete `first-round` including restart-mid-round.
6. Complete `second-round` (heels, opponent lead, 31, crib count).
7. Finish lesson 7 → Easy-game handoff: no modal, Easy, no stale toasts/queues.
8. 320–390px: coach above cards; footer reachable; no horizontal workspace scroll.
9. `prefers-reduced-motion: reduce` — no animation.
10. `VITE_TUTORIAL_PATH=off npm run build && npm run preview` — rules-only Learn; `/learn/count-a-hand` redirects.
11. `npm run lint`, `npx vitest run`, `npm run build`, Docker image, deep-link `/learn/count-a-hand` (nginx `try_files` → `index.html`).

Record the pass in the Phase 6 PR description (what you clicked, viewport, flag-off result). A screenshot is supporting evidence, not the pass.

---

## 7. Risk Assessment

| # | Risk | Severity | Mitigation | Owner task |
| --- | --- | --- | --- | --- |
| R1 | Kernel silently changes a score or Expert discard order | **High** | E2b explicit sort; exhaustive S-E3; `game.test.ts` unmodified (I2). Phase 0 is its own PR with no UI. | 0.2 |
| R2 | Group allocation lands on the EV hot path; Auto Select / AI discard jank | **High** | Optional sink (D1). Review must confirm `scoreHand` passes no sink. Measure `rankDiscards` on one hand before/after; put the numbers in the Phase 0 PR. Not a CI timing assertion. | 0.2 |
| R3 | Run enumeration diverges on an unusual multiset | Medium | Proof comment + S-E3/S-E4. The rank-multiset sweep is exhaustive, not sampled. | 0.2 |
| R4 | Guided round wedges on an unhandled `need-*` or stage | Medium | 5,000-iteration guard; `awaiting: "error"`; always-on Restart (X13); S-G3 drives both scripts in CI. | 5.2 |
| R5 | A curated scenario is ambiguous or has two defensible answers | Medium | `acceptTopN`; `require` narrows early counting steps; no generated exercises. Usability sessions are product work, not this plan. | 2.3 |
| R5b | Second script's deal parity is inverted (most likely authoring bug) | Medium | Validator derives parity from `script.dealer`. S-G2/G3/G4 parameterised over both scripts. `GuidedRound` / view are seat-agnostic. Deferral = remove lesson 6, do not ship it broken. | 2.3, 5.2 |
| R6 | Scope creep into V2 (adaptive practice, Coach Mode, muggins, …) | Medium | Spec §16 is a hard boundary. Flag lets the path ship without those. | all |
| R7 | Lesson prose drifts after a future rules fix | Medium | I1 + `validateCatalog` recomputes every scenario from the engine. | 2.4 |
| R8 | Absolutely-positioned table cannot fit three panels | Low–Medium | U3 starting positions; browser pass is the gate. Fallback: one panel + You/Opponent/Crib control, decided **during** 1.3. | 1.3 |
| R9 | Persisted progress becomes a compatibility burden | Low | `CURRICULUM_VERSION` reset-on-mismatch (X6). Only ids are persisted; sanitiser filters against the live catalog. | 3.3 |
| R10 | A11y regressions in the new card control | Low | A1 is acceptance. Existing `CardComponents` are untouched, so the table cannot regress. | 4.2, 6.3 |
| R11 | Easy-game handoff leaves stale singleton state | Low | Exact S4 sequence, mirroring `GameOverModal.backToMenu`. Lesson test + browser 7. | 6.1 |
| — | `clearAll` change surprises Stats users who wanted a full wipe | Low | Q3 settled: preserve tutorial. Learn has "Start over". Pin with S-P5. | 3.3 |
| — | Section 16 still lists "a second guided round" as out of scope | Process | **Q4 / D11 win.** Two rounds are in scope. See §8. | — |

### Unknowns that Phase 0 will resolve

- Whether the Cartesian-product run enumeration matches the legacy aggregate on every 4- and 5-card shape. The proof says yes; S-E3 is the experiment. If it fails, **stop** — do not "fix" totals by changing `scoreHand`.
- Whether `rankDiscards` timing regresses even with no sink (extra clone in E2a). A shallow clone of 4–5 cards × 18,000 calls should be noise; the before/after number tells us.

### Unknowns that Phase 1 will resolve

- Whether three compact `GroupList`s fit the 900×800 table canvas for a 29-hand-shaped five-group count at 200% zoom. Fallback is decided in task 1.3.

### Unknowns that Phase 5 will resolve

- Whether `CribbageGame` with a preset `dealer` and `FixedDeck` really skips cutting on `start-round` for **both** seats. S-G3 fails loudly if not. Construction order in 5.2 is the fix.

---

## 8. Open Questions

Spec §17 already settled Q1–Q6 with the business owner. **Do not reopen them.**

| # | Settled decision |
| --- | --- |
| Q1 | Ship live score breakdowns first, as their own release if needed. |
| Q2 | Ship the analytics interface with a null sink (~1 hour). |
| Q3 | `clearAll()` (Stats → Clear statistics) does **not** wipe tutorial progress. |
| Q4 | Two guided rounds (both seats). Lesson 6 is real, not a discard exercise in disguise. |
| Q5 | Path enabled by default; `VITE_TUTORIAL_PATH=off` for an internal build. No percentage rollout. |
| Q6 | Crib-flush vs four-card-flush contrast is on the required path (lesson 2, reinforced in `second-round`). |

The following are the remaining ambiguities. This plan **chooses** so implementation is not blocked. Overturn one only with an explicit note in the PR.

| # | Ambiguity | Recommendation (binding for implementers unless overturned) | Why |
| --- | --- | --- | --- |
| O1 | Spec §16 lists "a second guided round" as out of scope, contradicting Q4/D11 | **Q4 wins.** Two rounds are in scope. §16's bullet is stale relative to §17. | §17 is "decisions of record". |
| O2 | `SCORE_REASON_COPY` in `game.ts` vs `scoreCopy.ts` | **`src/app/scoreCopy.ts`.** `game.ts` must not import it. | Spec E5; keeps the engine copy-free; GuidedRound + coach both need it. |
| O3 | G2 text says count-hand happens at `show-non-dealer` "since the dealer is the opponent" | **Seat-aware pauses** (table in task 5.2). Learner counts every show action that applies to them, including the crib when they deal. | G3 and D11 require the dealer seat; G2's sentence is first-round-only. |
| O4 | `checkpoint` has multiple `scenarioIds` but `StepState` has no pointer | Add `subIndex: number` to `StepState` (task 3.2). | Lesson 7 mixes count, discard, and peg in one step. Flattening the catalog would change persisted step indexes. |
| O5 | Do Quick Practice completions write `completedLessonIds`? | **No.** Path markers only consider `BEGINNER_PATH`. `currentLessonId` may still point at a QP lesson for resume. | Spec: QP is "not part of progress". |
| O6 | How is `nobs-vs-heels` graded if heels is not a `ScoringGroup`? | One `ScoreScenario` for the nobs hand. Heels is narrated in `prompt` / adjacent display, not scored by `scoreHandDetailed`. | 2.3.7, X19. |
| O7 | Should `categoryFor` be exported for S-E10? | **Yes, export `categoryFor`.** | It is already the source of truth at `game.ts:378`. |
| O8 | When to persist — every `submit`, or only on step complete / unmount? | **Step complete and unmount**, as S3 says. Not on every toggle. | Avoids write storms; matches "partial answers are not persisted". |
| O9 | Does `Lesson.tsx` create `GuidedRound` in the reducer or in a ref? | **`useRef<GuidedRound>`.** Copy `view()` into React state after each call. The reducer only stores `status`. | I4: engine objects must not enter reducer state. |
| O10 | Deck skin inside lessons | Always `new StdDeck("rc")` (matches `/play`). Do not follow `/brooke` etc. | Spec T3. |
| O11 | `validateCatalog` check 7 needs `GuidedRound` | Split: checks 1–6 and 8–10 in Phase 2; check 7 in Phase 5. Same exported function, incrementally filled. | Avoids a false Phase 2 gate. |
| O12 | Should `rankDiscards`' existing `console.log` be silenced for exercises? | **Leave it.** Unrelated cleanup. | Scope rule: do not modernise `game.ts` while adding the kernel. |
| O13 | Handoff if the learner never finished lesson 7 but clicks a future "Play Easy" from Learn | Not in MVP. Only the lesson-7 recap runs the S4 sequence. Learn does not set difficulty. | Spec S4 is the one place. |
| O14 | `durationBand` for analytics with no timers | Band from `startedAt` date only, or omit the prop in v1. Prefer **omit** until a sink exists. | I5: no lesson clocks. A wall-clock delta would need `Date.now` at start/end of a step, which is fine if kept out of the reducer; still skip for MVP. |

If a new ambiguity appears that changes **scoring**, **persistence compatibility**, or **the S4 dispatch order**, stop and ask. Everything else, follow this plan.

---

## Appendix A — File inventory

### Created

| File | Task |
| --- | --- |
| `src/app/entities.test.ts` | 0.1 |
| `src/app/game.detailed.test.ts` | 0.2, 0.3, 0.4 |
| `src/app/scoreCopy.ts` | 0.4 |
| `src/components/GroupList.tsx` | 1.1 |
| `src/components/GroupList.test.tsx` | 1.1 |
| `src/features/tutorial/tutorialTypes.ts` | 2.1 |
| `src/features/tutorial/tutorialCopy.ts` | 2.2 |
| `src/features/tutorial/scenarios.ts` | 2.3 |
| `src/features/tutorial/lessonCatalog.ts` | 2.3 |
| `src/features/tutorial/validateCatalog.ts` | 2.4 |
| `src/features/tutorial/lessonCatalog.test.ts` | 2.4 |
| `src/features/tutorial/tutorialGrading.ts` | 3.1 |
| `src/features/tutorial/tutorialGrading.test.ts` | 3.1 |
| `src/features/tutorial/tutorialReducer.ts` | 3.2 |
| `src/features/tutorial/tutorialReducer.test.ts` | 3.2 |
| `src/features/tutorial/tutorialAnalytics.ts` | 3.4 |
| `src/features/tutorial/boundary.test.ts` | 3.4 |
| `src/features/tutorial/fixedDeck.ts` | 5.1 |
| `src/features/tutorial/fixedDeck.test.ts` | 5.1 |
| `src/features/tutorial/guidedRound.ts` | 5.2 |
| `src/features/tutorial/guidedRound.test.ts` | 5.2 |
| `src/components/tutorial/TutorialShell.tsx` | 4.4 |
| `src/components/tutorial/RoundMap.tsx` | 4.2 |
| `src/components/tutorial/SelectableHand.tsx` | 4.2 |
| `src/components/tutorial/CoachPanel.tsx` | 4.2 |
| `src/components/tutorial/HandScoringExercise.tsx` | 4.3 |
| `src/components/tutorial/DiscardExercise.tsx` | 4.3 |
| `src/components/tutorial/PeggingExercise.tsx` | 4.3 |
| `src/components/tutorial/GuidedRoundView.tsx` | 5.3 |
| `src/screens/RulesReference.tsx` | 4.1 |
| `src/screens/Lesson.tsx` | 4.5, 6.1 |
| `src/screens/Lesson.test.tsx` | 4.5, 6.1 |

### Modified

| File | Task |
| --- | --- |
| `src/app/entities.ts` | 0.1 |
| `src/app/game.ts` | 0.2, 0.3, 0.4 (export `categoryFor` only) |
| `src/app/game.test.ts` | 0.3 (additive S-E9 only) |
| `src/app/persistence.ts` | 3.3 |
| `src/app/persistence.test.ts` | 3.3 |
| `src/components/ScoreExplanation.tsx` | 1.2 |
| `src/components/ScoreExplanation.test.tsx` | 1.2 |
| `src/components/GameOverModal.tsx` | 1.4 |
| `src/components/GameOverModal.test.tsx` | 1.4 |
| `src/Cribbage.tsx` | 1.3 |
| `src/screens/Learn.tsx` | 4.1, 4.5 |
| `src/screens/Learn.test.tsx` | 4.5 |
| `src/App.tsx` | 4.5 |
| `src/App.css` | 1.3, 4.x |
| `src/vite-env.d.ts` | 2.1 |
| `AGENTS.md` | 6.3 |

### Explicitly unchanged

`src/app/gamePlayer.ts`, `src/features/game/gameSlice.ts`, `src/app/store.ts`, `src/app/hooks.ts`, `src/app/difficulty.ts`, `src/app/useCardMetrics.ts`, `src/components/CardComponents.tsx`, `src/components/CribbageBoard.tsx`, `src/components/DifficultyModal.tsx`, `src/screens/Splash.tsx`, `src/screens/Stats.tsx` (behaviour changes only via `clearAll`), `src/screens/FriendPlay.tsx`, `src/index.tsx`, `package.json` dependencies, `vite.config.ts`, `Dockerfile`, `nginx.conf`, `public/**`, `README.md`.

---

## Appendix B — Suggested PR slices

Each slice leaves `main` green. Prefer this granularity over one mega-PR.

| PR | Tasks | Title hint |
| --- | --- | --- |
| 1 | 0.1 + 0.2 | Engine: structured hand scoring with an optional group sink |
| 2 | 0.3 + 0.4 | Engine: `explainPegPlay` consumed by `doAction` |
| 3 | 1.1–1.4 | Live table: point-by-point breakdowns for hand, opponent, crib |
| 4 | 2.1–2.4 | Tutorial catalog and validator (no UI) |
| 5 | 3.1–3.4 | Tutorial runner, grading, and `cribbagex.v1` tutorial member |
| 6 | 4.1–4.5 | Learn landing, `/learn/:lessonId`, lessons 1–4 and 7 exercises |
| 7 | 5.1–5.3 | Deterministic guided rounds (both seats) |
| 8 | 6.1–6.3 | Easy-game handoff, flag-off verification, `AGENTS.md` |

PR 1's description **must** include the measured `rankDiscards` timing before and after, and must state that `src/app/game.test.ts` existing assertions are unchanged.

---

## Appendix C — Out of scope (do not build)

From spec §16. Adding any of these needs a new specification.

- Generated or infinite exercises; difficulty classification of generated hands
- Adaptive sequencing, spaced review, streaks, badges, leaderboards, daily challenges
- Coach Mode inside normal games
- Strategy lab, pegging replay, saved mistake library
- Manual counting or muggins in normal play
- Accounts, cloud sync, multiplayer tutorials, shareable hand URLs
- A CMS, markdown/HTML pipeline, or localisation
- Audio, video, animation frameworks
- Any analytics vendor, consent UI, or privacy-policy change
- A **third** guided round, a full guided game, or a guided cut-for-deal *(two rounds **are** in scope — Q4)*
- Changes to `StdDeck.shuffle`, difficulty weights, or AI strategy
- Skunk detection, Stats-screen expansion, or new `/play` features beyond the three explanation panels
- Percentage or cohort rollout

---

## Appendix D — First ticket, copied for the board

**Title:** Engine: structured hand scoring with an optional group sink

**Work:** Tasks 0.1 and 0.2 only (E1, E2, E3).

**Do not:** touch any component; implement `explainPegPlay`; change `game.test.ts` assertions.

**Done when:**

- `npx vitest run src/app/game.test.ts src/app/game.detailed.test.ts src/app/entities.test.ts` is green
- `T1 rankDiscards` passed unmodified
- S-E1…S-E7 exist
- PR body has `rankDiscards` before/after timing
- `git diff src/app/game.test.ts` is empty (or review-rejected if not)

After that ticket merges, Phase 1 (live explanations) and Phase 2 (catalog types) can proceed in parallel.
