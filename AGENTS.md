# AGENTS.md

Guidance for coding agents working in this repository.

## Purpose

CribbageX is a browser cribbage client (v0.3). A human plays a standard 121-point, two-player game against one computer opponent. There is no backend and no accounts. Preferences and lifetime stats persist in `localStorage` (`src/app/persistence.ts`, key `cribbagex.v1`). The product kernel is a local rules engine plus a pegboard UI.

Positioning and competitor notes live in `cribbage-games-competitors.md`. Do not treat that document as a build spec unless the user asks you to implement a listed feature.

## Tech stack

- **Language:** TypeScript (strict), React 18, `"type": "module"`
- **UI:** React Router 6, React Bootstrap 2 / Bootstrap 5, react-toastify
- **State:** Redux Toolkit. The store is a thin adapter; mutable game objects live outside Redux
- **Build:** Vite 6 (`vite.config.ts`). Dev server port **3000**
- **Test / lint:** Vitest 3 + jsdom + Testing Library; ESLint 9 (`eslint.config.js`, `typescript-eslint`)
- **Runtime:** static files only. Production image is Node 22 build → unprivileged nginx 1.27 on port **8080**

There is **no database, ORM, seeder, API server, or test DB**. Persistence is `localStorage` only, isolated in `src/app/persistence.ts`. Do not add a backend unless the task requires it.

## Artifacts

| Artifact | How to run | Output |
| --- | --- | --- |
| Web app (only product) | `npm start` / `npm run dev` | SPA at `http://localhost:3000` |
| Production bundle | `npm run build` | `dist/` (not CRA `build/`) |
| Local prod preview | `npm run preview` | Vite preview of `dist/` |
| Container | `docker build` + run the image | nginx serves `dist/` on **8080**, SPA fallback to `index.html` |

No mobile apps, no separate backend process.

## Architecture

Rules and AI are classes and functions. Redux holds UI-facing fields (toasts, peg dots, show-hand flags, scheduled delay). Keep that split.

```
User click / timer
  → dispatch(userPlay({ action, cards }))
  → gameSlice.userPlay
  → thePlayer.playAction (singleton GamePlayer)
  → CribbageGame.doAction (state machine)
  → GamePlayer.handleAction (AI replies, delays, peg updates)
  → merged GamePlayingState
```

**Do not put `Card` / `Hand` / `CribbageGame` instances into Redux.** They are mutable classes. The serializable play contract is `UserGamePlay` + `PCard` in `src/features/game/gameSlice.ts`.

### Functional areas

| Area | Where | Role |
| --- | --- | --- |
| Cards, deck, hand | `src/app/entities.ts` | `Card`, `StdDeck`, `Hand`, `Deck`. Image URIs under `/img/decks/{code}/` |
| Rules + scoring + discard EV | `src/app/game.ts` | `CribbageGame`, `GameAction`, `scoreHand`, `getBestHand`, `playBestCard1` |
| Opponent + timing | `src/app/gamePlayer.ts` | `GamePlayer`, exported `thePlayer`. Queues, AI discard/peg, toast/peg updates |
| UI state contract | `src/features/game/gameSlice.ts` | Reducers: `userPlay`, `setDifficulty`, `resetDifficultyChoice`, `clearFinalBreakdown`. Play actions: `cut`, `play-card`, `discard`, `start-round`, `new-game`, `round-end`, `noop`, `quit` |
| Store / typed hooks | `src/app/store.ts`, `src/app/hooks.ts` | Use `useAppDispatch` / `useAppSelector` |
| Table UI | `src/Cribbage.tsx` | Layout, buttons, timer that dispatches `noop` when `nextScheduledAction >= 0`. Stays at `src/` (not `src/screens/`) |
| Cards / board | `src/components/CardComponents.tsx`, `CribbageBoard.tsx` | Card faces, selection, SVG peg overlay on `public/img/Cribbage_Board.svg` |
| Screens | `src/screens/` | Splash, Learn, Stats, FriendPlay |
| Routes / skins | `src/App.tsx` | `/` splash; `/play` table (`rc`); `/learn`, `/stats`, `/friend`; `/brooke`, `/emma1`, `/emma2`, `/vintage` deep-link skins; `/select` picker; `*` → `/` |

Game stages: `starting` → `cutting` (first deal) → `dealing` → `selection` → `playing` → `showing` → `starting`, or `ending` at 121.

`thePlayer` is a **module singleton**. Tests that drive the engine, and a fresh table visit, must call `thePlayer.resetForNewSession()`. Difficulty changes strategy only; `StdDeck.shuffle` stays zero-argument. Crib flush is five-card only and **is implemented** in `scoreHand`. Quits are conceded games and increment lifetime/session stats.

## Repository layout

```
src/
  index.tsx              # React 18 root, Provider, ToastContainer
  App.tsx                # routes + deck map + GameLayout / AppRoutes
  Cribbage.tsx           # game screen (table; not under screens/)
  App.test.tsx           # splash smoke test
  setupTests.ts          # jest-dom for Vitest
  app/                   # engine, store, hooks, persistence, difficulty
  screens/               # Splash, Learn, Stats, FriendPlay
  features/game/         # Redux slice only
  components/            # presentational cards + board + modals
public/                  # static assets copied as-is (decks, board SVG, manifests)
dist/                    # build output (gitignored)
Dockerfile, nginx.conf   # unprivileged static hosting
```

