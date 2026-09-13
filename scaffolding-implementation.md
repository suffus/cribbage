# CribbageX v0.3.0 — Scaffold Implementation Report

**Source plan:** `scaffolding-plan.md`  
**Source spec:** `detailed-spec-for-scaffold.md`  
**Date:** 13 September 2026  
**Status:** All eight plan phases implemented. No in-scope items deferred.

`CodingStandards.md` is **not in this repository**. Styling followed spec §7 and the existing conventions: react-bootstrap 2 / Bootstrap 5, one global `src/App.css` with commented sections, green-baize / cream / gold table metaphor, no new CSS framework, and no edits to `.play` / `.playerHand` / `.deck` / `.board` / `.opponentHand` / `.cribHand`.

---

## 1. Summary of files created and modified

### Created

| File | Phase / task |
| --- | --- |
| `src/app/difficulty.ts` | 2.1 |
| `src/app/difficulty.test.ts` | 2.2 (T3a, T3b) |
| `src/app/persistence.ts` | 5.1 |
| `src/app/persistence.test.ts` | 5.2 (T9) |
| `src/app/useCardMetrics.ts` | 8.1 |
| `src/app/game.test.ts` | 1.2, 3.4 (T1, T2, T4, T5, T5b) |
| `src/features/game/gameSlice.test.ts` | 4.5 (T6) |
| `src/screens/Splash.tsx` | 6.2 |
| `src/screens/Splash.test.tsx` | 6.6 (T7) |
| `src/screens/Learn.tsx` | 6.3 |
| `src/screens/Stats.tsx` | 6.4 |
| `src/screens/FriendPlay.tsx` | 6.5 |
| `src/components/DifficultyModal.tsx` | 7.1 |
| `src/components/GameOverModal.tsx` | 7.3 |
| `src/components/ScoreExplanation.tsx` | 7.2 |
| `src/Cribbage.test.tsx` | 7.5 (T8) |
| `scaffolding-implementation.md` | this report |

### Modified

| File | Phase / task |
| --- | --- |
| `src/app/game.ts` | 1.1, 1.3, 3.1–3.3 |
| `src/app/gamePlayer.ts` | 2.3, 4.2–4.4, 4.6 |
| `src/features/game/gameSlice.ts` | 4.1, 5.3 |
| `src/App.tsx` | 6.1 |
| `src/App.test.tsx` | 6.1 / H8 |
| `src/App.css` | 6.2–6.3, 7.1, 8.2 |
| `src/Cribbage.tsx` | 7.1, 7.3, 7.4, 8.1, 8.2 |
| `AGENTS.md` | 8.3 |
| `package.json` | 8.4 (`version`: `0.3.0`) |

### Unchanged (as required)

`src/app/entities.ts` (including `StdDeck.shuffle`), `src/components/CribbageBoard.tsx`, `src/app/store.ts`, `src/app/hooks.ts`, `src/index.tsx`, `vite.config.ts`, `Dockerfile`, `nginx.conf`, runtime `package.json` dependencies.

---

## 2. Build / test results

Final verification (after the splash-button animation tweak):

```
npm run lint          # exit 0
npx vitest run        # 7 files, 26 tests passed
npm run build         # tsc --noEmit && vite build, exit 0
```

Vitest files: `game.test.ts`, `difficulty.test.ts`, `persistence.test.ts`, `gameSlice.test.ts`, `App.test.tsx`, `Splash.test.tsx`, `Cribbage.test.tsx`.

T1 no longer compares `rankDiscards()[0].keep` to `getBestHand` (that is tautological after the wrap). It pins Expert keeps with a frozen fixture table. T2 still checks `rankPlays` against `playBestCard1` plus the over-31 and empty-list properties. The original “ran against unwrapped bodies, then wrapped” process is not reconstructable from git history.

---

## 3. Plan checklist

### Phase 1 — Engine ranking

| Task | Status | Notes |
| --- | --- | --- |
| 1.1 `rankDiscards` / `rankPlays` | Done | Generation order preserved; stable descending sort commented |
| 1.2 T1, T2 | Done | Written and passing before wrap |
| 1.3 Convert wrappers | Done | `getBestHand` / `playBestCard1` are thin wrappers. Auto Select and autoplay still call the wrappers |

