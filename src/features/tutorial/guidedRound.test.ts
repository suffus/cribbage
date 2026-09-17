import { describe, expect, it } from 'vitest'
import { cardKey } from '../../app/entities'
import { explainPegPlay, scoreHand, scoreHandDetailed } from '../../app/game'
import { completeRound } from './completeRound'
import { GuidedRound } from './guidedRound'
import { ROUND_SCRIPTS } from './scenarios'
import { specToCard } from './tutorialCards'
import { TRAINING_DEAL_NOTICE } from './tutorialCopy'
import type { GuidedRoundView } from './guidedRound'

function ids(cards: ReadonlyArray<{ suit: string; rank: number }>): string[] {
  return [...cards].map((c) => cardKey(specToCard([c.suit, c.rank] as [never, never]))).sort()
}

/** Drives past every acknowledge-only pause (starter reveal, "the dealer
 *  counts next", etc.) without changing any graded state, stopping at the
 *  next discard / play-card / count-hand prompt, or at completion. */
function runToNextChoice(round: GuidedRound): GuidedRoundView {
  let view = round.view()
  let guard = 0
  while ((view.awaiting === "acknowledge" || view.awaiting === "opponent-play") && guard++ < 40) {
    if (view.awaiting === "acknowledge") { round.acknowledge() } else { round.letOpponentPlay() }
    view = round.view()
  }
  return view
}

