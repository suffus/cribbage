# Technical Specification — CribbageX Shell Rearchitecture ("Scaffold" phase)

**Status:** Ready for architectural planning
**Target version:** 0.3.0
**Author:** Engineering management
**Date:** 13 September 2026
**Audience:** Senior architect producing an implementation plan, then implementing engineers

---

## 1. Executive summary

CribbageX v0.2 is a single-screen prototype: opening the app drops the user straight onto a
cribbage table against one AI opponent of fixed strength, and finishing a game only offers
"Start The Round!". This specification defines the work to convert that single screen into a
**navigable application shell** with a front door, a learning path, selectable AI strength, and a
designed post-game moment.

The phase has two *fully implemented* features and a set of *navigable placeholders*.

**Fully implemented in this phase**

| # | Feature | Summary |
| --- | --- | --- |
| F1 | Application shell + splash screen | New `/` splash with animated "Play" and "Learn" buttons; game relocated to `/play` |
| F2 | Difficulty selection and degraded AI | Three levels (Easy / Intermediate / Expert) driven by probabilistic selection from a ranked candidate list; mandatory pre-game modal |
| F3 | Post-game score breakdown | Per-player accounting of points won from hand, crib, pegging, and bonuses; displayed in a game-over modal |
| F4 | Preference + stats persistence layer | Thin, isolated `localStorage` module (first persistence in the product) |
| F5 | Learn screen | Real static rules content; tutorial *lessons* are placeholders |

**Navigable placeholders in this phase** (routes exist, are reachable, render "coming soon"
content, and expose the seams the later work will attach to)

| # | Feature | Placeholder deliverable |
| --- | --- | --- |
| P1 | Onboarding / tutorial lessons | Disabled lesson tiles on `/learn` |
| P2 | Per-hand score explanations (15s, pairs, runs, flush, nobs) | `<ScoreExplanation>` component with its final prop contract defined, rendering a "coming soon" body |
| P3 | Large-card mobile layout | `useCardMetrics()` seam that returns today's constants verbatim — zero visual change, single future edit point |
| P4 | Session and lifetime stats | `/stats` screen rendering real counters from F4 with clearly-marked "coming soon" sections |
| P5 | Play with a friend (room codes) | `/friend` screen with a disabled room-code form. **No networking, no backend.** |

### 1.1 Scope decisions already taken (do not re-litigate)

These were settled with the requester before this document was written:

1. **Splash art** is supplied by the requester as an image file. The implementation must
   reference a fixed path and degrade gracefully when the file is absent (see §4.2.2).
2. **Difficulty weights** are specified concretely in this document (§4.3.3) and must live in a
   single exported constants table so they can be tuned without touching selection logic.
3. **Scope** is F1–F5 fully implemented; P1–P5 are placeholders. In particular, decomposing
   `scoreHand` into a full structured breakdown (15s / pairs / runs / flush / nobs) is **out of
   scope**, with one narrow exception for nobs (§4.4.4).
4. **Persistence** is introduced now as a thin, isolated `localStorage` module. This changes a
   standing statement in `AGENTS.md` ("no persistence") which must be updated as part of the work.
5. **Routing**: the splash becomes `/`; the game moves to `/play`; the existing deck-skin routes
   (`/brooke`, `/emma1`, `/emma2`, `/vintage`, `/select`) continue to work as direct-to-table deep
   links.

---

## 2. Current architecture the work must fit into

The architect must not restructure the engine. The following is the contract as it stands.

### 2.1 Control flow

```
User click / scheduled timer
 → dispatch(userPlay({ action, cards }))          src/features/game/gameSlice.ts
 → gameSlice.userPlay                              (the only reducer today)
 → thePlayer.playAction(state, payload)            src/app/gamePlayer.ts (module singleton)
 → GamePlayer.playNext(state)                      pumps playQueue / gameQueue
 → CribbageGame.doAction(action)                   src/app/game.ts (state machine)
 → GamePlayer.handleAction(state, action)          AI replies, delays, peg + toast updates
 → merged GamePlayingState back into Redux
```

Timing is cooperative: `GamePlayingState.nextScheduledAction` is a millisecond delay, and
`Cribbage.tsx` runs a `setTimeout` that dispatches `{action: "noop"}` to pump the queue.

### 2.2 Hard rules inherited from `AGENTS.md`

- **`Card`, `Hand`, `CribbageGame`, `Deck` instances must never enter Redux.** They are mutable
  classes. Everything crossing the Redux boundary must be a plain serializable record. The new
  `GameBreakdown` type (§4.4.2) is designed to satisfy this.
- **Fair shuffle.** Difficulty changes *strategy only*. `StdDeck.shuffle` must remain identical for
  every AI level, must not take a difficulty parameter, and must not be reachable from any
  difficulty-aware code path. This is a product-trust commitment, not a style preference.
- **One source of truth for score vs pegs.** Do not introduce a parallel score model. The
  breakdown ledger in F3 is an *attribution* of the existing `CribbageGame.scores` increments, and
  is covered by an invariant test (§8, T4).
- **Match local style.** `game.ts` and `gamePlayer.ts` use an older class/`console.log` idiom;
  `index.tsx`, `hooks.ts`, and the components use modern Vite/RTK patterns. Edit in the idiom of
  the file you are in. Do not modernise a file while changing it.
- **Lint**: unused imports and variables are errors unless prefixed `_`.

### 2.3 Existing scoring path (relevant to F3)

`CribbageGame.scoreAction(score, player, action, reason, stage)` builds a
`GameAction("score", player)` carrying:

- `score: number`
- `reason: string` — `"his-nibs" | "15" | "31" | "run" | "pair" | "the-last-card" |
  "show-non-dealer" | "show-dealer" | "show-crib"`
- `source: ActionSource` — `"start" | "play" | "show-hand" | "show-crib"`

All score actions converge on one place (`src/app/game.ts:791`):

```791:796:src/app/game.ts
        this.scores[action.subaction] += action.score
        if( this.scores[action.subaction] > 120 ) {
          this.gameOver = true  ///// do not wait for the game-win!
          this.winner = action.subaction
          return this.nextStage( "ending" )
        }
```

**This single convergence point is what makes F3 cheap.** The breakdown is attributed here, not by
re-deriving scores anywhere else.

---

