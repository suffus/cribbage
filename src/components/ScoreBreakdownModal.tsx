import { useMemo, useRef } from 'react'
import { Button, Modal } from 'react-bootstrap'
import { Card, cardKey, cardName } from '../app/entities'
import type { Deck } from '../app/entities'
import { scoreHandDetailed } from '../app/game'
import type { ScoringGroup } from '../app/game'
import type { PCard } from '../features/game/gameSlice'

export type ScoreBreakdownModalProps = {
  title: string
  hand: Array<PCard>
  starter: PCard | null
  isCrib: boolean
  total: number
  deck: Deck
  onClose: () => void
}

type ComboRow = {
  key: string
  label: string
  points: number
  cardIds: ReadonlyArray<string>
}

function pairRankFromIds(cardIds: ReadonlyArray<string>): string {
  const first = cardIds[0] ?? ""
  return first.startsWith("10") ? "10" : first.slice(0, -1)
}

/** Same pair aggregation as GroupList (three / four of a kind), but each row
 *  also keeps the unique cards so the modal can show miniature faces. */
function comboRows(groups: ReadonlyArray<ScoringGroup>): ComboRow[] {
  const pairBuckets = new Map<string, ScoringGroup[]>()
  for (const g of groups) {
    if (g.category !== "pair") {
      continue
    }
    const rank = pairRankFromIds(g.cardIds)
    const bucket = pairBuckets.get(rank) ?? []
    bucket.push(g)
    pairBuckets.set(rank, bucket)
  }
  const emittedRank = new Set<string>()
  const rows: ComboRow[] = []
  for (const g of groups) {
    if (g.category !== "pair") {
      rows.push({ key: g.id, label: g.label, points: g.points, cardIds: g.cardIds })
      continue
    }
    const rank = pairRankFromIds(g.cardIds)
    if (emittedRank.has(rank)) {
      continue
    }
    emittedRank.add(rank)
    const bucket = pairBuckets.get(rank) ?? [g]
    if (bucket.length === 3) {
      rows.push({
        key: `pair-set:${rank}`,
        label: "Three of a kind",
        points: 6,
        cardIds: uniqueIds(bucket),
      })
    } else if (bucket.length === 6) {
      rows.push({
        key: `pair-set:${rank}`,
        label: "Four of a kind",
        points: 12,
        cardIds: uniqueIds(bucket),
      })
    } else {
      for (const b of bucket) {
        rows.push({ key: b.id, label: b.label, points: b.points, cardIds: b.cardIds })
      }
    }
  }
  return rows
}

function uniqueIds(groups: ReadonlyArray<ScoringGroup>): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const g of groups) {
    for (const id of g.cardIds) {
      if (!seen.has(id)) {
        seen.add(id)
        ids.push(id)
      }
    }
  }
  return ids
}

function lookupCards(hand: ReadonlyArray<PCard>, starter: PCard | null): Map<string, Card> {
  const map = new Map<string, Card>()
  for (const spec of hand) {
    const card = new Card(spec.suit, spec.rank)
    map.set(cardKey(card), card)
  }
  if (starter) {
    const card = new Card(starter.suit, starter.rank)
    map.set(cardKey(card), card)
  }
  return map
}

export function ScoreBreakdownModal({
  title,
  hand,
  starter,
  isCrib,
  total,
  deck,
  onClose,
}: ScoreBreakdownModalProps) {
  const handKey = hand.map((c) => cardKey(new Card(c.suit, c.rank))).join(",")
  const starterKey = starter ? cardKey(new Card(starter.suit, starter.rank)) : ""

  const result = useMemo(() => {
    if (hand.length === 0) {
      return null
    }
    const cards = hand.map((c) => new Card(c.suit, c.rank))
    const cut = starter ? new Card(starter.suit, starter.rank) : undefined
    return scoreHandDetailed(cards, cut, isCrib)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handKey, starterKey, isCrib])

  const loggedMismatch = useRef<string | null>(null)
  if (result && result.total !== total && loggedMismatch.current !== handKey) {
    loggedMismatch.current = handKey
    console.log("ScoreBreakdownModal total mismatch", { prop: total, derived: result.total })
  }

  const cardsById = useMemo(
    () => lookupCards(hand, starter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handKey, starterKey],
  )
  const rows = result ? comboRows(result.groups) : []

  return (
    <Modal
      show
      centered
      size="lg"
      onHide={onClose}
      dialogClassName="scoreBreakdown-dialog"
      aria-labelledby="score-breakdown-title"
    >
      <Modal.Header closeButton>
        <Modal.Title id="score-breakdown-title">{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="scoreBreakdown-body">
        {rows.length === 0 ? (
          <p className="scoreBreakdown-empty">Nothing scored in this hand.</p>
        ) : (
          <ol className="scoreBreakdown-list">
            {rows.map((row) => (
              <li key={row.key} className="scoreBreakdown-row">
                <div className="scoreBreakdown-combo">
                  <div className="scoreBreakdown-label">{row.label}</div>
                  <div className="scoreBreakdown-cards">
                    {row.cardIds.map((id) => {
                      const card = cardsById.get(id)
                      if (!card) {
                        return null
                      }
                      return (
                        <img
                          key={id}
                          className="scoreBreakdown-card"
                          src={deck.getFaceImageUri(card)}
                          alt={cardName(card)}
                        />
                      )
                    })}
                  </div>
                </div>
                <span className="scoreBreakdown-points">{row.points}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="scoreBreakdown-total" aria-label={`Total ${total}`}>
          Total <span className="scoreBreakdown-totalNum">{total}</span>
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="warning" onClick={onClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  )
}