Styling: `src/App.css`, `src/index.css`. Card art is PNGs named `{rank}{suit}.png` (e.g. `AH.png`) plus `back.png`. Deck codes: `rc`, `br1`, `em1t`, `em2`, `vv`.

## Commands

```bash
npm install          # npm ci in Docker
npm start            # or npm run dev — Vite on :3000
npm test             # Vitest watch
npx vitest run       # single CI-style pass
npm run lint         # ESLint on **/*.{ts,tsx}
npm run build        # tsc --noEmit && vite build
npm run preview      # serve dist/
```

Unused imports/vars fail lint unless prefixed `_`. There is no formatter script and no CI workflow in-repo.

## Development workflow

1. If the request is ambiguous, stop and ask (options + tradeoffs + a recommendation).
2. Implement a detailed plan unless something concrete blocks it. Do not leave TODOs in place of required behavior.
3. Change only what the task needs. Prefer extending `scoreHand`, `getBestHand`, `CribbageGame.doAction`, `GamePlayer.handleAction`, and existing components over new frameworks.
4. For non-trivial work, set small goals and land one at a time (e.g. scoring → AI → slice contract → UI).
5. `npm run lint` and `npx vitest run` before claiming done. Add tests next to new engine behavior.
6. After UI changes, exercise the flow in the browser (cut, discard, peg, show, new game), not only a screenshot.
7. Production path: `npm run build` then the Docker image. nginx must keep `try_files` → `index.html` for React Router. Listen on **8080**, no root `user` directive (unprivileged UID 1172).

## Testing

| Layer | Status | Where / how |
| --- | --- | --- |
| Unit | Engine, difficulty, persistence | `src/app/game.test.ts`, `difficulty.test.ts`, `persistence.test.ts`. No HTTP, no DB. |
| Component | Splash + table gate | `src/App.test.tsx`, `src/screens/Splash.test.tsx`, `src/Cribbage.test.tsx` — RTL + store / MemoryRouter. |
| Integration / e2e | None | Do not add Playwright/Cypress unless asked. Prefer calling `CribbageGame.doAction` / `scoreHand` directly. |

`vite.config.ts`: `environment: 'jsdom'`, `globals: true`, `setupFiles: './src/setupTests.ts'`.

Engine tests are high value: `scoreHand` (15s, pairs, runs, flush, nobs, crib flush), pegging (15/31/go/pairs/runs), cut-for-deal, 121 win. Watch shared `thePlayer` state.

## Documentation

| File | Use |
| --- | --- |
| `AGENTS.md` | Agent + contributor working agreement (this file) |
| `README.md` | **Stale CRA text** (eject, `build/`). Do not follow it for tooling. Update only when asked; then document Vite, `dist/`, and the scripts above. |
| `cribbage-games-competitors.md` | Product/market notes, not implementation truth |
| Code | Types and `GameAction` / `UserGamePlay` are the contracts. Prefer a short comment on a non-obvious rule over a new markdown file |

New docs: short, next to the subject, no duplicate README. Do not add architecture novels.

## Code quality

1. **Think before coding.** If the prompt is ambiguous and clarification is needed, stop and ask. Present options, tradeoffs, and a recommendation when helpful.
2. **If given a detailed implementation plan, implement it** unless there is a concrete blocker. Do not leave TODO comments as a substitute for required behavior.
3. **Keep changes scoped to the request.** Do not add unrelated features, broad refactors, or new abstractions unless they are necessary for the task.
4. **Define small, achievable goals** for non-trivial work, and make each action advance one of those goals.
5. **Reuse existing helpers** — `scoreHand`, `getBestHand`, `playBestCard1`, `Hand` methods, `UserGamePlay`, `PCard`, card/board components, `useAppSelector` / `useAppDispatch` — before introducing new ones.
6. **Match local style** in the file you are editing. The repo mixes older class/console-log code (`game.ts`, `gamePlayer.ts`) with newer Vite/RTK patterns (`index.tsx`, `hooks.ts`). Nearby code is the best guide. Do not “modernize” a file while fixing a bug.
7. **Prefer structured validation and parsing.** Use `UserGamePlay` / `PCard`, `GameAction`, and `Hand` / `Deck` methods instead of ad hoc string or object handling. Validate card counts and ownership the way `CribbageGame.validateCards` / discard checks already do.
8. **Treat exported APIs, route payloads, and non-obvious parameters as typed contracts.** `UserGamePlay`, `PCard`, `GamePlayingState`, `Deck`, `GameStage`, and `GameEvent` stay explicit. Do not widen `toObject()` into untyped `object` usage in new code.

Also:

- **Fair shuffle:** difficulty (when added) must change strategy only, not the deck. Same `StdDeck.shuffle` for every AI level.
- **Cribbage rules:** standard show (15s, pairs, runs, flush, nobs); crib flush is five-card only (`scoreHand(..., isCrib)`). Peg to 31; game to 121.
- **Do not** rewrite the state machine “while you are here,” add a backend, or invent a second source of truth for score vs pegs.

## Deployment notes

`Dockerfile`: `npm ci` + `npm run build`, copy `dist/` to nginx. `nginx.conf` is the full main config (not a `conf.d` snippet): port 8080, temp/pid under `/tmp`, hashed `/assets/` immutable, `index.html` no-cache, security headers. Changing routes or asset paths may require nginx updates.
