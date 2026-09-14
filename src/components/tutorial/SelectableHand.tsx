import { Card, cardName, rank_map } from '../../app/entities'
import type { Deck, Suit } from '../../app/entities'
import type { PCard } from '../../features/game/gameSlice'

export type SelectableCard = {
  card: PCard
  cardId: string
  state: "idle" | "selected" | "credited" | "hinted" | "disabled"
}

export type SelectableHandProps = {
  deck: Deck
  cards: ReadonlyArray<SelectableCard>
  label: string
  onToggle?: (cardId: string) => void
  mode: "checkbox" | "radio" | "none"
}

const SUIT_GLYPH: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  spades: "♠",
  clubs: "♣",
  joker: "★",
}

function stateName(state: SelectableCard["state"]): string {
  switch (state) {
    case "selected":
      return "selected"
    case "credited":
      return "already counted"
    case "hinted":
      return "hinted"
    case "disabled":
      return "not available"
    default:
      return "not selected"
  }
}

export function SelectableHand({ deck, cards, label, onToggle, mode }: SelectableHandProps) {
  return (
    <fieldset className="selectable-hand hand">
      <legend className="selectable-hand-legend">{label}</legend>
      <div className="selectable-hand-cards">
        {cards.map((item) => {
          const live = new Card(item.card.suit, item.card.rank)
          const name = `${cardName(live)}, ${stateName(item.state)}`
          const badge = `${rank_map[item.card.rank]}${SUIT_GLYPH[item.card.suit]}`
          const className = [
            "selectable-card",
            "pc",
            item.state === "selected" ? "is-selected" : "",
            item.state === "credited" ? "is-credited credited" : "",
            item.state === "hinted" ? "is-hinted hinted" : "",
            item.state === "disabled" ? "is-disabled disabled" : "",
            mode === "none" ? "static" : "",
          ].filter(Boolean).join(" ")
          if (mode === "none") {
            return (
              <div key={item.cardId} className={className}>
                <img className="selectable-card-face" src={deck.getFaceImageUri(live)} alt="" />
                <span className="selectable-card-badge pc-badge" aria-hidden="true">{badge}</span>
                <span className="visually-hidden">{name}</span>
              </div>
            )
          }
          return (
            <button
              key={item.cardId}
              type="button"
              className={className}
              aria-pressed={mode === "checkbox" ? item.state === "selected" : undefined}
              role={mode === "radio" ? "radio" : undefined}
              aria-checked={mode === "radio" ? item.state === "selected" : undefined}
              disabled={item.state === "disabled" || item.state === "credited"}
              onClick={() => onToggle?.(item.cardId)}
            >
              <img className="selectable-card-face" src={deck.getFaceImageUri(live)} alt="" />
              <span className="selectable-card-badge pc-badge" aria-hidden="true">{badge}</span>
              <span className="visually-hidden">{name}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
