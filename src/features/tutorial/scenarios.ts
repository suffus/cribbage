import type {
  DiscardScenario,
  PegScenario,
  RoundScript,
  ScoreScenario,
} from './tutorialTypes'

const H = {
  fifteen: [
    "That makes 15, so it scores 2.",
    "Look at the ten-value card next to a five.",
    "Select the five and the king together — that is 15 for 2.",
  ] as const,
  pairs: [
    "You are looking for pairs — two cards of the same rank.",
    "One of the pairs uses a card near the left of the hand.",
    "Select both nines. That is a pair for 2. Then find the other pair the same way.",
  ] as const,
  run: [
    "There is still a run. A run is three or more consecutive ranks.",
    "Start from the lowest card that belongs to the run.",
    "Select 4, 5, and 6 — that is one run of three. Then find the other 4-5-6.",
  ] as const,
  count: [
    "There are still combinations left. Fifteens, pairs, and runs can share cards.",
    "A card can belong to more than one fifteen.",
    "Try the six, seven, and eight as a run, then look for fifteens that use the pair.",
  ] as const,
  nobs: [
    "Nobs is the jack of the starter's suit. His heels is a jack as the starter.",
    "Find the jack that matches the starter's suit.",
    "Select the jack of hearts. That is nobs for 1. His heels is the other jack sitting beside the hand — it is not part of this count.",
  ] as const,
  flush: [
    "A flush is four cards of one suit in the hand. The starter can add a fifth.",
    "Look at the four hand cards only, first.",
    "All four hand cards are hearts. That is a four-card flush for 4. The starter is a club, so it does not join.",
  ] as const,
  cribFlush: [
    "In the crib a flush needs all five cards, including the starter.",
    "Compare this with the same four cards you just saw as a hand.",
    "These four hearts plus a heart starter make a five-card crib flush for 5. Off-suit, a crib scores no flush.",
  ] as const,
  discard: [
    "Think about whose crib this is before you throw.",
    "A pair of fives is a gift in someone else's crib.",
    "Keep the run. Put the two cards that do not belong in the crib.",
  ] as const,
  peg: [
    "A card is legal only when its value plus the count is 31 or less.",
    "Add each card to 26 and see which totals stay at or under 31.",
    "The two and the five are legal. The king would make 36.",
  ] as const,
}

export const SCORE_SCENARIOS: Readonly<Record<string, ScoreScenario>> = {
  "fifteen-worked": {
    id: "fifteen-worked",
    concepts: ["fifteens"],
    hand: [["hearts", 5], ["diamonds", 13], ["clubs", 4], ["spades", 2]],
    starter: ["spades", 9],
    isCrib: false,
    prompt: "A fifteen is any two or more cards that add to 15. Face cards count 10. Watch one combination appear.",
    require: ["fifteen"],
    hints: H.fifteen,
  },
  "pair-find": {
    id: "pair-find",
    concepts: ["pairs"],
    hand: [["hearts", 2], ["clubs", 2], ["diamonds", 9], ["spades", 9]],
    starter: ["hearts", 13],
    isCrib: false,
    prompt: "Find every pair. Select each pair on its own — two cards of the same rank.",
    require: ["pair"],
    hints: H.pairs,
  },
  "fifteen-multi": {
    id: "fifteen-multi",
    concepts: ["fifteens"],
    hand: [["hearts", 5], ["diamonds", 10], ["spades", 13], ["clubs", 2]],
    starter: ["clubs", 3],
    isCrib: false,
    prompt: "One card can sit in more than one fifteen. Find every fifteen.",
    require: ["fifteen"],
    hints: [
      "There is still a fifteen to find.",
      "The five belongs to more than one combination.",
      "Select the five and the ten, then the five and the king.",
    ],
  },
  "run-double": {
    id: "run-double",
    concepts: ["runs"],
    hand: [["hearts", 4], ["clubs", 5], ["diamonds", 5], ["spades", 6]],
    starter: ["clubs", 13],
    isCrib: false,
    prompt: "A double run is two runs that share a pair. Select one run of three, then the other.",
    require: ["run"],
    hints: H.run,
  },
  "count-all": {
    id: "count-all",
    concepts: ["fifteens", "pairs", "runs"],
    hand: [["hearts", 6], ["clubs", 7], ["diamonds", 7], ["spades", 8]],
    starter: ["clubs", 13],
    isCrib: false,
    prompt: "Find every fifteen, pair, and run. Cards may be used in more than one combination.",
    hints: H.count,
  },
  "nobs-vs-heels": {
    id: "nobs-vs-heels",
    concepts: ["nobs", "his-heels"],
    hand: [["hearts", 11], ["clubs", 4], ["diamonds", 9], ["spades", 2]],
    starter: ["hearts", 5],
    isCrib: false,
    prompt: "Nobs is the jack in your hand that matches the starter's suit — 1 point. His heels (also called his nibs) is a jack as the starter, 2 to the dealer. Only nobs is part of this hand count. The extra jack shown beside the starter is there to name the contrast; it is not scored here.",
    require: ["nobs"],
    hints: H.nobs,
  },
  "flush-hand": {
    id: "flush-hand",
    concepts: ["hand-flush"],
    hand: [["hearts", 1], ["hearts", 4], ["hearts", 7], ["hearts", 13]],
    starter: ["clubs", 2],
    isCrib: false,
    prompt: "Four hearts in the hand, and a club starter. A hand flush is four cards of one suit. The starter would make it five only if it matched.",
    require: ["flush"],
    hints: H.flush,
  },
  "flush-crib": {
    id: "flush-crib",
    concepts: ["crib-flush"],
    hand: [["hearts", 1], ["hearts", 4], ["hearts", 7], ["hearts", 13]],
    starter: ["hearts", 2],
    isCrib: true,
    prompt: "The same four hearts, now in the crib, with a heart starter. A crib flush needs all five cards. Last time this was a hand — four was enough. In the crib, four matching cards and an off-suit starter score no flush at all.",
    require: ["flush"],
    contrastWith: "flush-hand",
    hints: H.cribFlush,
  },
  "checkpoint-count": {
    id: "checkpoint-count",
    concepts: ["fifteens", "pairs", "runs"],
    hand: [["hearts", 3], ["clubs", 4], ["diamonds", 5], ["spades", 5]],
    starter: ["hearts", 10],
    isCrib: false,
    prompt: "Count this hand on your own. Find every combination.",
    hints: [
      "Fifteens, a pair, and a double run are all here.",
      "The two fives each make 15 with the ten.",
      "Select 3-4-5 as one run, then the other 3-4-5.",
    ],
  },
}

