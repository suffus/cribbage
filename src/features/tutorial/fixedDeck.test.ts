import { describe, expect, it } from 'vitest'
import { cardKey } from '../../app/entities'
import { FixedDeck } from './fixedDeck'
import { ROUND_SCRIPTS } from './scenarios'
import { specToCard } from './tutorialCards'

const SCRIPT = ROUND_SCRIPTS["first-round"].deck

describe("FixedDeck", () => {
  it("deals from the front in script order and shuffle restores that order", () => {
    const deck = new FixedDeck(SCRIPT)
    const first = deck.dealOne()
    expect(first && cardKey(first)).toBe(cardKey(specToCard(SCRIPT[0])))
    deck.shuffle()
    const again = deck.dealOne()
    expect(again && cardKey(again)).toBe(cardKey(specToCard(SCRIPT[0])))
    expect(again).not.toBe(first)
  })

  it("reset restores all 13 as new Card instances", () => {
    const deck = new FixedDeck(SCRIPT)
    const dealt = deck.dealMany(4) ?? []
    deck.reset()
    const restored = deck.getRemainingDeck()
    expect(restored).toHaveLength(13)
    expect(restored[0]).not.toBe(dealt[0])
    expect(cardKey(restored[0])).toBe(cardKey(specToCard(SCRIPT[0])))
  })

  it("removeCard matches suit and rank", () => {
    const deck = new FixedDeck(SCRIPT)
    const target = specToCard(SCRIPT[3])
    deck.removeCard(target)
    expect(deck.getRemainingDeck()).toHaveLength(12)
    expect(deck.getRemainingDeck().some((c) => cardKey(c) === cardKey(target))).toBe(false)
  })
})