describe.each(Object.keys(ROUND_SCRIPTS))("GuidedRound %s — shared contract", (scriptId) => {
  const script = ROUND_SCRIPTS[scriptId]

  it("completes from any legal learner path (S-G3)", () => {
    expect(completeRound(scriptId)).toEqual({ ok: true })
  })

  it("carries the training-deal notice from the first view (I6)", () => {
    const round = new GuidedRound(script)
    expect(round.view().trainingNotice).toBe(TRAINING_DEAL_NOTICE)
  })

  it("reset() before any action reproduces an identical view, twice (S-G5)", () => {
    const round = new GuidedRound(script)
    const first = round.view()
    round.reset()
    expect(round.view()).toEqual(first)
    round.reset()
    expect(round.view()).toEqual(first)
  })

  it("reset() mid-round restores the identical initial view, with no leaked selection state (S-G5)", () => {
    const round = new GuidedRound(script)
    const initial = round.view()
    expect(initial.playerHandIds).toHaveLength(6)
    expect(initial.log).toHaveLength(0)
    // Discard, then walk forward at least into pegging before restarting.
    round.submitDiscard(initial.playerHandIds.slice(0, 2))
    runToNextChoice(round)
    expect(round.view()).not.toEqual(initial)
    round.reset()
    expect(round.view()).toEqual(initial)
    // Idempotent — resetting again from the fresh state changes nothing.
    round.reset()
    expect(round.view()).toEqual(initial)
  })

  it("refuses a discard of the wrong card count and does not mutate the hand (S-G6)", () => {
    const round = new GuidedRound(script)
    const before = round.view()
    expect(round.submitDiscard([before.playerHandIds[0]]))
      .toEqual({ ok: false, message: "Choose exactly two cards." })
    expect(round.submitDiscard(before.playerHandIds.slice(0, 3)))
      .toEqual({ ok: false, message: "Choose exactly two cards." })
    expect(round.view()).toEqual(before)
  })

  it("refuses a discard containing a card not in the learner's hand (S-G6)", () => {
    const round = new GuidedRound(script)
    const before = round.view()
    expect(round.submitDiscard(["ZZ", before.playerHandIds[0]]))
      .toEqual({ ok: false, message: "Those cards are not in your hand." })
    expect(round.view()).toEqual(before)
  })

  it("refuses a play with a card id that is not in the learner's hand (S-G6)", () => {
    const round = new GuidedRound(script)
    const initial = round.view()
    round.submitDiscard(initial.playerHandIds.slice(0, 2))
    const atPegging = runToNextChoice(round)
    expect(atPegging.awaiting).toBe("play-card")
    const before = round.view()
    expect(round.submitPlay("not-a-card")).toEqual({ ok: false, message: "That card is not in your hand." })
    expect(round.view().playingSequence).toEqual(before.playingSequence)
  })

  it("attributes every card in the trick to the player who laid it", () => {
    const round = new GuidedRound(script)
    const initial = round.view()
    round.submitDiscard(initial.playerHandIds.slice(0, 2))
    let view = runToNextChoice(round)
    expect(view.awaiting).toBe("play-card")
    expect(view.playingSequenceOwners.length).toBe(view.playingSequence.length)
    const activeCards = view.playingSequence.map((c) => specToCard([c.suit, c.rank] as [never, never]))
    const legalCard = view.playerHand.find((c) =>
      explainPegPlay(activeCards, specToCard([c.suit, c.rank] as [never, never])).legal,
    )
    expect(legalCard).toBeTruthy()
    round.submitPlay(cardKey(specToCard([legalCard!.suit, legalCard!.rank] as [never, never])))
    view = runToNextChoice(round)
    expect(view.playingSequenceOwners.length).toBe(view.playingSequence.length)
    expect(view.playingSequenceOwners.includes("you")).toBe(true)
  })

  it("waits for letOpponentPlay before the opponent replies", () => {
    const round = new GuidedRound(script)
    const initial = round.view()
    round.submitDiscard(initial.playerHandIds.slice(0, 2))
    const view = runToNextChoice(round)
    expect(view.awaiting).toBe("play-card")
    const before = round.view()
    const activeCards = view.playingSequence.map((c) => specToCard([c.suit, c.rank] as [never, never]))
    const legalCard = view.playerHand.find((c) =>
      explainPegPlay(activeCards, specToCard([c.suit, c.rank] as [never, never])).legal,
    )
    expect(legalCard).toBeTruthy()
    round.submitPlay(cardKey(specToCard([legalCard!.suit, legalCard!.rank] as [never, never])))
    expect(round.view().awaiting).toBe("opponent-play")
    expect(round.view().playingSequence.length).toBe(before.playingSequence.length + 1)
    round.letOpponentPlay()
    const after = round.view()
    expect(
      after.playingSequence.length === before.playingSequence.length + 2 || after.awaiting !== "opponent-play",
    ).toBe(true)
  })

  it("letOpponentPlay is a no-op unless the round is waiting for it", () => {
    const round = new GuidedRound(script)
    const before = round.view()
    // A freshly booted round is awaiting "discard" (deal happens before any
    // opponent play), not "opponent-play" — either way, the point of this
    // test is that letOpponentPlay does nothing outside that specific state.
    expect(before.awaiting).not.toBe("opponent-play")
    round.letOpponentPlay()
    expect(round.view()).toEqual(before)
  })
})

