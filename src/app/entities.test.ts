import { describe, expect, it } from 'vitest'
import { Card, RANK_NAMES, SUIT_NAMES, cardKey, cardName, rank_map, suit_map } from './entities'
import type { Rank, Suit } from './entities'

const SUITS: Suit[] = ["hearts", "diamonds", "spades", "clubs"]
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as Rank[]

describe("S-E1 card identity helpers", () => {
  it("cardKey is unique across all 52 real cards and matches the art filename form", () => {
    const keys = new Set<string>()
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const key = cardKey(new Card(suit, rank))
        expect(key).toBe(`${rank_map[rank]}${suit_map[suit]}`)
        expect(keys.has(key)).toBe(false)
        keys.add(key)
      }
    }
    expect(keys.size).toBe(52)
    expect(cardKey(new Card("hearts", 1))).toBe("AH")
    expect(cardKey(new Card("diamonds", 10))).toBe("10D")
    expect(cardKey(new Card("spades", 11))).toBe("JS")
  })

  it("cardName is lower-case rank of suit", () => {
    expect(cardName(new Card("hearts", 5))).toBe("five of hearts")
    expect(cardName(new Card("clubs", 1))).toBe("ace of clubs")
    expect(cardName(new Card("diamonds", 13))).toBe("king of diamonds")
  })

  it("RANK_NAMES and SUIT_NAMES cover the declared unions", () => {
    for (const rank of RANKS) {
      expect(RANK_NAMES[rank]).toBeTruthy()
    }
    for (const suit of [...SUITS, "joker"] as Suit[]) {
      expect(SUIT_NAMES[suit]).toBe(suit)
    }
  })
})
