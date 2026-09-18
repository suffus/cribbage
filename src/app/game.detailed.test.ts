import { describe, expect, it } from 'vitest'
import { Card } from './entities'
import type { Rank, Suit } from './entities'
import {
  GameAction,
  categoryFor,
  explainPegPlay,
  scoreHand,
  scoreHandDetailed,
} from './game'
import type { ScoringCategory, ScoringGroup } from './game'
import { SCORE_REASON_COPY, scoreNotice } from './scoreCopy'

const SUITS: Suit[] = ["hearts", "diamonds", "spades", "clubs"]
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as Rank[]

function C(suit: Suit, rank: Rank): Card {
  return new Card(suit, rank)
}

function snapshotCards(cards: ReadonlyArray<Card>): Array<{ suit: Suit; rank: Rank; selected: boolean; isFaceUp: boolean }> {
  return cards.map((c) => ({ suit: c.suit, rank: c.rank, selected: c.selected, isFaceUp: c.isFaceUp }))
}

function combinationsWithRep(n: number, k: number): number[][] {
  const result: number[][] = []
  const acc: number[] = []
  function rec(start: number) {
    if (acc.length === k) {
      result.push([...acc])
      return
    }
    for (let i = start; i <= n; i++) {
      acc.push(i)
      rec(i)
      acc.pop()
    }
  }
  rec(1)
  return result
}

function colorize(ranks: ReadonlyArray<number>, pattern: "all-same" | "three-same" | "two-two" | "all-different"): Card[] {
  const suitFor = (i: number): Suit => {
    if (pattern === "all-same") {
      return "hearts"
    }
    if (pattern === "three-same") {
      return i < 3 ? "hearts" : "diamonds"
    }
    if (pattern === "two-two") {
      return i < 2 ? "hearts" : i < 4 ? "diamonds" : "clubs"
    }
    return SUITS[i % 4]
  }
  return ranks.map((r, i) => new Card(suitFor(i), r as Rank))
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dealDistinct(n: number, rng: () => number): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(new Card(suit, rank))
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = deck[i]
    deck[i] = deck[j]
    deck[j] = tmp
  }
  return deck.slice(0, n)
}

function runPoints(groups: ReadonlyArray<ScoringGroup>): number {
  return groups.filter((g) => g.category === "run").reduce((s, g) => s + g.points, 0)
}

describe("S-E2 scoreHand purity", () => {
  it("does not reorder or mutate the argument, with and without a starter", () => {
    const hand = [C("spades", 8), C("hearts", 2), C("clubs", 13), C("diamonds", 5)]
    const starter = C("hearts", 11)
    const beforeHand = snapshotCards(hand)
    const beforeStarter = snapshotCards([starter])
    scoreHand(hand, undefined, false)
    scoreHand(hand, starter, false)
    scoreHandDetailed(hand, undefined, false)
    scoreHandDetailed(hand, starter, true)
    expect(snapshotCards(hand)).toEqual(beforeHand)
    expect(snapshotCards([starter])).toEqual(beforeStarter)
  })
})

describe("S-E3 equivalence", () => {
  it("scoreHandDetailed.total === scoreHand over rank multisets and a random sweep", () => {
    const multisets = combinationsWithRep(13, 5)
    expect(multisets.length).toBe(6188)
    const patterns = ["all-same", "three-same", "two-two", "all-different"] as const
    for (const ranks of multisets) {
      for (const pattern of patterns) {
        const hand5 = colorize(ranks, pattern)
        const four = hand5.slice(0, 4)
        const starter = hand5[4]
        for (const isCrib of [false, true]) {
          expect(scoreHandDetailed(four, starter, isCrib).total).toBe(scoreHand(four, starter, isCrib))
          expect(scoreHandDetailed(hand5, undefined, isCrib).total).toBe(scoreHand(hand5, undefined, isCrib))
        }
      }
    }

    const rng = mulberry32(20260914)
    for (let i = 0; i < 50000; i++) {
      const dealt = dealDistinct(5, rng)
      const hand = dealt.slice(0, 4)
      const starter = dealt[4]
      const isCrib = i % 2 === 0
      expect(scoreHandDetailed(hand, starter, isCrib).total).toBe(scoreHand(hand, starter, isCrib))
    }
  })
})

