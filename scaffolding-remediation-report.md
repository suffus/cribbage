# CribbageX v0.3.0 — Scaffold Remediation Report

**Source gap report:** `scaffolding-gaps.md`  
**Source plan:** `scaffolding-plan.md`  
**Source spec:** `detailed-spec-for-scaffold.md`  
**Date:** 13 September 2026

This pass implements the recommended fixes from `scaffolding-gaps.md` §6, plus the
report-accuracy corrections in §5 that those recommendations call out.

---

## 1. Verification after remediation

```
npm run lint          # exit 0
npx vitest run        # 7 files, 26 tests passed (1.20s)
npm run build         # tsc --noEmit && vite build, exit 0
```

T1 dropped from ~4.1 s to **394 ms**. The suite no longer sits against the default
5 s timeout. Browser checks on the running Vite server (`http://localhost:3000`):

- `/` — splash hero loads (`naturalWidth` 1024, no `splash--fallback`)
- `/learn` — difficulty list present; `.learn-difficulty-list` now has computed
  padding / spacing
- `/stats` — Clear statistics zeroes lifetime counters in place (state refresh,
  no reload)
- `/play` — difficulty modal, then **Start The Round!** / **Quit!** after confirm

---

## 2. Gap-report items addressed

Numbered as in `scaffolding-gaps.md` §6.

### 1. Clear `roundCounted` when a deal starts — **done**

**Defect.** Q1-B was wired but self-disabled after the first deal: `roundCounted`
was set `true` on `round-end` and only reset in `resetGame()`’s `gameOver` branch.
Every finished game that reached a second deal reported one round fewer than it
played.

**Fix.** In `src/app/game.ts` `start-round`, set `this.roundCounted = false`
before `resetGame()`. Each new deal starts uncounted, so a later peg-out or
mid-show win still increments `rounds` when entering `ending`. The field comment
and the `ending` comment now describe that lifecycle.

### 2. Add a `rounds` assertion to T4 — **done**

The completed-game T4 case now asserts `game.rounds ===` the number of
`shuffle-deck` actions, and that `rounds > 0`. That is the property the original
suite never checked, which is why the Q1-B defect shipped.

### 3. Replace T1’s tautology with frozen fixtures — **done**

`getBestHand` is `rankDiscards(...)[0].keep`, so comparing the two could not fail.
T1 now pins Expert keep order on **32 frozen 6-card hands** (16 player-crib, 16
opponent-crib). Each case still asserts `length === 15` and non-increasing
`score`. A ranking regression fails the expected keep, not a self-comparison.
Work dropped from 400 `rankDiscards` evaluations to 32.

### 4. Make the T4 quit case a real mid-game quit — **done**

Deleted the unused full-game pump. The quit test now:

1. Plays through at least one completed `round-end`
2. Enters the next deal (second `shuffle-deck`)
3. Quits from that in-progress deal
4. Asserts winner `"opponent"`, ledger invariant, and
   `rounds === shuffle-deck count` (at least 2)

A short retry loop skips the rare first-deal peg-out so the case stays a genuine
mid-game concession.

### 5. Guard `selectOpponentCards` with `if (idx < 0)` — **done**

Matches `playOpponentCard`. Empty candidate lists return `GameAction("error")`
instead of indexing `options[-1]`. Unreachable today (`rankDiscards` always
returns 15) but required by plan E2.

### 6. Optimise `splash-hero.png` and correct the implementation report — **done**

| | Before | After |
| --- | --- | --- |
| File | 1024×576 RGB PNG, 889 938 B (~869 KB) | 1024×576 256-colour PNG, 252 361 B (~246 KB) |
| Budget | over the plan’s ~400 KB cap | under budget; dimensions unchanged |

Quantised with a 256-colour median-cut palette. The `onError` baize fallback is
unchanged.

`scaffolding-implementation.md` browser-pass row now states the hero is present
and sized, not “file absent → fallback”. The Q1 and T1 accuracy claims in that
report were also corrected (see §4 below).

### 7. Housekeeping — **done**

