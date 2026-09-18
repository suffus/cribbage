import type { RoundPhase } from '../../features/tutorial/tutorialTypes'

const PHASES: ReadonlyArray<{ id: RoundPhase; label: string }> = [
  { id: "deal", label: "Deal" },
  { id: "discard", label: "Discard" },
  { id: "starter", label: "Starter" },
  { id: "pegging", label: "Pegging" },
  { id: "show", label: "Show" },
]

function mapPhase(current: RoundPhase | null): RoundPhase | null {
  // The crib is counted during the show, not as its own phase.
  return current === "crib" ? "show" : current
}

export type RoundMapProps = {
  current?: RoundPhase | null
  caption?: string
}

export function RoundMap({ current = null, caption }: RoundMapProps) {
  const highlight = mapPhase(current)
  const currentIndex = highlight ? PHASES.findIndex((p) => p.id === highlight) : -1
  return (
    <>
      <ol className="roundmap">
        {PHASES.map((phase, index) => {
          const isCurrent = phase.id === highlight
          const done = currentIndex >= 0 && index < currentIndex
          return (
            <li
              key={phase.id}
              className={done ? "done" : undefined}
              aria-current={isCurrent ? "step" : undefined}
            >
              {index > 0 ? <span className="sep" aria-hidden="true">→</span> : null}
              <span className="step">
                {phase.label}
                {isCurrent ? <span className="visually-hidden"> — current phase</span> : null}
                {done ? <span className="visually-hidden"> — completed</span> : null}
              </span>
            </li>
          )
        })}
      </ol>
      {caption ? <p className="roundmap-caption">{caption}</p> : null}
    </>
  )
}
