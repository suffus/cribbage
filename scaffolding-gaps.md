# CribbageX v0.3.0 — Scaffold Gap Report

**Audited artefacts**

| Document | Role in this audit |
| --- | --- |
| `detailed-spec-for-scaffold.md` | Requirement source (F1–F5, P1–P5, H1–H13, T1–T9) |
| `scaffolding-plan.md` | The plan being checked, Phases 1–8 / Tasks 1.1–8.4 |
| `scaffolding-implementation.md` | The implementation report whose claims are being checked |
| The working tree at `/home/steve/Cursor/cribbage` | **Ultimate source of truth** |

**Method.** Every claim below was checked against code, against `git diff HEAD`, or by executing
something. Where a claim could not be settled by reading, I wrote a throwaway test, ran it, and
recorded the output (all scratch files were deleted afterwards; `git status` is unchanged from the
state I found it in). Verification commands were re-run from scratch rather than trusted:

```
npm run lint     # exit 0, no output
npx vitest run   # 7 files, 26 tests passed (5.06s)
npm run build    # tsc --noEmit + vite build, exit 0, dist/ 289.70 kB js / 253.42 kB css
```

Those three numbers match `scaffolding-implementation.md` §2 exactly, including the test count.

**Headline.** The scaffold is substantially and faithfully implemented: 8 phases, 40 of the plan's
41 discrete tasks land as specified, and the highest-risk requirement in the whole plan (Expert
play being bit-identical to v0.2 after the ranking refactor) is genuinely satisfied — I proved it
independently rather than taking the report's word for it. There is **one functional defect**: the
Q1-B "rounds" rule is wired but self-disables after the first deal, so every finished game reports
one round fewer than it played. Beyond that the findings are test-quality and polish issues, plus
three stale or overstated claims in the implementation report.

---

## 1. Verdict summary

| Area | Implemented | Correct | Cited accurately in the report |
| --- | --- | --- | --- |
| Phase 1 — ranking refactor | Yes | Yes (proved vs. v0.2 engine) | Yes, but the committed T1 no longer proves what the report says it proves |
| Phase 2 — difficulty module + AI wiring | Yes | Yes | Yes |
| Phase 3 — ledger, nobs, crib flush, `game-win`/`quit` | Yes | Yes, **except `rounds`** | **No** — "Q1 rounds: Done as B" is not what the code does |
| Phase 4 — slice contract + singleton hygiene | Yes | Yes | Yes |
| Phase 5 — persistence | Yes | Yes | Yes |
| Phase 6 — shell + screens | Yes | Yes | Mostly; the splash hero row in §6 is now stale |
| Phase 7 — modals + recording | Yes | Yes | Yes |
| Phase 8 — seams, docs, version | Yes | Yes | Yes |
| Out-of-scope discipline | n/a | Nothing out-of-scope was built | Yes |

Counts: **1 functional defect**, **6 minor/robustness gaps**, **4 test-quality gaps**,
**3 report-accuracy corrections**, **0 security findings**, **0 unrequested features**.

---

## 2. Phase-by-phase confirmation

### Phase 1 — Engine ranking refactor

**Task 1.1 `rankDiscards` / `rankPlays` — done, correctly.** Both exist with the exact spec
signatures and the required stable-sort comment:

```150:179:src/app/game.ts
export function rankDiscards(
  hand: Array<Card>, otherCardsSeen: Array<Card>, isPlayerCrib: boolean
): Array<DiscardOption> {
// ...
    options.push( { keep: eH, discard: cH, score: tScore } )
    console.log("Expected Score for ", eH.join(), " is ", tScore, eScore, cScore )
  }
  // Array.prototype.sort is specified stable; that stability keeps Expert identical to v0.2 on ties.
  options.sort( (a, b) => b.score - a.score )
  return options
}
```

Generation order is preserved (`for (const sel of selections)` untouched), the `nS > 31` skip
survives in `rankPlays` (`src/app/game.ts:229-231`), the `"Expected Score for"` and
`"BEST SCORE:"` logs were kept as instructed, and `calcExpectedHandScore` /
`calcExpectedCribScore` / `p1Costs` are byte-identical in `git diff`.