export const DISCARD_SCENARIOS: Readonly<Record<string, DiscardScenario>> = {
  "discard-theirs": {
    id: "discard-theirs",
    concepts: ["discard-keep", "discard-crib-risk", "crib-ownership"],
    hand: [["spades", 5], ["diamonds", 5], ["clubs", 6], ["hearts", 7], ["diamonds", 11], ["hearts", 12]],
    isPlayerCrib: false,
    prompt: "This is the opponent's crib. Choose two cards to throw. You are holding a pair of fives — it is tempting to split them off together, but a pair handed to their crib is two free points for them.",
    acceptTopN: 3,
    reasons: {
      "JD-QH": "Jack and queen leave 5-5-6-7. That keep is stronger than it looks, and neither five goes anywhere near their crib.",
      "6C-7H": "Six and seven leave 5-5-J-Q. You still keep both fives out of their crib.",
    },
    hints: H.discard,
  },
  "discard-yours": {
    id: "discard-yours",
    concepts: ["discard-keep", "crib-ownership"],
    hand: [["spades", 5], ["diamonds", 5], ["clubs", 6], ["hearts", 7], ["diamonds", 11], ["hearts", 12]],
    isPlayerCrib: true,
    prompt: "Same six cards, but now this is your crib. The right throw can change when the crib is yours — though splitting up your own pair of fives is still the wrong idea.",
    acceptTopN: 3,
    reasons: {
      "6C-7H": "Six and seven leave 5-5-J-Q. The crib is yours, so that pair of fives is still working for you either way — but splitting it off the top is still the weaker keep.",
      "JD-QH": "Jack and queen leave 5-5-6-7. The crib is yours, so those court cards can still make points there.",
    },
    hints: [
      "The crib is yours this time, so a card in the crib can help you.",
      "Compare the keep you would have thrown last time.",
      "Keep the connected cards. Splitting your pair of fives is still the weaker throw, even into your own crib.",
    ],
  },
}

