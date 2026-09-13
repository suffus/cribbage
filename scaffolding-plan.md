# CribbageX v0.3.0 — Scaffold Implementation Plan

**Source spec:** `detailed-spec-for-scaffold.md`  
**Target version:** 0.3.0  
**Status:** Ready to implement  
**Audience:** Implementing engineers. Each task is written so it can be picked up in isolation.

This plan converts the single-screen v0.2 prototype into a navigable application shell. It does **not** restructure the rules engine. It does **not** add a backend, a database, or a new runtime dependency.

---

## How to use this document

- Phases are ordered to keep `npm run lint`, `npx vitest run`, and `npm run build` green after every phase.
- Tasks inside a phase are numbered. Do them in order unless a task is marked **parallel-safe**.
- A later phase may start once its listed dependencies are done; see [Dependency graph](#dependency-graph).
- Acceptance criteria are testable. If a criterion is not met, the task is not done.
- Do not implement anything in [Out of scope](#out-of-scope).
- Settled product decisions are in the spec §1.1. Do not re-litigate them.

**Settled after this plan was first written** (do not re-open):

1. **Crib flush is a scoring defect, not a documentation issue.** `scoreHand(..., isCrib=true)` currently awards `0` for every flush. That is an omission and **must be corrected in this phase** (Task 3.1). After the fix, a crib scores a flush only when all five cards (four crib + starter) are the same suit — 5 points. A four-card crib flush still scores nothing. Learn’s table must match the corrected engine. This is a narrow `scoreHand` bugfix, not the out-of-scope structured breakdown of 15s/pairs/runs/flush/nobs.
2. **Quits are conceded games.** They produce a `GameBreakdown` with `winner: "opponent"` and **do** increment lifetime (and session) stats via `recordCompletedGame`. Do not add a quit-exclusion flag.

**Commands after every phase**

```bash
npm run lint
npx vitest run
npm run build
```

---

## 1. Architecture overview

### 1.1 What stays the same

The v0.2 kernel is unchanged in shape:

```
User click / timer
  → dispatch(userPlay({ action, cards }))
  → gameSlice.userPlay
  → thePlayer.playAction(state, payload)     // module singleton
  → GamePlayer.playNext(state)
  → CribbageGame.doAction(action)
  → GamePlayer.handleAction(state, action)
  → merged GamePlayingState back into Redux
```

Hard constraints inherited from `AGENTS.md` and the spec:

| Constraint | Implication for this work |
| --- | --- |
| `Card` / `Hand` / `CribbageGame` / `Deck` never enter Redux | `GameBreakdown` is a plain record. `ScoreExplanation` takes `PCard`, not `Card`. |
| Fair shuffle | Difficulty changes strategy only. `StdDeck.shuffle()` stays zero-argument. `difficulty.ts` must not import `entities.ts`. |
| One score source of truth | The breakdown ledger attributes existing `scores` increments. It does not re-score. |
| Match file idiom | `game.ts` / `gamePlayer.ts` stay class/`console.log` style. New screens use modern React. |
| No backend | Persistence is `localStorage` only, isolated in one module. |

### 1.2 What is added

Two new concerns sit *beside* the engine, not inside it:

```
┌──────────────────────────────────────────────────────────────────┐
│  React Router                                                     │
│  /            Splash                                              │
│  /play        GameLayout + Cribbage  ── difficulty gate           │
│  /brooke …    GameLayout + Cribbage  ── deep-link skins           │
│  /select      GameLayout + Cribbage  ── deck picker then gate     │
│  /learn       Learn (real rules + disabled lesson tiles)          │
│  /stats       Stats (real F4 counters + "coming soon" rows)       │
│  /friend      FriendPlay (disabled form, no network)              │
│  *            Navigate → /                                        │
└────────────┬─────────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Redux gameSlice  (thin adapter — still no mutable classes)       │
│  existing fields + difficulty, difficultyChosen, finalBreakdown   │
│  reducers: userPlay, setDifficulty, resetDifficultyChoice,        │
│            clearFinalBreakdown                                    │
└────────────┬─────────────────────────────────────────────────────┘
             │ state.difficulty passed as a parameter
             ▼
┌──────────────────────────────────────────────────────────────────┐
│  GamePlayer (singleton)                                           │
│  selectOpponentCards(difficulty, delay)  ─┐                       │
│  playOpponentCard(difficulty, delay)     ─┤ rank* + pickWeighted  │
│  autoSelect / autoplay  **stay Expert**   │                       │
│  resetForNewSession()                     │                       │
│  prepare-board carries difficulty forward │                       │
│  game-win publishes finalBreakdown        │                       │
└────────────┬──────────────────────────────┘                       │
             ▼                                                      │
┌──────────────────────────────────────────────────────────────────┐
│  CribbageGame                                                     │
│  rankDiscards / rankPlays  (getBestHand / playBestCard1 wrap)     │
│  breakdown ledger + rounds, attributed at the score increment     │
│  countNobs + GameAction.bonus                                     │
│  game-win registered in ending; quit no longer queues new-game    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐   ┌───────────────────────────────────┐
│  difficulty.ts           │   │  persistence.ts                   │
│  weights / labels / pick │   │  ONLY module that touches         │
│  no Deck / shuffle       │   │  localStorage. Prefs + stats.     │
└──────────────────────────┘   └───────────────────────────────────┘
```

### 1.3 Data flow — difficulty

1. `initialState.difficulty` is seeded from `loadPreferences()`, default `"intermediate"`.
2. `DifficultyModal` is always shown on a table visit until the user confirms.
3. Confirm → `dispatch(setDifficulty(chosen))` + `savePreferences({ difficulty: chosen })`.
4. `handleAction` already receives `state`. Opponent AI reads `state.difficulty` at the call site and passes it into `selectOpponentCards` / `playOpponentCard`.
5. **`GamePlayer` must not store a `difficulty` field.** Redux is the only source.

### 1.4 Data flow — score breakdown

All scoring already converges on `CribbageGame.doAction` at the `"score"` block (`src/app/game.ts` ~788–797). Attribution is added in that same guarded `if (!this.gameOver && action.subaction)` block:

```
scores[player] += action.score
breakdown[player][category] += action.score - action.bonus
breakdown[player].bonuses   += action.bonus
```

On `game-win`, `GamePlayer.handleAction` copies a plain snapshot into `state.finalBreakdown`. `Cribbage.tsx` shows `GameOverModal` when that field is non-null, and a `useEffect` + `useRef` records the result once via `recordCompletedGame`.

### 1.5 Data flow — persistence

```
Confirm difficulty  → savePreferences({ difficulty })
finalBreakdown set  → Cribbage useEffect → recordCompletedGame(result)
                        ├─ module-level session counters
                        └─ localStorage cribbagex.v1 (lifetime)
/stats              → loadStats() + loadSessionStats()
Clear statistics    → clearAll()
```

Storage writes never happen in a reducer or in `GamePlayer.handleAction`.

### 1.6 File placement

| Kind | Where | Why |
| --- | --- | --- |
| New route screens | `src/screens/` | Spec convention for this phase |
| `Cribbage.tsx` | stays at `src/Cribbage.tsx` | Moving it is out of scope (churn) |
| New presentational / modal components | `src/components/` | Matches `PopupImage`, `CribbageBoard` |
| Engine / persistence / difficulty / hook seam | `src/app/` | Non-React or thin seams |
| Tests | next to the subject (`game.test.ts`, `difficulty.test.ts`, `Splash.test.tsx`) | Existing Vitest layout |

The `Cribbage.tsx` vs `src/screens/` inconsistency is accepted for v0.3. Schedule a move only if a later phase asks for it.

### 1.7 Unchanged artifacts

Do not touch: `src/app/entities.ts` (including `StdDeck.shuffle`), `src/components/CribbageBoard.tsx`, `src/app/store.ts`, `src/app/hooks.ts`, `src/index.tsx`, `vite.config.ts`, `Dockerfile`, `nginx.conf`, `package.json` dependencies. No new runtime packages. `nginx.conf` already `try_files` → `index.html` and caches `/img/` for 30 days.

Bump `"version"` in `package.json` from `0.2.0` to `0.3.0` in the final cleanup phase only.

---

## Dependency graph

```
Phase 1  Engine ranking          ──┐
Phase 2  Difficulty + AI wiring  ──┤
                                   ├── Phase 4  Slice contract
Phase 3  Breakdown ledger        ──┤         │
                                   │         ▼
Phase 5  Persistence module      ──┴── Phase 7  Modals + recording
Phase 6  Shell + screens                   │
                                           ▼
                                   Phase 8  Seams, AGENTS.md, browser pass
```

Phases 1, 3, 5, and 6 have **no mutual code dependencies** and can be worked in parallel. Phase 2 needs Phase 1. Phase 4 needs Phases 2 and 3. Phase 7 needs 4, 5, and 6. Phase 8 needs 7.

---

## 2. Implementation phases

Each phase ships testable behaviour and leaves the app playable.

| Phase | Delivers | Visible to a player? | Tests |
| --- | --- | --- | --- |
| 1 | Ranked discard/play lists; existing wrappers | No | T1, T2 |
| 2 | Weighted AI; Expert == v0.2 | No (still always Expert until Phase 7) | T3a, T3b |
| 3 | Ledger, nobs split, **crib-flush fix**, `game-win` / `quit` fixes | No (computed, not shown) | T4, T5, T5b |
| 4 | Redux fields + `prepare-board` preservation | No | T6 |
| 5 | `localStorage` module + unit tests | No | T9 |
| 6 | Splash, Learn, Stats, Friend, new routes | Yes — navigation works; table still starts immediately | T7, updated `App.test.tsx` |
| 7 | Difficulty modal, game-over modal, recording | Yes — the product | T8 |
| 8 | `useCardMetrics`, `ScoreExplanation` slots, docs, E2E browser pass | Yes — seams only; table visually unchanged | visual / manual |

---

## 3. Detailed tasks

### Phase 1 — Engine ranking refactor

**Goal:** Expose ranked candidate lists without changing any play. Expert later becomes a thin wrapper over index `0`.

**Hazard H5:** A naive re-sort can change which tied candidate wins. Today's loops use strict `>` against a running max, so the *earliest candidate in generation order* wins. Preserve generation order and use a stable descending sort.

#### Task 1.1 — Add `rankDiscards` / `rankPlays` *without* changing the wrappers

**Files:** `src/app/game.ts` (modify)

Extract the bodies of `getBestHand` (lines 125–154) and `playBestCard1` (lines 190–217) into ranking functions. Leave `getBestHand` and `playBestCard1` **byte-equivalent in behaviour** — do not convert them to wrappers yet.

```ts
export type DiscardOption = {
  keep: Array<Card>
  discard: Array<Card>
  score: number          // existing tScore: eScore ± cScore
}

export type PlayOption = {
  card: Card
  score: number          // existing dS
}

export function rankDiscards(
  hand: Array<Card>, otherCardsSeen: Array<Card>, isPlayerCrib: boolean
): Array<DiscardOption>          // always 15 entries, best first

export function rankPlays(
  gameHand: Array<Card>, playerHand: Array<Card>
): Array<PlayOption>             // legal cards only, best first, may be empty
```

**Implementation rules**

- Generate discard candidates by iterating `selections` in the existing `for (const sel of selections)` order (`makeSelections()`: outer `i`, inner `j > i`).
- Generate play candidates by iterating `playerHand` in array order; skip `nS > 31` so illegal cards never appear.
- Collect `{ option, score }`, then `sort((a, b) => b.score - a.score)`.
- **Comment on the sort:** `Array.prototype.sort` is specified stable; that stability is what keeps Expert identical to v0.2 on ties. Do not replace it with an unstable sort or a `>=` tie-break.
- Keep the existing `console.log` of expected scores and the `"BEST SCORE:"` log. Do not clean them up.
- Do not change `calcExpectedHandScore`, `calcExpectedCribScore`, or `p1Costs`.
- Export the new types from `game.ts` (add to the existing `export type` / `export { }` block).

**Acceptance**

- `rankDiscards` always returns 15 entries, descending by `score`.
- `rankPlays` never returns a card that makes the peg count exceed 31.
- `rankPlays` returns `[]` when every card is illegal.
- `getBestHand` / `playBestCard1` still produce the same results as v0.2 (proven in 1.2).

**Depends on:** nothing.

#### Task 1.2 — Equivalence tests T1 and T2

**Files:** `src/app/game.test.ts` (create)

Write these **before** converting the wrappers. After the wrap, `getBestHand === rankDiscards()[0].keep` is tautological.

**T1 — `rankDiscards`**

- Generate ≥ 200 random 6-card hands (build from `Card` + a seeded or `Math.random` deal of distinct cards).
- For each hand, assert `sameCardsInOrder(rankDiscards(...)[0].keep, getBestHand(...))`.
- Assert every result has `length === 15` and is non-increasing by `score`.
- Cover both `isPlayerCrib === true` and `false` (at least 100 each, or alternate).

**T2 — `rankPlays`**

- Generate random `gameHand` totals and `playerHand`s, including states where every card is illegal.
- Assert `rankPlays(...)[0]?.card ?? null` is the same card object identity (or same suit+rank) as `playBestCard1`.
- Assert no returned card pushes the count over 31.
- Assert an all-illegal state returns `[]`.

Helper: compare cards by `suit` + `rank`, and keep-arrays by order (the existing `bestHand = eH` preserves `selections` keep order).

**Acceptance:** `npx vitest run src/app/game.test.ts` passes against the *unwrapped* functions.

**Depends on:** 1.1.

#### Task 1.3 — Convert wrappers

**Files:** `src/app/game.ts` (modify)

```ts
export function getBestHand(hand, otherCardsSeen, isPlayerCrib): Array<Card> {
  return rankDiscards(hand, otherCardsSeen, isPlayerCrib)[0].keep
}

export function playBestCard1(gameHand, playerHand): Card | null {
  return rankPlays(gameHand, playerHand)[0]?.card ?? null
}
```

Existing call sites stay as they are:

| Caller | File | Must stay on `getBestHand` / `playBestCard1` |
| --- | --- | --- |
| `autoSelect` (human coaching button) | `Cribbage.tsx` | Yes — always Expert |
| `autoSelectPlayerCards` | `gamePlayer.ts` | Yes — always Expert |
| `autoplayPlayerCard` | `gamePlayer.ts` | Yes — always Expert |
| `selectOpponentCards` / `playOpponentCard` | `gamePlayer.ts` | Switched in Phase 2 only |

**Acceptance:** T1 and T2 still pass. No UI change.

**v0.2 bit-identity caveat (read before Phase 3):** T1 proves the wrapper equals `rankDiscards()[0]`, not that discard EV is frozen forever. Task 3.1’s crib-flush correction changes `scoreHand(..., isCrib=true)`, which feeds `calcExpectedCribScore`, which can change Expert’s discard on flush-relevant cribs. Pegging (`playBestCard1` / T2) is unaffected. That discard delta is required and correct; do not “restore” v0.2 by leaving crib flush broken.

**Depends on:** 1.2.

---

### Phase 2 — Difficulty module and AI wiring

**Goal:** Degraded opponent play exists and is unit-tested. The UI still has no selector; the slice still has no `difficulty` field. Call sites that need a value use a temporary `"expert"` literal (or read `state.difficulty` once Phase 4 lands — if Phase 4 is not done, pass `"expert"`).

**Recommended interim:** add the `difficulty` parameter to the two opponent methods now; pass `"expert"` from `handleAction` until Phase 4. That keeps the signature final and avoids a second edit.

#### Task 2.1 — `src/app/difficulty.ts`

**Files:** `src/app/difficulty.ts` (create)

Copy the types, `DIFFICULTY_ORDER`, `DIFFICULTY_WEIGHTS`, `DIFFICULTY_LABELS`, `DIFFICULTY_DESCRIPTIONS` exactly from spec §4.3.3.

```ts
export function pickWeightedIndex(
  weights: ReadonlyArray<number>,
  candidateCount: number,
  rng: () => number = Math.random
): number
```

**Semantics**

- `candidateCount <= 0` → return `-1`.
- Take `used = weights.slice(0, min(weights.length, candidateCount))`.
- Renormalise: `sum = used.reduce(...)`; draw `r = rng()` in `[0, 1)`; walk cumulative `used[i] / sum` until `r` lands.
- `expert` weights `[1.00]` therefore always return `0` for any non-empty list.
- `rng` is injectable **only for tests**. Production call sites must omit it.

**Fair-shuffle guard:** this file must not import `entities.ts`, `game.ts`, or anything that can reach `StdDeck`. Verifiable by inspection (T3b).

**Acceptance**

- Weights are the only tuning knobs; no `if (difficulty === "easy")` in selection logic.
- File has zero imports from `entities.ts`.

**Depends on:** nothing (parallel-safe with Phase 1).

#### Task 2.2 — Tests T3a and T3b

**Files:** `src/app/difficulty.test.ts` (create)

**T3a**

- Inject a deterministic `rng` that returns known values; assert the expected index.
- `pickWeightedIndex([1.00], n)` returns `0` for every `n >= 1`.
- `pickWeightedIndex(DIFFICULTY_WEIGHTS.easy, 2, rng)` never returns `2` or `3` (renormalises over the first two weights).
- Empty candidate count returns `-1`.
- A sequence of fixed `rng` values covers each bucket of a four-weight table.

**T3b**

- Read `src/app/difficulty.ts` as text (Vitest `fs` / `readFileSync`) and assert it does not contain `entities` or `shuffle`.
- Import `StdDeck` in the test and assert `StdDeck.prototype.shuffle.length === 0` (no difficulty argument).

**Depends on:** 2.1.

#### Task 2.3 — Wire opponent only

**Files:** `src/app/gamePlayer.ts` (modify)

| Method | Change |
| --- | --- |
| `selectOpponentCards(difficulty, delay)` | `rankDiscards(...)` + `pickWeightedIndex(DIFFICULTY_WEIGHTS[difficulty], options.length)` (always 15). Mark the chosen option's **keep** cards unselected using the existing set-all-selected-then-unselect-keepers idiom. `act.cards = this.game.getSelectedOpponentCards()`. |
| `playOpponentCard(difficulty, delay)` | `rankPlays(...)` + `pickWeightedIndex(...)`. Empty list still returns `new GameAction("error")`. |
| `autoSelectPlayerCards` | **Unchanged** — still `getBestHand`. |
| `autoplayPlayerCard` | **Unchanged** — still `playBestCard1`. |

`handleAction` call sites (`need-discard` opponent, `need-play-card` opponent) pass `state.difficulty` once Phase 4 exists; until then pass `"expert"`.

Do **not** store `this.difficulty` on `GamePlayer`.

**Do not "helpfully" degrade `Cribbage.tsx` `autoSelect`.** It is a coaching aid for the human seat and must remain Expert.

**Acceptance**

- Expert path is index `0` → identical to `getBestHand` / `playBestCard1`.
- `autoPlay` and the Auto Select button still call the wrappers.
- T1–T3 still pass.

**Depends on:** 1.3, 2.2.

---

### Phase 3 — Breakdown ledger and engine defects

**Goal:** Every point that increments `scores` is attributed to `hand` / `crib` / `pegging` / `bonuses`. The crib-flush omission in `scoreHand` is corrected. Two latent defects on the ending path are fixed. Nothing is shown in the UI yet.

#### Task 3.1 — `countNobs` and crib-flush correction in `scoreHand`

**Files:** `src/app/game.ts` (modify)

Two narrow scoring changes in the same function. Do not otherwise rewrite `scoreHand`.

**3.1a — `countNobs`**

```ts
export function countNobs(hand: Array<Card>, cutCard: Card | undefined): number
```

Returns `1` when any card in `hand` is a jack (`rank === 11`) of `cutCard.suit`, else `0`. No cut card → `0`.

Replace the inline `nobScore` loop in `scoreHand` (lines 45–48) with `countNobs(hand, cutCard)`. There must be exactly one implementation of the nobs rule.

**3.1b — Crib flush (required correction)**

Today’s flush block (lines 51–57) is:

```ts
if( isFlush && !isCrib ) {
  flushScore = 4
  if( cutCard && cutCard.suit === checkFlushSuit ) {
    flushScore += 1
  }
}
```

`isCrib` skips the entire block, so a five-card crib flush scores `0`. That is an omission. Replace it with the standard rule `AGENTS.md` already states:

| Hand | Four cards same suit | Four + starter same suit |
| --- | --- | --- |
| Non-crib (`isCrib === false`) | 4 | 5 |
| Crib (`isCrib === true`) | 0 | 5 |

```ts
if (isFlush) {
  if (!isCrib) {
    flushScore = 4
    if (cutCard && cutCard.suit === checkFlushSuit) {
      flushScore += 1
    }
  } else if (cutCard && cutCard.suit === checkFlushSuit) {
    flushScore = 5
  }
}
```

Keep using `isFlush` computed from the **four** hand/crib cards only (existing loop). The crib branch adds 5 only when the starter matches that suit. Do not award 4 for a crib flush.

**Effect on Expert discard:** `calcExpectedCribScore` calls `scoreHand(eH, rC, true)`. After this fix, discard EV (and therefore Expert keep/throw) can change when a five-card crib flush is in play. That is intended. Pegging EV is unchanged.

**Acceptance**

- Non-crib `scoreHand` totals are unchanged for the same inputs (T5).
- Crib: four-card flush, starter off-suit → flush contribution `0` (unchanged).
- Crib: all five the same suit → flush contribution `5` (this is the correction).
- Nobs still come only from `countNobs`.

**Depends on:** nothing (parallel-safe with Phase 1). Do this before or with Task 3.2 so T4/T5 run against the corrected scorer.

#### Task 3.2 — Types, ledger, `GameAction.bonus`, attribution

**Files:** `src/app/game.ts` (modify)

Add next to `scores` (and export the types):

```ts
export type ScoreCategory = "hand" | "crib" | "pegging" | "bonuses"

export type PlayerBreakdown = {
  hand: number
  crib: number
  pegging: number
  bonuses: number
  total: number
}

export type GameBreakdown = {
  player: PlayerBreakdown
  opponent: PlayerBreakdown
  winner: PlayerEvent
  rounds: number
  difficulty: Difficulty
}
```

`CribbageGame` fields:

```ts
public breakdown: { player: PlayerBreakdown, opponent: PlayerBreakdown } = emptyBreakdown()
public rounds: number = 0
```

`emptyBreakdown()` returns zeros for both players, including `total: 0`. Put it in `game.ts`.

`GameAction` gets `public bonus: number = 0`.

In `show-non-dealer`, `show-dealer`, and `show-crib`, set `bonus` on the returned score action:

```ts
const act = this.scoreAction(...)
act.bonus = countNobs(theHand, this.starter)
return [act, next]
```

Hands to pass:

| Case | Hand |
| --- | --- |
| `show-non-dealer` | `this.getSavedHand(this.getOtherPlayer(this.dealer)).hand` |
| `show-dealer` | `this.getSavedHand(this.dealer).hand` |
| `show-crib` | `this.crib.hand` |

Attribution, **inside** the existing score increment guard (`~788–797`):

```ts
const p = action.subaction            // "player" | "opponent"
const bucket = categoryFor(action)    // see table below
this.breakdown[p][bucket] += action.score - action.bonus
this.breakdown[p].bonuses += action.bonus
this.breakdown[p].total = this.breakdown[p].hand + this.breakdown[p].crib
  + this.breakdown[p].pegging + this.breakdown[p].bonuses
```

| `action.source` | `action.reason` | Bucket |
| --- | --- | --- |
| `"play"` | `15`, `31`, `run`, `pair`, `the-last-card` | `pegging` |
| `"start"` | `his-nibs` | `bonuses` |
| `"show-hand"` | `show-dealer`, `show-non-dealer` | `hand` |
| `"show-crib"` | `show-crib` | `crib` |

`categoryFor` is a small private function in `game.ts`. Unknown pairs should not throw (leave the increment on `scores` alone and skip ledger update, or treat as `pegging` only if you add a test — prefer a `console.log` and skip rather than invent a fifth bucket).

**His-nibs arithmetic is uniform.** Bucket is already `bonuses` and `bonus` is `0`, so the 2 points land via `action.score - action.bonus`. Do not special-case it.

**Display / invariant note (H9):** `scores` is not capped at 121. A player on 118 who counts 12 finishes on 130. Assert and later display the raw total. Do not cap `scores`.

**`rounds`:** increment on `round-end` in the `showing` stage (existing case at line 763). See [Open questions](#8-open-questions) Q1 if a win happens before `round-end`.

**`resetGame()`:** in the `if (this.gameOver)` branch only, also reset `breakdown = emptyBreakdown()` and `rounds = 0`. They are per-game, not per-round.

**Remove dead keys** `scores.playing` and `scores.starting` (lines 388–389). They are never written or read. Do not remove `player-hand` / `opponent-hand` / `crib` — the show UI still uses those.

**`getBreakdownSnapshot(difficulty: Difficulty): GameBreakdown`**

`CribbageGame` does not know the chosen difficulty. **Do not store difficulty on the game.** Pass it in:

```ts
getBreakdownSnapshot(difficulty: Difficulty): GameBreakdown {
  return {
    player: { ...this.breakdown.player },
    opponent: { ...this.breakdown.opponent },
    winner: this.winner,
    rounds: this.rounds,
    difficulty,
  }
}
```

Deep-copy the two `PlayerBreakdown` objects (spread is enough; they are flat numbers). Never hand `this.breakdown` to Redux by reference.

Import `Difficulty` from `./difficulty`. That import is types + a type-only union; it does not pull in `Deck`.

**Acceptance**

- After any completed game, `player.hand + crib + pegging + bonuses === scores.player` (same for opponent).
- Nobs from hand/crib sit in `bonuses`, not in `hand`/`crib`.
- His heels (2) sit in the dealer's `bonuses`.

**Depends on:** 3.1. Types are needed by Phase 4 and Phase 5.

#### Task 3.3 — Register `game-win`; fix `quit` (H2, H3)

**Files:** `src/app/game.ts` (modify)

**H3 — `game-win` is dropped.** `nextStage("ending")` emits `GameAction("game-win", winner)`, but the `ending` switch (line 774) only handles `end-game` and `new-game`. Add:

```ts
case "game-win":
  this.registerAction(action)
  return []
```

**H2 — `quit` skips ending.** The `showing` case queues `[...nextStage("ending"), new GameAction("new-game")]`, which immediately leaves `ending`. Remove the trailing `new-game`.

**Additional defect (not numbered in the spec, treat as H2b):** `quit` is only handled inside `showing`, but `Cribbage.tsx` renders Quit on `starting`, `showing`, and `ending`. A quit from `starting` or `ending` is currently an unregistered action.

**Required approach:** handle `quit` once, next to `abort-game` / `game-timeout` at the bottom of `doAction` (stage-independent):

```
register; winner = "opponent"; gameOver = true; return nextStage("ending")
```

Delete the `showing`-only `quit` case so there is one path. If `gameOver` is already true, ignore (same as `abort-game`) — the modal is already the way out.

Play Again is `GameOverModal` dispatching `{ action: "new-game" }`. `Cribbage.start()` already routes `game.gameOver` to `new-game`. No functionality is lost.

**Acceptance**

- A win emits `game-win` and it registers (no `"Unregistered Action"` log).
- A quit from any staged button lands in `ending` and stays there until `new-game`.
- `new-game` from `ending` still goes to `starting` as today.

**Depends on:** 3.2 (snapshot is taken on `game-win` in Phase 4/7; the action must exist first).

#### Task 3.4 — Tests T4, T5, and T5b

**Files:** `src/app/game.test.ts` (extend)

**T5 — Nobs attribution**

- Construct a 4-card hand containing JS and a starter of spades (or any matching suit). Assert `countNobs === 1`.
- Drive `scoreAction` / `doAction` through a `show-non-dealer` (or call the attribution by playing a minimal show) and assert `breakdown[player].bonuses` includes that 1 and `breakdown[player].hand === scoreHand(...) - 1`.
- Assert `scoreHand(hand, starter, false)` equals the pre-3.1b total for **non-crib** fixtures (flush + run + compound + nobs). Compare against a few frozen fixtures (e.g. 15-2, pair, nobs). Non-crib scores must not regress.

**T5b — Crib flush correction**

- Four hearts in the crib, diamond starter: `scoreHand(crib, starter, true)` flush contribution is `0` (four-card crib flush does not score). Other categories may still score.
- Four hearts in the crib, heart starter: flush contribution is `5`. A reliable way to isolate this: use ranks that form no 15, pair, or run (e.g. A♥ 4♥ 10♥ K♥ + 7♥ — check the actual `scoreHand` total and assert it is exactly 5 more than the same four cards with a 7♦ starter, or assert the two totals differ by 5 when the only changed card is the starter suit).
- Same five hearts scored as a **non-crib** hand still scores 5 for flush (no regression).
- Four hearts + off-suit starter as a **non-crib** hand still scores 4.

**T4 — Breakdown invariant (load-bearing)**

Drive a full game through `CribbageGame.doAction` to a win (loop returned actions; synthesise `cut` / `discard` / `play-card` with `getBestHand` + `playBestCard1`; pump `score` actions back in). Then:

```
for (const who of ["player", "opponent"]) {
  const b = game.breakdown[who]
  expect(b.hand + b.crib + b.pegging + b.bonuses).toBe(game.scores[who])
  expect(b.total).toBe(game.scores[who])
}
```

Also assert a quit mid-game produces a snapshot whose buckets still sum to `scores` (winner `"opponent"`). That snapshot is a conceded game and will be fed to `recordCompletedGame` in Task 7.4 — do not invent a separate “quit doesn’t count” path.

Do **not** go through `thePlayer` for T4 if you can avoid it. If you do, `resetForNewSession()` in `beforeEach` (available after Task 4.2). Prefer driving `CribbageGame` directly.

**Depends on:** 3.2, 3.3.

---

### Phase 4 — Slice contract and singleton hygiene

**Goal:** Redux holds difficulty and the final snapshot. `prepare-board` can no longer wipe them. Tests can reset `thePlayer`.

#### Task 4.1 — Extend `gameSlice`

**Files:** `src/features/game/gameSlice.ts` (modify)

Add to `GamePlayingState`:

```ts
difficulty: Difficulty
difficultyChosen: boolean
finalBreakdown: GameBreakdown | null
```

`initialState`:

```ts
difficulty: loadPreferences().difficulty,   // falls back to "intermediate" inside persistence
difficultyChosen: false,
finalBreakdown: null,
```

New reducers — **do not** widen `UserGamePlay`:

| Reducer | Payload | Effect |
| --- | --- | --- |
| `setDifficulty` | `Difficulty` | `difficulty = payload`, `difficultyChosen = true` |
| `resetDifficultyChoice` | none | `difficultyChosen = false` |
| `clearFinalBreakdown` | none | `finalBreakdown = null` |

Export the new actions next to `userPlay`.

**Import cycle:** `gameSlice` already imports `thePlayer`; `gamePlayer` already imports `initialState`. `persistence.ts` must not import `gameSlice` or `gamePlayer`. `game.ts` may import `Difficulty` from `difficulty.ts`. Keep that DAG.

Until Phase 5 exists, you may temporarily seed `difficulty: "intermediate"` and switch to `loadPreferences()` in Task 5.3. Prefer landing Phase 5 first if one person owns both.

**Depends on:** 2.1 (Difficulty type), 3.2 (`GameBreakdown` type). Soft-depends on 5.1 for the seed.

#### Task 4.2 — `resetForNewSession` (H7)

**Files:** `src/app/gamePlayer.ts` (modify)

```ts
resetForNewSession(): void {
  this.playQueue = []
  this.gameQueue = []
  this.game.gameOver = true
  this.game.resetGame()
  this.stateUpdate = {}
}
```

Setting `gameOver = true` before `resetGame()` is required — `resetGame` only clears scores / breakdown / dealer inside that branch.

This is the supported test isolation hook. Engine tests that touch `thePlayer` must call it in `beforeEach`.

**Depends on:** 3.2 (`resetGame` also clears breakdown).

#### Task 4.3 — `prepare-board` preserves difficulty (H1)

**Files:** `src/app/gamePlayer.ts` (modify)

Today (`~129–137`) this replaces UI state with `{...initialState}`, which would re-open the modal and drop `finalBreakdown` on every Play Again.

```ts
case "prepare-board": {
  console.log("New Game!")
  const ups = { ...initialState }
  ups.playerPeg = { ...ups.playerPeg, points: [0, -1, -1] }
  ups.opponentPeg = { ...ups.opponentPeg, points: [0, -1, -1] }
  ups.difficulty = state.difficulty
  ups.difficultyChosen = state.difficultyChosen
  ups.finalBreakdown = null
  this.stateUpdate = ups
  break
}
```

Clearing `finalBreakdown` here is correct: a new game has no result. `GameOverModal` dismisses via `clearFinalBreakdown()` *and* this path, so Play Again does not flash a stale modal.

**Depends on:** 4.1.

#### Task 4.4 — Publish snapshot on `game-win`

**Files:** `src/app/gamePlayer.ts` (modify)

In `case "game-win"` (existing toast stays):

```ts
this.stateUpdate["finalBreakdown"] = this.game.getBreakdownSnapshot(state.difficulty)
```

`handleAction` runs before `doAction` for a given queued action, but `game-win` is *emitted by* `doAction` and then handled on the next pump — the ledger is already updated. Do not snapshot from inside `CribbageGame`.

**Depends on:** 3.2, 3.3, 4.1.

#### Task 4.5 — Test T6

**Files:** `src/app/game.test.ts` or `src/features/game/gameSlice.test.ts` (create if needed)

1. `resetForNewSession()`.
2. Dispatch `setDifficulty("easy")` (or call the reducer).
3. Drive to a win **or** invoke `handleAction(state, new GameAction("prepare-board"))` with a state that already has `difficulty: "easy"` and `difficultyChosen: true`.
4. Assert the returned / merged state still has those two fields.
5. Assert `finalBreakdown` is `null` after `prepare-board`.

A reducer-only test plus a `handleAction` unit test is enough; a full game is optional here (T4 already covers the ledger).

**Depends on:** 4.2, 4.3.

#### Task 4.6 — Pass `state.difficulty` at opponent call sites

**Files:** `src/app/gamePlayer.ts` (modify)

Replace any temporary `"expert"` literals from Task 2.3 with `state.difficulty`.

**Depends on:** 2.3, 4.1.

---

### Phase 5 — Persistence layer (F4)

**Goal:** One module owns `localStorage`. Games and tests never throw because storage failed.

#### Task 5.1 — `src/app/persistence.ts`

**Files:** `src/app/persistence.ts` (create)

```ts
const STORAGE_KEY = "cribbagex.v1"

export type StoredPreferences = { difficulty: Difficulty }

export type StoredStats = {
  gamesPlayed: number
  playerWins: number
  opponentWins: number
  lifetime: { player: PlayerBreakdown, opponent: PlayerBreakdown }
}

export function loadPreferences(): StoredPreferences
export function savePreferences(prefs: Partial<StoredPreferences>): void
export function loadStats(): StoredStats
export function loadSessionStats(): StoredStats
export function recordCompletedGame(result: GameBreakdown): void
export function clearAll(): void
```

**On-disk shape** (single versioned blob — do not invent a second key):

```ts
type StoredV1 = {
  preferences: StoredPreferences
  stats: StoredStats
}
```

**Rules**

- Every `getItem` / `setItem` / `JSON.parse` wrapped in `try/catch`. Private mode, disabled storage, quota, and malformed JSON → in-memory defaults, no throw.
- Version or shape mismatch → discard, start from defaults. No migration.
- Unrecognised `difficulty` string → `"intermediate"`.
- Non-finite numbers → `0`.
- Pure data only. No `Card`, `Hand`, `CribbageGame`.
- `recordCompletedGame` increments `gamesPlayed`, the winner's win counter, and adds each category of `result.player` / `result.opponent` into `lifetime`. Also updates module-level **session** stats (same shape). Session resets on full page reload (module re-init). **Quits are conceded games:** a result with `winner: "opponent"` (including from `quit`) is recorded the same way as a peg-out. No exclusion flag.
- `clearAll` removes `STORAGE_KEY` and zeroes session + cached defaults.
- `savePreferences` merges with current stored prefs.

Default stats: all zeros, empty `PlayerBreakdown` totals.

**`loadPreferences` used from `initialState`:** it must be safe at module-import time (no `window` assumptions beyond `localStorage` behind try/catch; in jsdom it exists).

**Depends on:** 2.1, 3.2.

#### Task 5.2 — Test T9

**Files:** `src/app/persistence.test.ts` (create)

- `localStorage.setItem` stubbed to throw: `savePreferences`, `recordCompletedGame` do not throw; subsequent `loadPreferences` / `loadStats` return defaults.
- `localStorage.getItem` returns `"{not json"`: loaders return defaults.
- `getItem` returns a blob with `difficulty: "nightmare"` and `gamesPlayed: "nope"`: difficulty is `"intermediate"`, counts are `0`.
- Happy path: `savePreferences({ difficulty: "easy" })` then `loadPreferences()` is easy; `recordCompletedGame(fixture)` then `loadStats()` reflects it; a second fixture with `winner: "opponent"` (quit / concession) increments `gamesPlayed` and `opponentWins`; `clearAll()` wipes both lifetime and session.
- `loadSessionStats()` after `recordCompletedGame` increments; document that session is module state (reset the module via `clearAll` in `afterEach`).

**Depends on:** 5.1.

#### Task 5.3 — Seed the slice from preferences

**Files:** `src/features/game/gameSlice.ts` (modify)

`difficulty: loadPreferences().difficulty` in `initialState`.

**Depends on:** 4.1, 5.1.

---

### Phase 6 — Application shell and screens (F1, F5, P1, P4, P5)

**Goal:** `/` is the splash. The table lives at `/play` and on the existing skin routes. Learn has real rules. Stats and Friend are reachable placeholders. The table still starts without a difficulty modal (Phase 7).

#### Task 6.1 — Extract `AppRoutes` and `GameLayout`

**Files:** `src/App.tsx` (modify), `src/App.test.tsx` (modify)

1. Remove the unconditional `<h1>CRIBBAGE</h1>` above the router. It collides with the splash title.
2. Add a small `GameLayout` that renders that `<h1>` plus `children`. Use it only on table routes so the table looks unchanged.
3. Extract and **export** `AppRoutes` (`<Routes>…</Routes>` only). `App` remains `<div className="App"><Router …><AppRoutes/></Router></div>`. Keep the existing `future` flags on `BrowserRouter`.
4. Route table:

| Path | Element |
| --- | --- |
| `/` | `Splash` |
| `/play` | `GameLayout` + `<Cribbage deck={new StdDeck("rc")}/>` |
| `/learn` | `Learn` |
| `/stats` | `Stats` |
| `/friend` | `FriendPlay` |
| `/select` | `GameLayout` + `<Cribbage/>` (deck picker unchanged) |
| `/brooke`, `/emma1`, `/emma2`, `/vintage` | `GameLayout` + existing `url_map` decks |
| `*` | `<Navigate to="/" replace />` |

Deep-link skins do **not** pass through the splash. They **do** get the difficulty modal in Phase 7.

**H8:** `App.test.tsx` uses `getByText(/cribbage/i)`. After this change that matches splash title *and* possibly leftover copy. Update it in the **same commit** to assert splash-specific content (e.g. the Play button, or `/CribbageX/i` as a heading). Do not leave a red suite.

**Acceptance:** `/` is not the table. Skin routes still render `Cribbage`. Unknown paths redirect home.

**Depends on:** 6.2 can land in the same change (need a `Splash` stub at minimum).

#### Task 6.2 — Splash (F1)

**Files:** `src/screens/Splash.tsx` (create), `src/App.css` (new commented section)

Full-viewport screen:

- Background: `<img src="/img/splash/splash-hero.png" alt="">` (or CSS `background-image`) with a **dark scrim** over it so type stays readable.
- **H10 — artwork is not delivered.** `onError` on the `<img>` (or `background-image` with a gradient declared first in the stack) falls back to a CSS gradient in the existing green baize family (the `.play` / table greens). Build, tests, and the running app must work with the file absent. Do not add a dummy PNG to un-block CI.
- Title: **CribbageX**. Tagline (placeholder until product copy arrives): *A two-player game to 121. You, one opponent, and a crib.*
- Primary buttons (large, keyboard reachable, this order), `react-bootstrap` `<Button>`:
  - **Play** `variant="primary"` → `navigate("/play")`
  - **Learn** `variant="outline-light"` → `navigate("/learn")`
- Secondary text links: **Stats** → `/stats`, **Play with a Friend** → `/friend`.
- Fairness line (committed copy): *The same shuffle at every difficulty — only the opponent's strategy changes.*

**Animation** (new `@keyframes` in `App.css`, same style as `slide` / `sliderev` / `slide_text`):

1. Title: fade + slight scale-in, ~600 ms, `ease`.
2. Buttons: staggered rise-in, ~400 ms each, ~120 ms stagger after the title.
3. One ambient flourish: slow scale drift on the hero, **or** two decorative `<PlayingCard>` faces (export already exists) easing into place using a real deck (`new StdDeck("rc")`) and face-up cards.

**Reduced motion is mandatory.** Under `@media (prefers-reduced-motion: reduce)` apply the final visual state with no transition. The file already uses a `prefers-reduced-motion: no-preference` wrapper — follow that pattern (put *animation properties* inside `no-preference`, not the layout).

**`.App` leak:** `.App` currently paints a remote painting as `background-image`. `.splash` must be `min-height: 100vh` and paint its own background so that image does not show through. Do not edit `.play`, `.playerHand`, `.deck`, `.board`, `.opponentHand`, `.cribHand`.

**Acceptance:** Play and Learn navigate. Screen works with the hero file missing. Reduced-motion shows the final layout immediately.

**Depends on:** 6.1 (route). Can stub a heading-only Splash to unblock 6.1, then finish visuals here.

#### Task 6.3 — Learn (F5 + P1)

**Files:** `src/screens/Learn.tsx` (create), `src/App.css` (learn section)

`react-bootstrap` `Container` / `Row` / `Col` with `Accordion` or stacked `Card`s. Required sections:

1. Object of the game — 121, two players, first to peg out.
2. Deal and cut for dealer — low card deals; six cards each.
3. The crib — two discards each; crib belongs to the dealer.
4. Starter card — cut after discard; his heels = 2 to the dealer for a jack.
5. The play — alternate, count to 31, go, 15s, pairs, runs, last card.
6. The show — non-dealer, then dealer, then crib.
7. Scoring reference table — must match `scoreHand` (see note below).
8. Winning, and what a skunk is (explain the term; do **not** detect skunks in the game-over UI).
9. How the opponent plays — render `DIFFICULTY_LABELS` / `DIFFICULTY_DESCRIPTIONS` **from** `difficulty.ts` (do not duplicate strings), plus the fair-shuffle sentence.

**Scoring table vs `scoreHand`:** document standard cribbage as spec §4.5 item 7 lists it, and as Task 3.1b implements it (15s = 2; pair / trips / quads = 2 / 6 / 12; runs 1 per card; flush 4 in hand, 5 with starter; **crib flush five-card only**; nobs = 1). After 3.1b the table and the engine agree. If 6.3 lands before 3.1b, the table still describes the corrected rule — do not document the bug.

**P1 — Guided lessons:** grid of four tiles, each a real `disabled` control (not CSS-only): *Your first hand*, *Counting practice*, *Discard strategy*, *Pegging strategy*. Visible "Coming soon" label. Announced disabled to AT.

**Back** control → `navigate("/")`.

**Depends on:** 2.1, 6.1.

#### Task 6.4 — Stats placeholder (P4)

**Files:** `src/screens/Stats.tsx` (create)

Read `loadStats()` and `loadSessionStats()`. Render:

- Games played, player wins, opponent wins (lifetime and session).
- Lifetime category totals (hand / crib / pegging / bonuses) per seat.

Sections this phase does **not** collect must be explicit **"Coming soon"** rows, **not zeros**:

- Averages per hand
- Skunk / double-skunk counts
- Per-difficulty splits

**Clear statistics** button → `clearAll()` and local re-render.

Back → `/`.

Until Phase 7 records games, counters stay at zero — that is correct, and is not a "coming soon" row.

**Depends on:** 5.1, 6.1.

#### Task 6.5 — Friend placeholder (P5)

**Files:** `src/screens/FriendPlay.tsx` (create)

Disabled room-code `<Form.Control>`, disabled **Create room** button, copy:

> Playing with a friend over a room code is planned. This version is local-only — there is no network play yet.

**No** `fetch`, WebSocket, backend, or new dependency.

Back → `/`.

**Depends on:** 6.1.

#### Task 6.6 — Tests T7

**Files:** `src/screens/Splash.test.tsx` (create), `src/App.test.tsx` (already updated in 6.1)

Wrap `AppRoutes` in `MemoryRouter` + `Provider store={store}` (same wrapper idea as `App.test.tsx`).

- `/` renders buttons named Play and Learn.
- Click Learn → rules content (e.g. "crib" / "121") is in the document.
- `/stats` and `/friend` render without throwing and show "coming soon" (or the friend planned-copy).
- `*` / a bogus path: if testing via `MemoryRouter initialEntries={["/nope"]}`, assert splash or a redirect to `/`.

**Depends on:** 6.1–6.5.

---

### Phase 7 — Modals and recording (F2 UI, F3 UI)

**Goal:** A player cannot start until they pick a difficulty. A finished (or quit) game shows the ledger. Play Again keeps the level. Back to Menu is clean.

#### Task 7.1 — `DifficultyModal`

**Files:** `src/components/DifficultyModal.tsx` (create), `src/Cribbage.tsx` (modify), `src/App.css` (modal tweaks)

- `react-bootstrap` `<Modal>`, `backdrop="static"`, `keyboard={false}`, no close (X) button. Choice must be filled before play.
- Three options from `DIFFICULTY_ORDER`, each showing label + description from `difficulty.ts`. Radio group **or** three cards. The group has an accessible name (`aria-labelledby` on the modal title / `role="radiogroup"` + `aria-label`). Keyboard operable.
- Pre-select `uiState.difficulty` (seeded from preferences). **Always show** the modal when `!uiState.difficultyChosen` — a saved pref pre-fills, it does not skip.
- **Start Game** → `dispatch(setDifficulty(chosen))` + `savePreferences({ difficulty: chosen })`.
- Render from `Cribbage` when `!needDeck && !uiState.difficultyChosen`.
- **`/select` ordering:** existing `needDeck` flow first; modal only after a deck is chosen. Other table routes already have a deck, so the modal is the first thing the user sees.

While the modal is open, **suppress** `.commitCrib` action buttons (`Start The Round!`, `Quit!`, discard / Auto Select). No game action behind the backdrop.

**`resetForNewSession` on fresh mount:** in `Cribbage.tsx`, `useEffect` on mount: if `!uiState.difficultyChosen`, call `thePlayer.resetForNewSession()`. This is the navigation hygiene for splash → play → back → play. React 18 Strict Mode double-mounts in dev; the reset is idempotent, so that is acceptable.

**Acceptance (T8):** table route shows the modal; `Start The Round!` is not in the document until confirm.

**Depends on:** 4.1, 4.2, 5.1, 6.1.

#### Task 7.2 — `ScoreExplanation` placeholder (P2)

**Files:** `src/components/ScoreExplanation.tsx` (create)

```ts
export type ScoreExplanationProps = {
  hand: Array<PCard>       // never Card instances
  starter: PCard | null
  isCrib: boolean
  total: number
}
```

Body: render `total` and the text **Point-by-point breakdown coming soon.**

This is the seam for a later `scoreHand` decomposition. Do not decompose `scoreHand` now. When that work happens, keep `scoreHand(): number` as a wrapper over a structured result — same pattern as `getBestHand`.

**Depends on:** nothing (parallel-safe). Needed by 7.3.

#### Task 7.3 — `GameOverModal`

**Files:** `src/components/GameOverModal.tsx` (create), `src/Cribbage.tsx` (modify)

`Modal` `size="lg"`, `backdrop="static"`, `aria-labelledby` on the title.

- Header: "You win!" / "Your opponent wins!" from `finalBreakdown.winner`.
- Body: two columns (You / Opponent), rows Hand, Crib, Pegging, Bonuses, plus a visually emphasized **Total**. Also show `rounds` and `DIFFICULTY_LABELS[difficulty]`.
- Totals are the **raw ledger** (may exceed 121). Do not cap.
- Below the table: `<ScoreExplanation>` with a dummy empty `hand`, `starter={null}`, `isCrib={false}`, `total={0}` — the slot is the deliverable, not a real explanation. (Game-over has no single hand.)
- Footer:
  - **Play Again** → `dispatch(userPlay({ action: "new-game", cards: [] }))` and `dispatch(clearFinalBreakdown())`.
  - **Back to Menu** → `thePlayer.resetForNewSession()`, `dispatch(resetDifficultyChoice())`, `dispatch(clearFinalBreakdown())`, `navigate("/")`.

Render when `uiState.finalBreakdown !== null`. Also suppress `.commitCrib` buttons in that state so "Start The Round!" does not sit under/beside the result (Play Again replaces it).

**Depends on:** 4.4, 7.2.

#### Task 7.4 — Record completed games (H12)

**Files:** `src/Cribbage.tsx` (modify)

```ts
const recordedRef = useRef<GameBreakdown | null>(null)
useEffect(() => {
  const result = uiState.finalBreakdown
  if (!result || recordedRef.current === result) return
  recordedRef.current = result
  recordCompletedGame(result)
}, [uiState.finalBreakdown])
```

Identity guard: one result recorded once. Do **not** write storage from `userPlay` or `handleAction`.

A quit takes the same path: `quit` → `ending` → `game-win` → `finalBreakdown` → this effect. Opponent win + `gamesPlayed` both increment. That is required, not optional.

On Play Again / new session, `finalBreakdown` goes null then a later game sets a new object — the ref comparison is by identity, which is correct.

**Depends on:** 5.1, 7.3.

#### Task 7.5 — Test T8 and modal wiring tests

**Files:** `src/Cribbage.test.tsx` (create) and/or extend `Splash.test.tsx`

- Render `Cribbage` with a deck, `Provider`, `MemoryRouter`.
- Assert a dialog / heading for difficulty is present.
- Assert `Start The Round!` is absent.
- After clicking a level and **Start Game**, `Start The Round!` appears.

`user-event` is already a devDependency.

If the singleton makes this brittle, `resetForNewSession()` in `beforeEach` and/or a store created per test (`configureStore({ reducer: { game: gameReducer } })`) rather than the module `store`.

**Depends on:** 7.1.

---

### Phase 8 — Seams, docs, browser pass

#### Task 8.1 — `useCardMetrics` (P3)

**Files:** `src/app/useCardMetrics.ts` (create), `src/Cribbage.tsx` (modify)

```ts
export function useCardMetrics(): {
  cardSize: number
  cardSpacing: number
  showSpacing: number
  handLeft: number
}
```

Return exactly `{ cardSize: 150, cardSpacing: 100, showSpacing: 120, handLeft: 170 }`. Replace the four locals in `Cribbage.tsx`. **Zero visual change** is the acceptance criterion. Do not "improve" the numbers.

The hook lives under `src/app/` because the spec says so. Do not relocate it.

**Depends on:** 7.x (so the table is otherwise finished). Can be done earlier if you want a smaller diff.

#### Task 8.2 — Show-phase `ScoreExplanation` slot

**Files:** `src/Cribbage.tsx` (modify)

When `uiState.showPlayer` (or the existing show-phase branch), render `<ScoreExplanation>` with `PCard`s from `game.savedPlayerHand.hand` (`toObject()` as `PCard`), `starter` from `game.starter`, `isCrib={false}`, `total={game.scores["player-hand"]}`. Keep it visually subordinate so the table layout does not shift (absolute position or a small block in `.commitCrib`). If a clean slot would move existing cards, prefer a compact line under the player show score rather than changing `.playerHand` CSS.

**Do not** edit `.play` / `.playerHand` / `.deck` / `.board` / `.opponentHand` / `.cribHand` rules.

**Depends on:** 7.2.

#### Task 8.3 — `AGENTS.md` update

**Files:** `AGENTS.md` (modify)

Update, do not rewrite:

- Persistence now exists (`src/app/persistence.ts`, `localStorage` key `cribbagex.v1`). Still no database / backend.
- `userPlay` is no longer the only reducer; list `setDifficulty`, `resetDifficultyChoice`, `clearFinalBreakdown`.
- Route table including `/`, `/play`, `/learn`, `/stats`, `/friend`, catch-all, and skin deep links.
- `src/screens/` convention; `Cribbage.tsx` still at `src/`.
- `thePlayer.resetForNewSession()` for test isolation and navigation.
- Difficulty changes strategy only; fair shuffle unchanged.
- Crib flush is five-card only and **is implemented** in `scoreHand` (the v0.2 omission is gone).
- Quits are conceded games and are recorded in lifetime/session stats.
- Testing table: new unit files (`game.test.ts`, `difficulty.test.ts`, `persistence.test.ts`) and route tests.

Do not update `README.md` unless asked (it is stale CRA text by policy).

**Depends on:** all feature work landed enough that the doc is true.

#### Task 8.4 — Version bump and final verification

**Files:** `package.json` (`version`: `0.3.0`)

Run:

```bash
npm run lint
npx vitest run
npm run build
```

Then the [browser pass](#74-manual-browser-pass-not-optional).

**Depends on:** 8.1–8.3, all tests green.

---

## 4. Data model

There is **no database, no ORM, and no HTTP API**. The contracts below are TypeScript types plus one `localStorage` blob.

### 4.1 Redux — `GamePlayingState` additions

Existing fields are unchanged. Additions:

| Field | Type | Default | Owner |
| --- | --- | --- | --- |
| `difficulty` | `Difficulty` | `loadPreferences().difficulty` or `"intermediate"` | `setDifficulty`; preserved by `prepare-board` |
| `difficultyChosen` | `boolean` | `false` | `setDifficulty` / `resetDifficultyChoice`; preserved by `prepare-board` |
| `finalBreakdown` | `GameBreakdown \| null` | `null` | `handleAction` `game-win`; cleared by `clearFinalBreakdown` and `prepare-board` |

`UserGamePlay` stays `{ action, cards }`. Settings do not travel through it.

### 4.2 Engine ledger

`CribbageGame.scores` remains the source of truth for "what is the score?". `breakdown` is an attribution of the same increments.

`PlayerBreakdown.total` must always equal `hand + crib + pegging + bonuses`, and that sum must equal `scores[player]` for each seat at every moment after a score action.

### 4.3 Persistence blob

Key: `cribbagex.v1`

```json
{
  "preferences": { "difficulty": "intermediate" },
  "stats": {
    "gamesPlayed": 0,
    "playerWins": 0,
    "opponentWins": 0,
    "lifetime": {
      "player":   { "hand": 0, "crib": 0, "pegging": 0, "bonuses": 0, "total": 0 },
      "opponent": { "hand": 0, "crib": 0, "pegging": 0, "bonuses": 0, "total": 0 }
    }
  }
}
```

Session stats are **not** written to disk. They live as a module-level `StoredStats` in `persistence.ts`.

### 4.4 Component contracts

```ts
// DifficultyModal — no exported props required; reads Redux + persistence
// GameOverModal
{ breakdown: GameBreakdown }  // or read finalBreakdown from Redux inside

// ScoreExplanation
{ hand: PCard[], starter: PCard | null, isCrib: boolean, total: number }

// useCardMetrics()
{ cardSize: 150, cardSpacing: 100, showSpacing: 120, handLeft: 170 }
```

### 4.5 Import DAG (do not invert)

```
entities.ts          ←  game.ts  ←  gamePlayer.ts  ←  gameSlice.ts
difficulty.ts        ←  game.ts, gamePlayer.ts, screens, modals
persistence.ts       ←  gameSlice (seed), Cribbage, Stats, DifficultyModal
difficulty.ts        must not import entities.ts
persistence.ts       must not import gameSlice.ts or gamePlayer.ts
```

---

## 5. Edge cases and error handling

| ID | Failure / edge | Handling |
| --- | --- | --- |
| H1 | `prepare-board` spreads `initialState` and wipes difficulty | Carry `difficulty` + `difficultyChosen` from incoming `state`. Task 4.3. |
| H2 | `quit` queues `new-game` and skips `ending` | Remove trailing `new-game`. Task 3.3. |
| H2b | `quit` only registered in `showing` | Handle `quit` next to `abort-game` (any stage). Task 3.3. |
| H3 | `game-win` unregistered in `ending` | Register and return `[]`. Task 3.3. |
| H4 | Nobs folded into `scoreHand` total | `countNobs` + `GameAction.bonus`. Task 3.1–3.2. |
| H5 | Rank-then-sort changes Expert ties | Generation order + stable descending sort. Task 1.1. |
| H6 | Fewer than four legal peg cards | `pickWeightedIndex` truncates and renormalises. Task 2.1. |
| H7 | Navigate away and back resumes stale queues | `resetForNewSession` on fresh `Cribbage` mount. Tasks 4.2, 7.1. |
| H8 | `App.test.tsx` multiple `/cribbage/i` matches | Update test with Task 6.1. |
| H9 | Final score > 121; pegs capped at 121 | Modal and T4 use raw ledger / `scores`, not 121. |
| H10 | Splash PNG missing | `onError` / gradient fallback. No engineer blocked. Task 6.2. |
| H11 | `localStorage` throws | Total try/catch in `persistence.ts`. Task 5.1, T9. |
| H12 | Storage write in reducer double-fires | Record from `useEffect` + `useRef`. Task 7.4. |
| H13 | Difficulty copied onto `GamePlayer` | Forbidden. Pass `state.difficulty`. Task 2.3 / 4.6. |
| E1 | Empty `rankPlays` (go) | `playBestCard1` → `null`; `playOpponentCard` → existing `GameAction("error")`. |
| E2 | `candidateCount === 0` | `pickWeightedIndex` → `-1`; callers must not index with it. |
| E3 | Win during show/peg (no `round-end`) | `rounds` does not increment for that partial round unless Q1 is resolved. Ledger still balances. |
| E4 | Quit at 0–0 | Modal shows zeros; winner opponent; **must** `recordCompletedGame` (conceded game). |
| E5 | Play Again | Same difficulty, modal does not reopen (`difficultyChosen` carried). `finalBreakdown` cleared. |
| E6 | Back to Menu then Play | `resetDifficultyChoice` + `resetForNewSession`; modal shows again, pref pre-selected. |
| E7 | `/select` without a deck | Deck picker first; difficulty modal second. |
| E8 | Strict Mode double mount | `resetForNewSession` idempotent; record `useRef` prevents double stats. |
| E9 | Malformed stored JSON / unknown keys | Discard, defaults. No migration. |
| E10 | `scoreHand` crib flush was 0 | **Correct it** (Task 3.1b). Four-card crib flush stays 0; five-card crib flush is 5. |
| E11 | Unknown `categoryFor` pair | Do not throw on the score path; skip ledger line and `console.log`. |
| E12 | `.App` painting behind splash | Splash paints full viewport. Task 6.2. |
| E13 | Catch-all blank screen | `*` → `Navigate` to `/`. nginx already serves `index.html`. |
| E14 | `autoPlay` / Auto Select | Stay Expert. Degrading them is a defect. |
| E15 | Game-over + Start The Round both visible | Hide `.commitCrib` while `finalBreakdown !== null`. |

A storage or image failure must **never** break a game in progress.

---

## 6. Testing strategy

No Playwright/Cypress. Prefer `CribbageGame.doAction` / pure functions. Component tests use RTL + a real or per-test store, matching `App.test.tsx`.

### 6.1 Per phase

| Phase | Unit | Component / route | Not this phase |
| --- | --- | --- | --- |
| 1 | T1, T2 on `rank*` vs live wrappers | — | — |
| 2 | T3a rng cases; T3b import/shuffle guard | — | Play-testing Easy rates (manual, post-7) |
| 3 | T4 full-game invariant; T5 nobs; T5b crib flush | — | — |
| 4 | T6 prepare-board / `setDifficulty` | — | — |
| 5 | T9 throw / malformed / happy / clear | — | — |
| 6 | — | T7 MemoryRouter; updated `App.test.tsx` | Visual animation review |
| 7 | — | T8 difficulty gate | Full cribbage hand in RTL |
| 8 | Optional: `useCardMetrics` returns constants | Manual browser E2E | Docker (optional smoke) |

### 6.2 Spec tests (checklist)

| # | Assertion | Task |
| --- | --- | --- |
| T1 | `rankDiscards[0].keep` == pre-wrap `getBestHand`; 15 descending | 1.2 |
| T2 | `rankPlays[0]?.card` == `playBestCard1`; no over-31; empty = `[]` | 1.2 |
| T3a | Deterministic `pickWeightedIndex`; expert = 0; renormalise | 2.2 |
| T3b | `difficulty.ts` does not import `entities`; `shuffle` arity 0 | 2.2 |
| T4 | `hand+crib+pegging+bonuses === scores[p] === total` | 3.4 |
| T5 | Nobs in `bonuses`, excluded from `hand`; non-crib `scoreHand` unchanged | 3.4 |
| T5b | Crib: 4-card flush = 0; 5-card flush = 5; non-crib flush unchanged | 3.4 |
| T6 | Difficulty survives `new-game` / `prepare-board` | 4.5 |
| T7 | Splash Play/Learn; Learn content; `/stats` `/friend` render | 6.6 |
| T8 | Modal up; no Start The Round until confirm | 7.5 |
| T9 | Storage throw + bad JSON do not throw; defaults | 5.2 |

### 6.3 Shared-singleton rule

Any test that touches `thePlayer` calls `thePlayer.resetForNewSession()` in `beforeEach`. Prefer not using the singleton for T4.

### 6.4 Manual browser pass (not optional)

`npm start` → `http://localhost:3000`. Exercise, do not screenshot-only:

1. `/` splash: Play, Learn, Stats, Friend. Confirm fallback with hero file absent (temporarily rename if the file exists).
2. Play → difficulty modal → confirm Intermediate → cut → discard → peg → show → continue until someone wins **or** Quit from showing.
3. Game-over modal: four buckets + total match the on-table scores; Play Again does **not** re-prompt; same difficulty.
3b. Quit a second game → `/stats`: `gamesPlayed` and opponent wins have increased (quit is a conceded game). Reload: lifetime still shows those counts.
4. Play to a result → Back to Menu → Play again: modal reappears, last level pre-selected; board is not a stale mid-game.
5. `/brooke` (and one other skin): lands on the table with the modal, not the splash.
6. `/select`: deck picker, then modal.
7. Learn: rules readable; lesson tiles disabled.
8. Stats: after a recorded game, lifetime increments; reload the tab — lifetime survives; session may reset. Clear statistics zeroes them.
9. Friend: form disabled, no network in DevTools.
10. Unknown URL → splash.
11. OS/browser reduced-motion: splash has no animation.
12. Keyboard: tab to Play/Learn; tab through difficulty options; Enter confirms.

If a step fails, fix and re-run the flow. `npm run preview` after `npm run build` should serve every new route (nginx/`vite preview` SPA fallback). Docker image is optional this phase; `try_files` already covers new paths.

---

## 7. Risk assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Expert play silently diverges from v0.2 (tie-break / generation order) | Medium | High — product-trust | Implement `rank*` first, test against live wrappers (T1/T2), then wrap. Comment the stable sort. |
| T1 written *after* the wrap is a tautology | High if rushed | High (false confidence) | Task 1.2 before Task 1.3. |
| `prepare-board` re-opens the modal after every game | High if H1 missed | High | Task 4.3 + T6. Treat as a blocker for Phase 7. |
| `thePlayer` stale after client-side navigation | High | High (ghost plays, wrong board) | `resetForNewSession` on ungated mount; tests use the same hook. |
| Stats double-count in Strict Mode or reducer writes | Medium | Medium | `useRef` identity guard; no storage in reducers. |
| `localStorage` unavailable | Medium (private mode) | Low if isolated, High if not | One module, try/catch, T9. |
| Import cycles (`gameSlice` ↔ `gamePlayer` ↔ `persistence`) | Medium | High (undefined `initialState`) | Persistence does not import the slice/player. Seed prefs with a function call that is safe at import. |
| Quit from `starting` still broken if only the showing case is edited | Medium | Medium | H2b — stage-independent `quit`. |
| Crib-flush omission left in place “to keep Expert identical to v0.2” | High if T1 is misread | High (wrong scores, wrong Learn table) | Task 3.1b is required. T1 is wrapper equivalence, not a freeze of broken crib EV. |
| Splash art late / huge | Certain (not delivered) | Low | Fallback required. Resize to ≤1920 px / ~400 KB if it arrives. |
| Table CSS regressions | Medium | High | New class names only. Do not touch existing table rules. `useCardMetrics` returns today's constants. |
| Difficulty duplicated on `GamePlayer` | Medium (convenient) | High (drift) | Parameter from `state` only. |
| Easy/Intermediate feel wrong | Medium | Low | Weights are one table. Tune after play; do not special-case levels. |
| `getBreakdownSnapshot` without a difficulty argument | Medium | Low (wrong type / second store) | Pass `state.difficulty` in. |
| Scope creep from `cribbage-games-competitors.md` | Medium | High | That file is not a build spec. Reject muggins, hints, sound, 3–4 player, networking. |

**Unknowns that are *not* blockers:** splash PNG, final tagline copy, weight tuning. See spec §11.

---

## 8. Open questions

Q2 (crib flush) and Q3 (quit stats) are **resolved** — see “Settled after this plan was first written” at the top. Q1 does not block Phase 1–5.

### Q1 — `rounds` when the game ends before `round-end`

**Fact:** `rounds` increments only on `showing` / `round-end`. A win during pegging or during the show never hits that action, so the winning deal is not counted.

**Options**

- A. Follow the spec literally (undercount mid-round wins).
- B. Also increment when entering `ending` if this deal has not been counted.
- C. Increment on `start-round` after a successful deal (count deals started).

**Recommendation:** B, with a one-line comment. The modal label is "rounds played"; a player who pegged out mid-hand did play that round. If the requester wants literal spec behaviour, A is one line to delete.

### Q2 — Crib flush — **resolved**

Correct `scoreHand` in Task 3.1b. Five-card crib flush = 5; four-card crib flush = 0. Learn matches the corrected engine.

### Q3 — Quit stats — **resolved**

Quits are conceded games. `recordCompletedGame` counts them. Winner is the opponent.

### Q4 — Splash tagline and `/friend` copy

Spec allows engineer placeholder copy. Using the sentences in Tasks 6.2 and 6.5. Requester can replace strings without a logic change.

### Q5 — `ScoreExplanation` props on the game-over modal

Game-over has no single hand. Spec still wants the component slotted there.

**Recommendation:** dummy props (`hand: []`, `starter: null`, `total: 0`). Do not widen the prop contract.

### Q6 — Session stats reset definition

**Recommendation:** module-level state, reset on full reload (new JS module instance). `clearAll` zeroes session too. Not reset by Play Again or Back to Menu.

### Q7 — Should `package.json` version become 0.3.0?

Spec target is 0.3.0. **Recommendation:** yes, in Task 8.4. No other `package.json` edits.

---

## Out of scope

Reject these by reference to spec §10:

- Full `scoreHand` decomposition (15s / pairs / runs / flush / nobs) — P2 is the contract only. In-scope scoring edits are **`countNobs`** and **the crib-flush correction** (Task 3.1) only.
- Real tutorial lessons (P1 = disabled tiles).
- Responsive / large-card layout (P3 = constant hook).
- Networking, room codes, backend, accounts (P5 = disabled form).
- Muggins, manual counting, discard analyser, pegging hints, post-game coaching, sound, themes, rule variants, 61-point games, 3/4-player.
- Skunk detection on the game-over screen.
- Rewriting the `CribbageGame` state machine, the queue pump, or `Card` / `Hand`.
- Moving `src/Cribbage.tsx` into `src/screens/`.
- Updating `README.md` unless separately asked.
- New runtime dependencies.

---

## Suggested first ticket

If one engineer starts tomorrow, take **Task 1.1 + 1.2** (ranking functions + equivalence tests). It is the load-bearing refactor for F2, it has no UI, and it can be reviewed on tests alone.

If two engineers start: Engineer A takes Phase 1→2; Engineer B takes Phase 3 and 5 in parallel. Meet at Phase 4.