**Task 1.3 wrappers — done.** `getBestHand` is `rankDiscards(...)[0].keep` (`src/app/game.ts:181-183`)
and `playBestCard1` is `rankPlays(...)[0]?.card ?? null` (`src/app/game.ts:251-253`). Every call
site the plan said must stay Expert still calls a wrapper: `autoSelect` in `src/Cribbage.tsx:115`,
`autoSelectPlayerCards` in `src/app/gamePlayer.ts:223`, `autoplayPlayerCard` in
`src/app/gamePlayer.ts:191`. E14 holds.

**Expert equivalence — independently proved.** This is the plan's top risk ("Expert play silently
diverges from v0.2 … Impact: High — product-trust") and the committed T1 cannot prove it (see
§4.1). So I extracted `src/app/game.ts` and `src/app/entities.ts` from `HEAD`, applied *only* the
Task 3.1b crib-flush correction to the old copy (so the intended EV change is factored out), and
diffed the two engines over deterministic pseudo-random deals:

```
discard diffs over 400 hands (200 player-crib, 200 opponent-crib): 0
play diffs over 3000 pegging states:                               0
non-crib scoreHand diffs over 20000 hand+starter combinations:     0
```

The refactor is behaviour-preserving and the tie-break survived. Acceptance criterion §9.3 of the
spec is met in fact, not just in claim.

### Phase 2 — Difficulty module and AI wiring

**Task 2.1 — done, exact.** `src/app/difficulty.ts` reproduces spec §4.3.3 verbatim: the type,
`DIFFICULTY_ORDER`, the weight table (`easy [0.40, 0.25, 0.20, 0.15]`,
`intermediate [0.70, 0.20, 0.07, 0.03]`, `expert [1.00]`), labels, and descriptions. I compared
them character-by-character against spec lines 376–399. `pickWeightedIndex` truncates,
renormalises, returns `-1` for an empty candidate set, and takes an injectable `rng` that no
production call site passes (H6, E2 semantics correct). The file imports nothing at all, so the
fair-shuffle guard is satisfied by construction.

**Task 2.3 — done.** `selectOpponentCards(difficulty, delay)` and
`playOpponentCard(difficulty, delay)` use the ranked lists plus `pickWeightedIndex`
(`src/app/gamePlayer.ts:177-212`), the set-all-then-unselect-keepers idiom is preserved, and
`GamePlayer` has no `difficulty` field anywhere (`grep` confirms only parameters and
`state.difficulty`) — H13 satisfied. Expert is index `0`, which is why the equivalence result
above also covers the live opponent.

One robustness gap: `playOpponentCard` guards `idx < 0` before indexing
(`src/app/gamePlayer.ts:180-182`) but `selectOpponentCards` does not:

```203:204:src/app/gamePlayer.ts
    const idx = pickWeightedIndex( DIFFICULTY_WEIGHTS[difficulty], options.length )
    const keepers = options[idx].keep
```

Unreachable today (`rankDiscards` always returns 15 entries), but the plan's E2 says "callers must
not index with it", and the asymmetry between the two methods is the kind of thing that becomes a
crash the first time discard candidate generation is made conditional. One line to fix.

### Phase 3 — Breakdown ledger and engine defects

**Task 3.1a `countNobs` — done.** `src/app/game.ts:35-45`, and `scoreHand` now calls it
(`src/app/game.ts:58`). There is exactly one implementation of the nobs rule; `grep` finds no other
`rank === 11 && ... suit` test.

**Task 3.1b crib flush — done and correct.** `src/app/game.ts:62-71` implements the required table.
Measured directly (4♥-style fixture A♥ 4♥ 10♥ K♥):

- crib + 7♦ starter → flush contributes `0` (total 4, all of it from 15s/other categories)
- crib + 7♥ starter → flush contributes `5` (total 9)
- non-crib + 7♦ → `4`; non-crib + 7♥ → `5`

and the 20 000-hand comparison above shows **no** non-crib regression. E10 closed.

**Task 3.2 ledger — done.** Types, `emptyBreakdown()`, `GameAction.bonus`,
`getBreakdownSnapshot(difficulty)` with spread copies, per-show `bonus` assignment, and the
attribution block inside the existing guard:

```899:907:src/app/game.ts
        this.scores[action.subaction] += action.score
        const p = action.subaction
        const bucket = categoryFor( action )
        if( bucket ) {
          this.breakdown[p][bucket] += action.score - action.bonus
          this.breakdown[p].bonuses += action.bonus
          this.breakdown[p].total = this.breakdown[p].hand + this.breakdown[p].crib
            + this.breakdown[p].pegging + this.breakdown[p].bonuses
        }
```

