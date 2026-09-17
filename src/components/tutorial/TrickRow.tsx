import { Card, StdDeck, cardKey, cardName, rank_map } from '../../app/entities'
import { SUIT_GLYPH } from './SelectableHand'
import type { PCard } from '../../features/game/gameSlice'

export type TrickCard = { card: PCard; by: "you" | "opponent" }

export type TrickRowProps = {
  cards: ReadonlyArray<TrickCard>
  count: number
  label?: string
  previous?: { cards: ReadonlyArray<TrickCard>; reason: string }
}

const deck = new StdDeck("rc")

function trickListItems(cards: ReadonlyArray<TrickCard>, animateLast: boolean) {
  return cards.map((item, index) => {
    const live = new Card(item.card.suit, item.card.rank)
    const isLast = animateLast && index === cards.length - 1
    const className = ["selectable-card", "pc", "static", isLast ? "is-played" : ""].filter(Boolean).join(" ")
    return (
      <li className="peg-sequence-card" key={cardKey(live)}>
        <div className={className}>
          <img className="selectable-card-face" src={deck.getFaceImageUri(live)} alt="" />
          <span className="selectable-card-badge pc-badge" aria-hidden="true">
            {rank_map[item.card.rank]}{SUIT_GLYPH[item.card.suit]}
          </span>
          <span className="visually-hidden">{`${cardName(live)}, played by ${item.by === "you" ? "you" : "them"}`}</span>
        </div>
        <span className="peg-owner">{item.by === "you" ? "you" : "them"}</span>
      </li>
    )
  })
}

export function TrickRow({ cards, count, label, previous }: TrickRowProps) {
  return (
    <>
      {previous ? (
        <>
          <ul className="peg-sequence peg-sequence--previous" aria-label="The previous trick">
            {trickListItems(previous.cards, false)}
          </ul>
          <p className="peg-trick-reason">{previous.reason}</p>
        </>
      ) : null}
      <div className="peg-strip">
        <span className="count-chip">Count: {count}</span>
        {cards.length > 0 ? (
          <ul className="peg-sequence" aria-label={label ?? "Cards on the table"}>
            {trickListItems(cards, true)}
          </ul>
        ) : (
          <span className="meta">Nothing played yet.</span>
        )}
      </div>
    </>
  )
}