## 3. Routing and shell (F1)

### 3.1 Route table

| Route | Screen | Status | Notes |
| --- | --- | --- | --- |
| `/` | `Splash` | **New** | Front door. Was the game. |
| `/play` | `Cribbage` (deck `rc`) | **New path, existing screen** | Difficulty modal gates play |
| `/learn` | `Learn` | **New** | Real rules content + placeholder lesson tiles |
| `/stats` | `Stats` | **New** | Placeholder screen, real counters |
| `/friend` | `FriendPlay` | **New** | Placeholder screen |
| `/select` | `Cribbage` (deck picker) | Unchanged behaviour | Deep link; difficulty modal still applies |
| `/brooke` | `Cribbage` (deck `br1`) | Unchanged behaviour | Deep link; difficulty modal still applies |
| `/emma1` | `Cribbage` (deck `em1t`) | Unchanged behaviour | Deep link |
| `/emma2` | `Cribbage` (deck `em2`) | Unchanged behaviour | Deep link |
| `/vintage` | `Cribbage` (deck `vv`) | Unchanged behaviour | Deep link |
| `*` | Redirect to `/` | **New** | nginx already falls unknown paths through to `index.html`; the router must not render blank |

The deck-skin routes keep their current semantics (straight to the table with that deck). They are
*not* required to pass through the splash. They *are* required to show the difficulty modal, because
the modal is a property of starting a game, not of the entry route.

### 3.2 Structural changes to `App.tsx`

Three changes, all small:

1. **Remove the unconditional `<h1>CRIBBAGE</h1>`** currently rendered above the `<Router>` on
   every page. It will collide with the splash's own title. Move it into a small `GameLayout`
   wrapper used by the table routes so the table looks unchanged.
2. **Extract the `<Routes>` tree into an exported `AppRoutes` component**, leaving `App` as
   `<Router><AppRoutes/></Router>`. This is required so route-level tests can wrap `AppRoutes` in
   `MemoryRouter` — `App` currently hard-codes `BrowserRouter` and cannot be route-tested.
3. Register the new routes and the catch-all.

> **Hazard — existing test will break.** `src/App.test.tsx` asserts
> `screen.getByText(/cribbage/i)`. Once `/` renders the splash *and* any layout heading survives,
> `getByText` will throw on multiple matches. `App.test.tsx` must be updated in the same change to
> assert against the splash specifically (see §8, T7).

### 3.3 `thePlayer` singleton hygiene

`thePlayer` is a module singleton holding `playQueue`, `gameQueue`, and a live `CribbageGame`.
Navigation now makes it possible to leave a game half-played (splash → play → back → play), which
would resume with stale queued actions and a stale board.

**Required:** add `GamePlayer.resetForNewSession()` which clears `playQueue` and `gameQueue`, sets
`gameOver = true`, and calls `this.game.resetGame()`. `Cribbage.tsx` calls it on mount when
arriving fresh (i.e. when the difficulty has not yet been confirmed for this visit). This also gives
tests a supported way to isolate the singleton.

### 3.4 File placement convention

New route-level screens go in a new `src/screens/` folder. `src/Cribbage.tsx` **stays where it is** —
moving it is churn this phase does not need. The architect should note the resulting inconsistency
in the implementation plan and schedule the move separately if desired.

---

## 4. Feature specifications

### 4.1 Shared data contract changes

#### 4.1.1 New types

`src/app/difficulty.ts` (**new file**):

```ts
export type Difficulty = "easy" | "intermediate" | "expert"
```

`src/app/game.ts` (**modified**), alongside the existing `scores` object:

```ts
type ScoreCategory = "hand" | "crib" | "pegging" | "bonuses"

type PlayerBreakdown = {
  hand: number      // show points for the four-card hand, excluding nobs
  crib: number      // show points for the crib, excluding nobs
  pegging: number   // 15s, 31s, runs, pairs, last card during the play
  bonuses: number   // his nibs/heels (2 for a cut jack) + nobs from hand and crib
  total: number     // must equal hand + crib + pegging + bonuses
}

type GameBreakdown = {
  player: PlayerBreakdown
  opponent: PlayerBreakdown
  winner: PlayerEvent
  rounds: number
  difficulty: Difficulty
}
```

`GameBreakdown` is a plain record with only numbers, string unions, and nested plain records. It is
therefore safe to place in Redux and to serialise to `localStorage`.

#### 4.1.2 Redux state extension — `src/features/game/gameSlice.ts`

```ts
export interface GamePlayingState {
  // ... all existing fields unchanged ...
  difficulty: Difficulty          // single source of truth; read by GamePlayer
  difficultyChosen: boolean       // false until the pre-game modal is confirmed
  finalBreakdown: GameBreakdown | null
}
```

Defaults in `initialState`: `difficulty` seeded from `loadPreferences()` (§4.6) falling back to
`"intermediate"`, `difficultyChosen: false`, `finalBreakdown: null`.

**New reducers** (`userPlay` is no longer the only reducer — this is a deliberate, documented
widening of the contract, and `AGENTS.md` must be updated to match):

| Reducer | Payload | Effect |
| --- | --- | --- |
| `setDifficulty` | `Difficulty` | Sets `difficulty`, sets `difficultyChosen: true` |
| `resetDifficultyChoice` | — | Sets `difficultyChosen: false`; used when leaving a game |
| `clearFinalBreakdown` | — | Sets `finalBreakdown: null` |

Do **not** smuggle difficulty through `UserGamePlay`. `UserGamePlay` is a card-play contract and
widening it to carry settings would degrade a good type.

#### 4.1.3 Difficulty is read, not mirrored

`state` is already threaded through every AI decision point
(`playAction(state, …)` → `play(state)` → `playNext(state)` → `handleAction(state, action)`).
The AI selection helpers must therefore take the difficulty **as a parameter read from
`state.difficulty` at the call site**. `GamePlayer` must **not** hold its own `difficulty` field.
One source of truth; no drift.

---

### 4.2 F1 — Splash screen

#### 4.2.1 Content and behaviour

`src/screens/Splash.tsx` (**new**). Full-viewport screen containing:

- Background artwork (§4.2.2) with a dark scrim so text remains legible over arbitrary art.
- Product title ("CribbageX") and a one-line tagline.
- **Two primary buttons**, large, keyboard reachable, in this order:
  - **Play** → `navigate("/play")`
  - **Learn** → `navigate("/learn")`