describe("S-E4 run-group sums", () => {
  it("equals the legacy 3/6/9/12 and 4/8/5 cases", () => {
    // run of 3
    expect(runPoints(scoreHandDetailed(
      [C("hearts", 4), C("clubs", 5), C("diamonds", 6), C("spades", 13)],
      C("clubs", 2),
      false,
    ).groups)).toBe(3)
    // double run of 3 → 6
    expect(runPoints(scoreHandDetailed(
      [C("hearts", 4), C("clubs", 5), C("diamonds", 5), C("spades", 6)],
      C("clubs", 2),
      false,
    ).groups)).toBe(6)
    // triple run of 3 → 9
    expect(runPoints(scoreHandDetailed(
      [C("hearts", 4), C("clubs", 5), C("diamonds", 5), C("spades", 5)],
      C("hearts", 6),
      false,
    ).groups)).toBe(9)
    // double-double run of 3 → 12
    expect(runPoints(scoreHandDetailed(
      [C("hearts", 4), C("clubs", 4), C("diamonds", 5), C("spades", 5)],
      C("hearts", 6),
      false,
    ).groups)).toBe(12)
    // run of 4
    expect(runPoints(scoreHandDetailed(
      [C("hearts", 4), C("clubs", 5), C("diamonds", 6), C("spades", 7)],
      C("clubs", 2),
      false,
    ).groups)).toBe(4)
    // double run of 4 → 8
    expect(runPoints(scoreHandDetailed(
      [C("hearts", 4), C("clubs", 5), C("diamonds", 5), C("spades", 6)],
      C("hearts", 7),
      false,
    ).groups)).toBe(8)
    // run of 5
    expect(runPoints(scoreHandDetailed(
      [C("hearts", 4), C("clubs", 5), C("diamonds", 6), C("spades", 7)],
      C("hearts", 8),
      false,
    ).groups)).toBe(5)
  })
})

describe("S-E5 named fixtures", () => {
  it("scores the 29-hand: four fives + nobs", () => {
    const result = scoreHandDetailed(
      [C("hearts", 5), C("clubs", 5), C("diamonds", 5), C("spades", 11)],
      C("spades", 5),
      false,
    )
    expect(result.total).toBe(29)
    expect(result.groups.filter((g) => g.category === "fifteen")).toHaveLength(8)
    expect(result.groups.filter((g) => g.category === "pair")).toHaveLength(6)
    expect(result.groups.filter((g) => g.category === "nobs")).toHaveLength(1)
    expect(result.groups).toHaveLength(15)
  })

  it("credits a card that belongs to two fifteens", () => {
    const result = scoreHandDetailed(
      [C("hearts", 5), C("diamonds", 10), C("spades", 13), C("clubs", 2)],
      C("clubs", 3),
      false,
    )
    const fifteens = result.groups.filter((g) => g.category === "fifteen")
    expect(fifteens.length).toBeGreaterThanOrEqual(2)
    const fiveCount = fifteens.filter((g) => g.cardIds.includes("5H")).length
    expect(fiveCount).toBe(2)
  })

  it("enumerates a double run and a double-double run", () => {
    const double = scoreHandDetailed(
      [C("hearts", 4), C("clubs", 5), C("diamonds", 5), C("spades", 6)],
      C("clubs", 13),
      false,
    )
    expect(double.groups.filter((g) => g.category === "run")).toHaveLength(2)
    const doubleDouble = scoreHandDetailed(
      [C("hearts", 4), C("clubs", 4), C("diamonds", 5), C("spades", 5)],
      C("hearts", 6),
      false,
    )
    expect(doubleDouble.groups.filter((g) => g.category === "run")).toHaveLength(4)
  })

  it("caps a four-card hand flush and treats the same four as a crib", () => {
    const fourHearts = [C("hearts", 1), C("hearts", 4), C("hearts", 7), C("hearts", 13)]
    const off = C("clubs", 2)
    const on = C("hearts", 2)
    const handOff = scoreHandDetailed(fourHearts, off, false)
    expect(handOff.groups.filter((g) => g.category === "flush")).toHaveLength(1)
    expect(handOff.groups.find((g) => g.category === "flush")?.points).toBe(4)
    expect(scoreHandDetailed(fourHearts, off, true).groups.filter((g) => g.category === "flush")).toHaveLength(0)
    expect(scoreHandDetailed(fourHearts, on, true).groups.find((g) => g.category === "flush")?.points).toBe(5)
  })

  it("emits nobs only when the jack matches the starter suit", () => {
    const hand = [C("spades", 11), C("hearts", 2), C("diamonds", 3), C("clubs", 8)]
    expect(scoreHandDetailed(hand, C("spades", 5), false).groups.some((g) => g.category === "nobs")).toBe(true)
    expect(scoreHandDetailed(hand, C("hearts", 5), false).groups.some((g) => g.category === "nobs")).toBe(false)
  })
})