`categoryFor` (`src/app/game.ts:378-396`) covers all nine `reason` values that `scoreAction` can
emit, so the E11 "skip the ledger line" branch is unreachable in practice and the invariant cannot
be broken by a missed bucket. Dead `scores.playing` / `scores.starting` are gone and nothing
references them (`grep` returns nothing). `resetGame()` clears breakdown and `rounds` inside the
`gameOver` branch only, as specified (`src/app/game.ts:952-954`). I confirmed the invariant holds
over ten independently pumped full games, not just the one the suite runs.

**Task 3.3 `game-win` / `quit` — done.** `game-win` is registered in `ending`
(`src/app/game.ts:881-883`), the `showing`-only `quit` case is deleted, and `quit` is handled once,
stage-independently, next to `abort-game` with the `gameOver` short-circuit:

```929:937:src/app/game.ts
    if( action.action === "quit" ) {
      if( this.gameOver ) {
        return []
      }
      this.registerAction( action )
      this.winner = "opponent"
      this.gameOver = true
      return this.nextStage( "ending" )
    }
```

I verified reachability per stage: every stage `switch` either has no `quit` case or falls through
to `break`, so H2, H2b and H3 are genuinely closed.

**Q1 `rounds` — DEFECT. This is the one functional gap in the change set.** The plan chose option B
("also increment when entering `ending` if this deal has not been counted") and the implementation
report records it as "Done as **B**". The mechanism is present:

```557:562:src/app/game.ts
      case "ending":
        // Q1-B: count this deal if a win skipped round-end (peg-out or mid-show).
        if( !this.roundCounted ) {
          this.rounds += 1
          this.roundCounted = true
        }
```

but `roundCounted` is only ever set back to `false` in `resetGame()`'s `gameOver` branch
(`src/app/game.ts:954`) — never at the start of a new deal. `round-end` sets it to `true`
(`src/app/game.ts:873-874`) and nothing clears it, so from the second deal onward the guard at
line 559 is permanently false and option B degrades to option A.

Evidence — I drove ten full games through `CribbageGame.doAction` and compared deals started
(`shuffle-deck` actions) against the reported `rounds`:

```
game 0: deals=10 round-ends=9 rounds=9 winner=opponent   game 5: deals=8  round-ends=7 rounds=7
game 1: deals=9  round-ends=8 rounds=8 winner=player     game 6: deals=10 round-ends=9 rounds=9
game 2: deals=9  round-ends=8 rounds=8 winner=player     game 7: deals=8  round-ends=7 rounds=7
game 3: deals=10 round-ends=9 rounds=9 winner=opponent   game 8: deals=10 round-ends=9 rounds=9
game 4: deals=10 round-ends=9 rounds=9 winner=player     game 9: deals=9  round-ends=8 rounds=8
```

Ten out of ten games under-report by exactly one: `rounds` always equals the `round-end` count and
never counts the winning deal. A direct probe confirms the mechanism rather than the symptom — one
completed round, then a forced mid-deal peg-out: `rounds` stays at `1` where B requires `2`.

The only case where Q1-B fires is a game that ends during its **first** deal, which is exactly the
case the report's browser pass exercised ("Quit from starting → 1 round"), so the defect was
invisible to the manual test.

**Fix:** clear the flag when a deal starts — one line in the `start-round` case, or
`this.roundCounted = false` immediately after the two lines at `src/app/game.ts:873-874`. No other
code changes.

### Phase 4 — Slice contract and singleton hygiene

All six tasks are done and correct. `difficulty` / `difficultyChosen` / `finalBreakdown` are on
`GamePlayingState` with the specified defaults and `difficulty` seeded from `loadPreferences()`
(`src/features/game/gameSlice.ts:45-62`); the three new reducers exist and are exported next to
`userPlay`; `UserGamePlay` was **not** widened. `prepare-board` carries the two difficulty fields
forward and nulls `finalBreakdown` (`src/app/gamePlayer.ts:131-141`) — H1 closed, and E5 with it.
`resetForNewSession()` is exactly the plan's body including the `gameOver = true` ordering trick
(`src/app/gamePlayer.ts:214-220`). `game-win` publishes the snapshot with `state.difficulty`
(`src/app/gamePlayer.ts:104`). Only plain data crosses into Redux — `GameBreakdown` is flat numbers
plus two string unions, so the "no mutable classes in Redux" constraint holds.