- Secondary text links, visually subordinate, so the placeholder screens are reachable and
  testable: **Stats** (`/stats`), **Play with a Friend** (`/friend`).
- A small fairness line, already committed to in the competitive analysis:
  *"The same shuffle at every difficulty — only the opponent's strategy changes."*

Buttons use `react-bootstrap` `<Button>` (`variant="primary"` / `variant="outline-light"`),
consistent with `Cribbage.tsx` and `CardComponents.tsx`.

#### 4.2.2 Artwork — dependency and fallback

The splash artwork is a **requester-supplied dependency** and was not delivered with the request.

- **Agreed path:** `public/img/splash/splash-hero.png`, referenced from code as
  `/img/splash/splash-hero.png`.
- **Fallback is mandatory.** The image is loaded through an `<img>` with an `onError` handler (or a
  `background-image` with a gradient declared first in the stack) that falls back to a CSS gradient
  in the existing green baize family. **The build, the tests, and the running app must all work with
  the file absent.** No engineer may be blocked waiting for the asset.
- No nginx change is required: `public/` is copied verbatim into `dist/`, and `nginx.conf` already
  has a `location /img/` block with a 30-day cache header.
- If the supplied art is large, it should be resized to ≤ 1920 px wide and kept under ~400 KB.
  `public/img/Cribbage_Board.svg` is already 381 KB, so this is consistent with existing weight.

#### 4.2.3 Animation

Animations go in `src/App.css` as new `@keyframes`, following the existing convention in that file
(`slide`, `sliderev`, `slide_text` are already defined there). Required:

1. Title: fade + slight scale-in on mount (~600 ms, `ease`).
2. Buttons: staggered rise-in (~400 ms each, ~120 ms stagger) after the title.
3. One ambient flourish — e.g. a slow parallax/`scale` drift on the hero image, or a pair of
   decorative card faces (reuse `<PlayingCard>` from `CardComponents.tsx` with real deck images)
   easing into place.

**Reduced motion is mandatory.** All splash animation must be wrapped so that under
`@media (prefers-reduced-motion: reduce)` the final state is applied immediately with no transition.
The file already establishes the pattern with its `prefers-reduced-motion: no-preference` block.

---

### 4.3 F2 — Difficulty

#### 4.3.1 The problem to solve

The engine currently exposes only "the best move":

- `getBestHand(hand, otherCardsSeen, isPlayerCrib): Array<Card>` (`src/app/game.ts:124`) evaluates
  all 15 keep/discard splits and returns only the winner (`src/app/game.ts:149`).
- `playBestCard1(gameHand, playerHand): Card | null` (`src/app/game.ts:190`) evaluates each legal
  card and returns only the winner (`src/app/game.ts:211`).

Degraded play requires **ranked candidate lists**, which do not exist. Both functions must be
refactored to compute a ranking and expose the existing behaviour as a thin wrapper over it. The
existing exported signatures must not change — `getBestHand` is called from `Cribbage.tsx`
(`autoSelect`) and from `gamePlayer.ts` in two places; `playBestCard1` from two places.

#### 4.3.2 Required engine refactor (`src/app/game.ts`)

```ts
export type DiscardOption = {
  keep: Array<Card>      // the 4 cards retained
  discard: Array<Card>   // the 2 cards sent to the crib
  score: number          // the existing tScore: eScore ± cScore
}

export type PlayOption = {
  card: Card
  score: number          // the existing dS
}

export function rankDiscards(
  hand: Array<Card>, otherCardsSeen: Array<Card>, isPlayerCrib: boolean
): Array<DiscardOption>          // always 15 entries, best first

export function rankPlays(
  gameHand: Array<Card>, playerHand: Array<Card>
): Array<PlayOption>             // legal cards only (peg total ≤ 31), best first, may be empty
```

Then:

```ts
export function getBestHand(hand, otherCardsSeen, isPlayerCrib): Array<Card> {
  return rankDiscards(hand, otherCardsSeen, isPlayerCrib)[0].keep
}

export function playBestCard1(gameHand, playerHand): Card | null {
  return rankPlays(gameHand, playerHand)[0]?.card ?? null
}
```

**Behaviour-preservation requirements — these are not optional:**

- **Tie-breaking must be preserved exactly.** Today's loops use strict `>` against a running
  maximum, so on a tie the *earliest candidate in generation order* wins. The ranking must therefore
  (a) generate candidates in exactly today's order (`selections` order for discards; `playerHand`
  order for plays) and (b) sort with a **stable** descending sort. `Array.prototype.sort` is
  specified as stable, so `sort((a, b) => b.score - a.score)` is sufficient — but the reliance must
  be noted in a comment, because it is the thing that makes Expert provably identical to v0.2.
- `rankPlays` must retain the existing `nS > 31` skip, so illegal cards never appear in the list.
  An empty result means "go", and `playBestCard1` must still return `null`.
- `rankDiscards` must retain the existing `console.log` of expected scores. Do not clean it up;
  `AGENTS.md` forbids modernising a file while changing it.
- No change to the EV maths (`calcExpectedHandScore`, `calcExpectedCribScore`, `p1Costs`).

#### 4.3.3 Difficulty model (`src/app/difficulty.ts`, **new file**)

Degradation is *identical in shape* for discard and pegging: draw an index from a weighted
distribution over the top four ranked candidates.

```ts
export type Difficulty = "easy" | "intermediate" | "expert"

export const DIFFICULTY_ORDER: ReadonlyArray<Difficulty> = ["easy", "intermediate", "expert"]

/** Probability of choosing the 1st / 2nd / 3rd / 4th best candidate.
 *  These are the only tuning knobs; selection logic must not special-case a level. */
export const DIFFICULTY_WEIGHTS: Record<Difficulty, ReadonlyArray<number>> = {
  easy:         [0.40, 0.25, 0.20, 0.15],
  intermediate: [0.70, 0.20, 0.07, 0.03],
  expert:       [1.00],
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy:         "Easy",
  intermediate: "Intermediate",
  expert:       "Expert",
}

/** Player-facing, honest description of the strategy. Shown in the modal and on /learn. */
export const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  easy:         "Often takes the second, third, or fourth best discard and pegging card.",
  intermediate: "Usually plays the best move, but slips to a near-miss about three times in ten.",
  expert:       "Always plays the highest expected-value discard and pegging card.",
}
```