### Phase 2 — Difficulty + AI

| Task | Status | Notes |
| --- | --- | --- |
| 2.1 `difficulty.ts` | Done | Types, weights, labels, descriptions, `pickWeightedIndex` copied from spec §4.3.3 |
| 2.2 T3a, T3b | Done | T3b reads source as text via Vite `?raw` (see deviations) |
| 2.3 Opponent wiring | Done | `selectOpponentCards(difficulty, delay)` / `playOpponentCard(difficulty, delay)`. No `this.difficulty`. Human Auto Select stays Expert |

### Phase 3 — Ledger and engine defects

| Task | Status | Notes |
| --- | --- | --- |
| 3.1a `countNobs` | Done | Single nobs implementation |
| 3.1b Crib flush | Done | Four-card crib flush 0; five-card crib flush 5 |
| 3.2 Types, ledger, `GameAction.bonus`, attribution | Done | `emptyBreakdown`, `getBreakdownSnapshot(difficulty)`, dead `scores.playing` / `scores.starting` removed |
| 3.3 `game-win` + stage-independent `quit` | Done | H2, H2b, H3 |
| 3.4 T4, T5, T5b | Done | Full-game invariant + quit concession + nobs + crib flush |
| Q1 rounds | Done as **B** | Increment on `round-end`; `roundCounted` is cleared on `start-round` so a later peg-out or mid-show win still increments when entering `ending` |

### Phase 4 — Slice and singleton

| Task | Status | Notes |
| --- | --- | --- |
| 4.1 Slice fields + reducers | Done | `setDifficulty`, `resetDifficultyChoice`, `clearFinalBreakdown` |
| 4.2 `resetForNewSession` | Done | |
| 4.3 `prepare-board` preserves difficulty | Done | Clears `finalBreakdown` |
| 4.4 Publish snapshot on `game-win` | Done | |
| 4.5 T6 | Done | |
| 4.6 Pass `state.difficulty` | Done | |

### Phase 5 — Persistence

| Task | Status | Notes |
| --- | --- | --- |
| 5.1 `persistence.ts` | Done | Only module that touches `localStorage`. Quits recorded as opponent wins |
| 5.2 T9 | Done | |
| 5.3 Seed slice from prefs | Done | |

### Phase 6 — Shell and screens

| Task | Status | Notes |
| --- | --- | --- |
| 6.1 `AppRoutes` + `GameLayout` | Done | `/` is splash; `*` → `/` |
| 6.2 Splash | Done | Hero `onError` fallback; gradient baize; fairness line |
| 6.3 Learn | Done | Rules + scoring table matching corrected engine; disabled lesson tiles |
| 6.4 Stats | Done | Real F4 counters; coming-soon rows for averages / skunks / per-difficulty |
| 6.5 Friend | Done | Disabled form; no network |
| 6.6 T7 | Done | |

### Phase 7 — Modals and recording

| Task | Status | Notes |
| --- | --- | --- |
| 7.1 `DifficultyModal` | Done | Static backdrop; always shown until confirm; `/select` after deck picker |
| 7.2 `ScoreExplanation` | Done | Contract only; “coming soon” body |
| 7.3 `GameOverModal` | Done | Raw totals; Play Again / Back to Menu |
| 7.4 `recordCompletedGame` effect | Done | `useRef` identity guard; not in reducer / `handleAction` |
| 7.5 T8 | Done | |

### Phase 8 — Seams, docs, browser pass

| Task | Status | Notes |
| --- | --- | --- |
| 8.1 `useCardMetrics` | Done | Constants 150 / 100 / 120 / 170 |
| 8.2 Show-phase `ScoreExplanation` slot | Done | Compact block under player show; new class only |
| 8.3 `AGENTS.md` | Done | Persistence, reducers, routes, `src/screens/`, crib flush, quit stats |
| 8.4 Version 0.3.0 + verify | Done | |
| Browser pass | Done | See §6 |

### Out of scope (correctly not implemented)

Full `scoreHand` decomposition; real tutorial lessons; responsive large-card layout; networking; muggins / hints / sound / themes / 3–4 player; skunk detection on game-over; moving `Cribbage.tsx` into `src/screens/`; README update; new runtime dependencies.

---

## 4. Deviations (with justification)

