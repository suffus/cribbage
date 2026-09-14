import {
  DISCARD_SCENARIOS,
  PEG_SCENARIOS,
  ROUND_SCRIPTS,
  SCORE_SCENARIOS,
} from './scenarios'
import type { Lesson } from './tutorialTypes'

export const BEGINNER_PATH: ReadonlyArray<Lesson> = [
  {
    id: "shape-of-a-round",
    title: "The shape of a round",
    estimatedMinutes: 2,
    concepts: [
      "round-flow", "count-order", "crib-ownership",
      "fifteens", "pairs", "runs",
      "discard-keep", "discard-crib-risk",
      "peg-fifteen-31", "peg-pair-run",
    ],
    steps: [
      { kind: "round-map", id: "shape-deal", title: "Deal", highlight: "deal", body: ["Each player is dealt six cards. After the first cut for dealer, the deal alternates."] },
      { kind: "round-map", id: "shape-discard", title: "Discard", highlight: "discard", body: ["Each player throws two cards face down. Those four cards form the crib, which belongs to the dealer."] },
      { kind: "round-map", id: "shape-pegging", title: "Pegging", highlight: "pegging", body: ["Players alternate laying cards. The running count must not exceed 31. Fifteens, pairs, runs, 31, and the last card all score in the play."] },
      { kind: "round-map", id: "shape-show", title: "The show", highlight: "show", body: ["Hands are counted in order: non-dealer, then dealer, then the crib. The starter is shared by every count."] },
      { kind: "explain", id: "shape-board", title: "The board and the race", highlight: "show", body: ["Cribbage is a two-player race to 121. The first to peg out wins. Points come from the play, from each four-card hand, and from the crib."] },
      { kind: "recap", id: "shape-recap", concepts: ["round-flow", "count-order"], body: ["A round is deal, discard, starter, pegging, show, crib. The non-dealer counts first. The crib belongs to the dealer."] },
    ],
  },
  {
    id: "count-a-hand",
    title: "Count a hand",
    estimatedMinutes: 5,
    concepts: ["fifteens", "pairs", "runs", "hand-flush", "crib-flush", "nobs", "his-heels"],
    steps: [
      { kind: "score-example", id: "count-fifteen-ex", scenarioId: "fifteen-worked", title: "A fifteen" },
      { kind: "score-practice", id: "count-pairs", scenarioId: "pair-find", hintPolicy: "on-request" },
      { kind: "score-practice", id: "count-multi", scenarioId: "fifteen-multi", hintPolicy: "on-request" },
      { kind: "score-practice", id: "count-runs", scenarioId: "run-double", hintPolicy: "on-request" },
      { kind: "score-example", id: "count-flush-hand", scenarioId: "flush-hand", title: "A hand flush" },
      { kind: "score-example", id: "count-flush-crib", scenarioId: "flush-crib", title: "A crib flush" },
      { kind: "score-example", id: "count-nobs", scenarioId: "nobs-vs-heels", title: "Nobs and his heels" },
      { kind: "score-practice", id: "count-all-practice", scenarioId: "count-all", hintPolicy: "on-request" },
      { kind: "recap", id: "count-recap", concepts: ["fifteens", "pairs", "runs", "hand-flush", "crib-flush", "nobs", "his-heels"], body: ["Fifteens score 2. Pairs score 2 each. Runs score one per card. A hand flush is four; a crib flush needs five. Nobs is the jack of the starter's suit. His heels is a jack as the starter."] },
    ],
  },
  {
    id: "crib-and-discard",
    title: "The crib and the discard",
    estimatedMinutes: 3,
    concepts: ["crib-ownership", "discard-keep", "discard-crib-risk"],
    steps: [
      { kind: "explain", id: "crib-six-to-four", title: "Six to four", body: ["You are dealt six cards and keep four. The two you throw go to the crib. If they deal, the crib is theirs. If you deal, it is yours."] },
      { kind: "discard-practice", id: "crib-theirs", scenarioId: "discard-theirs", hintPolicy: "on-request" },
      { kind: "discard-practice", id: "crib-yours", scenarioId: "discard-yours", hintPolicy: "on-request" },
      { kind: "recap", id: "crib-recap", concepts: ["crib-ownership", "discard-keep", "discard-crib-risk"], body: ["Keep the cards that work together. Because it is their crib, avoid feeding a pair of fives. When the crib is yours, the same six cards can want a different throw."] },
    ],
  },
  {
    id: "peg-to-31",
    title: "Peg to 31",
    estimatedMinutes: 4,
    concepts: ["peg-legal", "peg-fifteen-31", "peg-pair-run", "peg-go-last-card"],
    steps: [
      { kind: "explain", id: "peg-explain", title: "The play", body: ["Players alternate laying cards. The running count must not exceed 31. A player who cannot play says go. The last card of a sequence scores 1, unless it made 31 already."] },
      { kind: "peg-practice", id: "peg-legal-step", scenarioId: "peg-legal", hintPolicy: "on-request" },
      { kind: "peg-practice", id: "peg-scoring-step", scenarioId: "peg-scoring", hintPolicy: "on-request" },
      { kind: "peg-practice", id: "peg-go-step", scenarioId: "peg-go", hintPolicy: "on-request" },
      { kind: "recap", id: "peg-recap", concepts: ["peg-legal", "peg-fifteen-31", "peg-pair-run", "peg-go-last-card"], body: ["Legal plays stay at or under 31. Fifteens and 31 score 2. Pairs and runs score in the play in the order the cards were laid. A go resets the count; the last card scores 1."] },
    ],
  },
  {
    id: "coached-round",
    title: "Play a coached round",
    estimatedMinutes: 6,
    concepts: ["round-flow", "count-order", "crib-ownership", "nobs", "peg-go-last-card"],
    steps: [
      { kind: "explain", id: "coach-notice", title: "A training deal", body: ["This is a training deal, arranged so the useful moments come up. It is not a shuffled hand from a regular game. You can restart the round at any time, and refreshing the page restarts it from the deal."] },
      { kind: "guided-round", id: "coach-first", scriptId: "first-round" },
      { kind: "recap", id: "coach-first-recap", concepts: ["count-order", "crib-ownership"], body: ["You were the non-dealer: you led, the crib was theirs, and you counted first."] },
    ],
  },
  {
    id: "coached-round-dealer",
    title: "Deal a coached round",
    estimatedMinutes: 5,
    concepts: ["crib-ownership", "his-heels", "count-order", "crib-flush"],
    steps: [
      { kind: "explain", id: "dealer-notice", title: "What changes when you deal", body: ["You turn the starter, the crib is yours, you play second, and you count second. Last round those jobs were inverted."] },
      { kind: "guided-round", id: "coach-second", scriptId: "second-round" },
      { kind: "recap", id: "coach-second-recap", concepts: ["his-heels", "crib-ownership"], body: ["You dealt. A jack starter paid you his heels. You counted second, then counted your crib."] },
    ],
  },
  {
    id: "ready-table",
    title: "Ready-table checkpoint",
    estimatedMinutes: 2,
    concepts: ["fifteens", "pairs", "runs", "discard-keep", "peg-fifteen-31"],
    steps: [
      { kind: "checkpoint", id: "ready-check", scenarioIds: ["checkpoint-count", "discard-theirs", "peg-scoring"], hintPolicy: "on-request" },
      { kind: "recap", id: "ready-recap", concepts: ["round-flow", "fifteens", "discard-keep", "peg-legal"], body: ["You have walked a whole round from both seats. The next game is a normal Easy game, with score explanations turned on."] },
    ],
  },
]

