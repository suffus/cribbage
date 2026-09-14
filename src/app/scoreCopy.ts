/** Keyed by GameAction.reason for score actions. Used by the tutorial coach and
 *  available to the toast layer. Must cover every reason categoryFor() recognises.
 *  Not imported by game.ts — the engine stays copy-free. */
export const SCORE_REASON_COPY: Record<string, string> = {
  "15": "fifteen — 2",
  "31": "thirty-one — 2",
  run: "a run in the play",
  pair: "a pair in the play",
  "the-last-card": "the last card — 1",
  "his-nibs": "his heels (also called his nibs) — the starter is a jack, 2 to the dealer",
  "show-non-dealer": "hand count",
  "show-dealer": "hand count",
  "show-crib": "crib count",
}
