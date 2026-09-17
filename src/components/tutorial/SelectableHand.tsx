import { Card, cardName, rank_map } from '../../app/entities'
import type { Deck, Suit } from '../../app/entities'
import type { PCard } from '../../features/game/gameSlice'

export type SelectableCard = {
  card: PCard
  cardId: string
  state: "idle" | "selected" | "credited" | "hinted" | "disabled"
  /** How many already-counted scoring groups contain this card. `undefined`
   *  or `0` means none. A card with a positive count is still selectable —
   *  cribbage cards can score in more than one combination. */
  creditedCount?: number
}

export type SelectableHandProps = {
  deck: Deck
  cards: ReadonlyArray<SelectableCard>
  label: string
  onToggle?: (cardId: string) => void
  mode: "checkbox" | "radio" | "none"
  /** Renders every card as a face-down back instead of its face. Used for an
   *  opponent's hand before the show, when a real game would not let you see
   *  it. Only meaningful with mode="none" — there is nothing to select. */
  faceDown?: boolean
}

export const SUIT_GLYPH: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  spades: "♠",
  clubs: "♣",
  joker: "★",
}

function describeState(state: SelectableCard["state"], creditedCount: number): string {
  if (state === "disabled") {
    return "not available"
  }
  if (state === "hinted") {
    return "hinted"
  }
  const parts: string[] = []
  if (creditedCount > 0) {
    parts.push(creditedCount === 1 ? "used in 1 counted combination" : `used in ${creditedCount} counted combinations`)
  }
  parts.push(state === "selected" ? "selected" : "not selected")
  return parts.join(", ")
}

export function SelectableHand({ deck, cards, label, onToggle, mode, faceDown }: SelectableHandProps) {
  return (
    <fieldset className="selectable-hand hand">
      <legend className="selectable-hand-legend">{label}</legend>
      <div className="selectable-hand-cards">
        {cards.map((item) => {
          const live = new Card(item.card.suit, item.card.rank)
          const creditedCount = item.creditedCount ?? 0
          const name = `${cardName(live)}, ${describeState(item.state, creditedCount)}`
          const badge = `${rank_map[item.card.rank]}${SUIT_GLYPH[item.card.suit]}`
          const className = [
            "selectable-card",
            "pc",
            item.state === "selected" ? "is-selected" : "",
            creditedCount > 0 ? "is-credited credited" : "",
            item.state === "hinted" ? "is-hinted hinted" : "",
            item.state === "disabled" ? "is-disabled disabled" : "",
            mode === "none" ? "static" : "",
            faceDown ? "is-facedown" : "",
          ].filter(Boolean).join(" ")
          if (mode === "none") {
            return (
              <div key={item.cardId} className={className}>
                <img
                  className="selectable-card-face"
                  src={faceDown ? deck.getBackImageUri() : deck.getFaceImageUri(live)}
                  alt=""
                />
                {faceDown ? null : (
                  <span className="selectable-card-badge pc-badge" aria-hidden="true">{badge}</span>
                )}
                <span className="visually-hidden">{faceDown ? "Face-down card" : name}</span>
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
              disabled={item.state === "disabled"}
              onClick={() => onToggle?.(item.cardId)}
            >
              <img className="selectable-card-face" src={deck.getFaceImageUri(live)} alt="" />
              <span className="selectable-card-badge pc-badge" aria-hidden="true">{badge}</span>
              {creditedCount > 0 ? (
                <span className="selectable-card-uses" aria-hidden="true">×{creditedCount}</span>
              ) : null}
              <span className="visually-hidden">{name}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