Selection helper, in the same file:

```ts
export function pickWeightedIndex(
  weights: ReadonlyArray<number>,
  candidateCount: number,
  rng: () => number = Math.random
): number
```

Semantics:

- Returns `-1` when `candidateCount <= 0`.
- Truncates `weights` to `min(weights.length, candidateCount)` and **renormalises over the
  remaining weights**. This matters: during the play there are frequently fewer than four legal
  cards, and without renormalisation the AI would be biased toward the best card in exactly the
  situations where the choice is tightest.
- `expert` weights `[1.00]` therefore always yield index `0` for any non-empty candidate list,
  which is what makes Expert bit-identical to v0.2 behaviour.
- `rng` is injectable **solely so the unit tests can be deterministic.** It defaults to
  `Math.random` and no production call site may pass anything else.

**Fair-shuffle guard.** `pickWeightedIndex` and `DIFFICULTY_WEIGHTS` must have no reference to
`Deck`, `StdDeck`, or `shuffle`. `src/app/difficulty.ts` must not import from `entities.ts`. This
is verifiable by inspection and is covered by test T3b.

#### 4.3.4 Wiring into the opponent (`src/app/gamePlayer.ts`)

| Method | Today | Change |
| --- | --- | --- |
| `selectOpponentCards(delay)` | `getBestHand(...)` | → `selectOpponentCards(difficulty, delay)`; use `rankDiscards(...)` + `pickWeightedIndex(DIFFICULTY_WEIGHTS[difficulty], 15)`; mark the chosen option's `discard` cards selected |
| `playOpponentCard(delay)` | `playBestCard1(...)` | → `playOpponentCard(difficulty, delay)`; use `rankPlays(...)` + `pickWeightedIndex(...)`; empty list still yields the existing `GameAction("error")` path |
| `autoSelectPlayerCards(delay)` | `getBestHand(...)` | **Unchanged — stays Expert** |
| `autoplayPlayerCard(delay)` | `playBestCard1(...)` | **Unchanged — stays Expert** |

`autoPlay` is a developer/demo mode driving the *human* seat; degrading it would make the mode
useless for engine debugging. Likewise, the human's **"Auto Select" button in `Cribbage.tsx` keeps
using `getBestHand` and stays at Expert strength** — it is a coaching aid for the player, not the
opponent. An architect should explicitly call this out so no engineer "helpfully" degrades it.

Call sites are inside `handleAction(state, action)`, which already has `state`, so the difficulty is
passed as `state.difficulty`.

Note the existing awkwardness in `selectOpponentCards`: it sets the whole hand selected and then
un-selects the keepers, because `getSelectedOpponentCards()` reads `Card.selected`. Keep that idiom
— it is how the rest of the file works — just drive it from `option.keep` instead of the
`getBestHand` return value.

#### 4.3.5 Difficulty selection modal

`src/components/DifficultyModal.tsx` (**new**), built on `react-bootstrap` `<Modal>` (the same
dependency `PopupImage` already uses).

- Rendered by `Cribbage.tsx` whenever `!uiState.difficultyChosen`.
- `backdrop="static"`, `keyboard={false}`, no close button — the requirement is that the choice
  "shall be filled in before the game starts".
- Three options rendered from `DIFFICULTY_ORDER`, each showing `DIFFICULTY_LABELS[d]` and
  `DIFFICULTY_DESCRIPTIONS[d]`. Radio group or three cards; the group must have an accessible
  label and be operable by keyboard.
- Pre-selected to the value loaded from preferences (§4.6). The modal is **always shown** even when
  a preference exists — remembering the choice pre-fills it, it does not skip the step.
- Confirm button ("Start Game") dispatches `setDifficulty(chosen)` and calls
  `savePreferences({ difficulty: chosen })`.
- While the modal is open, the table's action buttons (`Start The Round!`, `Quit!`, discard
  controls) must be suppressed so no game action can be triggered behind the backdrop.

**Ordering with the deck picker:** on `/select`, the existing `needDeck` flow runs first; the
difficulty modal appears once a deck has been chosen. On every other route the deck is already
resolved, so the modal is the first thing the user sees.

**Changing difficulty later:** out of scope as a settings screen. The modal reappears whenever
`difficultyChosen` is false — which happens on a fresh visit to a table route. That is sufficient
for this phase.

#### 4.3.6 Critical hazard — `prepare-board` wipes state

`src/app/gamePlayer.ts:131`:

```129:138:src/app/gamePlayer.ts
      case "prepare-board": {
        console.log( "New Game!" )
        const ups = {...initialState}
        ups.playerPeg = {...ups.playerPeg}
        ups.opponentPeg = {...ups.opponentPeg}
        ups.playerPeg.points = [0,-1,-1]
        ups.opponentPeg.points = [0,-1,-1]
        this.stateUpdate = ups
        break
      }
```

This replaces the whole UI state with `initialState` on every new game. As written it would **reset
the chosen difficulty back to the default and re-open the modal after every "Play Again"**, and
would clear `finalBreakdown` before the game-over modal could be dismissed.

**Required:** `prepare-board` must explicitly carry forward `difficulty` and `difficultyChosen`
from the incoming `state`. `finalBreakdown` *should* be cleared here (a new game has no result yet),
but only after confirming the game-over modal's dismissal path does not depend on it — see §4.4.5.

---

### 4.4 F3 — Post-game score breakdown

#### 4.4.1 Requirement

At the end of a game, show each player's points won from:

- **Hand** — points counted in the show for their four-card hand
- **Crib** — points counted in the show for the crib (dealer only, per round)
- **Pegging** — 15s, 31s, runs, pairs, and last card during the play
- **Bonuses** — his nibs/heels (the 2 points for cutting a jack) and nobs (the 1 point for holding
  the jack of the starter's suit), from both the hand and the crib

These four buckets must **sum exactly** to that player's final score.

#### 4.4.2 The ledger

Add to `CribbageGame`, next to the existing `scores` object:

```ts
public breakdown : { player: PlayerBreakdown, opponent: PlayerBreakdown } = emptyBreakdown()
public rounds : number = 0
```

Attribution happens at the single convergence point, `src/app/game.ts:791`, in the same guarded
block that already increments `scores`. Category is derived from the fields the score action
already carries:

| `action.source` | `action.reason` | Bucket |
| --- | --- | --- |
| `"play"` | `15`, `31`, `run`, `pair`, `the-last-card` | `pegging` |
| `"start"` | `his-nibs` | `bonuses` |
| `"show-hand"` | `show-dealer`, `show-non-dealer` | `hand` (less nobs — see §4.4.4) |
| `"show-crib"` | `show-crib` | `crib` (less nobs — see §4.4.4) |

`rounds` increments on the `round-end` action in the `showing` stage.

Because `scoreAction` already returns a `GameAction("noop")` once `gameOver` is true, and the
increment block is guarded by `if( !this.gameOver …)`, the ledger and `scores` are updated under
identical conditions and cannot diverge.

#### 4.4.3 Reset

`resetGame()` currently clears `scores.player` / `scores.opponent` only inside the
`if( this.gameOver )` branch. The breakdown and `rounds` must be cleared in **that same branch** —
they are per-game, not per-round.

#### 4.4.4 Nobs — the one narrow scoring change

Nobs is currently computed *inside* `scoreHand` and folded into the returned total
(`src/app/game.ts:45-47`, summed at `:104`). It cannot be attributed to `bonuses` without exposing
it. Full decomposition of `scoreHand` is out of scope, so the minimum viable change is:

1. Export a small helper:

   ```ts
   export function countNobs( hand : Array<Card>, cutCard : Card | undefined ) : number
   ```

   Returns `1` when the hand holds a jack of the cut card's suit, otherwise `0`.

2. **Refactor `scoreHand` to call `countNobs`** in place of its inline `nobScore` loop. There must
   be exactly one implementation of the nobs rule — two would drift.

3. Add an optional `public bonus : number = 0` field to `GameAction`. In the `show-non-dealer`,
   `show-dealer`, and `show-crib` cases of `doAction`, set `bonus` on the returned score action to
   `countNobs(theHand, this.starter)`.

4. In the attribution block:

   ```ts
   const bucket = categoryFor( action )          // "hand" | "crib" | "pegging" | "bonuses"
   this.breakdown[p][bucket] += action.score - action.bonus
   this.breakdown[p].bonuses += action.bonus
   ```

   For `his-nibs`, `bucket` is already `bonuses` and `bonus` is `0`, so the 2 points land in
   `bonuses` via the first line. The arithmetic is uniform; no special cases.

Crib nobs are attributed to the **dealer's** `bonuses` (the crib score action already carries
`subaction = this.dealer`), and correspondingly excluded from `crib`.

#### 4.4.5 Reaching the UI

1. `GamePlayer.handleAction`, `case "game-win"`: in addition to the existing toast, set
   `this.stateUpdate['finalBreakdown'] = this.game.getBreakdownSnapshot()`.
   `getBreakdownSnapshot(): GameBreakdown` must return a **deep plain-object copy** (the live
   ledger must not be handed to Redux by reference) including `winner`, `rounds`, the current
   difficulty, and computed `total` fields.
2. `Cribbage.tsx` renders `<GameOverModal>` when `uiState.finalBreakdown !== null`.

**Two engine defects block this and must be fixed:**

- **`game-win` is silently dropped.** `nextStage("ending")` emits `GameAction("game-win", winner)`,
  but the `ending` stage switch (`src/app/game.ts:774`) only handles `end-game` and `new-game`.
  `game-win` falls through unregistered and logs `"Unregistered Action"`. Add
  `case "game-win": this.registerAction( action ); return []`. (The snapshot is taken in
  `handleAction`, which runs before `doAction`, so the modal works either way — but leaving a
  dropped action on a path we now depend on is not acceptable.)
- **Quit skips the ending stage entirely.** `src/app/game.ts:767`:

  ```767:771:src/app/game.ts
          case "quit":
            this.registerAction( action )
            this.winner = "opponent"
            this.gameOver = true
            return [...this.nextStage( "ending" ), new GameAction("new-game")]
  ```

  The trailing `new GameAction("new-game")` immediately advances past `ending` back to `starting`,
  so a quit would flash the game-over modal and dismiss itself. **Remove the trailing `new-game`.**
  The modal's "Play Again" button dispatches `{action: "new-game"}`, and `Cribbage.tsx`'s existing
  `start()` already routes `game.gameOver` to `new-game`, so no functionality is lost.

#### 4.4.6 `<GameOverModal>`

`src/components/GameOverModal.tsx` (**new**), `react-bootstrap` `<Modal>` with `size="lg"`.

- Header: "You win!" / "Your opponent wins!" derived from `finalBreakdown.winner`.
- Body: a two-column comparison — one column per player, four labelled rows (Hand, Crib, Pegging,
  Bonuses), plus a **Total** row rendered with visual emphasis. Also show rounds played and the
  difficulty the game was played at.
- Below the table, a `<ScoreExplanation>` placeholder slot (P2) reading "Hand-by-hand breakdown
  coming soon."
- Footer: **Play Again** (dispatches `{action: "new-game", cards: []}` and
  `clearFinalBreakdown()`), and **Back to Menu** (`resetForNewSession()`,
  `resetDifficultyChoice()`, `clearFinalBreakdown()`, then `navigate("/")`).
- `backdrop="static"` so the result is not dismissed by a stray click.

**Display note on totals above 121.** The win condition is `scores[x] > 120`, and `scores` is never
capped — a player on 118 who counts 12 finishes on 130. The pegboard already caps the peg at 121
(`CribbageBoard.tsx`). The modal must display the **raw ledger total**, and the sum invariant is
asserted against that raw total, not against 121. Do not "fix" this by capping `scores`; that would
break the invariant and change scoring behaviour.

---

### 4.5 F5 — Learn screen

`src/screens/Learn.tsx` (**new**). Real, readable content — this is the one placeholder-adjacent
screen with genuine substance, because the request specifies "text describing the game of cribbage
and its basic rules".

Layout: `react-bootstrap` `<Container>` / `<Row>` / `<Col>` with an `<Accordion>` or a stack of
`<Card>`s. Required sections:

1. **The object of the game** — 121 points, two players, first to peg out wins.
2. **The deal and the cut for dealer** — low card deals; six cards each.
3. **The crib** — each player discards two; the crib belongs to the dealer.
4. **The starter card** — cut after the discard; his heels (2 to the dealer for a jack).
5. **The play (pegging)** — alternating cards, count to 31, go, 15s, pairs, runs, last card.
6. **The show** — non-dealer counts first, then dealer, then the crib.
7. **Scoring reference table** — 15s (2), pairs (2) / three of a kind (6) / four of a kind (12),
   runs (1 per card), flush (4 in hand, 5 with the starter; **five-card only in the crib**),
   nobs (1). This table must match what `scoreHand` actually implements.
8. **Winning, and what a skunk is.**
9. **How the opponent plays** — render `DIFFICULTY_LABELS` / `DIFFICULTY_DESCRIPTIONS` directly
   from `src/app/difficulty.ts` so the published strategy can never drift from the code, plus the
   fair-shuffle statement.

Below the rules, a **"Guided lessons" section (P1 placeholder)**: a grid of disabled tiles —
*Your first hand*, *Counting practice*, *Discard strategy*, *Pegging strategy* — each marked
"Coming soon" and rendered with `disabled` on the control so they are correctly announced to
assistive technology.

A "Back" control returns to `/`.

---

### 4.6 F4 — Persistence layer