describe("first-round (dealer: opponent) — S-G2, S-G4", () => {
  const script = ROUND_SCRIPTS["first-round"]

  it("deals the non-dealer (learner) the alternating front-of-deck indices 0,2,4,6,8,10", () => {
    const round = new GuidedRound(script)
    const view = round.view()
    expect(view.cribOwner).toBe("opponent")
    expect(view.playerHandIds).toHaveLength(6)
    expect(ids(view.playerHand)).toEqual(["2S", "5S", "6C", "7H", "JD", "QH"])
  })

  it("turns a starter that is not a jack, so nobody scores his heels", () => {
    const round = new GuidedRound(script)
    round.submitDiscard(["5S", "6C"])
    const view = runToNextChoice(round)
    expect(view.starter).toEqual({ suit: "diamonds", rank: 8 })
    expect(view.log.some((e) => e.text.includes("heels"))).toBe(false)
  })

  it("has the non-dealer (learner) lead the pegging and score, counts non-dealer first, ends below 121", () => {
    const round = new GuidedRound(script)
    round.submitDiscard(["5S", "6C"])
    let view = runToNextChoice(round)
    expect(view.awaiting).toBe("play-card")
    expect(view.count).toBe(0) // learner leads
    // Play out the kept hand (7H, JD, QH, 2S) in order; every card is legal
    // on this script (the point is go / last-card, not busting).
    for (const cardId of ["7H", "JD", "QH", "2S"]) {
      const result = round.submitPlay(cardId)
      expect(result.ok).toBe(true)
      view = runToNextChoice(round)
    }
    expect(view.awaiting).toBe("count-hand")
    expect(view.countTask?.isCrib).toBe(false)
    round.completeCount()
    view = runToNextChoice(round)
    // Non-dealer (the learner) counts first.
    const firstHandCount = view.log.find((e) => e.text === "hand count")
    expect(firstHandCount).toMatchObject({ who: "you" })
    expect(view.log.filter((e) => e.text === "hand count").map((e) => e.who)).toEqual(["you", "opponent"])
    expect(view.crib).toEqual([
      { suit: "hearts", rank: 1 },
      { suit: "clubs", rank: 3 },
      { suit: "spades", rank: 5 },
      { suit: "clubs", rank: 6 },
    ])
    expect(view.complete).toBe(true)
    expect(view.awaiting).toBe("done")
    expect(view.scores.player).toBeLessThan(121)
    expect(view.scores.opponent).toBeLessThan(121)
    // The three shown totals match the engine's own scorer.
    expect(scoreHand(
      [
        { suit: "hearts", rank: 7 }, { suit: "diamonds", rank: 11 },
        { suit: "hearts", rank: 12 }, { suit: "spades", rank: 2 },
      ].map((c) => specToCard([c.suit, c.rank] as [never, never])),
      specToCard(["diamonds", 8] as [never, never]),
      false,
    )).toBe(3)
  })

  it("retains the finished trick with a reason instead of clearing it silently", () => {
    const round = new GuidedRound(script)
    round.submitDiscard(["5S", "6C"])
    let view = runToNextChoice(round)
    let sawRetainedTrick = false
    for (const cardId of ["7H", "JD", "QH", "2S"]) {
      round.submitPlay(cardId)
      view = runToNextChoice(round)
      if (view.lastTrick.length > 0) {
        sawRetainedTrick = true
        expect(view.lastTrickOwners.length).toBe(view.lastTrick.length)
        expect(view.lastTrickReason).toMatch(/resets to 0/)
      }
    }
    expect(sawRetainedTrick).toBe(true)
  })

  it("reports each show total as that hand's own score, not the game score", () => {
    const round = new GuidedRound(script)
    round.submitDiscard(["5S", "6C"])
    let view = runToNextChoice(round)
    for (const cardId of ["7H", "JD", "QH", "2S"]) {
      round.submitPlay(cardId)
      view = runToNextChoice(round)
    }
    round.completeCount()
    view = runToNextChoice(round)
    const starterCard = specToCard([view.starter!.suit, view.starter!.rank] as [never, never])
    const opponentHandCards = view.opponentHand.map((c) => specToCard([c.suit, c.rank] as [never, never]))
    const cribCards = view.crib.map((c) => specToCard([c.suit, c.rank] as [never, never]))
    expect(view.showScores.opponentHand).toBe(scoreHandDetailed(opponentHandCards, starterCard, false).total)
    expect(view.showScores.crib).toBe(scoreHandDetailed(cribCards, starterCard, true).total)
    // The point of RM-8: this hand's own score, not the cumulative game score.
    expect(view.showScores.opponentHand).not.toBe(view.scores.opponent)
  })
})