1. **`CodingStandards.md` missing.** Styled from spec §7 and existing `App.css` / react-bootstrap usage.

2. **Q1 rounds = option B** (plan recommendation). A win during peg or show never hits `round-end`. `nextStage("ending")` increments `rounds` if this deal was not already counted. `roundCounted` is cleared when the next deal starts (`start-round`) so the ending increment is not a one-deal-only path.

3. **T3b file read uses Vite `?raw`** instead of `node:fs` / `readFileSync`. `tsc --noEmit` has no Node types, and adding `@types/node` would be a new dependency. The assertion is still “read `difficulty.ts` as text and forbid `entities` / `shuffle`”.

4. **Splash primary-button animation is transform-only.** Title still fades and scales. Buttons rise but stay at full opacity so they remain visible and clickable if CSS animations are paused (background tab / some automation). Matches the existing “put animation inside `prefers-reduced-motion: no-preference`; layout is the final state” pattern. `both` + `opacity: 0` at 0% left Play/Learn invisible when the animation never ticks.

5. **`GameOverModal` reads `finalBreakdown` from Redux** rather than taking a required `breakdown` prop. The plan’s contract section allows either.

6. **Bucket-edge T3a samples** use interior rng values (`0.20`, `0.50`, `0.70`, `0.90`) instead of exact `0.40` / `0.65` / `0.85` boundaries. IEEE floats make `0.40+0.25+0.20` slightly over `0.85`. Semantics of `pickWeightedIndex` are unchanged.

Nothing in-scope was skipped.

---

## 5. Edge cases implemented

H1–H13 and E1–E15 from the plan are handled in code:

- Difficulty survives `prepare-board` (H1, E5).
- Quit from any stage goes to `ending` and stays there (H2, H2b, E4).
- `game-win` registers (H3).
- Nobs split via `countNobs` + `bonus` (H4).
- Stable rank sort (H5).
- Weight renormalisation (H6).
- `resetForNewSession` on ungated table mount (H7, E6, E8).
- `App.test.tsx` asserts splash-specific content (H8).
- Modal totals are raw ledger, not capped at 121 (H9).
- Splash works with no hero PNG (H10).
- `localStorage` failures never throw (H11, E9).
- Stats recorded once via `useRef` (H12, E8).
- Difficulty is not stored on `GamePlayer` (H13).
- Crib flush corrected (E10).
- Unknown `categoryFor` logs and skips the ledger line (E11).
- Catch-all → `/` (E13).
- Autoplay / Auto Select stay Expert (E14).
- `.commitCrib` hidden while gated or while `finalBreakdown` is set (E15).

---

## 6. Browser pass performed

`npm start` → `http://localhost:3000`. Exercised (not screenshot-only):

| Step | Result |
| --- | --- |
| `/` splash: Play, Learn, Stats, Friend | Present. Hero `public/img/splash/splash-hero.png` is delivered (1024×576, 256-colour PNG, ~246 KB — under the plan’s ~400 KB budget). `onError` still falls back to the baize gradient (`splash--fallback`) if the file is missing |
| Learn | Rules accordion, scoring table, difficulty copy from `difficulty.ts`, four disabled “Coming soon” tiles |
| Stats (before any game in that document) | Zeros + coming-soon rows |
| Friend | Disabled room code + Create room; planned copy; no network API |
| `/play` | Difficulty modal; Intermediate pre-selected; no Start The Round until confirm |
| Confirm Intermediate | Start The Round / Quit appear |
| Start The Round → cut | “Click a card to cut for dealer”; 52 cut cards |
| Discard | Auto Select + Select for Crib; then pegging (13 cards on table, opponent had pegged 4) |
| Quit from starting | Game-over: “Your opponent wins!”, 1 round · Intermediate, all zeros, ScoreExplanation slot |
| Back to Menu | Splash. Play again → modal again, Intermediate still pre-selected |
| Stats after a recorded quit | Lifetime games 1, opponent wins 1 (full navigation resets session — expected) |
| Play Again | Does **not** re-open the difficulty modal; Start The Round returns |
| `/brooke` | Table + modal, not splash |
| `/select` | Deck picker first (15 face samples); after a deck click, modal |
| `/nope` | Redirect to splash |
| Keyboard | Play is a real button (`tabIndex` 0) and can take focus |

