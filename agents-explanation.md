# Why this AGENTS.md

There was **no existing `AGENTS.md`**. `README.md` is leftover Create React App text (eject, `build/`, CRA test docs) and would have misled agents. This file is written from the current tree: Vite 6, React 18, Vitest, Redux Toolkit as a thin shell, and Docker/nginx static hosting.

## Goals

- Give an agent enough map to edit the right file on the first try.
- Encode the unusual state model (`thePlayer` + `CribbageGame` vs Redux) so agents do not “fix” it by stuffing class instances into the store.
- Repeat the requested code-quality rules in a form that is both verbatim and tied to this repo.
- Stay near ~3000 tokens: facts that change decisions, not a rules-of-cribbage essay or a file-by-file tour.

## Section-by-section

### Purpose

The repo is a **v0.2 local two-player-vs-AI web prototype**, not a multiplayer product. Agents need that so they do not scaffold accounts, matchmaking, or a server. Competitor analysis is pointed at but marked **non-normative** so a planning memo is not treated as an implementation checklist.

### Tech stack

Taken from `package.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, and `Dockerfile`. Explicit **no database** section exists because the user asked for DB/ORM/seed/test-DB guidance; the correct answer here is absence.

### Artifacts

One executable: the SPA. Docker is the production wrapper, not a second app. Port split (**3000** Vite vs **8080** nginx) is called out because `README.md` and CRA muscle memory conflict with the image.

### Architecture

This is the highest-value section. A new agent looking at `gameSlice.ts` will assume Redux owns the game. In reality:

- `CribbageGame.doAction` is the rules state machine.
- `GamePlayer` (`thePlayer`) schedules AI, delays, toasts, and peg arrays.
- `userPlay` merges a partial UI state.

Without that diagram, typical failures are: serializing `Card` into Redux, duplicating score in a new store field, or adding a second game loop in `Cribbage.tsx`.

The functional-area table maps **jobs → files** so scoring work starts in `game.ts`, timing/AI replies in `gamePlayer.ts`, and button wiring in `Cribbage.tsx`.

`thePlayer` as a **singleton** is called out because it is easy to miss and makes naive tests flaky.

### Repository layout

A short tree, not a dump of `public/` or `node_modules`. Deck codes and PNG naming are included because `/select` and `App.tsx` routes are otherwise magic strings.

### Commands

Scripts as they exist today. `npx vitest run` is listed because `npm test` is watch mode and is a poor “done” check. No fake `format` or `e2e` scripts.

### Development workflow

The eight quality rules, sequenced as a working loop, plus project gates: lint, Vitest, browser play-through, nginx SPA fallback, unprivileged 8080. UI verification is required by the user’s web-app rule and by how easy it is to break cut/discard/show sequencing.

### Testing

Honest: one heading smoke test. Agents are steered to **unit-test `scoreHand` and `doAction`**, not to invent Cypress. That matches current tooling and the cost of the engine.

### Documentation

Stops agents from “fixing” `README.md` mid-task and from cloning competitor markdown into more strategy docs. Says where truth lives (types and actions).

### Code quality

The eight rules appear **verbatim** (numbered 1–8). Each reuse/style/validation/types rule is bound to named symbols (`UserGamePlay`, `PCard`, `validateCards`, `scoreHand`, …) so “reuse helpers” and “typed contracts” are checkable.

Extra bullets are **only** load-bearing product/engine constraints: shuffle fairness (competitor doc + `StdDeck.shuffle`), crib flush / 121, and “do not rewrite the state machine while here.”

### Deployment

Enough to avoid breaking the image (full `nginx.conf`, UID 1172, `/tmp` pid, `try_files`). Not a K8s runbook.

## Compared to a generic AGENTS.md

| Typical template | Why this file differs |
| --- | --- |
| Monorepo packages, API + web | Single SPA |
| Prisma/migrations | No persistence |
| “Run the backend” | There is none |
| CRA scripts | Vite; `dist/` |
| Large style guide | Nearby-file style; mixed old/new on purpose |
| Full domain rules | Only scoring/peg facts that affect code placement |

## Considered, left out (brevity)

- **Full cribbage rules and scoring tables.** Agents can read `scoreHand` / pegging in `doAction`. A tutorial belongs in product UI, not here.
- **Every `GameEvent` / `GameStage` variant and delay constant.** Those change; the queue + `noop` timer pattern is enough.
- **`p1Costs`, `generateCribPairs`, and EV math.** Implementation detail inside `game.ts`; document when changing AI, not in the always-on file.
- **Peg SVG geometry** (`getPoints`, track constants). Only relevant when editing `CribbageBoard.tsx`.
- **Roadmap / P0–P2 features** from `cribbage-games-competitors.md`. Strategy; including it would invite scope creep.
- **Known code smells** (verbose `console.log`, `toObject(): object`, `Hand.getSelected` logging, stale CRA `README` / `manifest.json` names). Quality rules already say match local style and don’t drive-by refactor.
- **Exact `UserGamePlay` TypeScript block.** Agents should open `gameSlice.ts`; a stale copy here would drift.
- **CSS class inventory and layout pixel constants** in `Cribbage.tsx`.
- **Deck image pipeline** (`public/img/decks/trim.py`). Rare.
- **CI/CD.** None in-repo; inventing jobs would be fiction.
- **Commit/PR conventions.** User rules already cover git; no project-specific history style worth mandating.
- **Accessibility / i18n / PWA** how-tos. Not implemented; listing them would read as a backlog.
- **Worked good/bad code samples.** Token-heavy; named reuse targets substitute.
- **Branch/deploy environment names.** Not defined in the repo.
- **React 19 / Redux “modernization” advice.** Conflicts with “match nearby style” and the mixed-era codebase.

## Accuracy checks

Claims were checked against:

- `package.json` scripts and dependencies
- `src/app/game.ts`, `gamePlayer.ts`, `entities.ts`, `features/game/gameSlice.ts`
- `src/App.tsx` routes and deck map
- `src/Cribbage.tsx` timer / `userPlay` usage
- `src/App.test.tsx` + `vite.config.ts` test config
- `Dockerfile` + `nginx.conf`
- Presence of `cribbage-games-competitors.md` and staleness of `README.md`

If the engine is later split into a worker, or a server is added, the Architecture, Artifacts, and “no database” sections should be rewritten first.