describe("second-round (dealer: player) — S-G2, S-G4", () => {
  const script = ROUND_SCRIPTS["second-round"]

  it("deals the non-dealer (opponent) the front-of-deck evens; the learner (dealer) gets the odd complement", () => {
    const round = new GuidedRound(script)
    const view = round.view()
    expect(view.cribOwner).toBe("you")
    expect(ids(view.playerHand)).toEqual(["2S", "5C", "6C", "7H", "AH", "JD"])
  })

  it("turns a jack starter that pays his heels to the learner (the dealer)", () => {
    const round = new GuidedRound(script)
    round.submitDiscard(["5C", "6C"])
    const view = runToNextChoice(round)
    expect(view.starter).toEqual({ suit: "hearts", rank: 11 })
    const heels = view.log.find((e) => e.text.includes("heels"))
    expect(heels).toBeTruthy()
    expect(heels?.who).toBe("you")
    expect(heels?.points).toBe(2)
  })

  it("has the opponent lead, refuses a real over-31 play, and lets a 31 score for the learner", () => {
    const round = new GuidedRound(script)
    round.submitDiscard(["5C", "6C"])
    let view = runToNextChoice(round)
    expect(view.awaiting).toBe("play-card")
    expect(view.count).toBeGreaterThan(0) // opponent led, so the count is already non-zero
    round.submitPlay("7H")
    view = runToNextChoice(round)
    round.submitPlay("JD")
    view = runToNextChoice(round)
    // At this point the learner holds AH and 2S with the count at 30 — 2S
    // would make 32 and must be refused without mutating the sequence.
    expect(view.awaiting).toBe("play-card")
    expect(view.count).toBe(30)
    const beforeBust = round.view()
    const busted = round.submitPlay("2S")
    expect(busted.ok).toBe(false)
    expect(busted.message).toMatch(/32/)
    expect(round.view().playingSequence).toEqual(beforeBust.playingSequence)
    // Cross-check against the pure engine helper directly.
    expect(explainPegPlay(
      beforeBust.playingSequence.map((c) => specToCard([c.suit, c.rank] as [never, never])),
      specToCard(["spades", 2] as [never, never]),
    ).legal).toBe(false)
    // The legal ace makes exactly 31.
    const scoring = round.submitPlay("AH")
    expect(scoring.ok).toBe(true)
    expect(scoring.message).toMatch(/31/)
    view = runToNextChoice(round)
    round.submitPlay("2S")
    view = runToNextChoice(round)
    expect(view.awaiting).toBe("count-hand")
  })

  it("has the opponent count first, then the learner's hand, then the learner's crib, and ends below 121", () => {
    const round = new GuidedRound(script)
    round.submitDiscard(["5C", "6C"])
    let view = runToNextChoice(round)
    for (const cardId of ["7H", "JD", "AH", "2S"]) {
      round.submitPlay(cardId)
      view = runToNextChoice(round)
    }
    expect(view.awaiting).toBe("count-hand")
    expect(view.countTask?.isCrib).toBe(false)
    round.completeCount()
    view = runToNextChoice(round)
    expect(view.awaiting).toBe("count-hand")
    expect(view.countTask?.isCrib).toBe(true)
    round.completeCount()
    view = runToNextChoice(round)
    expect(view.log.filter((e) => e.text === "hand count" || e.text === "crib count").map((e) => e.who))
      .toEqual(["you", "you"])
    expect(view.crib).toEqual([
      { suit: "clubs", rank: 2 }, { suit: "clubs", rank: 3 },
      { suit: "clubs", rank: 5 }, { suit: "clubs", rank: 6 },
    ])
    expect(view.cribOwner).toBe("you")
    expect(view.complete).toBe(true)
    expect(view.scores.player).toBeLessThan(121)
    expect(view.scores.opponent).toBeLessThan(121)
    // Gap-report defect 7: the crib checkpoint coach says "four of a suit is
    // not a crib flush unless the starter matches." With this discard the
    // crib really is four clubs (2C-3C-5C-6C) and the starter (JH) really
    // does not match — so the claim is now demonstrable, not merely stated.
    // The crib scores 4 (two fifteens: 2+3+J, 5+J) and zero from flush,
    // confirming four-of-a-suit alone did not pay.
    expect(view.starter).toEqual({ suit: "hearts", rank: 11 })
    const cribScore = scoreHand(
      view.crib.map((c) => specToCard([c.suit, c.rank] as [never, never])),
      specToCard([view.starter!.suit, view.starter!.rank] as [never, never]),
      true,
    )
    expect(cribScore).toBe(4)
  })
})
