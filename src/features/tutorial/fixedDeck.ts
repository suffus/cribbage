import { Card, StdDeck } from '../../app/entities'
import type { Deck } from '../../app/entities'
import { specToCard } from './tutorialCards'
import type { CardSpec } from './tutorialTypes'

/**
 * StdDeck.dealOne pops from the back. FixedDeck.dealOne shifts from the front
 * so scripts can be authored in engine deal order (D12).
 */
export class FixedDeck implements Deck {
  private remaining: Card[] = []
  private readonly script: ReadonlyArray<CardSpec>
  private readonly art: StdDeck

  constructor(script: ReadonlyArray<CardSpec>, deckCode: string = "rc") {
    this.script = script
    this.art = new StdDeck(deckCode)
    this.reset()
  }

  getFaceImageUri(card: Card): string {
    return this.art.getFaceImageUri(card)
  }

  getBackImageUri(): string {
    return this.art.getBackImageUri()
  }

  /** Restores the scripted order. A real shuffle would destroy determinism. */
  shuffle(): Deck {
    this.rebuild()
    return this
  }

  reset(): Deck {
    this.rebuild()
    return this
  }

  /** Front of the list — opposite of StdDeck.dealOne's pop(). */
  dealOne(): Card | undefined {
    return this.remaining.shift()
  }

  dealMany(count: number): Array<Card> | undefined {
    const cards: Card[] = []
    for (let i = 0; i < count; i++) {
      const card = this.dealOne()
      if (!card) {
        return undefined
      }
      cards.push(card)
    }
    return cards
  }

  cutOnce(_place: number): void {
    return
  }

  getRemainingDeck(): Array<Card> {
    return this.remaining
  }

  removeCard(c: Card): Deck {
    this.remaining = this.remaining.filter((card) => card.suit !== c.suit || card.rank !== c.rank)
    return this
  }

  dealRandomCard(): Card | undefined {
    return this.dealOne()
  }

  private rebuild(): void {
    this.remaining = this.script.map((spec) => specToCard(spec))
  }
}
