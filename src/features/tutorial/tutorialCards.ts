import { Card, cardKey } from '../../app/entities'
import type { CardSpec } from './tutorialTypes'

export function specToCard(spec: CardSpec): Card {
  return new Card(spec[0], spec[1])
}

export function specsToCards(specs: ReadonlyArray<CardSpec>): Card[] {
  return specs.map(specToCard)
}

export function discardPairKey(a: string, b: string): string {
  return [a, b].sort((x, y) => x.localeCompare(y)).join("-")
}

export function cardKeysOf(specs: ReadonlyArray<CardSpec>): string[] {
  return specs.map((spec) => cardKey(specToCard(spec)))
}
