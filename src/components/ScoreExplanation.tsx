import type { PCard } from '../features/game/gameSlice'

export type ScoreExplanationProps = {
  hand: Array<PCard>
  starter: PCard | null
  isCrib: boolean
  total: number
}

export function ScoreExplanation({ total }: ScoreExplanationProps) {
  return (
    <div className="scoreExplanation">
      <span className="scoreExplanation-total">{total}</span>
      <p>Point-by-point breakdown coming soon.</p>
    </div>
  )
}