Reduced-motion: animation properties live only under `@media (prefers-reduced-motion: no-preference)`. OS-level reduced-motion was not toggled in the host session; the CSS pattern matches the existing file.

---

## 7. Manual testing plan (for a human)

Use `npm start` → `http://localhost:3000`. Prefer a normal visible tab so splash animations run.

### 7.1 Splash (`/`)

1. Confirm title **CribbageX**, tagline, Play, Learn, Stats, Play with a Friend, fairness line.
2. Confirm the hero PNG is missing and the green baize gradient still fills the viewport (the `.App` painting must not show through).
3. Tab: Play → Learn → Stats → Friend. Enter on Play goes to `/play`.
4. Optional: OS “reduce motion” — title/buttons should appear in the final layout with no motion.

### 7.2 Learn (`/learn`)

1. From splash, click Learn.
2. Open every accordion. Scoring table must say: 15s = 2; pair / trips / quads = 2 / 6 / 12; runs 1 per card; hand flush 4 / 5 with starter; **crib flush five-card only**; nobs 1; his heels 2.
3. “How the opponent plays” must match the Easy / Intermediate / Expert strings in `src/app/difficulty.ts`.
4. Guided lesson buttons are disabled and labelled Coming soon.
5. Back returns to `/`.

### 7.3 Friend (`/friend`)

1. Room code and Create room are disabled.
2. Copy mentions local-only / no network.
3. DevTools Network: no WebSocket or room-code requests.
4. Back returns to `/`.

### 7.4 Play, difficulty, one deal (`/play`)

1. Open `/play`. Modal “Choose your opponent” is blocking (no X, backdrop static, no Start The Round).
2. Intermediate is pre-selected if you have never saved another level (or the last saved level is pre-selected).
3. Choose Easy, Start Game. Start The Round and Quit appear.
4. Start The Round. Cut a card. Wait for the opponent cut and the deal.
5. Discard two cards (or Auto Select then Select for Crib). Auto Select should feel Expert even on Easy — that is required.
6. Peg at least one card. Opponent play on Easy should sometimes not be the obvious best card (not a unit assertion; play-feel only).
7. Continue through the show. Confirm the small “Point-by-point breakdown coming soon” line under the player show (do not expect a layout jump of the hands).

### 7.5 Game over, Play Again, quit stats

1. Either play to 121 or **Quit** from starting / showing / ending.
2. Modal: You win / Your opponent wins; Hand / Crib / Pegging / Bonuses / **Total** for both seats; rounds and difficulty label.
3. Totals must match the yellow on-table scores (raw, may exceed 121).
4. **Play Again**: modal closes, difficulty modal does **not** return, same level, board reset.
5. Play Again, then **Quit** again. Open `/stats`:
   - Lifetime games played and opponent wins have increased (quit = concession).
   - Reload the tab: lifetime survives; session may reset to 0.
6. **Clear statistics**: lifetime and session go to zero. Coming-soon rows stay labelled coming soon (not zeros).

### 7.6 Back to Menu hygiene

1. From a finished game, Back to Menu → splash.
2. Play: modal shows again with the last saved level pre-selected.
3. Board is not a mid-hand leftover (no stale pegged cards / queues).

### 7.7 Deep links

1. `/brooke` and `/vintage`: table + CRIBBAGE heading + difficulty modal (no splash).
2. `/select`: deck faces first; after choosing a deck, difficulty modal.
3. `/this-is-not-a-route`: splash.

### 7.8 Optional production check

```
npm run build && npm run preview
```

Hit `/`, `/play`, `/learn`, `/stats`, `/friend`, `/brooke`. Docker is optional this phase; `nginx.conf` already `try_files` → `index.html`.

---

## 8. Product behaviour recap

- `/` is the front door. The table lives at `/play` and on the existing skin routes.
- Difficulty changes **strategy only**. The shuffle is unchanged.
- Expert opponent is index `0` of the ranked lists (v0.2 tie-break preserved).
- Crib flush is five-card only; Learn’s table matches `scoreHand`.
- Quits are conceded games: `winner: "opponent"`, recorded in lifetime and session stats.
- Persistence key: `cribbagex.v1`. Session counters are module memory (reset on full reload). `clearAll` zeros both.
