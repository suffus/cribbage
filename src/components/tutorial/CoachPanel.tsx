import { Collapse } from 'react-bootstrap'
import { useState, type ReactNode } from 'react'
import type { Feedback } from '../../features/tutorial/tutorialReducer'
import type { CategoryProgress } from '../../features/tutorial/tutorialGrading'
import type { ScoringCategory } from '../../app/game'

export type CoachPanelProps = {
  prompt: string
  progress?: CategoryProgress
  earned: number
  feedback: Feedback | null
  hintLevel: 0 | 1 | 2 | 3
  onHint?: () => void
  secondary?: ReactNode
}

const CAT_LABEL: Record<ScoringCategory, string> = {
  fifteen: "Fifteens",
  pair: "Pairs",
  run: "Runs",
  flush: "Flush",
  nobs: "Nobs",
}

function hintLabel(level: 0 | 1 | 2 | 3): string {
  if (level <= 0) {
    return "Hint"
  }
  if (level === 1) {
    return "Another hint"
  }
  return "Show me one group"
}

export function CoachPanel({
  prompt,
  progress,
  earned,
  feedback,
  hintLevel,
  onHint,
  secondary,
}: CoachPanelProps) {
  const [showMath, setShowMath] = useState(false)
  return (
    <div className="coach-box">
      <p className="coach-prompt">{prompt}</p>
      {progress && Object.keys(progress).length > 0 ? (
        <dl className="coach-progress">
          {(Object.entries(progress) as Array<[ScoringCategory, { found: number; total: number }]>).map(([cat, row]) => (
            <div key={cat}>
              <dt>{CAT_LABEL[cat]}</dt>
              <dd>{row.found === 0 && row.total > 0 ? "not started" : `${row.found} of ${row.total}`}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className={`status coach-status ${feedback?.tone ?? "neutral"}`} role="status" aria-live="polite">
        {feedback ? (
          <>
            <span className="tone">
              {feedback.tone === "good" ? "Nice" : feedback.tone === "retry" ? "Not this time" : "Coach"}
            </span>
            {feedback.text}
          </>
        ) : null}
        <p className="earned">Counted so far: <strong>{earned}</strong> points</p>
      </div>
      <div className="coach-actions btn-row">
        {onHint ? (
          <button type="button" className="btn btn-outline-light" onClick={onHint}>
            {hintLabel(hintLevel)}
          </button>
        ) : null}
        {secondary ? (
          <>
            <button type="button" className="btn-link" onClick={() => setShowMath((v) => !v)}>
              Show the math
            </button>
            <Collapse in={showMath}>
              <div>{secondary}</div>
            </Collapse>
          </>
        ) : null}
      </div>
    </div>
  )
}
