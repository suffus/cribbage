import { StdDeck, cardKey } from '../../app/entities'
import { scoreHandDetailed } from '../../app/game'
import { GroupList } from '../GroupList'
import { SelectableHand } from './SelectableHand'
import type { SelectableCard } from './SelectableHand'
import { specToCard, specsToCards } from '../../features/tutorial/tutorialCards'
import type { ScoreScenario } from '../../features/tutorial/tutorialTypes'
import type { RunnerAction, StepState } from '../../features/tutorial/tutorialReducer'

export type HandScoringExerciseProps = {
  scenario: ScoreScenario
  step: StepState
  mode: "example" | "practice"
  dispatch: (action: RunnerAction) => void
  hintedIds?: ReadonlyArray<string>
}

const deck = new StdDeck("rc")

function toSelectable(
  specs: ScoreScenario["hand"] | ReadonlyArray<ScoreScenario["hand"][number]>,
  step: StepState,
  mode: "example" | "practice",
  hintedIds: ReadonlyArray<string>,
): SelectableCard[] {
  return specsToCards(specs).map((card) => {
    const cardId = cardKey(card)
    const credited = step.found.some((id) => id.includes(cardId))
    let state: SelectableCard["state"] = "idle"
    if (mode === "example") {
      state = credited ? "credited" : "idle"
    } else if (credited) {
      state = "credited"
    } else if (step.selected.includes(cardId)) {
      state = "selected"
    } else if (hintedIds.includes(cardId)) {
      state = "hinted"
    }
    return { card: { suit: card.suit, rank: card.rank }, cardId, state }
  })
}

export function HandScoringExercise({
  scenario,
  step,
  mode,
  dispatch,
  hintedIds = [],
}: HandScoringExerciseProps) {
  const starterCard = scenario.starter ? specToCard(scenario.starter) : null
  const detailed = scoreHandDetailed(
    specsToCards(scenario.hand),
    starterCard ?? undefined,
    scenario.isCrib,
  )
  const required = scenario.require
    ? detailed.groups.filter((g) => scenario.require?.includes(g.category))
    : detailed.groups
  const revealedGroups = mode === "example"
    ? required.slice(0, step.revealed)
    : detailed.groups.filter((g) => step.found.includes(g.id))

  return (
    <div>
      {starterCard ? (
        <SelectableHand
          deck={deck}
          label="Starter"
          mode="none"
          cards={[{
            card: { suit: starterCard.suit, rank: starterCard.rank },
            cardId: cardKey(starterCard),
            state: "idle",
          }]}
        />
      ) : null}
      <SelectableHand
        deck={deck}
        label={mode === "example" ? "The hand" : "Select the cards that score together"}
        mode={mode === "example" ? "none" : "checkbox"}
        cards={toSelectable(scenario.hand, step, mode, hintedIds)}
        onToggle={(id) => dispatch({ type: "toggle-card", cardId: id })}
      />
      {mode === "practice" ? (
        <p className="meta">Select each pair on its own. A triple is three pairs.</p>
      ) : null}
      <div className="btn-row" style={{ marginBottom: "0.9rem" }}>
        {mode === "example" ? (
          <button
            type="button"
            className="btn btn-warning"
            onClick={() => dispatch({ type: "reveal-next" })}
            disabled={step.status === "complete"}
          >
            Show the next combination
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-warning"
              onClick={() => dispatch({ type: "submit" })}
              disabled={step.selected.length === 0}
            >
              Count selected cards
            </button>
            <button type="button" className="btn btn-outline-light" onClick={() => dispatch({ type: "clear-selection" })}>
              Clear
            </button>
          </>
        )}
      </div>
      {revealedGroups.length > 0 ? (
        <>
          <h3 className="tutorial-subhead">{mode === "example" ? "Revealed so far" : "Counted so far"}</h3>
          <GroupList
            groups={revealedGroups}
            total={step.earned}
            activeGroupIds={revealedGroups.map((g) => g.id)}
            aggregatePairs={false}
          />
        </>
      ) : null}
    </div>
  )
}
