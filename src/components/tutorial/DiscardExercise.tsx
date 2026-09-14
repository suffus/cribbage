import { StdDeck, cardKey } from '../../app/entities'
import { SelectableHand } from './SelectableHand'
import { specToCard } from '../../features/tutorial/tutorialCards'
import { gradeDiscard } from '../../features/tutorial/tutorialGrading'
import type { DiscardScenario } from '../../features/tutorial/tutorialTypes'
import type { RunnerAction, StepState } from '../../features/tutorial/tutorialReducer'

export type DiscardExerciseProps = {
  scenario: DiscardScenario
  step: StepState
  dispatch: (action: RunnerAction) => void
  locked?: boolean
}

const deck = new StdDeck("rc")

export function DiscardExercise({ scenario, step, dispatch, locked = false }: DiscardExerciseProps) {
  const owner = scenario.isPlayerCrib ? "This is your crib." : "This is the opponent's crib."
  const grade = step.feedback
    ? gradeDiscard(scenario, step.selected.length === 2 ? step.selected : Object.keys(scenario.reasons)[0]?.split("-") ?? [])
    : null
  const confirmed = step.status === "complete" || (step.feedback !== null && step.attempts > 0)

  return (
    <div>
      <p><strong>{owner}</strong> Choose two cards before you confirm.</p>
      <SelectableHand
        deck={deck}
        label={scenario.isPlayerCrib ? "Choose two cards for your crib" : "Choose two cards for their crib"}
        mode="checkbox"
        cards={scenario.hand.map((spec) => {
          const card = specToCard(spec)
          const cardId = cardKey(card)
          return {
            card: { suit: card.suit, rank: card.rank },
            cardId,
            state: step.selected.includes(cardId) ? "selected" : "idle",
          }
        })}
        onToggle={(id) => {
          if (!locked) {
            dispatch({ type: "toggle-card", cardId: id })
          }
        }}
      />
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-warning"
          disabled={step.selected.length !== 2}
          onClick={() => dispatch({ type: "submit" })}
        >
          Confirm two discards
        </button>
        {confirmed ? (
          <button type="button" className="btn btn-outline-light" onClick={() => dispatch({ type: "clear-selection" })}>
            Try another discard
          </button>
        ) : null}
      </div>
      {grade && confirmed ? (
        <div className="discard-compare">
          <p>Your throw compared with the engine's favourite keep. The numbers sit behind Show the math.</p>
        </div>
      ) : null}
    </div>
  )
}