I also checked the import DAG by hand for a cycle hazard the plan warned about: `gameSlice` →
`persistence` → `game` → (type-only) `difficulty`, with `gamePlayer` initialised before
`persistence` in `gameSlice`'s import list. ES module hoisting means `persistence` is fully
evaluated before `loadPreferences()` runs at slice-definition time, so the `initialState` seed is
safe. No cycle was introduced.

### Phase 5 — Persistence

`src/app/persistence.ts` is the only module touching `localStorage` (`grep -rn localStorage src/`
returns this file and its test only). Every access is inside `try/catch`
(`readBlob`/`writeBlob`/`clearAll`), unknown difficulty falls back to `"intermediate"`, non-finite
numbers become `0`, a blob missing `preferences` or `stats` is discarded wholesale with no
migration, `savePreferences` merges, session stats are module state and are deep-copied on read,
and `recordCompletedGame` treats `winner: "opponent"` identically whether it came from a peg-out or
a quit. T9 covers throwing `setItem`, malformed JSON, the `"nightmare"`/`"nope"` sanitisation case,
and the happy path including `clearAll`.

Two notes, neither a plan violation:

- `persistence.ts` takes a **value** import from the engine (`import { emptyBreakdown } from './game'`,
  `src/app/persistence.ts:3`). The plan's DAG only forbids importing `gameSlice` / `gamePlayer`, so
  this is legal, but it means the storage module pulls the whole engine (and `entities.ts`) into its
  dependency graph to obtain eight zeros. A local literal would keep the boundary as thin as the
  spec describes it ("pure data in, pure data out").
- `clearAll()` zeroes stats and removes the key, which also drops the saved difficulty preference.
  That is consistent with "removes `STORAGE_KEY`" as written in the plan, and the test asserts it,
  so it is intended — but the button is labelled "Clear statistics", and it silently clears a
  preference too.

### Phase 6 — Application shell and screens

`AppRoutes` and `GameLayout` are extracted and exported, the unconditional `<h1>CRIBBAGE</h1>` now
only renders on table routes, and the route table matches the plan row for row including
`*` → `<Navigate to="/" replace />` (`src/App.tsx:33-48`). Splash, Learn, Stats and FriendPlay all
exist under `src/screens/` and match their task descriptions:

- **Splash** has the committed title, tagline, fairness line, large `Play`/`Learn` buttons in the
  specified order, secondary Stats/Friend links as real `<button>`s, a hero `<img>` with an
  `onError` fallback to `.splash--fallback`, a scrim, `min-height: 100vh` with its own background
  (so the pre-existing `.App` painting cannot show through — E12), and all animation properties
  confined to `@media (prefers-reduced-motion: no-preference)`.
- **Learn** has all nine required sections; the scoring table states "Crib flush (five cards the
  same suit only) 5", which matches the corrected engine; the difficulty copy is rendered from
  `DIFFICULTY_LABELS` / `DIFFICULTY_DESCRIPTIONS` rather than duplicated; the four lesson tiles use
  the real `disabled` attribute with a visible "Coming soon". I also checked the rules text against
  the engine: "the low card deals" matches `cut-win`'s `dR < 0 ? "player" : "opponent"`
  (`src/app/game.ts:664-666`).
- **Stats** renders real lifetime and session counters plus lifetime category totals per seat, with
  averages / skunks / per-difficulty splits as explicit "Coming soon" rows rather than zeros, and a
  `clearAll()` button.
- **FriendPlay** has a disabled `Form.Control`, a disabled Create room button, the committed copy,
  and no `fetch` / `WebSocket` anywhere (`grep` confirms).

`src/App.css` is a **pure append** — `git diff` shows a single hunk `@@ -226,3 +226,305 @@`, so
none of the fragile table rules (`.play`, `.playerHand`, `.deck`, `.board`, `.opponentHand`,
`.cribHand`) was touched. Every new class used in JSX has a matching rule except
`.learn-difficulty-list`, which is applied in `src/screens/Learn.tsx:103` but never styled — dead
class name, cosmetic only.

