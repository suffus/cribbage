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
export const REQUIRED_CONCEPTS: ReadonlyArray<ConceptId> = [
  "round-flow", "count-order", "crib-ownership",
  "fifteens", "pairs", "runs", "hand-flush", "crib-flush", "nobs", "his-heels",
  "discard-keep", "discard-crib-risk",
  "peg-legal", "peg-fifteen-31", "peg-pair-run", "peg-go-last-card",
]

/** Concepts assessed in the final checkpoint; each needs an earlier worked example (C4). */
export const CHECKPOINT_CONCEPTS: ReadonlyArray<ConceptId> = [
  "fifteens", "pairs", "runs",
  "crib-ownership", "discard-keep", "discard-crib-risk",
  "peg-fifteen-31", "peg-pair-run",
]

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
    | { kind: "select-legal" }
    | { kind: "select-scoring" }
    | { kind: "play-sequence" }
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
  dealer: PlayerEvent
  /** 13 cards in engine deal order: index 0 → the non-dealer's first card, then alternating;
   *  index 12 → the starter. See G1 for the derivation.
   *
   *  dealer = "opponent"  (first-round)
   *  index : 0  1  2  3  4  5  6  7  8  9 10 11 | 12
   *  to    : P  O  P  O  P  O  P  O  P  O  P  O | starter
   *
   *  dealer = "player"    (second-round)
   *  index : 0  1  2  3  4  5  6  7  8  9 10 11 | 12
   *  to    : O  P  O  P  O  P  O  P  O  P  O  P | starter
   */
  deck: readonly [
    CardSpec, CardSpec, CardSpec, CardSpec, CardSpec, CardSpec,
    CardSpec, CardSpec, CardSpec, CardSpec, CardSpec, CardSpec, CardSpec,
  ]
  opponentDiscard: readonly [CardSpec, CardSpec]
  /** The opponent's pegging plays, in intended order. Legality is re-checked at run time; an
   *  illegal scripted card is skipped in favour of the first legal card and reported by C4. */
  opponentPlays: ReadonlyArray<CardSpec>
  /** The learner's seat's discard, set only on demonstration scripts (`RoundDemo`). The coached
   *  rounds (`first-round`, `second-round`) leave this undefined because the learner chooses there.
   *  When one of `playerDiscard` / `playerPlays` is set, the other must be too. */
  playerDiscard?: readonly [CardSpec, CardSpec]
  /** The learner's seat's pegging plays, in order, set only on demonstration scripts. See
   *  `playerDiscard`. */
  playerPlays?: ReadonlyArray<CardSpec>
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
  /** Plays two scripted hands back to back, one visible beat at a time, with the dealer reversed
   *  between the two ids. Never assessed and never awaits learner input. */
  | { kind: "round-demo";       id: string; scriptIds: readonly [string, string] }
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

export function tutorialEnabled(): boolean {
  return import.meta.env.VITE_TUTORIAL_PATH !== "off"
}
