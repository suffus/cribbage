import type { RoundPhase } from '../../features/tutorial/tutorialTypes'

const PHASES: ReadonlyArray<{ id: RoundPhase; label: string }> = [
  { id: "deal", label: "Deal" },
  { id: "discard", label: "Discard" },
  { id: "starter", label: "Starter" },
  { id: "pegging", label: "Pegging" },
  { id: "show", label: "Show" },
  { id: "crib", label: "Crib" },
]

export type RoundMapProps = {
  current?: RoundPhase | null
}

export function RoundMap({ current = null }: RoundMapProps) {
  const currentIndex = current ? PHASES.findIndex((p) => p.id === current) : -1
  return (
    <ol className="roundmap">
      {PHASES.map((phase, index) => {
        const isCurrent = phase.id === current
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
            </span>
          </li>
        )
      })}
    </ol>
  )
}