### Phase 7 — Modals and recording

`DifficultyModal` is `backdrop="static"`, `keyboard={false}`, no close button, `role="radiogroup"`
with `aria-labelledby` pointing at the modal title, three options built from `DIFFICULTY_ORDER`
with labels and descriptions, pre-selected from `uiState.difficulty`, and confirm dispatches
`setDifficulty` **and** `savePreferences` (`src/components/DifficultyModal.tsx:18-21`). It is
rendered inside the `!needDeck` branch of `Cribbage.tsx`, so the `/select` deck-picker-then-modal
ordering (E7) is structurally guaranteed rather than conditionally coded.

`GameOverModal` matches Task 7.3 point for point: `size="lg"`, static backdrop, `aria-labelledby`,
winner-derived title, two columns of Hand/Crib/Pegging/Bonuses plus an emphasised Total, rounds and
`DIFFICULTY_LABELS[difficulty]`, a `ScoreExplanation` slot with the dummy props Q5 recommended, and
the two footer actions with exactly the prescribed dispatch sequences.

Gating and recording are both right:

```31:44:src/Cribbage.tsx
  const gated = !uiState.difficultyChosen || uiState.finalBreakdown !== null

  useEffect(() => {
    if (!uiState.difficultyChosen) {
      thePlayer.resetForNewSession()
    }
  }, [uiState.difficultyChosen])

  useEffect(() => {
    const result = uiState.finalBreakdown
    if (!result || recordedRef.current === result) return
    recordedRef.current = result
    recordCompletedGame(result)
  }, [uiState.finalBreakdown])
```

`gated` suppresses both `.commitCrib` button groups (`src/Cribbage.tsx:175-176`), covering E15 as
well as the modal-open case. The recording effect is in the component layer with a `useRef`
identity guard, so H12 holds; `React.StrictMode` is active in `src/index.tsx:16`, and the ref
survives the double-invoked effect, so E8 holds too.

One residual on H7 worth knowing about, though the implementation follows the plan exactly: the
reset only fires when `difficultyChosen` is false, and `difficultyChosen` is only cleared by
`resetDifficultyChoice()` (Back to Menu). Because the Redux store outlives client-side navigation,
leaving a game in progress via the browser's Back button or an in-app link and then returning to
`/play` re-enters the *same* mid-game state with no modal. That is arguably desirable resume
behaviour, but spec §4.3.5 says the modal "reappears … on a fresh visit to a table route", which is
not what happens for in-tab navigation. The plan encoded the weaker behaviour, so this is a
plan-level gap rather than an implementation deviation.

### Phase 8 — Seams, docs, version

`useCardMetrics()` returns exactly the four original constants and replaces the four locals
(`git diff src/Cribbage.tsx` shows the literals deleted), so P3 is a pure seam.
The show-phase `ScoreExplanation` slot passes `PCard`s via `toObject()`, the real starter, and
`game.scores["player-hand"]`, positioned absolutely in a new class so the hands cannot shift.
`AGENTS.md` was updated, not rewritten, and every bullet Task 8.3 listed is present and true.
`package.json` is `0.3.0` with dependencies untouched.

### Out of scope — clean

Nothing on the plan's reject list was built. `scoreHand` still returns `number` with no structured
decomposition; lesson tiles are disabled shells; `useCardMetrics` returns constants; there is no
network code, no skunk detection, no new runtime dependency (`package.json` diff is the version
line only), and `README.md` is untouched. `src/Cribbage.tsx` correctly stayed at `src/`.

---

## 3. Delivered but not in the plan

From `git diff HEAD` plus the untracked file list, the change set is: 9 modified files
(`AGENTS.md`, `package.json`, `src/App.css`, `src/App.test.tsx`, `src/App.tsx`, `src/Cribbage.tsx`,
`src/app/game.ts`, `src/app/gamePlayer.ts`, `src/features/game/gameSlice.ts`; 613 insertions /
91 deletions) and 16 new files. That is exactly the plan's §5.1/§5.2 manifest. The only additions
beyond the letter of the plan are:

| Extra | Where | Assessment |
| --- | --- | --- |
| `private roundCounted` field | `src/app/game.ts:475` | Implied by the plan's Q1-B recommendation; the mechanism is legitimate, its lifecycle is the defect in §2 |
| `public/img/splash/splash-hero.png` (1024×576, 890 KB) | untracked asset | **Arrived after the report was written** (file mtime 19:10 vs. report 19:08). The plan's risk table says "Resize to ≤1920 px / ~400 KB if it arrives" — at 890 KB of unoptimised PNG it is over twice that budget, and `public/` is copied verbatim by Vite, so it is an unoptimised first-paint cost on the landing route |
| `src/features/game/gameSlice.test.ts` | new test file | Explicitly permitted by Task 4.5 ("`src/app/game.test.ts` **or** `src/features/game/gameSlice.test.ts`") |
| `AGENTS.md` version bump v0.2 → v0.3 in the Purpose line | `AGENTS.md:6` | Sensible and consistent with Task 8.4; not itemised in Task 8.3 |
| `cribbage-games-competitors.md`, `detailed-spec-for-scaffold.md`, `scaffolding-*.md` | untracked docs | Inputs/outputs of the exercise, not product code |

No unrequested features, no refactors of untouched files, no dependency changes. Scope discipline
is good.

---

## 4. Quality assessment

### 4.1 Completeness — strong, with one live defect and four soft spots in the tests

The only requirement that is wired but does not work is Q1-B `rounds` (§2, Phase 3). Everything
else on the plan's acceptance lists is present. The test gaps matter more than they look, because
the plan called two of them out in advance as named risks:

1. **T1 is now the tautology the plan warned about.** `src/app/game.test.ts:50-62` compares
   `rankDiscards(...)[0].keep` against `getBestHand(...)`, but post-Task-1.3 `getBestHand` *is*
   `rankDiscards(...)[0].keep`. The assertion cannot fail. The plan's risk table scores this "T1
   written after the wrap is a tautology — Likelihood: High if rushed, Impact: High (false
   confidence)", and the implementation report's mitigation is a process claim ("T1 and T2 were run
   against the unwrapped bodies, then the wrappers were converted") that the repository cannot
   corroborate: the entire change set is uncommitted against `dc24268`, so there is no intermediate
   state to inspect. The claim is probably true — my independent comparison found zero divergence —
   but the *committed* test no longer guards the invariant it was written for. A frozen-fixture
   table (a few dozen hands with expected keeps) would make it regression-proof.
2. **T1 also runs ~4.1 s of a 5 s default timeout.** `rankDiscards` costs ~9.3 ms per call
   (measured); T1 does 200 hands × 2 calls = 400 evaluations, half of them redundant because the
   wrapper recomputes the ranking. `vite.config.ts` sets no `testTimeout`, so the suite is one
   slow CI runner away from a red build. Halving the work (compare against a fixture, or reuse the
   ranked list) removes the risk.
3. **The T4 quit case asserts almost nothing.** `src/app/game.test.ts:225-239` pumps a full game
   into a local `game` variable that is then never used (dead work costing ~1 s), and the quit is
   taken from a game truncated after one `need-cut`, so the ledger is all zeros and
   `0 + 0 + 0 + 0 === 0` passes trivially. The plan asked for "a quit **mid-game**" whose buckets
   still sum to `scores`.
4. **Nothing tests `rounds`.** Neither T4 nor T6 asserts the counter, which is precisely why the
   Q1-B defect shipped. One assertion (`rounds === count of shuffle-deck actions`) would have
   caught it.

The rest of the suite is well targeted: T5's frozen fixtures include a real 29-hand, T5b isolates
the flush delta correctly *and* pins the four-card crib flush at 0 via the non-crib comparison, T9
covers all four storage failure modes, and T7/T8 exercise routing and the gate through the real
store and router.

### 4.2 Correctness — good

The ledger invariant is the load-bearing property and it holds: I re-derived it over ten pumped
games in addition to the suite's one. Attribution is uniform (no special case for his-nibs),
`categoryFor` is exhaustive over the reasons `scoreAction` can produce, nobs is computed in exactly
one place and correctly excluded from `hand`/`crib`, raw totals above 121 are preserved (H9), and
the two engine defects on the ending path are genuinely fixed for every stage rather than just the
one the old code happened to handle.

Two small correctness edges, both unreachable from the current UI:

