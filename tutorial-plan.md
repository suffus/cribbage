# CribbageX — Interactive Tutorial (Beginner Path) — Feature Specification

**Status:** Draft for architectural review
**Source request:** `training-cribbage-x.md` (product/implementation research report, 14 Sep 2026)
**Target version:** v0.4.0
**Audience:** Senior architect converting this into an implementation plan; engineers implementing it

---

## How to use this document

This is a *specification*, not an implementation plan. It states what must exist, what contract
each new module honours, which existing files change, and how each change is verified. It
deliberately fixes the decisions that would otherwise be re-litigated during implementation
(section 3) and records the places where the source research report is wrong or under-specified
about this codebase (section 2.3).

Numbered work items (`E1`, `C2`, `G4`, …) are stable identifiers. An implementation plan should
map each to one or more commits/tickets. Section 18 gives the required delivery order.

Everything in section 16 (*Out of scope*) must not be built in this feature.

---

## 1. Problem statement

### 1.1 Restatement in project terms

CribbageX ships a correct rules engine (`src/app/game.ts`) and a playable table (`src/Cribbage.tsx`),
but the learning surface is a static reference page. Concretely, today:

- `src/screens/Learn.tsx` renders a rules accordion plus four **disabled** lesson tiles labelled
  "Coming soon" (`LESSONS`, lines 9–14 and 115–130).
- `src/components/ScoreExplanation.tsx` accepts `hand`, `starter`, `isCrib`, `total` and renders only
  the total plus the literal string "Point-by-point breakdown coming soon."
- `scoreHand` in `src/app/game.ts` returns a `number`. No API in the repo can say *which* cards
  scored, so no UI can explain a count, and no exercise can be graded against the real rules.
- `CribbageGame.doAction` computes pegging scores inline (`play-card` branch, lines 762–811) and emits
  `score` `GameAction`s whose `reason` is a bare string (`"15"`, `"31"`, `"run"`, `"pair"`,
  `"the-last-card"`). Nothing exposes the participating cards.
- `src/app/persistence.ts` persists `preferences` and `stats` under `cribbagex.v1`. There is no
  concept of learning progress.

A beginner therefore has to translate prose rules into table actions with no feedback, and the
automatic scoring in a normal game actively hides the skill (finding combinations) that a real
cribbage table requires.

### 1.2 What this feature delivers

Two connected deliverables:

1. **Explainable scoring, everywhere.** The engine gains pure, structured explanations of a hand
   count and of a pegging play. The live table uses them immediately, so the normal game becomes
   self-teaching before any lesson ships.
2. **A skippable Beginner Path.** A seven-lesson curriculum at `/learn/:lessonId` that moves a learner
   from a worked example, to a graded exercise, to two deterministic playable rounds driven by the
   production `CribbageGame` — one from each seat at the table — to an independent checkpoint, and
   finally into a normal Easy game.

The product promise on the Learn page is: *learn your first round in about 15 minutes, then play with
score explanations turned on.*

### 1.3 Non-negotiable invariants

| # | Invariant | Why |
| --- | --- | --- |
| I1 | One source of truth for rules. Every tutorial answer key, hint, and grade is derived from `src/app/game.ts`. No lesson may hard-code a score total or a "correct" combination. | A divergent answer key teaches wrong cribbage and rots silently. |
| I2 | Every existing score total is byte-identical after the engine refactor. `npx vitest run` passes unchanged except for the tests listed in section 14.2. | `rankDiscards` tie order defines Expert play; the frozen `T1_FIXTURES` in `src/app/game.test.ts` encode it. |
| I3 | The tutorial never touches `thePlayer`. It constructs its own `CribbageGame`. | `thePlayer` is a module singleton with queued actions and wall-clock `schedule` values; sharing it makes restart/resume non-deterministic. |
| I4 | No `Card`, `Hand`, `CribbageGame`, or `Deck` instance enters Redux or `localStorage`. | Existing architecture rule (`AGENTS.md`); these are mutable classes. |
| I5 | Lessons contain no timers. Every advance is a user action. | Accessibility, and it removes the whole class of flaky async tests. |
| I6 | The guided round is labelled a training deal. No tutorial copy may be read as a claim about shuffle fairness. | The splash and `/learn` already carry an explicit fairness promise ("the same shuffle at every difficulty"). |
| I7 | No new runtime dependency, no backend, no account, no CMS, no analytics vendor. | Local-first positioning; `package.json` stays at its current five runtime deps. |
| I8 | Corrupt or stale tutorial progress degrades to "not started" and never affects `preferences` or `stats`. | Persisted progress is untrusted input. |

---

## 2. Current-state audit

### 2.1 Foundations we build on (verified)

| Asset | Location | Reused how |
| --- | --- | --- |
| `scoreHand( hand, cutCard, isCrib )` | `src/app/game.ts:47` | Refactored in place into a shared kernel; becomes the total-only façade over the same code path that produces groups. |
| `countNobs` | `src/app/game.ts:35` | Reused verbatim as the nobs group source. |
| `rankDiscards` / `DiscardOption` | `src/app/game.ts:150` | Discard exercise feedback and "show the math". Already returns all 15 keep/discard splits, sorted descending by EV. |
| `rankPlays` / `PlayOption` | `src/app/game.ts:219` | *Suggestion only* ("another card scores now"). Never used as a scoring explanation — see 2.3.1. |
| `Hand.calcTailRunScore`, `Hand.calcTailPairScore`, `Hand.sum`, `Hand.canPlay` | `src/app/entities.ts:180–216` | Pegging explanation kernel. All are already non-mutating. |
| `CribbageGame` state machine + `Deck` interface | `src/app/game.ts:444`, `src/app/entities.ts:28` | The guided round instantiates its own `CribbageGame` with a `FixedDeck`. `Deck` is already an interface, which is the seam. |
| Synchronous pump pattern | `src/app/game.test.ts:165` (`pumpUntil`, `synthesizeNeed`) | The guided-round runner is a productised version of this pattern: translate `need-*` actions into scripted or learner actions, ignore `schedule`. |
| Peg-point bookkeeping | `src/app/gamePlayer.ts:90–101` | Copied (not shared) into the guided-round runner so `CribbageBoard` / `Peg` are reused unchanged. |
| `PCard` serialisable card contract | `src/features/game/gameSlice.ts:13` | All tutorial view models and persisted state use `PCard` or a derived string key, never `Card`. |
| `persistence.ts` sanitise/merge pattern | `src/app/persistence.ts` | Tutorial progress is a third top-level member of the same blob, sanitised the same way. |
| Screen chrome and palette | `src/App.css:358–457`, `src/screens/Stats.tsx` | `.learn-page` / `.screen-header` / accordion variables and the green-and-cream palette are the styling standard for all new tutorial screens. |
| Deck art | `Deck.getFaceImageUri` + `public/img/decks/{code}/` | The tutorial's selectable card component takes a `Deck` and calls the same accessor, so skins keep working. |

### 2.2 Gaps that block the feature

| # | Gap | Consequence |
| --- | --- | --- |
| B1 | `scoreHand` returns a number and enumerates nothing. | No breakdown UI, no gradable counting exercise. |
| B2 | When `cutCard === undefined`, `scoreHand` sorts the **caller's** array in place (`eH = hand` then `eH.sort(...)`, lines 49–59). | Detailed scoring cannot be pure without changing observable ordering elsewhere. See E2. |
| B3 | Pegging scoring is inline in `doAction`; the participating cards are discarded. | The coach cannot describe the run or pair the engine just awarded. |
| B4 | `Card` has no identity. `Hand.remove` and `StdDeck.removeCard` match on `suit`+`rank`. | Selection state has to key on something; adding mutable state to `Card` would leak into Redux/persistence. |
| B5 | `PlayingCard` / `CardHand` (`src/components/CardComponents.tsx`) are absolutely-positioned `div`s with `onClick`, no accessible name, no keyboard handling, and `alt={card.toString()}` producing `"hearts5"`. | Not usable for a graded, keyboard-operable exercise. A new component is required; the existing ones stay for the table. |
| B6 | The table layout (`.play`, `.playerHand`, `.deck` in `src/App.css:88–199`) is a fixed 900×800 absolute canvas. | Lesson screens must use normal flow layout, in line with `.learn-page`. |
| B7 | `src/screens/Learn.tsx` has no route parameter, no progress notion, and four disabled tiles. | Needs a landing redesign plus a new route. |
| B8 | `GameOverModal` renders `<ScoreExplanation hand={[]} starter={null} isCrib={false} total={0} />` (`src/components/GameOverModal.tsx:71`) as a contract stub. | A real implementation must not be handed an empty hand; `scoreHand`'s `hand[0].suit` would throw. |

### 2.3 Corrections to the source research report

The report is a good product brief. These points are wrong or dangerous as engineering instructions
and the architect must not carry them forward unchanged.

**2.3.1 `rankPlays` is an EV heuristic, not a scoring explainer.** The report's diagram routes the
pegging exercise to `explainPegPlay() / rankPlays()`. `rankPlays` subtracts a hand-tuned positional
cost table (`p1Costs`, `src/app/game.ts:185`) and returns non-integer, sometimes negative "scores"
that are not cribbage points. It may only drive *suggestions*. All statements of fact about points
must come from `explainPegPlay` (E4).

**2.3.2 Do not implement `scoreHand` as `scoreHandDetailed(...).total`.** `rankDiscards` performs
roughly 18,000 `scoreHand` calls per discard decision (15 keep/discard splits × [13 starter ranks in
`calcExpectedHandScore` + 13 × 91 crib pairs in `calcExpectedCribScore`]). That path runs on every AI
discard and on the table's **Auto Select** button. Allocating group objects and id strings there is an
unacceptable regression. Use one kernel with an *optional* output sink (E1).

**2.3.3 Making detailed scoring "pure" silently breaks a frozen test.** Because of B2,
`calcExpectedHandScore` currently leaves `rankDiscards`' `keep` array rank-sorted as a side effect.
`T1_FIXTURES` in `src/app/game.test.ts:53` assert `keep` in rank order. Removing the in-place sort
without compensating in `rankDiscards` breaks 31 fixtures and would change `getBestHand`'s returned
order. E2 specifies the compensating sort.

**2.3.4 Give cards a *derived* key, not an assigned id.** The report suggests "an explicit ID". Adding
a field to `Card` puts mutable identity into objects that are cloned, filtered by value, and rendered.
Use a pure `cardKey(card)` returning the existing image-naming form (`"5H"`, `"10D"`, `"JS"`).

**2.3.5 The existing card components cannot be "extended for focus/highlight/disabled states."** See
B5. A new `SelectableHand` is required (U3).

**2.3.6 Percentage rollout and the four KPIs are not implementable here.** There is no backend and no
analytics vendor (I7). The engineering scope is a single build-time flag plus a vendor-neutral,
no-op-by-default event seam (A2). KPI definitions in the report stay as product documentation; the
spec does not promise measurement.

**2.3.7 Vocabulary.** The engine's event and reason token is `his-nibs` (`GameEvent`,
`src/app/game.ts:346`), and it fires when the **starter** is a jack, paying the dealer 2. Player-facing
copy must say "his heels (also called his nibs)". Code identifiers keep `his-nibs`. Nobs (the jack of
the starter's suit, 1 point, in `countNobs`) is a different thing and the curriculum must contrast them.

**2.3.8 `TutorialProgress.currentStep` is not sufficient state.** A step's runtime object (a
`CribbageGame` for the guided round) is not serialisable. Persistence stores the pointer only; resume
restarts the current step from its beginning (I5, P2).

---

## 3. Architecture decisions

Each decision is binding. Deviating requires an explicit note in the implementation report.

| # | Decision | Rationale / rejected alternative |
| --- | --- | --- |
| D1 | Detailed hand scoring and total-only scoring share **one kernel** in `src/app/game.ts` with an optional `Array<ScoringGroup>` sink. `scoreHand` keeps its exact signature and allocation profile. | Satisfies I1 without the hot-path cost of 2.3.2. Rejected: two implementations (two sources of truth); rejected: naive delegation. |
| D2 | Tutorial runner state lives in a local `useReducer`, **not** Redux. | The state has no consumer outside the lesson screen, and the existing slice's only reducer of substance delegates into `thePlayer` (I3). Redux stays the live table's adapter. Rejected: a second slice. |
| D3 | The guided round is driven by a plain class `GuidedRound` that owns a private `CribbageGame` + `FixedDeck`, pumped **synchronously** on user actions. `GameAction.schedule` is ignored; no `setTimeout`. | I3, I5. Rejected: reusing `GamePlayer` (its queue model is time-based and its state updates target the Redux shape). |
| D4 | Curriculum content is TypeScript data in `src/features/tutorial/`, validated by unit tests. No JSON, no schema library, no CMS. | Compile-time checking, no network, no `dangerouslySetInnerHTML`, ships in the static bundle. |
| D5 | Card identity in tutorial state is the derived string `cardKey(card)`. Selection lives in reducer state as `ReadonlyArray<string>`; `Card.selected` is never mutated by a lesson. | I4, 2.3.4, B4. The live table keeps using `Card.selected`. |
| D6 | Tutorial progress is a new optional `tutorial` member of the existing `cribbagex.v1` blob, read/written only through `src/app/persistence.ts`. The storage key does not change. | Existing blob already tolerates additive members through its sanitiser; a second key would double the failure surface. |
| D7 | `ScoreExplanation` is upgraded in place and keeps its current prop contract as a superset. It derives groups itself from `PCard`s via the engine and composes a new shared `GroupList`. | Zero call-site churn in `Cribbage.tsx`; one breakdown renderer for the table, the modal, and the tutorial. |
| D8 | New lesson UI lives in `src/components/tutorial/` and uses React Bootstrap + normal flow layout with `.tutorial-*` classes appended to `src/App.css`. | B6; matches `.learn-page` conventions. No CSS framework or animation library added. |
| D9 | One build-time flag, `VITE_TUTORIAL_PATH` (`"on"` \| `"off"`, default `"on"`). When `"off"`, the Learn landing renders today's rules-only page and `/learn/:lessonId` redirects to `/learn`. | 2.3.6. Enables an internal-only build without branching the code. |
| D10 | Analytics is an in-process interface with a null sink by default and no vendor code. | I7. |
| D11 | The MVP ships **two guided rounds**, each a single deal with a preset dealer (`first-round`: `dealer = "opponent"`; `second-round`: `dealer = "player"`), so cut-for-deal is skipped and crib ownership is deterministic in both. | Round 1 puts the learner in the non-dealer seat: they lead the play, the crib is the opponent's, and they count first. Round 2 inverts every one of those — the learner deals, turns the starter, owns the crib, plays second, and counts second. Those are different skills and the second seat cannot be taught by a discard exercise alone. |
| D12 | Scenario decks are authored in **engine deal order** and `FixedDeck` deals from the **front**. | `StdDeck.dealOne` pops from the back; authoring reversed 13-card arrays is a defect factory. The difference is documented on `FixedDeck`. |

