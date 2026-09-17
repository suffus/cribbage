import { describe, expect, it } from 'vitest'
import { cardKey } from '../../app/entities'
import { DISCARD_SCENARIOS, PEG_SCENARIOS, SCORE_SCENARIOS } from './scenarios'
import { specToCard } from './tutorialCards'
import type { ScoreScenario } from './tutorialTypes'
import {
  categoryProgress,
  gradeDiscard,
  gradePegChoice,
  gradeScoreSelection,
  hintFor,
  initPegSequence,
  learnerGo,
  learnerLegalCardIds,
  opponentTurn,
  playLearnerCard,
} from './tutorialGrading'
import gradingSource from './tutorialGrading.ts?raw'

describe("tutorialGrading", () => {
  it("credits an exact fifteen and rejects a leftover card", () => {
    const scenario = SCORE_SCENARIOS["fifteen-worked"]
    const five = cardKey(specToCard(["hearts", 5]))
    const king = cardKey(specToCard(["diamonds", 13]))
    const two = cardKey(specToCard(["spades", 2]))
    const hit = gradeScoreSelection(scenario, [five, king], [])
    expect(hit.credited).toBe(true)
    expect(hit.matched[0]?.points).toBe(2)
    const miss = gradeScoreSelection(scenario, [five, two], [])
    expect(miss.credited).toBe(false)
  })

  it("explains a repeat of an already-found combination plainly instead of the generic 'may already be counted' hedge", () => {
    const scenario = SCORE_SCENARIOS["fifteen-worked"]
    const five = cardKey(specToCard(["hearts", 5]))
    const king = cardKey(specToCard(["diamonds", 13]))
    const first = gradeScoreSelection(scenario, [five, king], [])
    expect(first.credited).toBe(true)
    const found = first.matched.map((g) => g.id)
    // Selecting the identical pair again is not a scoring mistake — one
    // card can be part of more than one combination — so it should not be
    // graded like a wrong guess.
    const again = gradeScoreSelection(scenario, [five, king], found)
    expect(again.credited).toBe(false)
    expect(again.message).toMatch(/already counted/i)
    expect(again.message).not.toMatch(/may already be counted/i)
  })

  it("names the missing card instead of a generic hedge when a run is one card short of a longer run (guided-round 5-6-7-8)", () => {
    // scoreHandDetailed never emits both a run of three and the run of four
    // that contains it (that would double-count) — 5-6-7 is only ever a
    // fragment of the required 5-6-7-8 group here, never a group on its own.
    const scenario: ScoreScenario = {
      id: "guided-count",
      concepts: ["runs"],
      hand: [["spades", 5], ["clubs", 6], ["hearts", 7], ["spades", 2]],
      starter: ["diamonds", 8],
      isCrib: false,
      prompt: "",
      hints: ["", "", ""],
    }
    const five = cardKey(specToCard(["spades", 5]))
    const six = cardKey(specToCard(["clubs", 6]))
    const seven = cardKey(specToCard(["hearts", 7]))
    const eight = cardKey(specToCard(["diamonds", 8]))
    const partial = gradeScoreSelection(scenario, [five, six, seven], [])
    expect(partial.credited).toBe(false)
    expect(partial.message).toMatch(/add eight of diamonds to complete it/i)
    expect(partial.message).not.toMatch(/may already be counted/i)
    // Selecting all four (including the starter) credits the run of four.
    const whole = gradeScoreSelection(scenario, [five, six, seven, eight], [])
    expect(whole.credited).toBe(true)
    expect(whole.matched[0]?.points).toBe(4)
  })

  it("accepts a top-N discard and rejects a worse throw", () => {
    const scenario = DISCARD_SCENARIOS["discard-theirs"]
    const bestKey = Object.keys(scenario.reasons)[0]
    const accepted = gradeDiscard(scenario, bestKey.split("-"))
    expect(accepted.accepted).toBe(true)
    expect(accepted.plain.length).toBeGreaterThan(0)
    const five = cardKey(specToCard(["spades", 5]))
    const jack = cardKey(specToCard(["diamonds", 11]))
    const poor = gradeDiscard(scenario, [five, jack])
    expect(poor.accepted).toBe(false)
  })

  it("grades legal vs scoring peg choices without ranking plays", () => {
    expect(gradingSource).not.toMatch(/rankPlays/)
    const legal = PEG_SCENARIOS["peg-legal"]
    const two = cardKey(specToCard(["hearts", 2]))
    const king = cardKey(specToCard(["clubs", 13]))
    const seq = legal.sequence.map(([suit, rank]) => ({ suit, rank }))
    expect(gradePegChoice(legal, seq, two).legal).toBe(true)
    expect(gradePegChoice(legal, seq, king).legal).toBe(false)
    const scoring = PEG_SCENARIOS["peg-scoring"]
    const five = cardKey(specToCard(["clubs", 5]))
    const three = cardKey(specToCard(["diamonds", 3]))
    const scoringSeq = scoring.sequence.map(([suit, rank]) => ({ suit, rank }))
    expect(gradePegChoice(scoring, scoringSeq, five).accepted).toBe(true)
    expect(gradePegChoice(scoring, scoringSeq, three).accepted).toBe(false)
  })

  it("reports per-category progress for a score scenario", () => {
    const scenario = SCORE_SCENARIOS["pair-find"]
    const emptyProgress = categoryProgress(scenario, [])
    expect(emptyProgress.pair).toEqual({ found: 0, total: 2 })
    expect(emptyProgress.fifteen).toBeUndefined()
    const two = cardKey(specToCard(["hearts", 2]))
    const twoC = cardKey(specToCard(["clubs", 2]))
    const firstPair = gradeScoreSelection(scenario, [two, twoC], [])
    expect(firstPair.credited).toBe(true)
    const halfProgress = categoryProgress(scenario, firstPair.matched.map((g) => g.id))
    expect(halfProgress.pair).toEqual({ found: 1, total: 2 })
  })

  it("plays the peg-go scripted exchange through fifteen, a growing run, and a go that resets and scores the last card (T7)", () => {
    const scenario = PEG_SCENARIOS["peg-go"]
    let state = initPegSequence(scenario)
    expect(state.count).toBe(8) // the pre-played 8H
    expect(state.turn).toBe("learner")
    expect([...learnerLegalCardIds(scenario, state)].sort()).toEqual(["7C", "9S"])

    // Learner plays 7C: 8+7=15, scores 2. The opponent does not reply until
    // the learner explicitly lets them (RM-4 item 2).
    const afterSeven = playLearnerCard(scenario, state, "7C")
    expect(afterSeven.ok).toBe(true)
    state = afterSeven.state
    expect(state.count).toBe(15)
    expect(state.turn).toBe("opponent")
    expect(state.events.map((e) => e.points)).toEqual([2])

    // The opponent's scripted 6D plays next (8,7,6 is a run of three).
    state = opponentTurn(state)
    expect(state.count).toBe(21)
    expect(state.turn).toBe("learner")
    expect(state.events.map((e) => e.points)).toEqual([2, 3])

    // Learner plays 9S: 21+9=30. That extends 8-7-6-9 into a run of four (4).
    const afterNine = playLearnerCard(scenario, state, "9S")
    expect(afterNine.ok).toBe(true)
    state = afterNine.state
    expect(state.count).toBe(30)
    expect(state.turn).toBe("opponent")
    expect(state.events.map((e) => e.points)).toEqual([2, 3, 4])

    // The opponent's remaining scripted 10C would make 40 — illegal — so the
    // opponent goes and hands the turn back to the learner.
    state = opponentTurn(state)
    expect(state.turn).toBe("learner")
    expect(state.done).toBe(false)
    expect(learnerLegalCardIds(scenario, state)).toHaveLength(0) // hand is empty

    // The learner also has nothing left to play, so they say go too — two
    // consecutive goes resets the count and awards the last card (the
    // learner's 9S) 1 point.
    state = learnerGo(state)
    expect(state.done).toBe(true)
    expect(state.count).toBe(0)
    expect(state.active).toHaveLength(0)
    expect(state.events.map((e) => e.points)).toEqual([2, 3, 4, 0, 0, 1])
    expect(state.events[state.events.length - 1]?.message).toMatch(/go/i)
    expect(state.earned).toBe(2 + 3 + 4 + 1)
    expect(state.earned).toBe(10)
    expect(state.pegPoints.learner[0]).toBe(7)
    expect(state.pegPoints.opponent[0]).toBe(3)
    expect(state.lastActive).toHaveLength(4)
    expect(state.lastTrickReason).toMatch(/resets to 0/)
  })

  it("opponentTurn is a no-op when it is not the opponent's turn", () => {
    const scenario = PEG_SCENARIOS["peg-go"]
    const state = initPegSequence(scenario)
    expect(opponentTurn(state)).toEqual(state)
  })

  it("rejects an out-of-turn or illegal learner card without mutating state (S-G6-equivalent for play-sequence)", () => {
    const scenario = PEG_SCENARIOS["peg-go"]
    const state = initPegSequence(scenario)
    const notInHand = playLearnerCard(scenario, state, "ZZ")
    expect(notInHand).toEqual({ state, ok: false, message: "That card is not in your hand." })
  })

  it("lets the learner explicitly say go when they hold no legal card", () => {
    const scenario = PEG_SCENARIOS["peg-go"]
    let state = initPegSequence(scenario)
    state = playLearnerCard(scenario, state, "7C").state
    state = opponentTurn(state)
    state = playLearnerCard(scenario, state, "9S").state
    state = opponentTurn(state)
    state = learnerGo(state)
    expect(state.done).toBe(true)
    // Nothing left to say go about — but a mid-hand go (turn !== "learner"
    // or already done) must be a no-op rather than throwing.
    expect(learnerGo(state)).toEqual(state)
  })

  it("returns authored hint text and highlights a card at tier 2", () => {
    const step = { kind: "score-practice" as const, id: "x", scenarioId: "pair-find", hintPolicy: "on-request" as const }
    const h1 = hintFor(step, 1, { found: [], subIndex: 0 })
    expect(h1.text).toMatch(/pairs/i)
    expect(h1.highlightCardIds).toHaveLength(0)
    const h2 = hintFor(step, 2, { found: [], subIndex: 0 })
    expect(h2.highlightCardIds.length).toBe(1)
    const h3 = hintFor(step, 3, { found: [], subIndex: 0 })
    expect(h3.highlightCardIds.length).toBeGreaterThan(1)
  })
})