- `GameBreakdown.winner` is `PlayerEvent`, i.e. `"player" | "opponent" | undefined`. An
  `abort-game` or `game-timeout` with no `subaction` would set `winner = undefined`
  (`src/app/game.ts:926`), which `GameOverModal` renders as "Your opponent wins!" while
  `recordCompletedGame` increments `gamesPlayed` without incrementing either win counter — so
  `playerWins + opponentWins !== gamesPlayed`. No UI path emits those actions today.
- `selectOpponentCards`'s missing `idx < 0` guard, described in §2 Phase 2.

### 4.3 Security — no findings

There is no backend, no network call, and no new dependency, so the attack surface is unchanged.
Specifically checked and clean:

- No `dangerouslySetInnerHTML`, no `eval`, no `new Function`, no `innerHTML` in the new code.
- The only untrusted input is the `localStorage` blob, and it is fully validated on read rather
  than trusted: type-checked object shape, whitelisted difficulty (`isDifficulty`), and
  `Number.isFinite` coercion on every numeric field (`src/app/persistence.ts:35-71`). A malicious
  or corrupt blob yields defaults, not an exception and not a rendered payload.
- Nothing sensitive is stored — a difficulty string and score counters under one versioned key.
- Every `JSON.parse` / `getItem` / `setItem` / `removeItem` is inside `try/catch`, so a hostile or
  disabled storage environment degrades rather than breaking a game in progress.
- No user-controlled string reaches a URL, an image `src`, or a route.
- `FriendPlay` contains no network primitives, so P5 introduces no surface.

Two pre-existing items this work neither caused nor worsened, noted for completeness: `.App` still
pulls a background image from a third-party CDN (`src/App.css:4`), which is a privacy/availability
dependency on every route; and `nginx.conf` is a `server` block on port 80 copied to
`conf.d/default.conf`, which contradicts the "port 8080, full main config, unprivileged UID 1172"
description in `AGENTS.md`'s deployment section. The plan explicitly forbade touching either file,
so neither is a gap in this delivery — but `AGENTS.md` was edited in Task 8.3 and that stale
deployment paragraph was left in place.

### 4.4 Efficiency — no regression, one avoidable cost

Measured: `rankDiscards` ≈ 9.3 ms and 15 `console.log` lines per call; `rankPlays` ≈ 0.007 ms. Both
are unchanged from v0.2 in algorithmic terms — the refactor adds 15 small object literals and one
15-element sort to a computation already dominated by 15 × 13 EV evaluations, and the logging was
mandated to stay. Against the 1 200–3 000 ms AI delays, opponent decisions are free.

The avoidable costs are all in test and asset land: the double evaluation in T1 (§4.1), the dead
full-game pump in the T4 quit test, the 890 KB unoptimised hero PNG, and `Stats` calling
`loadStats()` + `loadSessionStats()` on every render (two `JSON.parse`s per render — harmless at
this size, but it is why the re-render hack in §4.5 works at all).

### 4.5 Adherence to coding standards — good

`AGENTS.md`'s "match local style" rule is respected in both directions: `game.ts` and
`gamePlayer.ts` keep the older spaced-paren, `console.log`-heavy class idiom (`countNobs` and
`categoryFor` are written in the surrounding style, not modernised), while the new screens,
modals, hooks and persistence use modern TypeScript and hooks. No file was modernised while being
fixed. Styling stayed in `src/App.css` in commented sections with plain class names, on
react-bootstrap and Bootstrap 5, with no CSS-in-JS and no new UI library. `npm run lint` is clean
with no `_`-prefixed escape hatches and no suppression comments (`grep` finds no
`eslint-disable` in the diff). Typed contracts are respected: `PCard`/`toObject()` at every Redux
boundary, `UserGamePlay` not widened, no `any` introduced, `GameBreakdown` flat and serialisable.

Three deviations from idiomatic style, all minor:

- `src/screens/Stats.tsx:24-27` forces a re-render with a counter it then discards:

  ```24:27:src/screens/Stats.tsx
    const [version, setVersion] = useState(0)
    const lifetime = loadStats()
    const session = loadSessionStats()
    void version
  ```

  `void version` exists only to satisfy the no-unused-vars rule. It works, but holding the loaded
  stats in state and refreshing them in the click handler would express the intent without a
  lint-dodge.