### 3.1 Module boundaries (import direction — do not invert)

```text
src/app/entities.ts          ← no tutorial imports
src/app/game.ts              ← imports entities only        (E1–E4 live here)
src/app/persistence.ts       ← imports types from game + tutorial types only (P1)
src/features/tutorial/*      ← imports app/* and features/game types
src/components/tutorial/*    ← imports features/tutorial + app/* + components/*
src/screens/Learn.tsx        ← imports features/tutorial catalog + components/tutorial
src/screens/Lesson.tsx       ← imports features/tutorial + components/tutorial
```

`src/features/tutorial/*` must not import from `src/app/gamePlayer.ts` (I3) or from
`src/features/game/gameSlice.ts` beyond the `PCard` type. A boundary test asserts this
(`src/features/tutorial/boundary.test.ts`), following the existing pattern in
`src/app/persistence.test.ts:139`.

---

## 4. Workstream E — Engine: structured explanations

All of section 4 is in `src/app/game.ts` and `src/app/entities.ts`. It is user-visible only through
workstream U, but it is the prerequisite for everything else and must land first.

### E1 — Card identity and naming helpers (`src/app/entities.ts`)

Add three pure exports. No changes to `Card`, `Hand`, `StdDeck`, or `Deck`.

```ts
export const RANK_NAMES: Record<Rank, string> = { 1: "ace", 2: "two", /* … */ 11: "jack", 12: "queen", 13: "king" }
export const SUIT_NAMES: Record<Suit, string> = { hearts: "hearts", diamonds: "diamonds", spades: "spades", clubs: "clubs", joker: "joker" }

/** Stable identity for a real playing card: rank glyph + suit letter, e.g. "5H", "10D", "JS".
 *  Matches the deck art filenames under /img/decks/{code}/. Not unique for the synthetic
 *  "joker"-suit cards used by the expected-value helpers in game.ts. */
export function cardKey( card : Card ) : string

/** Accessible name, e.g. "five of hearts". Used for aria labels and coach copy. */
export function cardName( card : Card ) : string
```

Requirements:

- `cardKey` is `rank_map[rank] + suit_map[suit]`; it must not allocate beyond the returned string.
- Both are total functions over the declared `Rank`/`Suit` unions.
- `cardName` is lower-case; callers capitalise via CSS or sentence construction.

### E2 — Purity fix and order compensation (`src/app/game.ts`)

This is the highest-risk change in the feature. It has two halves that must land in the same commit.

**E2a.** The scoring kernel must never mutate its inputs. Today, when `cutCard === undefined`,
`eH = hand` aliases the caller's array and `eH.sort(...)` reorders it in place (lines 49–59). Replace
with an unconditional shallow clone before sorting.

**E2b.** `rankDiscards` currently depends on that side effect: `calcExpectedHandScore(eH, …)` leaves
`eH` rank-sorted, and `eH` is what is published as `DiscardOption.keep` (line 173) and returned by
`getBestHand`. To preserve observable behaviour exactly, `rankDiscards` must sort `eH` itself,
immediately after building it and before scoring:

```ts
s.forEach( (n) => eH.push( hand[n] ) )
eH.sort( (c1, c2) => c1.rank - c2.rank )   // was a side effect of scoreHand; now explicit
```

The comparator must be rank-only (not rank-then-suit): `Array.prototype.sort` is specified stable, and
rank-only stable sorting is what produces the current order for equal ranks. The existing comments in
`rankDiscards` and `rankPlays` about sort stability preserving Expert parity apply here too and should
be extended with a one-line note.

**Verification:** `T1 rankDiscards` and `ranking wrappers stay Expert` in `src/app/game.test.ts` must
pass unmodified. Add `E2` to their coverage by a new test asserting `scoreHand` does not reorder its
argument (section 14.1, `S-E2`).

### E3 — `scoreHandDetailed` (`src/app/game.ts`)

```ts
export type ScoringCategory = "fifteen" | "pair" | "run" | "flush" | "nobs"

export type ScoringGroup = {
  /** `${category}:${cardIds.join("-")}` — unique within a result, stable across runs. */
  id: string
  category: ScoringCategory
  /** cardKey values, ascending by rank then suit. */
  cardIds: ReadonlyArray<string>
  points: number
  /** Plain-language, no punctuation-only output. e.g. "5 + K = 15", "Pair of fives",
   *  "Run of three: 4-5-6", "Flush — five hearts", "Nobs — jack of hearts". */
  label: string
}

export type HandScoreResult = {
  total: number
  groups: ReadonlyArray<ScoringGroup>
  isCrib: boolean
  starterIncluded: boolean
}

export function scoreHandDetailed(
  hand : ReadonlyArray<Card>,
  cutCard : Card | undefined,
  isCrib : boolean,
) : HandScoreResult
```

**Implementation shape (D1).** Extract today's body into

```ts
function computeHandScore(
  hand : ReadonlyArray<Card>,
  cutCard : Card | undefined,
  isCrib : boolean,
  sink? : Array<ScoringGroup>,
) : number
```

`scoreHand` calls it with no sink and returns the number; `scoreHandDetailed` calls it with a sink and
wraps the result. When `sink` is `undefined` the function must perform no group or label allocation.

**Enumeration rules.** These must reproduce the current totals exactly, category by category.

| Category | Rule | Points | Notes |
| --- | --- | --- | --- |
| `fifteen` | Every subset of the 4- or 5-card set with size ≥ 2 whose `Card.value` sum is 15. | 2 each | Uses the existing `nonUnarySubsetsOf5` / `nonUnarySubsetsOf4` tables. A 2-card subset that is a pair is emitted as a `pair` only — matching `scoreSubset`'s early return (arithmetically unreachable, but keep the precedence so the kernel is provably identical). |
| `pair` | Every unordered pair of equal-rank cards. | 2 each | Atomic. Three of a kind yields 3 groups (6 points); four of a kind yields 6 groups (12). Display aggregation is a UI concern (U2). |
| `run` | Sort by rank ascending (stable). Split into maximal chains where consecutive sorted ranks differ by 0 or 1 — identical to the existing loop. For a chain spanning distinct ranks `r … r+k` with `k+1 ≥ 3` and multiplicity `m_i` per rank, emit the Cartesian product of one card per rank: `∏ m_i` groups, each worth `k+1`. | `k+1` each | See the equivalence proof below. |
| `flush` | Determined from the **four hand cards only** (`hand[0].suit`), exactly as today. Non-crib: all four match → one group of 4, plus the starter's card id and 5 points if the starter matches. Crib: a group of 5 only when all four crib cards *and* the starter match; otherwise none. | 4, 5, or 0 | Crib flush is five-card only; this rule stays inside the kernel, never in lesson data (I1). |
| `nobs` | `countNobs(hand, cutCard) === 1` → one group containing the jack's card id. | 1 | `his-nibs` is **not** a hand-scoring group (2.3.7). |

**Run equivalence proof (include as a comment in the source).** The legacy branch scores a chain of
`nCards` cards spanning `seqLen` distinct ranks as: `seqLen` if `nCards === seqLen`; `2·seqLen` if
`nCards === seqLen + 1`; `12` if `nCards === seqLen + 2 && maxSame === 2`; `9` otherwise. For 4- and
5-card sets the Cartesian-product total `seqLen · ∏ m_i` equals each case:
`∏ m_i = 1` → `seqLen`; one pair → `2·seqLen`; two pairs (`seqLen = 3`) → `3·2·2 = 12`; one triple
(`seqLen = 3`) → `3·3 = 9`. The legacy outer-loop bound `i < eH.length - 2` skips only chains of ≤ 2
cards, which never score.

**Edge cases.**

- `hand.length === 0` → `{ total: 0, groups: [], isCrib, starterIncluded: false }`. Today `hand[0].suit`
  throws; B8 depends on this guard even though U2 also removes the offending call site.
- `cutCard === undefined` → `starterIncluded: false`, four-card scoring, flush capped at 4.
- Group ordering in `groups` is deterministic: `fifteen`, `pair`, `run` (longest first), `flush`, `nobs`;
  within a category, ascending by `cardIds.join()`. Required for stable UI and snapshot-free tests.
- `scoreHandDetailed` must accept a `ReadonlyArray` and must not mutate it (E2a).

### E4 — `explainPegPlay` (`src/app/game.ts`)

```ts
export type PegCategory = "fifteen" | "thirty-one" | "run" | "pair"

export type PegEvent = {
  category: PegCategory
  points: number
  /** cardKeys in play order. */
  cardIds: ReadonlyArray<string>
  label: string          // "That makes 15", "Run of three: 5-3-4", "Pair of sevens", "31 exactly"
}

export type PegPlayResult = {
  legal: boolean
  /** count after the play, even when illegal, so the coach can say "that would make 34". */
  newCount: number
  events: ReadonlyArray<PegEvent>
  total: number
}

export function explainPegPlay(
  playingSequence : ReadonlyArray<Card>,
  card : Card,
) : PegPlayResult
```

Requirements:

- Pure; must not mutate `playingSequence` or construct a persistent `Hand`. It may build a throwaway
  `Hand` to reuse `calcTailRunScore` / `calcTailPairScore` (both already non-mutating).
- `legal = sum(playingSequence.value) + card.value <= 31`. When illegal, `events` is empty and
  `total` is 0.
- Events are returned in the canonical order **fifteen, thirty-one, run, pair** — the exact order in
  which `doAction` currently pushes score actions (lines 776–790). Order is observable because scores
  are applied sequentially and can cross 121.
- `run` cardIds are the trailing `n` cards **in play order**, so the coach can show an out-of-order run
  ("you played 5, then 3, then 4 — that is still a run of three").
- `pair` cardIds are the trailing equal-rank cards.
- `fifteen` / `thirty-one` cardIds are the whole sequence including the played card.

**E4a — `doAction` consumes it.** The `playing` / `play-card` branch of `CribbageGame.doAction` must be
rewritten to call `explainPegPlay` and map `result.events` to `this.scoreAction(...)` calls, preserving
the current `reason` tokens (`"15"`, `"31"`, `"run"`, `"pair"`) so `categoryFor` and every existing
test keep working. The over-31 rollback stays in `doAction` (it must remove the card from
`playingHand`); it may consult `result.legal`. Scoring must not be computed twice.

**E4b — Go and the last card are not in this helper.** `last-card` is a state-machine decision
(`doAction`, lines 812–832) and stays there. Copy for go / the last card comes from E5.

### E5 — Shared score copy (`src/app/game.ts` or a new `src/app/scoreCopy.ts`)

```ts
/** Keyed by GameAction.reason for score actions. Used by the tutorial coach and available to the
 *  toast layer. Must cover every reason categoryFor() recognises. */
export const SCORE_REASON_COPY : Record<string, string>
// "15" → "fifteen — 2", "31" → "thirty-one — 2", "run" → "a run in the play",
// "pair" → "a pair in the play", "the-last-card" → "the last card — 1",
// "his-nibs" → "his heels (his nibs) — the starter is a jack, 2 to the dealer",
// "show-non-dealer" | "show-dealer" → "hand count", "show-crib" → "crib count"
```

A test asserts every reason string produced by `categoryFor` (`src/app/game.ts:379`) has an entry.
Place this in `game.ts` if it stays under ~20 lines; otherwise a new `src/app/scoreCopy.ts` imported
by `game.ts` consumers only (never by `game.ts` itself, to keep the engine copy-free).

---

## 5. Workstream U — Explainable scoring in the live game

This workstream ships user value on its own, before any lesson exists, and it is the shared rendering
vocabulary the tutorial reuses.

### U1 — `GroupList` (new: `src/components/GroupList.tsx`)

One presentational component that renders `ReadonlyArray<ScoringGroup>`.

```ts
export type GroupListProps = {
  groups: ReadonlyArray<ScoringGroup>
  total: number
  /** Highlight one group (worked-example reveal) or a set the learner has found. */
  activeGroupIds?: ReadonlyArray<string>
  /** "compact" for the table overlay, "list" for the modal and lessons. */
  variant?: "compact" | "list"
  /** Aggregate atomic pairs into "three of a kind — 6". Default true. */
  aggregatePairs?: boolean
}
```

- Renders an `<ol>` of `label` + points, then a labelled total row.
- Points are never conveyed by colour alone; every row carries the numeral.
- `aggregatePairs` groups same-rank `pair` groups: 3 groups → "Three of a kind — 6", 6 groups →
  "Four of a kind — 12". The underlying group ids remain the highlight keys.