export const QUICK_PRACTICE: ReadonlyArray<Lesson> = [
  {
    id: "count-a-hand-practice",
    title: "Counting practice",
    estimatedMinutes: 5,
    concepts: ["fifteens", "pairs", "runs"],
    steps: [
      { kind: "score-practice", id: "qp-pairs", scenarioId: "pair-find", hintPolicy: "on-request" },
      { kind: "score-practice", id: "qp-multi", scenarioId: "fifteen-multi", hintPolicy: "on-request" },
      { kind: "score-practice", id: "qp-runs", scenarioId: "run-double", hintPolicy: "on-request" },
      { kind: "score-practice", id: "qp-all", scenarioId: "count-all", hintPolicy: "on-request" },
      { kind: "recap", id: "qp-count-recap", concepts: ["fifteens", "pairs", "runs"], body: ["Every total came from the same scoring rules as a live game."] },
    ],
  },
  {
    id: "peg-practice",
    title: "Pegging practice",
    estimatedMinutes: 4,
    concepts: ["peg-legal", "peg-fifteen-31", "peg-go-last-card"],
    steps: [
      { kind: "peg-practice", id: "qp-legal", scenarioId: "peg-legal", hintPolicy: "on-request" },
      { kind: "peg-practice", id: "qp-scoring", scenarioId: "peg-scoring", hintPolicy: "on-request" },
      { kind: "peg-practice", id: "qp-go", scenarioId: "peg-go", hintPolicy: "on-request" },
      { kind: "recap", id: "qp-peg-recap", concepts: ["peg-legal", "peg-fifteen-31"], body: ["Legal plays stay at or under 31. Scoring plays are named by the engine, not by a guess."] },
    ],
  },
  {
    id: "cribbage-quirks",
    title: "Cribbage quirks",
    estimatedMinutes: 4,
    concepts: ["nobs", "his-heels", "hand-flush", "crib-flush", "fifteens", "runs", "peg-go-last-card"],
    steps: [
      { kind: "score-example", id: "qp-nobs", scenarioId: "nobs-vs-heels", title: "Nobs and his heels" },
      { kind: "score-example", id: "qp-flush-h", scenarioId: "flush-hand", title: "Hand flush" },
      { kind: "score-example", id: "qp-flush-c", scenarioId: "flush-crib", title: "Crib flush" },
      { kind: "score-practice", id: "qp-quirk-multi", scenarioId: "fifteen-multi", hintPolicy: "on-request" },
      { kind: "score-practice", id: "qp-quirk-run", scenarioId: "run-double", hintPolicy: "on-request" },
      { kind: "peg-practice", id: "qp-quirk-go", scenarioId: "peg-go", hintPolicy: "on-request" },
      { kind: "recap", id: "qp-quirk-recap", concepts: ["nobs", "crib-flush"], body: ["Nobs is not his heels. A hand flush is not a crib flush."] },
    ],
  },
]

export const ALL_LESSONS: ReadonlyArray<Lesson> = [...BEGINNER_PATH, ...QUICK_PRACTICE]

export function findLesson(id: string): Lesson | undefined {
  return ALL_LESSONS.find((lesson) => lesson.id === id)
}

export function lessonIndex(id: string): number {
  return BEGINNER_PATH.findIndex((lesson) => lesson.id === id)
}

export function nextLessonId(id: string): string | undefined {
  const idx = lessonIndex(id)
  if (idx < 0 || idx >= BEGINNER_PATH.length - 1) {
    return undefined
  }
  return BEGINNER_PATH[idx + 1].id
}

export { SCORE_SCENARIOS, DISCARD_SCENARIOS, PEG_SCENARIOS, ROUND_SCRIPTS }