- The comment on `src/app/game.ts:474` ("Q1-B: a mid-round win never hits round-end; count that
  deal when entering ending") documents behaviour the code does not deliver, so it is currently
  misleading rather than helpful.
- `.learn-difficulty-list` is applied but unstyled (dead class name).

### 4.6 General coding quality — good

The change is well factored along the seams the spec asked for: one storage boundary, one weights
table with no per-level branching, one nobs implementation, one difficulty source of truth, ranking
functions with thin wrappers, and a ledger that attributes rather than re-scores. The hazard list
was worked deliberately rather than incidentally — H1, H2, H2b, H3, H4, H5, H6, H8, H9, H10, H11,
H12 and H13 are all closed in code, and I could point at the specific line for each. Naming and
file placement follow the plan's §1.6 table exactly.

The weakest structural point is process rather than code: the entire delivery sits as one
uncommitted working-tree change against `dc24268`, so the plan's central discipline — "keep lint,
tests and build green after every phase", with T1/T2 landing *before* the wrapper conversion —
cannot be evidenced, and the tautology in §4.1 is the direct consequence.

---

## 5. Implementation-report accuracy

Verified accurate: the created/modified/unchanged file tables (checked against `git diff` and the
untracked list), the three command results including the exact test count, the Phase 1–2 and 4–8
task rows, all six declared deviations (the `?raw` T3b read, the transform-only splash button
animation, `GameOverModal` reading Redux instead of taking a prop, the interior-rng T3a samples,
the missing `CodingStandards.md`, and the dummy `ScoreExplanation` props), the edge-case list in §5,
and the out-of-scope list.

Three claims need correcting:

| Report claim | Codebase says |
| --- | --- |
| §3 Phase 3: "Q1 rounds — **Done as B** — Increment on `round-end`; also increment when entering `ending` if this deal was not counted", repeated as deviation 2 | The `ending` increment is dead after the first deal, because `roundCounted` is never cleared per deal. Effective behaviour is option A. Measured: 10/10 games report one round fewer than they dealt (§2, Phase 3) |
| §6 browser pass: "`/` splash … Hero file absent → baize gradient (`splash--fallback`)" | `public/img/splash/splash-hero.png` now exists (1024×576, 890 KB, mtime 19:10 — two minutes *after* the report at 19:08). The fallback path is still correctly implemented, but the row no longer describes the running app, and the delivered asset is over the plan's ~400 KB budget |
| §2: "T1 and T2 were run **against the unwrapped** `getBestHand` / `playBestCard1` bodies, then the wrappers were converted, then T1/T2 were re-run and still passed" | Unverifiable from the repository — there are no commits for this work, so no pre-wrap state exists to inspect, and the committed T1 is a tautology. I substantiated the underlying property independently (0 divergences across 400 discard decisions, 3 000 pegging states and 20 000 scoring hands), so the conclusion stands even though the evidence trail does not |

Also worth flagging as under-claimed rather than over-claimed: §6 says "Reduced-motion: OS-level
reduced-motion was not toggled in the host session" — honest, and the CSS structure does satisfy
the requirement by construction, since every `animation` declaration is inside the
`no-preference` block.

---

## 6. Recommended fixes, in priority order

1. **Clear `roundCounted` when a deal starts** (`src/app/game.ts`, one line in `start-round` or
   after line 874). Without it, "rounds played" in the game-over modal is wrong for every game
   that reaches a second deal.
2. **Add a `rounds` assertion to T4** — `rounds` should equal the number of `shuffle-deck` actions
   — so the fix stays fixed.
3. **Replace T1's tautology with frozen fixtures**, which also cuts the suite's slowest test in
   half and removes the 4.1 s / 5 s timeout risk.
4. **Make the T4 quit case a real mid-game quit** and delete the unused full-game pump.
5. **Guard `selectOpponentCards` with `if (idx < 0)`**, matching `playOpponentCard`.
6. **Optimise or resize `splash-hero.png`** to the plan's ≤ ~400 KB budget, and correct the
   implementation report's browser-pass row.
7. Housekeeping: drop the `void version` hack in `Stats`, fix or remove the now-misleading Q1-B
   comment, remove or style `.learn-difficulty-list`, and consider inlining the zeroed
   `PlayerBreakdown` in `persistence.ts` so the storage module no longer imports the engine.
8. Process: commit the work in the plan's phase order so the "green after every phase" claim and
   the pre-wrap T1 run become part of the record.