- No engine imports beyond the `ScoringGroup` type.

### U2 — `ScoreExplanation` upgrade (`src/components/ScoreExplanation.tsx`)

Prop contract is a superset of today's, so `Cribbage.tsx`'s existing call site compiles unchanged:

```ts
export type ScoreExplanationProps = {
  hand: Array<PCard>
  starter: PCard | null
  isCrib: boolean
  total: number
  title?: string                       // e.g. "Your hand", "Opponent", "Crib"
  variant?: "compact" | "list"
}
```

Behaviour:

- Returns `null` when `hand.length === 0` or `total < 0`. The second guard matters because
  `game.scores['player-hand']`, `['opponent-hand']`, and `['crib']` are `-1` between rounds
  (`resetGame`, `src/app/game.ts:961`).
- Maps `PCard` → `new Card(suit, rank)` and calls `scoreHandDetailed` inside `useMemo` keyed on the
  card keys, `isCrib`, and the starter.
- Renders `title` (if given) then `<GroupList>`.
- The authoritative number displayed is the `total` **prop** (the engine's ledger value). When the
  derived total differs, render the prop and emit a single `console.log` diagnostic naming both values.
  This is the repo's existing diagnostic style and it turns any future engine/UI divergence into a
  visible signal rather than a silent wrong lesson.
- Keeps the existing `.scoreExplanation` / `.scoreExplanation-total` class names.

### U3 — Three explanations on the table (`src/Cribbage.tsx`, `src/App.css`)

`Cribbage.tsx` currently renders one explanation, for the player's hand, gated on `uiState.showPlayer`
(lines 146–155). Add two more, using data already present:

| Panel | Gate | `hand` | `starter` | `isCrib` | `total` |
| --- | --- | --- | --- | --- | --- |
| Your hand (existing) | `uiState.showPlayer` | `game.savedPlayerHand.hand` | `game.starter` | `false` | `game.scores['player-hand']` |
| Opponent (new) | `uiState.showOpponent` | `game.savedOpponentHand.hand` | `game.starter` | `false` | `game.scores['opponent-hand']` |
| Crib (new) | `uiState.showCrib` | `game.crib.hand` | `game.starter` | `true` | `game.scores['crib']` |

Constraints:

- Cards are converted with the existing `c.toObject() as PCard` idiom. No `Card` crosses the prop
  boundary (I4).
- Layout: `.scoreExplanationShow` is absolutely positioned at `top: 250px; left: 170px`
  (`src/App.css:531`). Add `.scoreExplanationShow--opponent` and `.scoreExplanationShow--crib` in the
  same block, positioned to avoid the board (`left: 850px`), the pegging row, and each other. Suggested
  starting values: crib at `top: 250px; left: 470px`; opponent at `top: 640px; left: 170px`. These are
  starting values only — U3 is not done until the browser pass in section 14.5 confirms no overlap for a
  five-group hand at default zoom and at 200%.
- Keep `variant="compact"` on the table.

### U4 — Remove the `GameOverModal` stub (`src/components/GameOverModal.tsx`)

Delete the `<ScoreExplanation hand={[]} … total={0} />` line (B8). The modal already shows the
per-category ledger, which is the right level of detail for an end-of-game summary; a per-hand
breakdown there has no hand to explain. Update `src/components/GameOverModal.test.tsx` (section 14.2).

### U5 — CSS

Append one commented block to `src/App.css` following the existing section-header convention:

```css
/* ---------------------------------------------------------------------------
   Score breakdown + tutorial
   --------------------------------------------------------------------------- */
```

Rules: palette limited to the existing tokens (`#0d3b24`, `#14532d`, `#166534`, `#f4efe2`, `#f7e7b0`,
`#d9c48a`, `#c9b36a`); all motion inside `@media (prefers-reduced-motion: no-preference)`; no `!important`;
tap targets ≥ 44×44 CSS px for every interactive element introduced by workstreams U and T.

---

## 6. Workstream C — Curriculum content model

New directory `src/features/tutorial/`. All files are TypeScript data or pure functions (D4).

```text
src/features/tutorial/
  tutorialTypes.ts        # C1 — every type in this section
  scenarios.ts            # C2 — curated hands, deals, and pegging sequences
  lessonCatalog.ts        # C3 — the ordered Beginner Path and Quick Practice
  validateCatalog.ts      # C4 — pure validator used by tests
  tutorialCopy.ts         # C5 — feedback phrasing helpers
  tutorialGrading.ts      # R2 — grading, delegates to the engine
  tutorialReducer.ts      # R1 — pure runner reducer
  fixedDeck.ts            # G1 — Deck implementation for scripted deals
  guidedRound.ts          # G2 — isolated round runner
  tutorialAnalytics.ts    # A2 — vendor-neutral event seam
```

### C1 — Types (`tutorialTypes.ts`)

```ts
import type { Rank, Suit } from '../../app/entities'
import type { ScoringCategory } from '../../app/game'
import type { PlayerEvent } from '../../app/game'

export const CURRICULUM_VERSION = 1

export type ConceptId =
  | "round-flow" | "count-order" | "crib-ownership"
  | "fifteens" | "pairs" | "runs" | "hand-flush" | "crib-flush" | "nobs" | "his-heels"
  | "discard-keep" | "discard-crib-risk"
  | "peg-legal" | "peg-fifteen-31" | "peg-pair-run" | "peg-go-last-card"

/** Concepts the Beginner Path must cover; enforced by C4. */
export const REQUIRED_CONCEPTS : ReadonlyArray<ConceptId>

/** Concepts assessed in the final checkpoint; each needs an earlier worked example (C4). */
export const CHECKPOINT_CONCEPTS : ReadonlyArray<ConceptId>

export type RoundPhase = "deal" | "discard" | "starter" | "pegging" | "show" | "crib"

/** Authoring form for a card. Mirrors the [suit, rank] tuple style already used by
 *  T1_FIXTURES in src/app/game.test.ts. */
export type CardSpec = readonly [Suit, Rank]

export type HintTiers = readonly [string, string, string]
// tier 1: name the category still missing
// tier 2: point at one card
// tier 3: show and explain one complete group

export type ScoreScenario = {
  id: string
  concepts: ReadonlyArray<ConceptId>
  hand: readonly [CardSpec, CardSpec, CardSpec, CardSpec]
  starter: CardSpec | null
  isCrib: boolean
  prompt: string
  /** Categories the learner must find. Omitted = every scoring category present in the hand. */
  require?: ReadonlyArray<ScoringCategory>
  hints: HintTiers
  /** Optional teaching contrast: render this scenario beside `id` (crib flush vs hand flush). */
  contrastWith?: string
}

export type DiscardScenario = {
  id: string
  concepts: ReadonlyArray<ConceptId>
  hand: readonly [CardSpec, CardSpec, CardSpec, CardSpec, CardSpec, CardSpec]
  /** true = the learner deals, so the crib is theirs. */
  isPlayerCrib: boolean
  prompt: string
  /** A choice inside the top N of rankDiscards is treated as a good choice. */
  acceptTopN: number
  /** Plain-language cause and effect, keyed by the two discarded cardKeys joined by "-",
   *  ascending. Must include an entry for the engine's best discard and for every choice
   *  the lesson explicitly discusses. Unlisted choices fall back to a generated comparison. */
  reasons: Readonly<Record<string, string>>
  hints: HintTiers
}

export type PegScenario = {
  id: string
  concepts: ReadonlyArray<ConceptId>
  /** Cards already on the table, in play order. Sum must be ≤ 31. */
  sequence: ReadonlyArray<CardSpec>
  /** The learner's remaining cards. */
  hand: ReadonlyArray<CardSpec>
  /** The opponent's replies, consumed in order after each learner play. */
  opponentScript: ReadonlyArray<CardSpec>
  prompt: string
  task:
    | { kind: "select-legal" }                 // "which of these can you play?"
    | { kind: "select-scoring" }               // "which one scores right now?"
    | { kind: "play-sequence" }                // play until the sequence ends, incl. go / last card
  hints: HintTiers
}

export type RoundCheckpoint = {
  phase: RoundPhase
  concepts: ReadonlyArray<ConceptId>
  /** One goal sentence, shown when the round pauses at this phase. */
  coach: string
}

export type RoundScript = {
  id: string
  dealer: PlayerEvent                     // "opponent" or "player"; both seats ship (D11)
  /** 13 cards in engine deal order: index 0 → the non-dealer's first card, then alternating;
   *  index 12 → the starter. See G1 for the derivation. */
  deck: readonly [
    CardSpec, CardSpec, CardSpec, CardSpec, CardSpec, CardSpec,
    CardSpec, CardSpec, CardSpec, CardSpec, CardSpec, CardSpec, CardSpec,
  ]
  opponentDiscard: readonly [CardSpec, CardSpec]
  /** The opponent's pegging plays, in intended order. Legality is re-checked at run time; an
   *  illegal scripted card is skipped in favour of the first legal card and reported by C4. */
  opponentPlays: ReadonlyArray<CardSpec>
  checkpoints: ReadonlyArray<RoundCheckpoint>
}

export type HintPolicy = "proactive" | "on-request" | "none"

export type TutorialStep =
  | { kind: "explain";          id: string; title: string; body: ReadonlyArray<string>; highlight?: RoundPhase }
  | { kind: "round-map";        id: string; title: string; highlight: RoundPhase; body: ReadonlyArray<string> }
  | { kind: "score-example";    id: string; scenarioId: string; title: string }
  | { kind: "score-practice";   id: string; scenarioId: string; hintPolicy: HintPolicy }
  | { kind: "discard-practice"; id: string; scenarioId: string; hintPolicy: HintPolicy }
  | { kind: "peg-practice";     id: string; scenarioId: string; hintPolicy: HintPolicy }
  | { kind: "guided-round";     id: string; scriptId: string }
  | { kind: "checkpoint";       id: string; scenarioIds: ReadonlyArray<string>; hintPolicy: "on-request" }
  | { kind: "recap";            id: string; concepts: ReadonlyArray<ConceptId>; body: ReadonlyArray<string> }

export type Lesson = {
  /** Slug used in /learn/:lessonId. Lower-case, hyphenated, stable — it is persisted. */
  id: string
  title: string
  estimatedMinutes: number
  concepts: ReadonlyArray<ConceptId>
  steps: ReadonlyArray<TutorialStep>
}
```

Notes for the architect:

- `body` is `ReadonlyArray<string>` of paragraphs, rendered as `<p>` elements. There is no markdown
  parser and no `dangerouslySetInnerHTML` anywhere in this feature.
- Lesson and step `id`s are persisted, so they are part of the compatibility surface. Changing one
  requires bumping `CURRICULUM_VERSION` (P1).
- No scenario stores a score, a total, or a "correct combination" (I1). The only answer-shaped data is
  `acceptTopN` (a tolerance) and `reasons` (prose keyed by a choice).

### C2 — Scenarios (`scenarios.ts`)

Exports three keyed records plus the round scripts:

```ts
export const SCORE_SCENARIOS   : Readonly<Record<string, ScoreScenario>>
export const DISCARD_SCENARIOS : Readonly<Record<string, DiscardScenario>>
export const PEG_SCENARIOS     : Readonly<Record<string, PegScenario>>
export const ROUND_SCRIPTS     : Readonly<Record<string, RoundScript>>
```

Minimum content for MVP (each row is one scenario; the architect may add, not remove):

| Id | Kind | Teaches | Shape |
| --- | --- | --- | --- |
| `fifteen-worked` | score-example | `fifteens` | One obvious 15 with a ten-value card. Revealed one group at a time. |
| `pair-find` | score-practice | `pairs` | Two pairs, no runs, no flush. `require: ["pair"]`. |
| `fifteen-multi` | score-practice | `fifteens` | A hand where one card belongs to two different fifteens. `require: ["fifteen"]`. |
| `run-double` | score-practice | `runs` | A double run (four cards spanning three ranks) → two run groups. `require: ["run"]`. |
| `count-all` | score-practice | `fifteens`,`pairs`,`runs` | Full count, all categories, moderate total (7–12). |
| `nobs-vs-heels` | score-example | `nobs`, `his-heels` | Jack in hand matching the starter suit (nobs, 1) presented next to a jack **as** starter (his heels, 2 to the dealer). The second half is narrated, not scored by `scoreHandDetailed` (2.3.7). |
| `flush-hand` | score-example | `hand-flush` | Four-card hand flush, off-suit starter → 4. |
| `flush-crib` | score-example | `crib-flush` | The same four cards scored as a crib: 0 off-suit, 5 with a matching starter. `contrastWith: "flush-hand"`. |
| `checkpoint-count` | score-practice | all counting | Independent count used by the final checkpoint. |
| `discard-theirs` | discard-practice | `discard-keep`, `discard-crib-risk`, `crib-ownership` | Six cards, opponent's crib, with an obvious keep and a tempting 5–5 feed. `acceptTopN: 3`. |
| `discard-yours` | discard-practice | `discard-keep`, `crib-ownership` | The same six cards with `isPlayerCrib: true`, so the right answer changes. `acceptTopN: 3`. |
| `peg-legal` | peg-practice | `peg-legal` | Count at 26; some cards would exceed 31. `task: select-legal`. |
| `peg-scoring` | peg-practice | `peg-fifteen-31`, `peg-pair-run` | A choice between a legal non-scoring card and a 15 or a pair. `task: select-scoring`. |
| `peg-go` | peg-practice | `peg-go-last-card` | A short scripted sequence that reaches a go, a reset, and the last-card point. `task: play-sequence`. |
| `first-round` | round script | everything, from the non-dealer seat | `dealer: "opponent"`. See G3. |
| `second-round` | round script | everything, from the dealer seat | `dealer: "player"`. See G3. |

Authoring constraints (enforced by C4):

- Every card in a scenario is a real suit (never `"joker"`) and no `cardKey` repeats within a scenario.
- `ScoreScenario` hands must produce at least one group and a non-zero total under `scoreHandDetailed`.
- `PegScenario.sequence` must sum to ≤ 31 and each scripted play must be legal at the moment it is made.
- Prose in `prompt`, `hints`, and `reasons` follows the tone rules in C5.

### C3 — The Beginner Path (`lessonCatalog.ts`)

```ts
export const BEGINNER_PATH : ReadonlyArray<Lesson>
export const QUICK_PRACTICE : ReadonlyArray<Lesson>   // standalone replay lessons, not part of progress
export function findLesson( id : string ) : Lesson | undefined
export function lessonIndex( id : string ) : number    // -1 when absent
export function nextLessonId( id : string ) : string | undefined
export const ALL_LESSONS : ReadonlyArray<Lesson>
```

| # | `id` | Title | Min | Steps (kind sequence) |
| --- | --- | --- | --- | --- |
| 1 | `shape-of-a-round` | The shape of a round | 2 | `round-map` ×4 (deal/discard/pegging/show), `explain` (board and the race to 121), `recap` |
| 2 | `count-a-hand` | Count a hand | 5 | `score-example` (`fifteen-worked`), `score-practice` (`pair-find`, `fifteen-multi`, `run-double`), `score-example` (`flush-hand`, `flush-crib`), `score-example` (`nobs-vs-heels`), `score-practice` (`count-all`), `recap` |
| 3 | `crib-and-discard` | The crib and the discard | 3 | `explain` (six to four, whose crib), `discard-practice` (`discard-theirs`), `discard-practice` (`discard-yours`), `recap` |
| 4 | `peg-to-31` | Peg to 31 | 4 | `explain`, `peg-practice` (`peg-legal`, `peg-scoring`, `peg-go`), `recap` |
| 5 | `coached-round` | Play a coached round | 6 | `explain` (training-deal notice, I6), `guided-round` (`first-round`), `recap` |
| 6 | `coached-round-dealer` | Deal a coached round | 5 | `explain` (what changes when you deal: you turn the starter, the crib is yours, you play and count second), `guided-round` (`second-round`), `recap` |
| 7 | `ready-table` | Ready-table checkpoint | 2 | `checkpoint` (`checkpoint-count`, `discard-theirs`, `peg-scoring`), `recap` (with the Easy-game handoff, S4) |

Lesson 6 is a separate lesson rather than a second step inside lesson 5, so that a learner who stops
after the first round still has a completed lesson and a clean resume point, and so the Learn page can
show the two seats as distinct skills.

**Time-promise correction.** The estimates sum to about 27 minutes, so the Learn landing must not
promise "15 minutes" for the whole path. (The source report is internally inconsistent here: its own
wireframe sums to 22 minutes beside a 15-minute promise.) Required copy: *"Learn your first round in
about 15 minutes, or the whole path in about half an hour."* The 15-minute claim then refers to lessons
1–5, which is true and is the number the landing page's primary button should imply.

Quick Practice (MVP): `count-a-hand-practice` (re-runs the counting scenarios), `peg-practice`
(re-runs the pegging scenarios), and `cribbage-quirks` (`nobs-vs-heels`, `flush-hand`/`flush-crib`,
`fifteen-multi`, `run-double`, `peg-go`). These reuse existing scenarios; no new content.

### C4 — Catalog validator (`validateCatalog.ts`)

A pure function used only by tests (it must not run in the browser bundle path):

```ts
export type CatalogProblem = { where: string; problem: string }
export function validateCatalog() : ReadonlyArray<CatalogProblem>   // empty = valid
```

It must check, at minimum:

1. Lesson ids, step ids, and scenario ids are unique and slug-shaped (`/^[a-z0-9-]+$/`).
2. Every `scenarioId` / `scriptId` referenced by a step exists.
3. Every scenario card is a real suit and rank; no duplicate `cardKey` within a scenario.
4. Every `ScoreScenario` yields `scoreHandDetailed(...).total > 0` and covers each category listed in
   `require`.
5. Every `DiscardScenario`: `rankDiscards` returns 15 options; `acceptTopN` is in `1..15`; every
   `reasons` key is a legal two-card subset of the hand; the engine's best discard has a `reasons` entry.
6. Every `PegScenario`: the sequence is legal and ≤ 31; every card in `hand` and `opponentScript` is
   distinct from the sequence; `explainPegPlay` reports `legal` for each scripted play in order.
7. Every `RoundScript`: exactly 13 distinct cards; `opponentDiscard` is a subset of the opponent's six
   dealt cards (derived from the alternation rule in G1); `opponentPlays` is exactly the opponent's kept
   four; the whole round completes through `CribbageGame` without an `error` action (this reuses G2).
8. Worked-example ordering: for every concept in `CHECKPOINT_CONCEPTS`, an `explain` / `score-example`
   / `round-map` step teaching it appears in an earlier lesson than the first step that assesses it.
9. Every concept in `REQUIRED_CONCEPTS` appears in at least one lesson's `concepts`.
10. Every lesson's final step is `recap` or `checkpoint`.

### C5 — Copy rules (`tutorialCopy.ts`)

Helpers that turn engine facts into learner-facing sentences, plus the tone contract.

```ts
export function describeGroup( g : ScoringGroup ) : string           // reuses g.label; adds "for 2"
export function describeMissingCategory( c : ScoringCategory ) : string
export function describeDiscardComparison(
  chosen : DiscardOption, best : DiscardOption, isPlayerCrib : boolean,
) : { plain: string; math: string }
export function describePegOutcome( r : PegPlayResult ) : string
export const TRAINING_DEAL_NOTICE : string     // I6
```

Tone rules (binding, and reviewed as part of code review):

- Use: "That makes 15, so it scores 2." / "You found all the pairs. There is still one run." /
  "Legal play, but another card scores now — want a clue?" / "Because this is their crib, avoid feeding
  a pair of fives."
- Never use: "Wrong", "Error", "Suboptimal", a bare expected-value number as the only explanation, or
  muggins language.
- `describeDiscardComparison` returns plain language first; the numeric EV goes in `math`, revealed
  only behind a "Show the math" disclosure.

---

## 7. Workstreams R and P — Runner, grading, and persisted progress

### R1 — Runner reducer (`tutorialReducer.ts`)

Pure, synchronous, serialisable state; no timers, no engine objects (D2, I5).

```ts
export type Feedback = { tone: "neutral" | "good" | "retry"; text: string }

export type StepState = {
  stepId: string
  /** cardKeys currently selected by the learner. */
  selected: ReadonlyArray<string>
  /** ScoringGroup ids (or peg event keys) already credited. */
  found: ReadonlyArray<string>
  attempts: number
  hintLevel: 0 | 1 | 2 | 3
  /** For score-example: how many groups have been revealed. */
  revealed: number
  status: "in-progress" | "complete" | "skipped"
  feedback: Feedback | null
  /** Running credited points, for the coach panel. */
  earned: number
}

export type RunnerState = {
  lessonId: string
  stepIndex: number
  step: StepState
  completedStepIds: ReadonlyArray<string>
  lessonComplete: boolean
}

export type RunnerAction =
  | { type: "toggle-card"; cardId: string }
  | { type: "clear-selection" }
  | { type: "submit" }
  | { type: "reveal-next" }          // score-example
  | { type: "request-hint" }
  | { type: "next" } | { type: "back" }
  | { type: "skip" }                 // marks skipped, never complete
  | { type: "restart-step" }
  | { type: "restart-lesson" }

export function initialRunnerState( lesson : Lesson, startAtStep? : number ) : RunnerState
export function makeTutorialReducer( lesson : Lesson ) : ( s : RunnerState, a : RunnerAction ) => RunnerState
```

Behavioural requirements:

- `submit` grades via R2 and never clears `found`. A wrong submission increments `attempts`, sets a
  `retry` feedback that explains *why the selected subset does not score*, and clears only `selected`.
- A correct submission appends the matched group id(s) to `found`, adds their points to `earned`, and
  sets `status: "complete"` once every required group is found.
- `request-hint` increments `hintLevel` up to 3 and is idempotent at 3.
- `skip` sets `status: "skipped"` and advances. Skipped steps must not enter `completedStepIds` and must
  not count as mastery (P1, and the Learn page shows the lesson as incomplete).
- `next` past the last step sets `lessonComplete: true`.
- `back` restarts the previous step from a clean `StepState` (I5: no partial replay of interactive state).
- `guided-round` steps are inert in this reducer: the `GuidedRound` instance owns its own state, and the
  reducer only records `status` when the round reports completion.
- The reducer must be exhaustive over `RunnerAction` and `TutorialStep["kind"]` with no `default:` that
  silently swallows a case (`typescript-eslint` will catch a missing branch when the switch is written
  over the discriminant).

### R2 — Grading (`tutorialGrading.ts`)

The only module allowed to decide whether a learner is right. Every function delegates to the engine (I1).

```ts
export type ScoreGradeResult = {
  /** Groups matching the selected cards exactly. */
  matched: ReadonlyArray<ScoringGroup>
  /** True when the selection is a valid scoring subset the learner has not yet found. */
  credited: boolean
  /** Every required group in this scenario, for progress display. */
  required: ReadonlyArray<ScoringGroup>
  remainingByCategory: Readonly<Record<ScoringCategory, number>>
  message: string
}
export function gradeScoreSelection(
  scenario : ScoreScenario, selected : ReadonlyArray<string>, found : ReadonlyArray<string>,
) : ScoreGradeResult

export type DiscardGradeResult = {
  rankOfChoice: number            // 1..15 from rankDiscards
  accepted: boolean               // rankOfChoice <= scenario.acceptTopN
  best: DiscardOption
  chosen: DiscardOption
  plain: string
  math: string
}
export function gradeDiscard(
  scenario : DiscardScenario, selected : ReadonlyArray<string>,
) : DiscardGradeResult

export type PegGradeResult = {
  legal: boolean
  result: PegPlayResult
  /** Best available by points scored now, from explainPegPlay across the learner's hand — not rankPlays. */
  bestScoringCardIds: ReadonlyArray<string>
  accepted: boolean
  message: string
}
export function gradePegChoice(
  scenario : PegScenario, sequence : ReadonlyArray<PCard>, selectedCardId : string,
) : PegGradeResult

export function hintFor(
  step : TutorialStep, level : 1 | 2 | 3, state : StepState,
) : { text: string; highlightCardIds: ReadonlyArray<string> }
```

Rules:

- Selections are matched to groups by comparing sorted `cardIds` sets, so selection order is irrelevant.
- `remainingByCategory` drives the coach panel's "Fifteens: 1 of 2 · Pairs: not started" display and is
  computed from `scoreHandDetailed`, never from scenario metadata.
- `gradeDiscard` uses `rankDiscards(hand, [], scenario.isPlayerCrib)` and finds the learner's choice by
  matching the discard pair's card keys. `plain` prefers `scenario.reasons[key]`; otherwise it is
  generated by `describeDiscardComparison`.
- `gradePegChoice` computes `bestScoringCardIds` by running `explainPegPlay` for each card in the
  learner's hand and taking the maximum `total` (2.3.1). `rankPlays` may only be used to phrase an
  optional strategic aside, and if used, its number must not be presented as points.
- Hint tiers map to `scenario.hints[level-1]` for text; tier 2 additionally returns one card id from an
  unfound group; tier 3 returns every card id of one unfound group and the coach reveals it as a worked
  example.

### R3 — Analytics-free mastery accounting

Concept mastery is recorded locally at the moment a step completes:

- `independentCorrect` increments only when `attempts === 1 && hintLevel < 2` (tier-1 hints are a nudge,
  tiers 2–3 are assistance — this matches the report's KPI definition).
- `hintsUsed` increments by the final `hintLevel`.
- `attempts` increments by the step's `attempts`.
- A `skipped` step records an attempt and no independent correct.

Written through `recordConceptAttempt` (P1). No network, no vendor.

### P1 — Persistence (`src/app/persistence.ts`)

Extend the existing module. Storage key stays `cribbagex.v1` (D6).

```ts
export type ConceptMastery = { attempts: number; independentCorrect: number; hintsUsed: number }

export type TutorialProgress = {
  curriculumVersion: number
  startedAt?: string                 // ISO date, coarse: date only, no time-of-day
  completedAt?: string
  completedLessonIds: string[]
  skippedStepIds: string[]
  currentLessonId?: string
  currentStepIndex: number
  conceptMastery: Partial<Record<ConceptId, ConceptMastery>>
}

type StoredV1 = {
  preferences: StoredPreferences
  stats: StoredStats
  tutorial: TutorialProgress          // new, always present after a write
}

export function loadTutorialProgress() : TutorialProgress
export function saveTutorialProgress( patch : Partial<TutorialProgress> ) : void
export function recordConceptAttempt( concept : ConceptId, outcome : { correct : boolean; hintLevel : number } ) : void
export function clearTutorialProgress() : void
```

Requirements:

- `sanitizeBlob` keeps its current gate (a blob missing `preferences` or `stats` is discarded — a
  behaviour `persistence.test.ts:72` pins) and adds `tutorial: sanitizeTutorial(src.tutorial)`, which
  returns the default when the member is absent or malformed. A malformed `tutorial` must never
  invalidate the blob (I8).
- `sanitizeTutorial` treats stored progress as untrusted input:
  - `curriculumVersion` via `finiteNumber`; when it differs from `CURRICULUM_VERSION`, return the
    default progress with the new version (no partial migration in v1).
  - `completedLessonIds` / `skippedStepIds`: arrays of strings, de-duplicated, filtered against the live
    catalog's ids, capped at a sane length (e.g. 200).
  - `currentLessonId`: dropped unless `findLesson` resolves it.
  - `currentStepIndex`: `finiteNumber`, floored, clamped to `0 .. steps.length - 1` of the resolved
    lesson, else 0.
  - `conceptMastery`: keys filtered to known `ConceptId`s, values through `finiteNumber` and clamped
    to ≥ 0.
  - `startedAt` / `completedAt`: kept only if they are strings matching `/^\d{4}-\d{2}-\d{2}$/`.
- `saveTutorialProgress` merges the patch over `currentBlob().tutorial` and writes the whole blob,
  reusing the existing `writeBlob` try/catch so a quota or private-mode failure is silent.
- `savePreferences` and `recordCompletedGame` must round-trip `tutorial` untouched. This follows
  automatically once `currentBlob()` is typed as `StoredV1`, but a test pins it.
- **`clearAll` changes meaning.** It currently removes the whole key, which would make the Stats
  screen's "Clear statistics" button silently destroy tutorial progress. `clearAll` must now clear
  preferences and stats and **preserve** `tutorial`, writing the reduced blob back. `clearTutorialProgress`
  is the tutorial-only reset used by the Learn page's "Start over" control. The existing assertions in
  `persistence.test.ts:53` and `:88` continue to hold; add coverage for the preservation (S-P5).
- `persistence.ts` must not import the tutorial catalog at module scope if that would create a cycle;
  import `findLesson` lazily inside `sanitizeTutorial`, or accept a validator injected by the caller.
  The existing boundary test (`persistence.test.ts:139`) forbids `gameSlice` and `gamePlayer` imports —
  extend it to also forbid `guidedRound` and `gamePlayer`.

### P2 — Resume semantics

- Resume restores `currentLessonId` and `currentStepIndex` and starts that step from a clean
  `StepState`. Partial answers are not persisted (2.3.8).
- A refresh mid-`guided-round` restarts the round from the deal. The UI must say so before the round
  begins ("You can restart this round at any time").
- If the resolved lesson no longer exists (catalog edit without a version bump), fall back to the first
  incomplete lesson in `BEGINNER_PATH`, or lesson 1.

---

## 8. Workstream G — The deterministic guided round

### G1 — `FixedDeck` (`src/features/tutorial/fixedDeck.ts`)

```ts
export class FixedDeck implements Deck {
  constructor( script : ReadonlyArray<CardSpec>, deckCode : string = "rc" )
  // Deck members: getFaceImageUri, getBackImageUri, shuffle, reset, dealOne,
  //               dealMany, cutOnce, getRemainingDeck, removeCard, dealRandomCard
}
```

Contract, derived from how `CribbageGame` actually uses `Deck`:

| Member | Behaviour | Why |
| --- | --- | --- |
| `getFaceImageUri` / `getBackImageUri` | Delegate to a private `new StdDeck(deckCode)`. | Deck skins and the `/img/decks/{code}/` art are reused unchanged. |
| `shuffle()` | **No-op that restores the scripted order** and returns `this`. | `doAction` calls `shuffle` on `start-round` (when there is no dealer) and again on `shuffle-deck` (line 692). A real shuffle would destroy determinism. |
| `reset()` | Rebuild the full scripted list from the script. | `resetGame` calls `deck.reset()` (line 973). |
| `dealOne()` | `shift()` from the **front** (D12) and return `undefined` when empty. | Lets scripts be authored in deal order. Documented in a comment contrasting `StdDeck.dealOne`'s `pop()`. |
| `dealMany(n)` | `n` successive `dealOne()`; `undefined` if it runs short. | Interface completeness; unused by the engine. |
| `dealRandomCard()` | Alias of `dealOne()`. | Only used by `dealOpponentCut`, which the guided round never reaches (D11), but determinism must hold if it is. |
| `removeCard(c)` | Filter by `suit` + `rank`, matching `StdDeck`. | `doAction` removes the cut and the starter from the deck. |
| `getRemainingDeck()` | The undealt remainder, in order. | Used by the cutting stage, which the guided round skips; keep it honest anyway. |
| `cutOnce(place)` | No-op returning `this`. | Never called by the engine. |

`FixedDeck` converts `CardSpec` to `Card` **once per `reset()`**, producing fresh `Card` instances each
time, because `Card.selected` and `Card.isFaceUp` are mutable and a restart must not inherit them.

**Deal-order derivation (put this in a comment on `RoundScript.deck`).** `nextStage("dealing")` emits
`shuffle-deck`; the handler then emits `deal-card` for `getOtherPlayer(dealer)` and the `deal-card`
handler alternates while the other hand has fewer than six cards (lines 690–714). **The non-dealer
always receives index 0.** So the two MVP scripts differ:

```text
dealer = "opponent"  (first-round)
index : 0  1  2  3  4  5  6  7  8  9 10 11 | 12
to    : P  O  P  O  P  O  P  O  P  O  P  O | starter      learner: 0,2,4,6,8,10

dealer = "player"    (second-round)
index : 0  1  2  3  4  5  6  7  8  9 10 11 | 12
to    : O  P  O  P  O  P  O  P  O  P  O  P | starter      learner: 1,3,5,7,9,11
```

Index 12 is consumed by the runner's `starter-card` action, which the engine attributes to
`this.dealer` — so in `second-round` a jack at index 12 pays **his heels to the learner** (G3).
`validateCatalog` re-derives the parity from `script.dealer` and checks `opponentDiscard` against the
opponent's six; hard-coding the wrong parity is the most likely authoring mistake in this workstream.

### G2 — `GuidedRound` (`src/features/tutorial/guidedRound.ts`)

A plain class, not a hook and not a reducer, because it owns mutable engine objects (D3, I3, I4).

```ts
export type RoundLogEntry = { id: string; who: "you" | "opponent"; text: string; points: number }

export type GuidedRoundView = {
  phase: RoundPhase
  stage: GameStage
  awaiting: "acknowledge" | "discard" | "play-card" | "count-hand" | "done" | "error"
  coach: string
  trainingNotice: string
  cribOwner: "you" | "opponent"
  playerHand: ReadonlyArray<PCard>
  playerHandIds: ReadonlyArray<string>
  opponentCardCount: number
  opponentHand: ReadonlyArray<PCard>       // empty until the show
  playingSequence: ReadonlyArray<PCard>
  count: number
  starter: PCard | null
  crib: ReadonlyArray<PCard>               // empty until the crib count
  scores: { player: number; opponent: number }
  pegPoints: { player: number[]; opponent: number[] }
  /** Present while awaiting "count-hand": the hand to count and its authoritative total. */
  countTask: { hand: ReadonlyArray<PCard>; starter: PCard | null; isCrib: boolean; total: number } | null
  log: ReadonlyArray<RoundLogEntry>
  complete: boolean
}

export class GuidedRound {
  constructor( script : RoundScript, deckCode? : string )
  view() : GuidedRoundView
  reset() : void
  acknowledge() : void
  submitDiscard( cardIds : ReadonlyArray<string> ) : { ok: boolean; message: string }
  submitPlay( cardId : string ) : { ok: boolean; message: string }
  /** Called by the show exercise when the learner has found every group. */
  completeCount() : void
}
```

Construction sequence — this ordering is load-bearing:

1. `this.deck = new FixedDeck(script.deck, deckCode)`
2. `this.game = new CribbageGame(this.deck)`
3. `this.game.dealer = script.dealer` — set **before** the first action. A fresh `CribbageGame` has
   `gameOver === false`, so `resetGame()` preserves `dealer` (it only clears it when `gameOver`,
   `src/app/game.ts:947`). This is what makes `start-round` route to `nextStage("dealing")` and skip
   cut-for-deal.
4. `this.pump([new GameAction("start-round")])`

Pump loop:

- Modelled on `pumpUntil` in `src/app/game.test.ts:165`: a local queue; `need-*` actions are answered
  from the script or by suspending for the learner; everything else goes to `game.doAction`.
- `GameAction.schedule` and `delayFor` are ignored entirely. No `setTimeout`, no `Date.now`.
- A hard iteration guard (5,000) and any `error` action set `awaiting: "error"`, surface
  `action.reason` in the coach panel, and offer "Restart this round". The lesson must never wedge.
- `need-discard` for `"opponent"` is answered from `script.opponentDiscard`; for `"player"` it suspends
  with `awaiting: "discard"`.
- `need-play-card` for `"opponent"` takes the next legal card from `script.opponentPlays` (falling back
  to the first legal card in hand and logging a diagnostic if the script is stale); for `"player"` it
  suspends with `awaiting: "play-card"`.
- `need-starter-card` is answered by the runner with `deck.dealOne()` (index 12).
- `score` actions update `scores` and shift the peg-point arrays exactly as
  `GamePlayer.handleAction` does (`src/app/gamePlayer.ts:96–99`), so `CribbageBoard` and `Peg` are reused
  with no change. Each `score` also appends a `RoundLogEntry` whose text comes from
  `SCORE_REASON_COPY[action.reason]` (E5) plus, for pegging, `explainPegPlay`'s label.
- After each phase boundary listed in `script.checkpoints`, the pump stops with
  `awaiting: "acknowledge"` and sets `coach` from the checkpoint.
- At `show-non-dealer` (the learner, since the dealer is the opponent) the pump stops with
  `awaiting: "count-hand"` and populates `countTask` from `game.getSavedHand("player").hand`,
  `game.starter`, and the engine's emitted score total. The opponent's hand and the crib are *shown*
  with `ScoreExplanation` and a Continue button, not counted by the learner.
- The round terminates at `round-end`: `complete: true`, `awaiting: "done"`. The runner does **not**
  start a second deal and never reaches `ending`, so there is no game-over path to handle.

`submitDiscard` / `submitPlay` validate the incoming card ids against the current hand, construct a
`GameAction` with the matching `Card` instances (the same lookup idiom as
`GamePlayer.playAction`, `src/app/gamePlayer.ts:283`), and return `{ ok: false, message }` on a bad
count, an unknown card, or an over-31 play — using `explainPegPlay` for the message so the coach's
reason matches the engine's refusal.

`reset()` rebuilds `FixedDeck` and `CribbageGame` from scratch. It must not reuse `Card` instances.

### G3 — Required contents of the two MVP rounds

Both scripts are curated, both are labelled training deals (I6), and neither can approach 121, so
neither can trigger `ending` and there is no game-over path in the runner.

**`first-round` — the learner is the non-dealer (`dealer: "opponent"`).**

1. A **discard** with an obvious keep and a visible temptation, with the crib belonging to the opponent
   (`crib-ownership`, `discard-crib-risk`).
2. A **starter** that is **not** a jack — his heels belongs to the dealer, so in this seat it would pay
   the opponent and teach the wrong lesson first.
3. The learner **leads** the play and makes a pegging **15 or pair**.
4. A **go** and the **last card** point.
5. A learner hand at the show with three or four straightforward groups across at least two categories,
   including **nobs** (a jack matching the starter's suit).
6. The count order non-dealer → dealer → crib, narrated with the learner counting **first**
   (`count-order`).

**`second-round` — the learner is the dealer (`dealer: "player"`).** Every item below is the mirror of a
round-1 fact, and the coach must name the contrast explicitly ("last round this was theirs").

1. A **discard into the learner's own crib**, curated so the right answer differs from round 1's
   (`discard-keep`, `crib-ownership`).
2. The learner **turns the starter**, and it **is a jack** — so **his heels** pays the learner 2 in
   context, which is the moment the `nobs-vs-heels` example was preparing for (2.3.7, X19).
3. The opponent **leads**; the learner plays **second** and must respond to an existing count.
4. A pegging **31** (round 1 covers 15 and the go, so the two rounds together cover all four pegging
   scores).
5. The learner **counts second**, then counts the **crib** — with the crib containing a teaching
   pattern, ideally the four-card-flush-that-is-not-a-crib-flush contrast from `flush-crib`.
6. The count order narrated from the dealer's seat, ending with "the crib is yours".

Checkpoints for each round: one per phase (`discard`, `starter`, `pegging`, `show`, `crib`) plus a
closing recap that replays at most three log entries — the learner's discard, their best pegging play,
and their hand count.

`validateCatalog` check 7 runs each script end to end and asserts it reaches `round-end` with no `error`
action. Each numbered requirement above additionally gets its own assertion in `guidedRound.test.ts`
(S-G4), so a curated deal that silently loses a teaching moment fails CI rather than shipping.

---

## 9. Workstream T — Tutorial UI components

New directory `src/components/tutorial/`. React Bootstrap only; flow layout only (D8, B6).

### T1 — `TutorialShell.tsx`

Frame for every lesson step. Props: `lesson`, `state: RunnerState`, `dispatch`, `onExit`.

```text
┌──────────────────────────────────────────────────────────────────┐
│ Count a hand                  Step 4 of 7          [Exit] [Rules]│   ← header
│ Deal ─ Discard ─ Starter ─ Pegging ─ [SHOW] ─ Crib               │   ← RoundMap
├──────────────────────────────────────┬───────────────────────────┤
│ WORKSPACE (step component)           │ COACH (CoachPanel)        │
├──────────────────────────────────────┴───────────────────────────┤
│ [Back]                         Progress 57%              [Next]  │   ← footer
└──────────────────────────────────────────────────────────────────┘
```

- `Container` + `Row`/`Col` (`md={8}` workspace, `md={4}` coach). On narrow screens the coach column
  comes **first** (`order-md-last` on the workspace column) so the instruction is above the cards.
- Header: `<h1>` is the lesson title; "Step n of m" is plain text plus an `aria-label` on the region.
  `Exit` navigates to `/learn`. `Rules` opens the rules reference — link to `/learn#rules` in a new tab
  is rejected (loses progress context); use a React Bootstrap `Offcanvas` rendering the same accordion
  content, extracted from `Learn.tsx` into `src/screens/RulesReference.tsx` so there is one copy of the
  rules text.
- Footer: `ProgressBar` (`now` = completed steps / total, with `label` text, not colour alone), `Back`,
  and `Next` (disabled until `status !== "in-progress"`, except for `explain`/`round-map`/`recap` steps).
  A `Skip this step` link sits beside `Next` and is always available.
- The whole shell is keyboard reachable in DOM order: header → round map → workspace cards → coach
  controls → footer.

### T2 — `RoundMap.tsx`

`Deal → Discard → Starter → Pegging → Show → Crib` as an ordered list of six items.
`aria-current="step"` on the highlighted phase, a text marker (not colour alone) for the current phase,
and phase names always visible (no truncation to icons). Reused by `TutorialShell`, the Learn landing,
and the guided round header.

### T3 — `SelectableHand.tsx`

The accessible card control that replaces `CardHand` for lessons (B5, 2.3.5).

```ts
export type SelectableCard = {
  card: PCard
  cardId: string
  state: "idle" | "selected" | "credited" | "hinted" | "disabled"
}
export type SelectableHandProps = {
  deck: Deck
  cards: ReadonlyArray<SelectableCard>
  label: string                       // fieldset legend, e.g. "Your hand"
  onToggle?: ( cardId : string ) => void
  /** "checkbox" for multi-select counting, "radio" for a single pegging choice, "none" for display. */
  mode: "checkbox" | "radio" | "none"
}
```

Requirements:

- Renders a `<fieldset>`/`<legend>` and one `<button type="button">` per card, with
  `aria-pressed` (checkbox mode) or `role="radio"` + `aria-checked` (radio mode).
- Accessible name from `cardName(card)` plus the state, e.g. `"five of hearts, selected"`,
  `"five of hearts, already counted"`. Built with a visually-hidden span, not `alt` text, so the image
  can carry `alt=""`.
- A visible text badge (`5♥`) is rendered alongside the image so rank and suit never depend on the art
  loading or on colour.
- Card faces come from `deck.getFaceImageUri(new Card(suit, rank))` — the same accessor the table uses,
  so skins work. Lessons pass `new StdDeck("rc")` to match `/play`.
- Flex wrap layout, `min-width`/`min-height` ≥ 44px, `:focus-visible` outline, `Space`/`Enter` toggle
  (native button behaviour — no custom key handling).
- `credited` and `hinted` states are conveyed by an outline **and** the accessible name, never by hue
  alone.
- No absolute positioning. No mutation of the passed `PCard`s.

### T4 — `CoachPanel.tsx`

Props: `prompt`, `progress` (per-category "found of total"), `earned`, `feedback`, `hintLevel`,
`onHint`, `onShowMethod`, `secondary` (optional node for "Show the math").

- The prompt is a `<p>`; category progress is a definition list ("Fifteens 1 of 2", "Pairs not started").
- Feedback renders inside a container with `aria-live="polite"` and `role="status"`. Only the feedback
  and the running total live in that region — card movements and decorative changes must not be
  announced.
- `Hint` is a single button whose label reflects the tier ("Hint", "Another hint", "Show me").
  At tier 3 it becomes "Show me one group" and reveals a worked example inline.
- `Show the math` is a React Bootstrap `Collapse`, closed by default (C5).

### T5 — `HandScoringExercise.tsx`

Drives `score-example`, `score-practice`, and `checkpoint` counting steps, and is reused verbatim by the
guided round's show phase (`awaiting: "count-hand"`).

- Renders the starter (via `SelectableHand` with `mode="none"`) above the hand.
- `Count selected cards` submits; `Clear` clears the selection.
- Credited groups stay visible in a `GroupList` with `activeGroupIds`, and the running total is displayed.
- `score-example` mode auto-reveals nothing: the learner presses `Show the next combination`, which
  reveals one group at a time in the deterministic group order from E3 and narrates it with `label`.
- On a wrong submission, the message states why the subset does not score (its `value` sum, or that the
  ranks differ, or that the cards are not consecutive) — derived, not authored.

### T6 — `DiscardExercise.tsx`

- Shows the six cards and, **before** any choice is possible, states the crib owner ("This is the
  opponent's crib").
- Requires exactly two selections; `Confirm two discards` is disabled otherwise.
- On confirm: shows the learner's keep and the engine's best keep side by side, `plain` reasoning first,
  `Show the math` for the EV numbers from `rankDiscards`, and a `Try another discard` control that does
  not penalise the recorded attempt beyond the first submission.

### T7 — `PeggingExercise.tsx`

- Persistent running count, rendered as text next to the played sequence.
- `select-legal`: multi-select; grading marks each card legal/illegal with the resulting count.
- `select-scoring`: single-select; grading uses `explainPegPlay` and names the scoring combination.
- `play-sequence`: alternates learner plays with `opponentScript`, pausing to explain out-of-order runs,
  the go, who leads after the reset, and why the last card scores.
- Animation is limited to the played card. All motion inside
  `@media (prefers-reduced-motion: no-preference)`.

### T8 — `GuidedRoundView.tsx`

Presentational wrapper over `GuidedRound.view()`.

- Header: `RoundMap` with the current phase, the crib owner, and `TRAINING_DEAL_NOTICE` rendered
  persistently (I6).
- Reuses `CribbageBoard` + `Peg` with `view().pegPoints`, and `ScoreExplanation` for the opponent hand
  and the crib.
- Delegates the discard to `DiscardExercise`-style selection, the play to `SelectableHand mode="radio"`,
  and the learner's count to `T5`.
- A `Restart this round` button is always present, and is the only recovery path from
  `awaiting: "error"`.

---

## 10. Workstream S — Screens, routing, and handoff

### S1 — `RulesReference.tsx` (extracted, `src/screens/RulesReference.tsx`)

Move the existing `<Accordion>` from `Learn.tsx` (items 0–8, including the scoring table and the
difficulty list built from `src/app/difficulty.ts`) into a component exported as `RulesReference`.
The copy must not change — `Learn.test.tsx` asserts specific strings (crib flush, his heels, "race to
121", "the low card deals first", difficulty labels and descriptions) and those assertions must keep
passing against the new location. `Learn.tsx` renders `<RulesReference />` inside a section with
`id="rules"`; `TutorialShell`'s Rules `Offcanvas` renders the same component.

### S2 — Learn landing redesign (`src/screens/Learn.tsx`)

New structure, top to bottom:

1. Existing `.screen-header` with `<h1>Learn Cribbage</h1>` and the `Back` button (unchanged).
2. **Beginner path panel** (only when `VITE_TUTORIAL_PATH !== "off"`):
   - Promise line: "New to cribbage? Learn your first round in about 15 minutes, or the whole path in
     about half an hour." (See the time-promise correction in C3 — do not claim 15 minutes for the
     whole path.)
   - Primary action: `Start beginner path`, or `Resume: {lesson title}, step {n}` when
     `loadTutorialProgress().currentLessonId` resolves.
   - `<RoundMap />` with no phase highlighted.
   - The seven-lesson list: state marker (`✓` complete / `→` current / `○` not started, each with a
     visually-hidden text equivalent), title, estimated minutes, and a button that navigates to
     `/learn/{id}`. Lessons are never locked — a learner may jump anywhere.
   - `Quick practice` row of buttons for the `QUICK_PRACTICE` lessons.
   - A `Start over` link calling `clearTutorialProgress()` behind a confirm.
3. **Rules reference** section (`id="rules"`) containing `<RulesReference />`.

**Removed:** the `LESSONS` constant, the four disabled tiles, and the `Coming soon` copy
(`Learn.tsx:9–14`, `115–130`). `.learn-lessons` / `.learn-lesson-tile` CSS may be reused for the new
lesson list; `.coming-soon` remains in use by `Stats.tsx` and must not be deleted.

Progress is read once with `useState(loadTutorialProgress)` — the same idiom as
`Stats.tsx:24` — and re-read when the screen regains focus is **not** required for MVP.

### S3 — Lesson route (`src/screens/Lesson.tsx`, `src/App.tsx`)

```tsx
// App.tsx
<Route path='/learn' element={<Learn />} />
<Route path='/learn/:lessonId' element={<Lesson />} />
```

`Lesson.tsx`:

- `useParams()` → `findLesson(lessonId)`. Unknown id, or the flag off → `<Navigate to="/learn" replace />`.
  (The existing `*` → `/` fallback in `App.tsx:45` must not be relied on: `/learn/nonsense` matches the
  parameterised route, so the redirect has to be explicit.)
- Owns `useReducer(makeTutorialReducer(lesson), initialRunnerState(lesson, resumeIndex))`.
- Persists on step completion and on unmount: `saveTutorialProgress({ currentLessonId, currentStepIndex, … })`,
  plus `recordConceptAttempt` per completed step (R3).
- On `lessonComplete`, appends to `completedLessonIds` and shows a lesson-complete panel with
  `Next lesson` (from `nextLessonId`) or, for the last lesson, the handoff (S4).
- Not wrapped in `GameLayout` — Learn, Stats, and Friend do not use it either, and its `<h1>CRIBBAGE</h1>`
  would duplicate the lesson heading.

### S4 — Completion and handoff to a normal game

The `ready-table` recap shows concept-level results from `conceptMastery`
("Round flow: ready · Hand counting: ready · Pegging: practised") — three states only:
`ready` (independent), `practised` (assisted), `not yet` (skipped or unattempted).

Primary action **Play your first Easy game** must execute exactly this sequence, because of how the
difficulty gate is wired:

```ts
savePreferences({ difficulty: "easy" })     // persists the choice
thePlayer.resetForNewSession()              // clears queues; the /play effect will not do it for us
dispatch(resetGameUi())                     // back to initialState (difficultyChosen: false)
dispatch(setDifficulty("easy"))             // sets easy AND difficultyChosen: true
navigate("/play")
```

Order matters: `resetGameUi` returns `initialState` (with `difficultyChosen: false`), so `setDifficulty`
must come after it. Setting `difficultyChosen: true` suppresses `DifficultyModal`, which also means
`Cribbage.tsx`'s `useEffect` on `!uiState.difficultyChosen` (line 33) will **not** call
`resetForNewSession()` — hence the explicit call, mirroring `GameOverModal.backToMenu`
(`src/components/GameOverModal.tsx:45`). `savePreferences` alone is insufficient because
`initialState.difficulty` is evaluated once at module load.

This is the only place in the tutorial that imports `thePlayer` or `gameSlice` actions, and it lives in
`src/screens/Lesson.tsx` (a screen), not in `src/features/tutorial/` (3.1).

Secondary actions: `Practise a weak concept` (deep-links to the relevant Quick Practice lesson),
`Rules reference`, `Back to Learn`.

---

## 11. Workstream A — Accessibility, feature flag, analytics, documentation

### A1 — Accessibility acceptance criteria

These are acceptance criteria, not aspirations. Each is verified in the browser pass (14.5).

1. Every card in a lesson is a real `<button>` with an accessible name including rank, suit, and state.
2. Rank and suit are readable without colour (text badge) and without the art loading.
3. Correct/incorrect and score changes are announced once, via a single `aria-live="polite"`
   `role="status"` region per screen. Card movement is not announced.
4. Focus is visible on every interactive element; focus order follows the visual order; nothing traps
   focus except the Rules `Offcanvas`, which returns focus to its trigger on close.
5. Tap targets ≥ 44×44 CSS px.
6. Full keyboard completion of every lesson type: select cards, submit, hint, next, skip, exit.
7. All motion is inside `@media (prefers-reduced-motion: no-preference)`; no lesson advances on a timer.
8. Layout is usable at 320px width and at 200% browser zoom without horizontal scrolling of the
   workspace.
9. Headings are hierarchical: one `<h1>` per screen (the lesson title), `<h2>` for workspace and coach.

### A2 — Feature flag and analytics seam

Flag (D9): `import.meta.env.VITE_TUTORIAL_PATH`. Add the declaration to `src/vite-env.d.ts`:

```ts
interface ImportMetaEnv {
  readonly VITE_TUTORIAL_PATH?: "on" | "off"
}
interface ImportMeta { readonly env: ImportMetaEnv }
```

A single exported helper, `export function tutorialEnabled(): boolean` (in
`src/features/tutorial/tutorialTypes.ts` or a tiny `flags.ts`), returns `env.VITE_TUTORIAL_PATH !== "off"`.
Read it in `Learn.tsx` (S2) and `Lesson.tsx` (S3) only.

Analytics (D10, I7) — `src/features/tutorial/tutorialAnalytics.ts`:

```ts
export type TutorialEventName =
  | "tutorial_path_viewed" | "tutorial_started" | "tutorial_step_completed"
  | "tutorial_lesson_completed" | "tutorial_completed" | "coach_game_started"

export type TutorialEvent = {
  name: TutorialEventName
  props?: Readonly<Record<string, string | number>>
}
export interface AnalyticsSink { track( e : TutorialEvent ) : void }
export function setAnalyticsSink( sink : AnalyticsSink | null ) : void
export function track( e : TutorialEvent ) : void      // no-op when no sink is installed
```

Constraints: no vendor package, no network call, no sink installed in this release. Only banded
properties are permitted (`attemptBand: "1" | "2" | "3+"`, `hintBand: "none" | "1" | "2-3"`,
`durationBand`, `lessonId`, `stepKind`, `curriculumVersion`). Card sequences, timestamps, free text,
and any identifier are forbidden, and a test asserts the allowlist.

### A3 — Documentation

- `AGENTS.md`: add `src/features/tutorial/` and `src/components/tutorial/` rows to the functional-area
  table; add `/learn/:lessonId` to the routes row; add the rules "the tutorial must never use
  `thePlayer`" and "`scoreHand` / `scoreHandDetailed` share one kernel — do not fork the rules"; add
  `tutorial` to the persistence description; note that `clearAll` preserves tutorial progress.
- `README.md` stays untouched (it is known-stale CRA text; changing it is a separate request).
- No new architecture document. Non-obvious rules get a comment next to the code: the run-equivalence
  proof (E3), the deal-order table (G1), the `FixedDeck.dealOne` front-vs-back note (D12), and the
  order-compensation comment in `rankDiscards` (E2b).

---

## 12. Impact matrix

### 12.1 Created

| File | Workstream |
| --- | --- |
| `src/features/tutorial/tutorialTypes.ts` | C1 |
| `src/features/tutorial/scenarios.ts` | C2 |
| `src/features/tutorial/lessonCatalog.ts` | C3 |
| `src/features/tutorial/validateCatalog.ts` | C4 |
| `src/features/tutorial/tutorialCopy.ts` | C5 |
| `src/features/tutorial/tutorialReducer.ts` | R1 |
| `src/features/tutorial/tutorialGrading.ts` | R2 |
| `src/features/tutorial/fixedDeck.ts` | G1 |
| `src/features/tutorial/guidedRound.ts` | G2 |
| `src/features/tutorial/tutorialAnalytics.ts` | A2 |
| `src/components/GroupList.tsx` | U1 |
| `src/components/tutorial/TutorialShell.tsx` | T1 |
| `src/components/tutorial/RoundMap.tsx` | T2 |
| `src/components/tutorial/SelectableHand.tsx` | T3 |
| `src/components/tutorial/CoachPanel.tsx` | T4 |
| `src/components/tutorial/HandScoringExercise.tsx` | T5 |
| `src/components/tutorial/DiscardExercise.tsx` | T6 |
| `src/components/tutorial/PeggingExercise.tsx` | T7 |
| `src/components/tutorial/GuidedRoundView.tsx` | T8 |
| `src/screens/RulesReference.tsx` | S1 |
| `src/screens/Lesson.tsx` | S3 |
| Tests: `game.detailed.test.ts`, `lessonCatalog.test.ts`, `tutorialReducer.test.ts`, `tutorialGrading.test.ts`, `fixedDeck.test.ts`, `guidedRound.test.ts`, `boundary.test.ts`, `GroupList.test.tsx`, `SelectableHand.test.tsx`, `HandScoringExercise.test.tsx`, `Lesson.test.tsx` | 14 |

### 12.2 Modified

| File | Change | Workstream |
| --- | --- | --- |
| `src/app/entities.ts` | Add `RANK_NAMES`, `SUIT_NAMES`, `cardKey`, `cardName`. No class changes. | E1 |
| `src/app/game.ts` | Kernel refactor with optional sink; purity fix; `scoreHandDetailed`; `explainPegPlay`; `doAction` play-card branch consumes it; `rankDiscards` explicit sort; `SCORE_REASON_COPY`. | E1–E5 |
| `src/app/persistence.ts` | `tutorial` member, sanitiser, four new exports, `clearAll` semantics. | P1 |
| `src/components/ScoreExplanation.tsx` | Real breakdown via `GroupList`; empty/negative guards; optional `title`/`variant`. | U2 |
| `src/components/GameOverModal.tsx` | Remove the placeholder `ScoreExplanation`. | U4 |
| `src/Cribbage.tsx` | Two additional explanation panels (opponent, crib). | U3 |
| `src/screens/Learn.tsx` | Beginner-path panel; rules moved into `RulesReference`; disabled tiles removed. | S1, S2 |
| `src/App.tsx` | `/learn/:lessonId` route. | S3 |
| `src/App.css` | New "Score breakdown + tutorial" block; two new `.scoreExplanationShow--*` positions. | U3, U5, D8 |
| `src/vite-env.d.ts` | `ImportMetaEnv` declaration for the flag. | A2 |
| `AGENTS.md` | Functional areas, routes, tutorial rules, persistence note. | A3 |

### 12.3 Explicitly unchanged

`src/app/gamePlayer.ts`, `src/features/game/gameSlice.ts`, `src/app/store.ts`, `src/app/hooks.ts`,
`src/app/difficulty.ts`, `src/app/useCardMetrics.ts`, `src/components/CardComponents.tsx`,
`src/components/CribbageBoard.tsx`, `src/components/DifficultyModal.tsx`, `src/screens/Splash.tsx`,
`src/screens/Stats.tsx`, `src/screens/FriendPlay.tsx`, `src/index.tsx`, `package.json` dependencies,
`vite.config.ts`, `Dockerfile`, `nginx.conf`, `public/**`.

Two of these deserve a note. The live-play AI (`gamePlayer.ts`) needs no change at all: everything the
tutorial needs from the engine is added as pure functions, and the guided round drives `CribbageGame`
directly. `gameSlice.ts` needs no change because the tutorial does not use Redux (D2); the only Redux
interaction is the existing `resetGameUi` / `setDifficulty` actions dispatched at the handoff (S4).

---

## 13. Edge cases and error handling

| # | Case | Required behaviour |
| --- | --- | --- |
| X1 | `scoreHandDetailed` called with an empty hand (today's `GameOverModal` stub, or a scenario bug). | Return `{ total: 0, groups: [] }`. Never throw. |
| X2 | `total` prop disagrees with the derived total in `ScoreExplanation`. | Display the prop (engine ledger wins), log one diagnostic. Never display two different numbers. |
| X3 | A hand scored between rounds, when `game.scores['player-hand'] === -1`. | `ScoreExplanation` returns `null`. |
| X4 | `/learn/does-not-exist`. | Redirect to `/learn`, no error UI. |
| X5 | Stored `currentLessonId` no longer in the catalog, or `currentStepIndex` out of range. | Sanitised away; resume falls back to the first incomplete lesson, then lesson 1. |
| X6 | `curriculumVersion` mismatch. | Reset tutorial progress to default; `preferences` and `stats` untouched; the Learn page shows "Start beginner path". |
| X7 | `localStorage` unavailable, full, or throwing. | Every path already wrapped by `readBlob`/`writeBlob` try/catch. The tutorial runs fully; progress simply does not persist. No user-facing error. |
| X8 | Corrupt `tutorial` member (wrong types, injected keys, huge arrays). | `sanitizeTutorial` returns defaults; the blob remains valid; arrays capped. |
| X9 | Learner submits a card selection that is not a scoring subset. | Derived explanation of why (sum, ranks, adjacency); `found` and credited points preserved; attempt counted once. |
| X10 | Learner selects a card twice / submits an empty selection. | Toggle semantics; submit disabled while the selection is empty or the wrong size for the step. |
| X11 | Learner tries an over-31 pegging play in the guided round. | `submitPlay` returns `ok: false` with the resulting count from `explainPegPlay`; the engine is never given the illegal action, so no rollback path is exercised. |
| X12 | Scripted opponent play is illegal at run time (stale script after an edit). | Fall back to the first legal card, log a diagnostic, and fail `validateCatalog` check 6/7 in CI so it is fixed at source. |
| X13 | The guided round's pump exceeds its iteration guard, or the engine emits `error`. | `awaiting: "error"`, coach shows the reason, `Restart this round` is the recovery. The lesson must not wedge and must not crash the SPA. |
| X14 | Learner refreshes mid-round or mid-step. | Resume at the same step, restarted from its beginning; a notice explains this before the round starts. |
| X15 | Learner skips every step. | Path shows incomplete; no concept reaches `ready`; the handoff button is still available (never trap a learner in the tutorial). |
| X16 | Two browser tabs edit progress concurrently. | Last write wins. Acceptable; documented, not defended against. |
| X17 | Deck art fails to load in a lesson. | The text badge (T3) keeps every card identifiable; no layout collapse. `Splash.tsx` already models the fallback pattern. |
| X18 | A hand with four of a kind or a triple in a counting exercise. | Atomic pair groups; `GroupList` aggregates the display ("Four of a kind — 12"); the learner may submit any single pair and receives credit for that pair only. Copy must set this expectation ("select each pair"). |
| X19 | A jack turns up as the starter in a curated scenario. | His heels is narrated by the coach from the engine's `his-nibs` action; it is never part of the learner's hand count (2.3.7). |
| X20 | `prefers-reduced-motion: reduce`. | No animation anywhere in the tutorial; all state changes are instantaneous. |

---

## 14. Testing strategy

Vitest 3 + jsdom + Testing Library, as configured in `vite.config.ts`. No Playwright, no Cypress
(`AGENTS.md`). Engine tests call `scoreHandDetailed` / `explainPegPlay` / `CribbageGame.doAction`
directly. Any test that touches `thePlayer` must call `thePlayer.resetForNewSession()` first — the
tutorial tests must not need it at all, which is itself an assertion (T-B1).

### 14.1 New spec tests (checklist)

| Id | Assertion | Where |
| --- | --- | --- |
| S-E1 | `cardKey` is unique across all 52 real cards and matches the deck-art filename form. | `entities.test.ts` (new) |
| S-E2 | `scoreHand` and `scoreHandDetailed` do not reorder or mutate the argument array, with and without a starter. | `game.detailed.test.ts` |
| S-E3 | **Equivalence:** `scoreHandDetailed(h,c,isCrib).total === scoreHand(h,c,isCrib)` exhaustively over all 6,188 five-card rank multisets under at least four suit patterns (all-same, three-same, two-two, all-different), for `isCrib` both ways, plus a 50,000-deal random sweep from a real deck. | `game.detailed.test.ts` |
| S-E4 | Group sums per category equal the legacy contributions: run groups sum to the legacy run score for every case in the equivalence proof (`3/6/9/12` and `4/8/5`). | `game.detailed.test.ts` |
| S-E5 | Named fixtures: the 29 hand (four fives + nobs → 8 groups, total 29); a card in two fifteens; a double run; a double-double run; four-card hand flush with off-suit starter; the same four cards as a crib (0 and 5); nobs present/absent. | `game.detailed.test.ts` |
| S-E6 | Group `id`s are unique within a result and the group order is deterministic across runs. | `game.detailed.test.ts` |
| S-E7 | `scoreHandDetailed([], undefined, false)` → total 0, no groups, no throw. | `game.detailed.test.ts` |
| S-E8 | `explainPegPlay`: 15, 31, pair/triple/quad (2/6/12), in-order and out-of-order runs, illegal play reports `legal: false` with the would-be count, and events arrive in the canonical order. | `game.detailed.test.ts` |
| S-E9 | Engine parity: for 200 random pegging positions, the score actions emitted by `doAction` equal `explainPegPlay(...).events` in reason order and point value. | `game.test.ts` (extended) |
| S-E10 | Every reason string `categoryFor` recognises has a `SCORE_REASON_COPY` entry. | `game.detailed.test.ts` |
| S-C1 | `validateCatalog()` returns an empty array. This single test carries all ten checks in C4. | `lessonCatalog.test.ts` |
| S-C2 | Every lesson id in `BEGINNER_PATH` resolves via `findLesson`, and `nextLessonId` walks the path exactly once and ends `undefined`. | `lessonCatalog.test.ts` |
| S-R1 | Reducer: correct selection credits points and never clears `found`; wrong selection increments `attempts` and clears only `selected`; hint level saturates at 3; `skip` marks skipped and is excluded from `completedStepIds`; `back` yields a clean `StepState`; `restart-lesson` returns `initialRunnerState`. | `tutorialReducer.test.ts` |
| S-R2 | Grading: an out-of-order selection of a valid group is credited; a non-scoring subset is refused with a derived reason; `remainingByCategory` decrements correctly; a fully found hand reaches `complete`. | `tutorialGrading.test.ts` |
| S-R3 | `gradeDiscard` reports rank 1 for the engine's best discard and `accepted: false` for the worst of 15; `plain` prefers the authored `reasons` entry. | `tutorialGrading.test.ts` |
| S-R4 | `gradePegChoice`'s `bestScoringCardIds` is derived from `explainPegPlay`, and the module does not import `rankPlays` for grading. | `tutorialGrading.test.ts` |
| S-P1 | `loadTutorialProgress` on a legacy blob (no `tutorial` member) returns defaults and leaves `preferences`/`stats` intact. | `persistence.test.ts` |
| S-P2 | `savePreferences` and `recordCompletedGame` round-trip tutorial progress unchanged. | `persistence.test.ts` |
| S-P3 | Malformed tutorial member (wrong types, unknown concept keys, index out of range, `Infinity`, a 10,000-element array, an unknown lesson id) sanitises to safe values without invalidating the blob. | `persistence.test.ts` |
| S-P4 | `curriculumVersion` mismatch resets tutorial progress only. | `persistence.test.ts` |
| S-P5 | `clearAll()` clears preferences and stats and **preserves** tutorial progress; `clearTutorialProgress()` does the inverse. | `persistence.test.ts` |
| S-G1 | `FixedDeck`: `shuffle()` is order-preserving; `reset()` restores all 13 cards as **new** `Card` instances; `dealOne` deals from the front; `removeCard` matches by suit+rank. | `fixedDeck.test.ts` |
| S-G2 | Deal alternation, parameterised over both scripts: the non-dealer holds indices 0/2/4/6/8/10 and the dealer 1/3/5/7/9/11, so the learner's six flip between the two rounds; the starter is index 12 in both. | `guidedRound.test.ts` |
| S-G3 | Full-round integration, run for **both** `first-round` and `second-round`: drive end to end through the real engine; assert stage transitions `starting → dealing → selection → playing → showing`, crib ownership, the pegging score at each learner play, the three show totals against `scoreHand`, and `complete: true` at `round-end`. | `guidedRound.test.ts` |
| S-G4 | Each numbered G3 requirement, asserted per round. `first-round`: non-jack starter, learner leads, a learner 15-or-pair, a go plus last card, a learner hand with ≥3 groups across ≥2 categories including nobs. `second-round`: learner is dealer, jack starter paying `his-nibs` 2 to the player, opponent leads, a 31 in the play, and a crib counted by the learner. | `guidedRound.test.ts` |
| S-G5 | `reset()` mid-round returns an identical initial view, twice in a row (no leaked `selected`/`isFaceUp`), for both scripts. | `guidedRound.test.ts` |
| S-G6 | An illegal `submitPlay` is refused without mutating the engine's `playingHand`, and an illegal `submitDiscard` (1 or 3 cards) is refused. | `guidedRound.test.ts` |
| T-B1 | Boundary: no file in `src/features/tutorial/` imports `gamePlayer`, `thePlayer`, `store`, or `gameSlice` (except the `PCard` type). Uses the `?raw` import idiom from `persistence.test.ts:139`. | `boundary.test.ts` |
| T-B2 | Analytics: `track` with no sink is a no-op; the module contains no `fetch`, `XMLHttpRequest`, `navigator.sendBeacon`, or vendor hostname; only allowlisted property keys appear in emitted events. | `boundary.test.ts` |

### 14.2 Existing tests that must change

| Test | Change | Reason |
| --- | --- | --- |
| `src/screens/Learn.test.tsx` — "renders difficulty copy from the module and disables lesson tiles" | Drop the four disabled-tile assertions and the `coming soon` assertion; add assertions for the beginner-path panel, the seven lesson links, and (behind the flag) navigation to `/learn/shape-of-a-round`. Keep every rules-copy assertion. | S2 removes the tiles. |
| `src/components/ScoreExplanation.test.tsx` | Replace the "coming soon" assertion with group and total assertions for a known hand; add the empty-hand `null` case and the negative-total case. | U2. |
| `src/components/GameOverModal.test.tsx` — "shows raw totals, rounds, difficulty, and the explanation slot" | Remove the `point-by-point breakdown coming soon` assertion; rename the case. | U4. |
| `src/app/persistence.test.ts` — "records games … and clears both stores" | Keep as is; add S-P1…S-P5 as new cases. | P1 changes `clearAll`'s scope but not its assertions. |
| `src/app/game.test.ts` | No assertion changes. `T1 rankDiscards` and `ranking wrappers stay Expert` are the regression gate for E2 and must pass **unmodified**. Extend only with S-E9. | I2. |

If any assertion in `src/app/game.test.ts` needs to change, stop: the engine refactor has altered
behaviour and the cause must be found before proceeding.

### 14.3 Component and interaction tests

- `SelectableHand`: renders a button per card; the accessible name contains rank, suit, and state;
  `Space` toggles; `aria-pressed` tracks selection; `mode="none"` renders no buttons.
- `HandScoringExercise`: a correct group is credited and stays credited; a wrong subset shows a reason
  and keeps prior credit; the running total matches `GroupList`'s total; three hint tiers escalate;
  keyboard-only completion of a full count.
- `CoachPanel`: feedback lands in a single `role="status"` region; the hint button label changes by tier.
- `Lesson`: unknown id redirects; a resumed lesson opens at the persisted step; completing the last step
  shows the handoff; the handoff dispatch sequence leaves the store with
  `difficulty: "easy"`, `difficultyChosen: true` and calls `resetForNewSession` (spy).
- `Learn`: shows `Start beginner path` with no progress and `Resume: …` with progress; with the flag off,
  renders only the rules reference.

### 14.4 What is not tested automatically

Visual placement of the three table explanation panels (U3) and the lesson layout at 200% zoom. Both are
covered by 14.5.

### 14.5 Manual browser pass (not optional)

Run `npm run dev` and confirm, per `AGENTS.md`:

1. `/play` — complete one round; the three explanation panels appear at the show, do not overlap each
   other, the board, or the pegging row, and each total matches the number beside the hand.
2. `/play` at 200% zoom — panels remain readable and do not cover the cards.
3. `/learn` — start the path, complete lesson 2 by keyboard only, with a screen reader confirming the
   feedback announcements.
4. Refresh mid-lesson 2 and mid-guided-round; both resume at the right step.
5. Complete `first-round`: cut is skipped, the discard, the learner leads, all learner pegging plays,
   the go, the show with a manual count, and the crib count. Restart it mid-round and complete it again.
6. Complete `second-round`: the learner deals, turns a jack starter and is paid his heels, the opponent
   leads, a 31 occurs, and the learner counts second and then their own crib.
7. Finish lesson 7 and take the Easy-game handoff: `/play` opens with no difficulty modal, Easy in
   effect, and no stale toasts or queued actions.
8. Narrow viewport (320–390px): coach appears above the cards; footer actions reachable; no horizontal
   scroll of the workspace.
9. `prefers-reduced-motion: reduce` — no animation in any lesson.
10. `VITE_TUTORIAL_PATH=off npm run build && npm run preview` — `/learn` is the rules page and
    `/learn/count-a-hand` redirects to `/learn`.
11. `npm run lint`, `npx vitest run`, `npm run build`, then the Docker image with a deep-link check on
    `/learn/count-a-hand` (nginx `try_files` must still serve `index.html`).

---

## 15. Risks

| # | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| R1 | The engine refactor silently changes a score or the Expert discard order. | **High** | E2b's explicit sort; the exhaustive equivalence sweep (S-E3); `game.test.ts` must pass unmodified (I2). Land E1–E4 as their own reviewable commit with no UI changes. |
| R2 | Group allocation lands in the EV hot path and makes Auto Select / AI discards sluggish. | High | D1's optional sink; code review must confirm `scoreHand` passes no sink; measure `rankDiscards` on one hand before and after (local benchmark, not a CI test — timing assertions are flaky). |
| R3 | Run enumeration diverges from the legacy aggregate formula on an unusual multiset. | Medium | The proof in E3 plus S-E3/S-E4. The exhaustive rank-multiset sweep covers every possible shape, so this is provable rather than sampled. |
| R4 | The guided round wedges on an unhandled `need-*` or an unexpected stage. | Medium | Iteration guard, `awaiting: "error"`, always-present `Restart this round` (X13); S-G3 drives the whole round in CI. |
| R5 | A curated scenario is ambiguous, or too hard, or has two defensible answers. | Medium | `acceptTopN` tolerance for discards; `require` narrows counting steps to one category at a time; usability sessions before broad release. No generated exercises in MVP. |
| R5b | Two guided rounds double the curation and validation surface, and the second script's deal parity is inverted — the most likely authoring bug in the feature. | Medium | `validateCatalog` derives the parity from `script.dealer` rather than trusting the author (G1); S-G2/S-G3/S-G4 are parameterised over both scripts; `GuidedRound` and `GuidedRoundView` are seat-agnostic by construction, so the second round adds data and tests, not code. If schedule pressure appears, the second round is the one thing in phase 5 that can be deferred without breaking a lesson dependency. |
| R6 | Scope creep into V2 (adaptive practice, Coach Mode, strategy lab, muggins). | Medium | Section 16 is a hard boundary; the flag lets the path ship without those. |
| R7 | Lesson prose drifts from engine behaviour after a future rules fix. | Medium | I1 — no authored answers. `validateCatalog` recomputes every scenario from the engine, so a rules change that invalidates a scenario fails CI. |
| R8 | The absolutely-positioned table layout cannot fit three explanation panels. | Low–Medium | U3 gives starting positions and makes the browser pass the acceptance gate. If they cannot fit, the fallback is a single panel with a segmented control (You / Opponent / Crib) — decide during U3, not later. |
| R9 | Persisted progress becomes a compatibility burden. | Low | `CURRICULUM_VERSION` with a reset-on-mismatch policy (X6); ids are the only persisted references and are validated against the live catalog. |
| R10 | Accessibility regressions creep in through the new card control. | Low | A1 is written as acceptance criteria and tested at 14.3/14.5; the existing `CardComponents` are untouched so the table's behaviour cannot regress. |
| R11 | The Easy-game handoff leaves stale singleton state and the first game misbehaves. | Low | The exact dispatch sequence in S4, mirroring the already-fixed `backToMenu` path; covered by a `Lesson` test and browser step 6. |

---

## 16. Out of scope

Not in this feature. Adding any of these requires a new specification.

- Generated or infinite exercises; difficulty classification of generated hands.
- Adaptive sequencing, spaced review, streaks, badges, leaderboards, daily challenges.
- Coach Mode inside normal games (contextual prompts during live discard/pegging).
- Strategy lab, pegging replay, saved mistake library.
- Manual counting or muggins in normal play.
- Accounts, cloud sync, multiplayer or shared tutorials, shareable hand URLs.
- A CMS, a markdown/HTML content pipeline, or localisation.
- Audio narration, video, animation frameworks.
- Any analytics vendor, consent UI, or privacy-policy change.
- A second guided round, a full guided game, or a guided cut-for-deal.
- Changes to `StdDeck.shuffle`, to difficulty weights, or to any AI strategy.
- Skunk detection, stats-screen expansion, or new `/play` features.
- Percentage or cohort rollout mechanics (2.3.6).

---

## 17. Decisions of record

Q1, Q3, Q4, and Q5 were put to the business owner and are settled. They are recorded here so the
architect does not reopen them.

| # | Question | Decision |
| --- | --- | --- |
| Q1 | Is the live score breakdown (workstream U) in this release, or held until the tutorial lands? | **Confirmed: ship it first**, as its own release ahead of the curriculum. It is the engine work's first user-visible payoff, improves the existing game for everyone, and de-risks the tutorial by proving the group model in production. This is why phase 1 stands alone in section 18. |
| Q2 | Does the MVP include the analytics seam at all, given no sink will be installed? | **Yes, interface only** (~1 hour). Costs nothing and prevents lesson code being retrofitted with vendor calls later. |
| Q3 | Should `clearAll()` (the Stats screen's "Clear statistics") wipe tutorial progress? | **Confirmed: no.** Preserve progress; the Learn page gets a separate "Start over". See P1 and S-P5. |
| Q4 | Is one guided round enough, with the learner's-own-crib case taught by a standalone discard exercise? | **Confirmed: no — build two rounds.** `first-round` from the non-dealer seat and `second-round` from the dealer seat, as a seventh lesson. Recorded as D11; contents in G3; the added risk is R5b. This is a deliberate scope increase over the source report's MVP. |
| Q5 | Enabled by default, or hidden behind the flag until usability sessions are done? | **Confirmed: enabled by default**, with `VITE_TUTORIAL_PATH=off` available for an internal build. Percentage rollout is not achievable without a backend (2.3.6). |
| Q6 | Does the crib flush / four-card flush contrast belong in the required path, or only in Quick Practice? | **Required path** (lesson 2, reinforced by `second-round`'s crib count). It is the rule this engine itself got wrong before v0.3, and the report asks for adjacent examples. |

---

## 18. Delivery order and exit criteria

Each phase is independently reviewable and leaves `main` green (`npm run lint`, `npx vitest run`,
`npm run build`).

| Phase | Work items | Exit criteria |
| --- | --- | --- |
| **0. Engine foundation** | E1, E2, E3, E4, E5 | `game.test.ts` passes **unmodified**; S-E1…S-E10 pass; the equivalence sweep is exhaustive over rank multisets; no UI change in the diff. |
| **1. Live explanations** | U1, U2, U3, U4, U5 | A completed round at `/play` shows correct point-by-point breakdowns for hand, opponent, and crib, verified in the browser at 100% and 200% zoom. Updated `ScoreExplanation` / `GameOverModal` tests pass. |
| **2. Content model** | C1, C2, C3, C4, C5 | `validateCatalog()` returns `[]`; the seven lessons, both round scripts, and all scenarios exist; no UI yet. |
| **3. Runner and persistence** | R1, R2, R3, P1, P2 | Reducer and grading tests pass; a lesson can be driven to completion in a unit test with no DOM; persistence sanitisation tests pass; boundary test passes. |
| **4. Lesson UI** | T1–T7, S1, S2, S3 | Lessons 1–4 and 7 are completable in the browser, keyboard-only, at 320px and at 200% zoom. Learn landing shows Start/Resume and per-lesson state. |
| **5. Guided rounds** | G1, G2, G3, T8 | S-G1…S-G6 pass for **both** scripts; both rounds are completable and restartable in the browser; the training-deal notice is always visible. `second-round` is the only deferrable item in the release (R5b) — if it is deferred, lesson 6 is removed from `BEGINNER_PATH` rather than left half-built. |
| **6. Handoff, flag, docs** | S4, A1, A2, A3 | The Easy-game handoff works with no stale state; the full browser pass (14.5) is recorded; `AGENTS.md` updated; flag-off build verified. |

**Rationale for this order:** phase 0 is the only phase that can break existing gameplay, so it lands
alone and early with the strongest possible regression gate. Phase 1 then converts that work into user
value immediately, which means the feature is worth shipping even if the curriculum slips. Phases 2–3
are pure logic with no UI risk. The guided round (phase 5) is the highest-complexity, lowest-certainty
piece and is deliberately last, so a schedule problem degrades the release to "five lessons plus
explanations" rather than "nothing".

### Suggested first ticket

*Engine: structured hand scoring with an optional group sink.* Implement E1, E2, and E3 only. Add
`src/app/game.detailed.test.ts` with S-E1…S-E7. Do not touch any component. The pull request must show
`src/app/game.test.ts` unchanged, and its description must state the measured `rankDiscards` timing
before and after.












