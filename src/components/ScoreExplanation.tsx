import { useMemo, useRef } from 'react'
import { Card, cardKey } from '../app/entities'
import { scoreHandDetailed } from '../app/game'
import type { PCard } from '../features/game/gameSlice'
import { GroupList } from './GroupList'

export type ScoreExplanationProps = {
  hand: Array<PCard>
  starter: PCard | null
  isCrib: boolean
  total: number
  title?: string
  variant?: "compact" | "list"
}

export function ScoreExplanation({
  hand,
  starter,
  isCrib,
  total,
  title,
  variant = "compact",
}: ScoreExplanationProps) {
  // Key the memo on stable cardKey strings, not on the hand/starter object
  // references — Cribbage.tsx builds fresh PCard objects on every render via
  // an inline .map()/.toObject(), so keying on the objects themselves would
  // never hit the memo.
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

  if (hand.length === 0 || total < 0 || !result) {
    return null
  }

  if (result.total !== total && loggedMismatch.current !== handKey) {
    loggedMismatch.current = handKey
    console.log("ScoreExplanation total mismatch", { prop: total, derived: result.total })
  }

  return (
    <div className="scoreExplanation">
      {title ? <h3 className="scoreExplanation-title">{title}</h3> : null}
      <GroupList groups={result.groups} total={total} variant={variant} />
    </div>
  )
}