| Item | Change |
| --- | --- |
| `void version` hack in Stats | Stats now holds `lifetime` / `session` in state and refreshes them in the Clear handler |
| Misleading Q1-B comment | Field comment now says the flag is cleared on `start-round` |
| `.learn-difficulty-list` unstyled | Added padding and item spacing in `src/App.css` (learn section only; table rules untouched) |
| `persistence.ts` imports the engine for eight zeros | Inlined `emptyPlayerBreakdown()`; the module now has a **type-only** import from `game.ts` |

### 8. Commit the work in the plan’s phase order — **left open**

See §3.

---

## 3. Items not fully addressed / left open

| Item | Why it stayed open |
| --- | --- |
| **§6 item 8 — phase-ordered commits** | The user did not ask for a commit. The prior scaffold already sat as one uncommitted working tree; inventing eight back-dated phase commits would be history rewriting, not evidence. The “green after every phase” and “T1 run against unwrapped bodies” claims remain unverifiable from git. T1 is now a frozen-fixture regression test, which is the durable substitute. |
| **H7 in-tab Back / link resume** (`scaffolding-gaps.md` Phase 7 residual) | Spec §4.3.5 says the modal “reappears … on a fresh visit to a table route”. The plan encoded the weaker `difficultyChosen` behaviour. The gap report classified this as a **plan-level** gap, not an implementation defect, and did not list it in §6. Left as the plan specifies. |
| **`abort-game` / `game-timeout` with no `subaction`** (§4.2) | Would leave `winner` undefined and make `playerWins + opponentWins !== gamesPlayed`. No UI path emits those actions. Not in the §6 fix list. |
| **`clearAll()` also drops the saved difficulty** (Phase 5 note) | Consistent with the plan (“removes `STORAGE_KEY`”) and already asserted by T9. The button label is “Clear statistics”; changing the storage contract was not requested. |
| **Stale `AGENTS.md` deployment paragraph / `nginx.conf` port 80** (§4.3) | Pre-existing; the plan forbade touching `nginx.conf`. Not a scaffold-delivery gap. |
| **`.App` third-party CDN background** (§4.3) | Pre-existing; plan forbade editing that rule. |

Nothing on the §6 recommended-fix list was skipped except item 8 (process / git).

---

## 4. Implementation-report accuracy (gap §5)

Corrected in `scaffolding-implementation.md`:

1. **Q1 “Done as B”** — now describes the `start-round` clear, so the ending
   increment is not a first-deal-only path.
2. **Browser-pass splash row** — hero file is present and under budget; fallback
   remains implemented.
3. **T1/T2 “ran against unwrapped bodies”** — marked unverifiable from git;
   T1 is now frozen fixtures rather than a wrapper tautology.

---

## 5. Files touched

### Product / test code

| File | Change |
| --- | --- |
| `src/app/game.ts` | Clear `roundCounted` on `start-round`; accurate Q1-B comments |
| `src/app/gamePlayer.ts` | `idx < 0` guard in `selectOpponentCards` |
| `src/app/game.test.ts` | Frozen T1 fixtures; T4 `rounds === shuffle-deck` count; real mid-game quit |
| `src/app/persistence.ts` | Local zeroed `PlayerBreakdown`; type-only import from `game.ts` |
| `src/screens/Stats.tsx` | Stats held in state; Clear refreshes from loaders |
| `src/App.css` | `.learn-difficulty-list` spacing |
| `public/img/splash/splash-hero.png` | 890 KB RGB → 246 KB 256-colour PNG |

### Documents

| File | Change |
| --- | --- |
| `scaffolding-implementation.md` | Q1, T1, and splash browser-pass accuracy |
| `scaffolding-remediation-report.md` | This report (new) |

### Not modified

Engine ranking, difficulty weights, slice contract, routes, modals, `entities.ts`,
`CribbageBoard.tsx`, `store.ts`, `hooks.ts`, `index.tsx`, `vite.config.ts`,
`Dockerfile`, `nginx.conf`, `package.json` dependencies, `README.md`.
No new runtime dependency.

A temporary fixture-generation script under `scripts/` was used and deleted; that
directory is not in the tree.