describe("S-E6 group ids and order", () => {
  it("ids are unique and order is deterministic", () => {
    const hand = [C("hearts", 5), C("clubs", 5), C("diamonds", 10), C("spades", 6)]
    const starter = C("clubs", 4)
    const a = scoreHandDetailed(hand, starter, false)
    const b = scoreHandDetailed(hand, starter, false)
    const ids = a.groups.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(b.groups.map((g) => g.id)).toEqual(ids)
    const cats = a.groups.map((g) => g.category)
    const order: ScoringCategory[] = ["fifteen", "pair", "run", "flush", "nobs"]
    let last = -1
    for (const cat of cats) {
      const idx = order.indexOf(cat)
      expect(idx).toBeGreaterThanOrEqual(last)
      last = idx
    }
  })
})

describe("S-E7 empty hand", () => {
  it("returns total 0 and does not throw", () => {
    const result = scoreHandDetailed([], undefined, false)
    expect(result).toEqual({ total: 0, groups: [], isCrib: false, starterIncluded: false })
    expect(scoreHand([], undefined, false)).toBe(0)
  })
})

describe("S-E8 explainPegPlay", () => {
  it("scores 15, 31, pairs, runs, and illegal plays", () => {
    const fifteen = explainPegPlay([C("hearts", 5)], C("spades", 10))
    expect(fifteen.legal).toBe(true)
    expect(fifteen.newCount).toBe(15)
    expect(fifteen.events.map((e) => e.category)).toEqual(["fifteen"])
    expect(fifteen.total).toBe(2)

    const thirtyOne = explainPegPlay([C("hearts", 10), C("spades", 10), C("clubs", 6)], C("diamonds", 5))
    expect(thirtyOne.newCount).toBe(31)
    expect(thirtyOne.events.map((e) => e.category)).toEqual(["thirty-one"])

    const pair = explainPegPlay([C("hearts", 7)], C("spades", 7))
    expect(pair.events[0]).toMatchObject({ category: "pair", points: 2 })
    const triple = explainPegPlay([C("hearts", 7), C("spades", 7)], C("clubs", 7))
    expect(triple.events.find((e) => e.category === "pair")?.points).toBe(6)
    const quad = explainPegPlay(
      [C("hearts", 7), C("spades", 7), C("clubs", 7)],
      C("diamonds", 7),
    )
    expect(quad.events.find((e) => e.category === "pair")?.points).toBe(12)

    const inOrder = explainPegPlay([C("hearts", 4), C("spades", 5)], C("clubs", 6))
    expect(inOrder.events.find((e) => e.category === "run")?.points).toBe(3)
    const outOfOrder = explainPegPlay([C("hearts", 5), C("spades", 3)], C("clubs", 4))
    const run = outOfOrder.events.find((e) => e.category === "run")
    expect(run?.points).toBe(3)
    expect(run?.cardIds).toEqual(["5H", "3S", "4C"])
    expect(run?.label).toMatch(/5-3-4/)

    const illegal = explainPegPlay([C("hearts", 10), C("spades", 10), C("clubs", 10)], C("diamonds", 4))
    expect(illegal.legal).toBe(false)
    expect(illegal.newCount).toBe(34)
    expect(illegal.events).toEqual([])
    expect(illegal.total).toBe(0)

    const both = explainPegPlay([C("hearts", 5), C("spades", 5)], C("clubs", 5))
    expect(both.events.map((e) => e.category)).toEqual(["fifteen", "pair"])
  })
})

describe("S-E10 score copy covers categoryFor reasons", () => {
  it("has an entry for every reason categoryFor recognises", () => {
    const reasons = [
      "15", "31", "run", "pair", "the-last-card",
      "his-nibs", "show-non-dealer", "show-dealer", "show-crib",
    ]
    for (const reason of reasons) {
      const action = new GameAction("score")
      action.reason = reason
      if (reason === "his-nibs") {
        action.source = "start"
      } else if (reason === "show-crib") {
        action.source = "show-crib"
      } else if (reason === "show-dealer" || reason === "show-non-dealer") {
        action.source = "show-hand"
      } else {
        action.source = "play"
      }
      expect(categoryFor(action)).not.toBeNull()
      expect(SCORE_REASON_COPY[reason]).toBeTruthy()
    }
    expect(SCORE_REASON_COPY["his-nibs"]).toMatch(/his heels \(also called his nibs\)/)
  })

  it("formats a score notice for the play toast", () => {
    expect(scoreNotice("player", 2, "15")).toBe("You scored 2 for fifteen — 2")
    expect(scoreNotice("opponent", 1, "the-last-card")).toBe("Your opponent scored 1 for the last card — 1")
  })
})
