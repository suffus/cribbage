import { describe, expect, it } from 'vitest'
import { RoundDemo } from './roundDemo'

describe("RoundDemo", () => {
  it("deals twelve cards one at a time before the crib forms", () => {
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    expect(demo.view().stage).toBe("deal")
    expect(demo.view().playerHand).toHaveLength(0)
    expect(demo.view().opponentHand).toHaveLength(0)

    for (let i = 1; i <= 12; i++) {
      demo.advance()
      const view = demo.view()
      expect(view.playerHand.length + view.opponentHand.length).toBe(i)
      expect(view.stage).toBe("deal")
      expect(view.crib).toHaveLength(0)
    }

    demo.advance()
    expect(demo.view().stage).toBe("discard")
    expect(demo.view().crib).toHaveLength(4)
  })

  it("turns the ten of spades in the first hand and the jack of hearts in the second", () => {
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    // 12 deals + 1 discard beat = 13, then the starter beat.
    for (let i = 0; i < 14; i++) {
      demo.advance()
    }
    expect(demo.view().starter).toEqual({ suit: "spades", rank: 10 })
    expect(demo.view().log.some((e) => /nibs|heels/i.test(e.text))).toBe(false)

    // Drive to the start of hand 2 (through the show and the board recap)
    // and into its starter beat.
    while (demo.view().handNumber === 1) {
      demo.advance()
    }
    for (let i = 0; i < 14; i++) {
      demo.advance()
    }
    expect(demo.view().starter).toEqual({ suit: "hearts", rank: 11 })
    expect(demo.view().log.some((e) => e.who === "you" && e.points === 2)).toBe(true)
  })

  it("shows every pegging card with its owner and holds 31 before the next sequence starts", () => {
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    const asPairs = (arr: ReadonlyArray<{ card: { suit: string; rank: number }; by: string }>) =>
      arr.map((t) => `${t.by} ${t.card.suit[0]}${t.card.rank}`)
    // 12 deals + 1 discard + 1 starter + 6 plays (up to the 31) = 20 beats.
    for (let i = 0; i < 20; i++) {
      demo.advance()
    }
    let view = demo.view()
    // The 31 is still the current sequence — count 31, cards not yet dulled —
    // so the learner sees the score before the reset.
    expect(asPairs(view.trick)).toEqual(["you d6", "opponent h8", "you c7", "opponent s3", "you s5", "opponent c2"])
    expect(view.lastTrick).toEqual([])
    expect(view.count).toBe(31)
    expect(view.coach).toMatch(/scores 2 points/i)
    expect(view.coach).toMatch(/new sequence/i)
    expect(view.coach).toMatch(/reset to 0/i)

    // The next card starts a new sequence: first trick is now previous
    // (dulled), and the count is the four just played.
    demo.advance()
    view = demo.view()
    expect(asPairs(view.lastTrick)).toEqual(["you d6", "opponent h8", "you c7", "opponent s3", "you s5", "opponent c2"])
    expect(view.lastTrickReason).toMatch(/31/)
    expect(asPairs(view.trick)).toEqual(["you h4"])
    expect(view.count).toBe(4)
    expect(view.coach).toMatch(/lead the second sequence/i)
    expect(view.coach).toMatch(/your turn/i)
    expect(view.coach).toMatch(/they played the last card/i)

    // The last play of the hand: keep the sequence and its count, and say
    // that the last card scores 1.
    demo.advance()
    view = demo.view()
    expect(asPairs(view.lastTrick)).toEqual(["you d6", "opponent h8", "you c7", "opponent s3", "you s5", "opponent c2"])
    expect(asPairs(view.trick)).toEqual(["you h4", "opponent d8"])
    expect(view.count).toBe(12)
    expect(view.stage).toBe("pegging")
    expect(view.coach).toMatch(/last card/i)
    expect(view.coach).toMatch(/they score 1 point/i)
    expect(view.coach).toMatch(/count is 12/i)
    expect(view.coach).not.toMatch(/you lead, because you are not the dealer/i)

    // After that count, one more pegging beat introduces the show.
    demo.advance()
    view = demo.view()
    expect(view.stage).toBe("pegging")
    expect(view.count).toBe(12)
    expect(asPairs(view.trick)).toEqual(["you h4", "opponent d8"])
    expect(view.coach).toMatch(/entering the show/i)
    expect(view.coach).toMatch(/hands will now be counted/i)
  })

  it("names a pegging run when it scores, and does not keep the lead advice up", () => {
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    // 12 deals + 1 discard + 1 starter + 1 lead = 15 beats.
    for (let i = 0; i < 15; i++) {
      demo.advance()
    }
    expect(demo.view().coach).toMatch(/you lead/i)
    expect(demo.view().count).toBe(6)

    demo.advance()
    expect(demo.view().count).toBe(14)
    expect(demo.view().coach).toMatch(/count is now 14/i)
    expect(demo.view().coach).not.toMatch(/you lead/i)

    // 6-8-7 is a run of three for the learner.
    demo.advance()
    const view = demo.view()
    expect(view.count).toBe(21)
    expect(view.coach).toMatch(/you scored 3 points for a run/i)
    expect(view.coach).toMatch(/consecutive/i)
    expect(view.coach).not.toMatch(/you lead/i)
  })

  it("reveals all three hands' cards together at the count, but their totals one at a time", () => {
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    // 12 deals + 1 discard + 1 starter + 8 plays + 1 show-intro = 23, then the show.
    for (let i = 0; i < 23; i++) {
      demo.advance()
    }
    demo.advance()
    let view = demo.view()
    // R5: the coach introduces the count as its own phase.
    expect(view.coach).toMatch(/the count/i)
    expect(view.coach).toMatch(/next phase of cribbage/i)
    // All three hands are visible immediately...
    expect(view.show.nonDealer?.hand.length).toBe(4)
    expect(view.show.dealer?.hand.length).toBe(4)
    expect(view.show.crib?.hand.length).toBe(4)
    // ...but only the one just counted discloses its total.
    expect(view.show.nonDealer?.total).toBe(8)
    expect(view.show.nonDealer?.title).toBe("Your hand")
    expect(view.show.nonDealer?.revealed).toBe(true)
    expect(view.show.dealer?.revealed).toBe(false)
    expect(view.show.crib?.revealed).toBe(false)

    demo.advance()
    view = demo.view()
    expect(view.show.dealer?.total).toBe(4)
    expect(view.show.dealer?.title).toBe("Their hand")
    expect(view.show.dealer?.revealed).toBe(true)
    expect(view.show.crib?.revealed).toBe(false)

    demo.advance()
    view = demo.view()
    expect(view.show.crib?.total).toBe(5)
    expect(view.show.crib?.title).toBe("Their crib")
    expect(view.show.crib?.revealed).toBe(true)

    // Advance into hand 2 (through the board recap) and drive to its three show beats.
    demo.advance()
    while (demo.view().stage !== "show") {
      demo.advance()
    }
    expect(demo.view().show.nonDealer?.total).toBe(8)
    expect(demo.view().show.nonDealer?.title).toBe("Their hand")
    demo.advance()
    expect(demo.view().show.dealer?.total).toBe(14)
    expect(demo.view().show.dealer?.title).toBe("Your hand")
    demo.advance()
    expect(demo.view().show.crib?.total).toBe(8)
    expect(demo.view().show.crib?.title).toBe("Your crib")
  })

  it("pauses on a board recap between hands explaining the two pegs, then moves into hand 2", () => {
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    let guard = 0
    while (demo.view().stage !== "board" && guard++ < 200) {
      demo.advance()
    }
    const view = demo.view()
    expect(view.handNumber).toBe(1)
    expect(view.atEnd).toBe(false)
    // R6/R7: explains the two-peg, leapfrogging mechanic.
    expect(view.coach).toMatch(/two pegs/i)
    expect(view.coach).toMatch(/leapfrog/i)

    demo.advance()
    expect(demo.view().stage).toBe("deal")
    expect(demo.view().handNumber).toBe(2)
  })

  it("pauses on a second board recap after hand 2, then finishes", () => {
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    let guard = 0
    while (demo.view().stage !== "board" && guard++ < 200) {
      demo.advance()
    }
    demo.advance() // past the first recap and into hand 2
    guard = 0
    while (demo.view().stage !== "board" && guard++ < 200) {
      demo.advance()
    }
    expect(demo.view().handNumber).toBe(2)
    expect(demo.view().atEnd).toBe(false)

    demo.advance()
    expect(demo.view().stage).toBe("done")
    expect(demo.view().atEnd).toBe(true)
  })

  it("reaches a finished state whose cumulative score is you 36, them 25", () => {
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    let guard = 0
    while (!demo.view().atEnd && guard++ < 200) {
      demo.advance()
    }
    expect(demo.view().stage).toBe("done")
    expect(demo.view().handNumber).toBe(2)
    expect(demo.view().scores).toEqual({ player: 36, opponent: 25 })
  })

  it("back replays to the previous beat and reset returns to the start", () => {
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    for (let i = 0; i < 5; i++) {
      demo.advance()
    }
    const captured = demo.view()
    demo.advance()
    demo.back()
    expect(demo.view()).toEqual(captured)

    demo.reset()
    expect(demo.view().beatIndex).toBe(0)
    expect(demo.view().atStart).toBe(true)
    expect(demo.view().playerHand).toHaveLength(0)
    expect(demo.view().opponentHand).toHaveLength(0)
  })

  it("throws when a script id is missing or has no scripted learner seat", () => {
    expect(() => new RoundDemo(["first-round", "second-round"])).toThrow()
    expect(() => new RoundDemo(["nope", "demo-hand-2"])).toThrow()
  })
})