export const PEG_SCENARIOS: Readonly<Record<string, PegScenario>> = {
  "peg-legal": {
    id: "peg-legal",
    concepts: ["peg-legal"],
    sequence: [["diamonds", 9], ["clubs", 8], ["spades", 9]],
    hand: [["hearts", 2], ["spades", 5], ["clubs", 13], ["diamonds", 7]],
    opponentScript: [],
    prompt: "The count is 26. Which of these can you play without going over 31?",
    task: { kind: "select-legal" },
    hints: H.peg,
  },
  "peg-scoring": {
    id: "peg-scoring",
    concepts: ["peg-fifteen-31", "peg-pair-run"],
    sequence: [["hearts", 10]],
    hand: [["clubs", 5], ["diamonds", 3], ["spades", 9], ["hearts", 13]],
    opponentScript: [],
    prompt: "Which one scores right now?",
    task: { kind: "select-scoring" },
    hints: [
      "One card makes 15 with the ten already played.",
      "A five plus a ten-value card is 15.",
      "Play the five of clubs. That makes 15, so it scores 2.",
    ],
  },
  "peg-go": {
    id: "peg-go",
    concepts: ["peg-go-last-card"],
    sequence: [["hearts", 8]],
    hand: [["clubs", 7], ["spades", 9]],
    opponentScript: [["diamonds", 6], ["clubs", 10]],
    prompt: "Play through this short sequence. Watch for a go, a reset, and the last-card point.",
    task: { kind: "play-sequence" },
    hints: [
      "If nobody can play without passing 31, the count resets and the last card scores 1.",
      "After 8-7-6 the count is 21. A nine makes 30.",
      "Play the seven, then the nine. When nobody can go further, the last card scores 1.",
    ],
  },
}

export const ROUND_SCRIPTS: Readonly<Record<string, RoundScript>> = {
  "first-round": {
    id: "first-round",
    dealer: "opponent",
    deck: [
      ["spades", 5], ["diamonds", 4],
      ["clubs", 6], ["hearts", 10],
      ["hearts", 7], ["clubs", 9],
      ["diamonds", 11], ["hearts", 1],
      ["hearts", 12], ["clubs", 13],
      ["spades", 2], ["clubs", 3],
      ["diamonds", 8],
    ],
    opponentDiscard: [["hearts", 1], ["clubs", 3]],
    opponentPlays: [["diamonds", 4], ["clubs", 9], ["clubs", 13], ["hearts", 10]],
    checkpoints: [
      { phase: "discard", concepts: ["crib-ownership", "discard-crib-risk"], coach: "They deal, so the crib is theirs. You will lead the play and count first." },
      { phase: "starter", concepts: ["his-heels"], coach: "The starter is not a jack, so nobody scores his heels. Nobs would be a jack in a hand matching this diamond." },
      { phase: "pegging", concepts: ["peg-fifteen-31", "peg-go-last-card"], coach: "You lead. Look for a fifteen, then a go and the last card." },
      // Coach copy is a static string shown regardless of which two cards the
      // learner actually discarded (I1). It is hedged, not asserted, because
      // nobs is only in this hand when the learner kept the jack of diamonds
      // — the starter is a diamond, and any other discard drops nobs entirely.
      { phase: "show", concepts: ["count-order", "nobs"], coach: "You are the non-dealer, so you count first. If you kept the jack of diamonds, this hand includes nobs — it matches the starter's suit." },
      { phase: "crib", concepts: ["crib-ownership"], coach: "The crib is theirs. It is shown, not counted by you." },
    ],
  },
  "second-round": {
    id: "second-round",
    dealer: "player",
    deck: [
      ["clubs", 3], ["clubs", 5],
      ["spades", 4], ["clubs", 6],
      ["diamonds", 9], ["hearts", 7],
      ["clubs", 2], ["diamonds", 11],
      ["spades", 13], ["hearts", 1],
      ["clubs", 8], ["spades", 2],
      ["hearts", 11],
    ],
    opponentDiscard: [["clubs", 3], ["clubs", 2]],
    opponentPlays: [["spades", 4], ["diamonds", 9], ["spades", 13], ["clubs", 8]],
    checkpoints: [
      { phase: "discard", concepts: ["crib-ownership", "discard-keep"], coach: "You deal this round, so the crib is yours — last round it was theirs." },
      { phase: "starter", concepts: ["his-heels"], coach: "You turned a jack. That is his heels (also called his nibs) — 2 to you, the dealer. It is not part of a hand count." },
      { phase: "pegging", concepts: ["peg-fifteen-31"], coach: "They lead. You play second. Look for a 31." },
      { phase: "show", concepts: ["count-order"], coach: "They count first. Then you count your hand, then your crib." },
      { phase: "crib", concepts: ["crib-flush", "crib-ownership"], coach: "The crib is yours. Four of a suit is not a crib flush unless the starter matches." },
    ],
  },
}