`src/app/persistence.ts` (**new file**). This is the **only** module in the codebase permitted to
touch `localStorage`. Everything else goes through its exported functions.

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
export function recordCompletedGame(result: GameBreakdown): void
export function clearAll(): void          // used by /stats and by tests
```

Requirements:

- Every read and write wrapped in `try/catch`. Private browsing, disabled storage, quota errors,
  and malformed JSON must all degrade to in-memory defaults without throwing. **A storage failure
  must never break a game in progress.**
- Versioned key (`cribbagex.v1`). On a version or shape mismatch, discard and start from defaults —
  do not attempt migration for a v1 schema.
- Validate on read: an unrecognised `difficulty` string falls back to `"intermediate"`; non-finite
  numbers fall back to `0`.
- Pure data in, pure data out. No `Card`, no `Hand`, no `CribbageGame`.

**Where recording happens.** `recordCompletedGame` must be called from a `useEffect` in
`Cribbage.tsx` keyed on the identity of `uiState.finalBreakdown`, guarded by a `useRef` so a single
result is recorded exactly once. It must **not** be called from inside a reducer or from
`GamePlayer.handleAction`: `userPlay` is already impure, but adding a storage write to the reducer
path invites double-writes and makes the reducer untestable. Keep side effects in the component
layer.

**Session stats** (this browser session, reset on reload) live in the same module as module-level
state, exposed through the same accessor shape, so `/stats` reads one API for both.

---

### 4.7 Placeholder components (P2–P5)

These exist to fix the *seams*, not to ship behaviour. Each must render visibly "coming soon" so
nobody mistakes it for a broken feature.

#### P2 — `src/components/ScoreExplanation.tsx`

Define the prop contract now, because it is the target of the later `scoreHand` decomposition:

```ts
type ScoreExplanationProps = {
  hand: Array<PCard>       // serializable — never Card instances
  starter: PCard | null
  isCrib: boolean
  total: number
}
```

Phase-1 body: renders the total and the text "Point-by-point breakdown coming soon." Rendered in
two places: the `GameOverModal` body, and a slot in the show phase of `Cribbage.tsx`.

Note for the architect: the eventual implementation is a refactor of `scoreHand` to return
`{ total, fifteens, pairs, runs, flush, nobs }`. Anyone doing that work should preserve
`scoreHand`'s current `number` return as a wrapper, exactly as §4.3.2 does for `getBestHand`.

#### P3 — `src/app/useCardMetrics.ts`

`Cribbage.tsx` hard-codes `cardSize = 150`, `cardSpacing = 100`, `showSpacing = 120`,
`handLeft = 170`. Extract these into a hook:

```ts
export function useCardMetrics(): { cardSize: number, cardSpacing: number, showSpacing: number, handLeft: number }
```

**Phase 1 returns exactly today's constants.** Zero visual change is a hard acceptance criterion —
this is pure seam-cutting so the later responsive/large-card work has one file to edit rather than
a scatter of literals across the JSX.

#### P4 — `src/screens/Stats.tsx`

Reads `loadStats()` and the session counters. Renders games played, wins/losses, and lifetime
category totals (all of which F3 + F4 genuinely produce). Sections that need data this phase does
not collect — averages per hand, skunk counts, per-difficulty splits — are rendered as explicit
"coming soon" rows rather than zeros, so the screen is not misread as reporting real zeros. Include
a "Clear statistics" control wired to `clearAll()`.

#### P5 — `src/screens/FriendPlay.tsx`

A disabled room-code input, a disabled "Create room" button, and copy explaining that friend play is
planned. **No network code, no WebSocket, no backend, no new dependency.** `AGENTS.md` is explicit
that there is no backend and none may be added.

---

## 5. File-by-file impact

### 5.1 New files

| File | Purpose |
| --- | --- |
| `src/app/difficulty.ts` | `Difficulty` type, weights table, labels/descriptions, `pickWeightedIndex` |
| `src/app/persistence.ts` | The only `localStorage` boundary; preferences + stats |
| `src/app/useCardMetrics.ts` | P3 sizing seam |
| `src/screens/Splash.tsx` | F1 splash |
| `src/screens/Learn.tsx` | F5 rules content + P1 lesson placeholders |
| `src/screens/Stats.tsx` | P4 placeholder |
| `src/screens/FriendPlay.tsx` | P5 placeholder |
| `src/components/DifficultyModal.tsx` | F2 pre-game modal |
| `src/components/GameOverModal.tsx` | F3 result modal |
| `src/components/ScoreExplanation.tsx` | P2 placeholder with final prop contract |
| `src/app/game.test.ts` | Engine tests (T1–T6) |
| `src/app/difficulty.test.ts` | Weighted-selection tests (T3) |
| `src/screens/Splash.test.tsx` | Route/shell tests (T7) |

### 5.2 Modified files

| File | Change |
| --- | --- |
| `src/App.tsx` | Remove global `<h1>`; extract `AppRoutes`; add `/learn`, `/stats`, `/friend`, `/play`, catch-all; add `GameLayout` wrapper for table routes |
| `src/App.test.tsx` | Update the heading assertion for the new splash-at-`/` reality |
| `src/App.css` | New sections: splash layout + keyframes, modal tweaks, learn/stats screen styles, reduced-motion overrides |
| `src/app/game.ts` | `rankDiscards` / `rankPlays` refactor; `countNobs`; `GameAction.bonus`; `PlayerBreakdown` / `GameBreakdown` / `ScoreCategory` types; breakdown ledger + attribution; `rounds`; `getBreakdownSnapshot()`; register `game-win` in `ending`; drop trailing `new-game` from `quit`; remove the dead `scores.playing` / `scores.starting` keys (`:388-389`, never written, never read) |
| `src/app/gamePlayer.ts` | Difficulty-aware `selectOpponentCards` / `playOpponentCard`; `resetForNewSession()`; `prepare-board` preserves difficulty; `game-win` publishes `finalBreakdown` |
| `src/features/game/gameSlice.ts` | Three state fields; three new reducers; `initialState` seeded from preferences |
| `src/Cribbage.tsx` | Render `DifficultyModal` and `GameOverModal`; suppress action buttons while gated; `useCardMetrics()`; `recordCompletedGame` effect; `resetForNewSession()` on fresh mount |
| `AGENTS.md` | Update: `userPlay` is no longer the only reducer; persistence now exists; new route table; `src/screens/` convention |

### 5.3 Explicitly unchanged

`src/app/entities.ts` (including `StdDeck.shuffle`), `src/components/CribbageBoard.tsx`,
`src/app/store.ts`, `src/app/hooks.ts`, `src/index.tsx`, `vite.config.ts`, `Dockerfile`,
`nginx.conf`, `package.json`. **No new runtime dependencies.** Everything specified here is
buildable from React 18, React Router 6, React Bootstrap 2, and Redux Toolkit, all already present.

---

## 6. Consolidated hazard list

The architect should carry these into the plan as explicit work items; each has bitten a naive
implementation of this feature set.

| # | Hazard | Mitigation |
| --- | --- | --- |
| H1 | `prepare-board` spreads `initialState` and wipes the chosen difficulty (`gamePlayer.ts:131`) | Explicitly carry `difficulty` / `difficultyChosen` forward (§4.3.6) |
| H2 | `quit` queues `new-game` immediately and skips the `ending` stage (`game.ts:767`) | Remove the trailing `new-game` (§4.4.5) |
| H3 | `game-win` is unhandled in the `ending` stage and logged as unregistered | Register it (§4.4.5) |
| H4 | Nobs is buried inside `scoreHand` and cannot be attributed to bonuses | `countNobs` + `GameAction.bonus` (§4.4.4) |
| H5 | Rank-then-sort can change Expert's tie-breaking vs. v0.2 | Preserve generation order + stable sort; test T1/T2 (§4.3.2) |
| H6 | Fewer than four legal pegging candidates biases a naive weighted pick | Truncate and renormalise in `pickWeightedIndex` (§4.3.3) |
| H7 | `thePlayer` is a module singleton; navigation can resume a stale game | `resetForNewSession()` (§3.3) |
| H8 | `App.test.tsx`'s `getByText(/cribbage/i)` will match multiple nodes | Update the test alongside `App.tsx` (§3.2) |
| H9 | Final scores can exceed 121; pegs are capped at 121 | Display and assert against the raw ledger total (§4.4.5) |
| H10 | Splash art is an external dependency that has not been delivered | Mandatory graceful fallback; nobody is blocked (§4.2.2) |
| H11 | `localStorage` throws in private mode / when disabled | Total `try/catch` isolation in one module (§4.6) |
| H12 | Storage writes inside a reducer double-fire and are untestable | Record from a `useEffect` with a `useRef` guard (§4.6) |
| H13 | Difficulty duplicated in Redux *and* on `GamePlayer` would drift | Redux is the single source; pass `state.difficulty` as a parameter (§4.1.3) |

---

## 7. Styling and accessibility

- **Stay on the existing stack.** `react-bootstrap` components (`Button`, `Modal`, `Container`,
  `Row`, `Col`, `Card`, `Accordion`, `Form`) plus Bootstrap 5 utility classes. No CSS-in-JS, no
  Tailwind, no new UI library.
- **Styles live in `src/App.css`**, in clearly commented sections. The repo uses one global
  stylesheet with plain class names and no CSS modules; keep it that way this phase.
- The game table's absolute-positioned layout in `App.css` is fragile. **Do not touch the existing
  `.play`, `.playerHand`, `.deck`, `.board`, `.opponentHand`, `.cribHand` rules.** New screens get
  new class names in their own section.
- **Accessibility floor for new UI:** every button has an accessible name; the difficulty radio
  group has a group label and is keyboard-operable; both modals trap focus (React Bootstrap does
  this) and have `aria-labelledby` on their titles; the splash meets WCAG AA contrast over the hero
  image via the scrim; all new animation is disabled under
  `@media (prefers-reduced-motion: reduce)`.
- Placeholder controls use the real `disabled` attribute, not a CSS-only "looks disabled" state.

---

## 8. Testing requirements

`AGENTS.md` records that unit coverage is "almost none — add here first". This phase must not
continue that. Tests use Vitest + jsdom (already configured); `npx vitest run` must pass.

| # | Test | Assertion |
| --- | --- | --- |
| T1 | `rankDiscards` equivalence | Over ≥ 200 randomly generated 6-card hands, `rankDiscards(...)[0].keep` equals the pre-refactor `getBestHand` result (same cards, same order), and the result always has 15 entries sorted descending |
| T2 | `rankPlays` equivalence | Over randomly generated play states, `rankPlays(...)[0]?.card ?? null` equals `playBestCard1`; no returned card can push the count over 31; an all-illegal state returns `[]` |
| T3a | `pickWeightedIndex` distribution | With an injected deterministic `rng`, returns the expected index for known inputs; `expert` weights always return `0`; `candidateCount` of 2 renormalises (never returns 2 or 3) |
| T3b | Fair-shuffle guard | `src/app/difficulty.ts` has no import from `entities.ts`, and `StdDeck.shuffle`'s signature takes no arguments |
| T4 | **Breakdown invariant** | Drive a full game through `CribbageGame.doAction` to a win; for each player, `hand + crib + pegging + bonuses === scores[player]`, and `total` matches. This is the load-bearing test for F3 |
| T5 | Nobs attribution | A hand holding the jack of the starter's suit contributes exactly 1 to `bonuses` and that 1 is excluded from `hand`; `scoreHand`'s total is unchanged from v0.2 for the same inputs |
| T6 | Difficulty survives a new game | Set difficulty, drive the game to a win, dispatch `new-game`, assert `state.difficulty` and `difficultyChosen` are preserved (covers H1) |
| T7 | Shell routing | With `MemoryRouter`, `/` renders Play and Learn; clicking Learn reaches the rules content; `/stats` and `/friend` render without error; the updated `App.test.tsx` passes |
| T8 | Difficulty gate | The table route renders the modal and does not render `Start The Round!` until a difficulty is confirmed |
| T9 | Persistence resilience | With `localStorage.setItem` stubbed to throw, and with a malformed stored payload, `loadPreferences` / `recordCompletedGame` return defaults and do not throw |

Engine tests that drive `thePlayer` must call `resetForNewSession()` in `beforeEach`; `AGENTS.md`
already flags the shared-singleton trap.

`npm run lint` and `npm run build` (which runs `tsc --noEmit`) must both pass.

---

## 9. Acceptance criteria

1. `/` shows the splash with working, animated **Play** and **Learn** buttons; animation is
   suppressed under reduced-motion; the screen renders correctly with the hero image file absent.
2. **Play** reaches the table and a blocking modal requires an Easy / Intermediate / Expert choice
   before any game action is possible. The previously chosen level is pre-selected on a return
   visit.
3. **Expert play is bit-identical to v0.2** — same discard, same pegging card, same tie-breaking
   (T1, T2).
4. Easy and Intermediate demonstrably choose sub-optimal discards and pegging cards at
   approximately the specified rates, and **do not alter the deck or the shuffle in any way** (T3b).
5. Completing a game shows a modal with each player's points from hand, crib, pegging, and bonuses;
   the four buckets sum exactly to that player's final score (T4). Quitting shows the same modal
   rather than skipping it.
6. **Play Again** starts a new game at the same difficulty without re-prompting (T6). **Back to
   Menu** returns to the splash with no stale game state.
7. **Learn** shows readable cribbage rules whose scoring table matches `scoreHand`'s actual
   behaviour, plus visibly disabled lesson placeholders.
8. `/stats` and `/friend` are reachable and clearly marked as incomplete; lifetime stats survive a
   page reload; the app works normally with `localStorage` unavailable.
9. **The game table is visually unchanged** apart from the two new modals. The `useCardMetrics`
   extraction is a pure refactor.
10. `npm run lint`, `npx vitest run`, and `npm run build` all pass. `npm run preview` and the Docker
    image serve every new route (nginx `try_files` already handles this).
11. The browser flow is exercised end to end — splash → difficulty → cut → discard → peg → show →
    game over → play again — not merely screenshotted.

---

## 10. Explicitly out of scope

Listed so the architect can reject scope creep by reference:

- Decomposing `scoreHand` into a structured 15s/pairs/runs/flush/nobs breakdown (P2 defines the
  contract only; the nobs extraction in §4.4.4 is the sole exception).
- Any actual tutorial lesson content, interactivity, or guided play (P1 is tiles only).
- Responsive/mobile layout work (P3 is the seam only).
- Any networking, signalling, room-code exchange, backend, or account system (P5 is UI only).
- Muggins, manual counting, discard analyser, pegging hints, post-game coaching, sound, themes,
  rule variants, 61-point games, 3/4-player cribbage. These appear in
  `cribbage-games-competitors.md`, which `AGENTS.md` states is **not** a build spec.
- Skunk and double-skunk detection on the game-over screen. It is trivially derivable from the final
  scores and is a natural first follow-up, but it was not requested and is not in this phase.
- Rewriting the `CribbageGame` state machine, the queue pump, or the `Card`/`Hand` classes.
- Migrating `src/Cribbage.tsx` into `src/screens/`.

---

## 11. Open items and dependencies

| Item | Owner | Blocking? |
| --- | --- | --- |
| **Splash hero image** delivered to `public/img/splash/splash-hero.png` | Requester | **No** — the mandatory fallback (§4.2.2) means implementation proceeds without it. Blocking only for the final visual sign-off of acceptance criterion 1. |
| Product copy for the splash tagline and the `/friend` "coming soon" text | Requester / product | No — engineers may use the placeholder copy in this document |
| Confirmation that the Easy/Intermediate weights in §4.3.3 feel right in play | Requester, after first playable | No — the weights are a one-line edit in `DIFFICULTY_WEIGHTS` and were designed to be tuned post-hoc |
| `AGENTS.md` update (persistence now exists; `userPlay` is no longer the only reducer; new routes and `src/screens/`) | Implementing engineer | No — deliverable of this phase, per §5.2 |

---

## 12. Suggested delivery sequence

Each step lands independently, keeps the app green, and is separately reviewable — matching the
"small, achievable goals, one at a time" instruction in `AGENTS.md`.

1. **Engine ranking refactor** — `rankDiscards` / `rankPlays` with `getBestHand` / `playBestCard1`
   as wrappers, plus equivalence tests T1/T2. No behaviour change ships.
2. **Difficulty module + AI wiring** — `difficulty.ts`, `gamePlayer.ts` call sites, tests T3.
   Difficulty is hard-coded to Expert at this point; still no visible change.
3. **Breakdown ledger** — `countNobs`, `GameAction.bonus`, the attribution block, the `quit` and
   `game-win` fixes, test T4/T5. Ledger is computed but not yet shown.
4. **Slice contract** — new state fields and reducers, `prepare-board` preservation (H1), test T6.
5. **Shell and routing** — `App.tsx` restructure, `Splash`, `Learn`, placeholder screens, CSS and
   animations, tests T7 and the `App.test.tsx` fix.
6. **Modals** — `DifficultyModal` and `GameOverModal` wired into `Cribbage.tsx`, test T8.
7. **Persistence** — `persistence.ts`, the recording effect, `/stats` wiring, test T9.
8. **Seam extraction and cleanup** — `useCardMetrics`, `ScoreExplanation` slot, `AGENTS.md` update,
   full browser pass against §9.
