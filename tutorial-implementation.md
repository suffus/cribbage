# Tutorial implementation

Shipped against `detailed-tutorial-implementation-plan.md` and the UI tokens in `tutorial-mockups.html`.

## What shipped

### Engine (Phase 0)

- `scoreHand` and `scoreHandDetailed` share `computeHandScore`. Empty hand totals 0. Hands are cloned before sort.
- `explainPegPlay` names 15 / 31 / pair / run. Copy lives in `src/app/scoreCopy.ts`, not in `game.ts`.
- `RANK_NAMES`, `SUIT_NAMES`, `cardKey`, `cardName` on `entities.ts`. Existing `game.test.ts` assertions were not edited.

### Live table (Phase 1)

- `GroupList` / `ScoreExplanation` on `/play` for player, opponent, and crib at show.
- Active groups use `▸` plus visually-hidden “(found)”, not colour alone.
- `GameOverModal` no longer stubs a score explanation.

### Curriculum and runner (Phases 2–3)

- Seven Beginner Path lessons and three Quick Practice lessons.
- Grading uses `scoreHandDetailed`, `rankDiscards`, and `explainPegPlay` (never `rankPlays`).
- Progress is the `tutorial` member of `cribbagex.v1`. Corrupt tutorial data is sanitised. `clearAll` keeps tutorial; Learn “Start over” calls `clearTutorialProgress()`.
- Analytics `track` is an in-process null sink.

### Lesson UI (Phase 4) — mockup-aligned

Layout and markers follow `tutorial-mockups.html`:

- Palette `#0d3b24` / `#14532d` / `#f4efe2` / `#f7e7b0` / `#d9c48a` / `#c9b36a`; Georgia headings; 44×44 targets.
- Learn: promise line, `lesson-row` with `✓` / `→` / `○` plus visually-hidden text, Start / Resume / Replay, Quick Practice, dashed training notice, Rules accordion under `#rules`.
- Lesson shell: coach column first below 768px (`order-1` / `order-2`); one `role="status"` live region; hint labels Hint → Another hint → Show me one group.
- Selectable cards: outline + badge text for selected / credited / hinted / disabled (not hue alone).
- S4 mastery pills: `ready` / `practised` / `notyet`.
- Rules open in an Offcanvas, not `/learn#rules`.

`/learn/:lessonId` is registered before `*`. Unknown ids and `VITE_TUTORIAL_PATH=off` redirect to `/learn`. Flag-off Learn is header + `RulesReference` only.

### Guided rounds (Phase 5)

- `FixedDeck` deals from the front; `shuffle` / `reset` rebuild fresh `Card`s.
- `GuidedRound` constructs FixedDeck → `CribbageGame` → set `dealer` → `start-round`. Both `first-round` and `second-round` complete through the real engine. Illegal plays over 31 are refused. Restart rebuilds the deal.

### Handoff (Phase 6)

Lesson 7 recap runs, in order:

`savePreferences({difficulty:"easy"})` → `thePlayer.resetForNewSession()` → `dispatch(resetGameUi())` → `dispatch(setDifficulty("easy"))` → `navigate("/play")`.

Skipping every step still shows **Play your first Easy game**.

## Deferred / not in this drop

- Adaptive practice, Coach Mode on `/play`, muggins, skunk flags, and a real analytics backend (spec §16).
- Re-reading tutorial progress on window focus.
- `README.md` (stale CRA text left as requested).
- `CodingStandards.md` was not in the repo; styling followed the mockup tokens plus existing `App.css`.
- Docker / nginx were not rebuilt; `nginx.conf` already has `try_files` → `index.html` for React Router. No route-prefix change.

## Manual test plan

Use `npm start` (Vite on :3000). Default flag is on.

1. **Learn landing.** `/learn` shows the 15-minute / half-hour promise, a six-phase round map, seven unlocked lessons, and Quick Practice. Rules accordion still has crib flush (five cards only), his heels, race to 121, and “the low card deals first”.
2. **Start vs Resume.** Start beginner path → `/learn/shape-of-a-round`. Advance a step, return to Learn, confirm Resume names the lesson and step. Start over asks to confirm and clears tutorial only.
3. **Lesson 1.** Walk Deal → Crib on the round map. Next is enabled on explain/map/recap steps. Skip does not mark the step complete.
4. **Lesson 2, keyboard only.** Tab to cards, Space/Enter to select a pair or fifteen, Count selected cards, then Next. Hint cycles Hint → Another hint → Show me one group. One status region updates.
5. **Refresh mid-lesson 2.** Resume opens the same step.
6. **Lessons 3–4.** Opponent-crib discard rejects feeding a five when a better throw exists. Peg-legal marks the two and five, not the king. Count chip stays visible.
7. **Guided rounds (5 and 6).** Training-deal dashed notice stays up. Restart this round returns to six cards. First round: they deal, you lead and count first. Second round: jack starter pays his heels; you count second, then the crib. Both finish without the red error box.
8. **Lesson 7 / S4.** Skip every checkpoint item if you want (X15). Handoff shows `ready` / `practised` / `not yet` pills. Play your first Easy game → `/play` with no difficulty modal, Easy opponent, no leftover toasts.
9. **Live show on `/play`.** Play one deal to the show. Three compact breakdowns (you / opponent / crib) appear and match the pegged totals.
10. **320px and 200% zoom.** Coach sits above the cards. Footer remains reachable. No horizontal scroll of the workspace.
11. **Flag off.** `VITE_TUTORIAL_PATH=off npm start` — `/learn` is rules only; `/learn/count-a-hand` redirects to `/learn`.
12. **Stats wipe.** Clear statistics on `/stats` must not wipe tutorial progress.

Automated coverage for the above: `npx vitest run` (148 tests at ship) and `npm run lint`.
