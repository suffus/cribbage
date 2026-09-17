import { StdDeck, cardKey } from '../../app/entities'
import { scoreHandDetailed } from '../../app/game'
import { GroupList } from '../GroupList'
import { SelectableHand } from './SelectableHand'
import type { SelectableCard } from './SelectableHand'
import { specToCard, specsToCards } from '../../features/tutorial/tutorialCards'
import type { CardSpec, ScoreScenario } from '../../features/tutorial/tutorialTypes'
import type { RunnerAction, StepState } from '../../features/tutorial/tutorialReducer'

export type HandScoringExerciseProps = {
  scenario: ScoreScenario
  step: StepState
  mode: "example" | "practice"
  dispatch: (action: RunnerAction) => void
  hintedIds?: ReadonlyArray<string>
  submitAs?: "submit" | "submit-count"
}

const deck = new StdDeck("rc")

function toSelectable(
  specs: ScoreScenario["hand"] | ReadonlyArray<ScoreScenario["hand"][number]>,
  step: StepState,
  mode: "example" | "practice",
  hintedIds: ReadonlyArray<string>,
  /** Groups whose cards should glow "credited" right now. In example mode
   *  this is only the single most-recently-revealed group, so a card does
   *  not stay lit for combinations after the one that used it (RM-5 item
   *  1/2): the starter and the hand share the same highlighting rule, which
   *  is why the starter's card is routed through this helper too instead of
   *  always rendering "idle". Practice mode always passes an empty array —
   *  a card that has already scored in a found combination is still a
   *  perfectly ordinary, selectable card (it can score again in a different
   *  combination), so it gets no lingering highlight once its selection is
   *  cleared. The `GroupList` below is the one place that shows what has
   *  already been counted. */
  creditGroups: ReadonlyArray<{ cardIds: ReadonlyArray<string> }>,
): SelectableCard[] {
  return specsToCards(specs).map((card) => {
    const cardId = cardKey(card)
    const creditedCount = creditGroups.filter((g) => g.cardIds.includes(cardId)).length
    let state: SelectableCard["state"] = "idle"
    if (mode === "example") {
      state = creditedCount > 0 ? "credited" : "idle"
    } else if (step.selected.includes(cardId)) {
      state = "selected"
    } else if (creditedCount > 0) {
      state = "credited"
    } else if (hintedIds.includes(cardId)) {
      state = "hinted"
    }
    return { card: { suit: card.suit, rank: card.rank }, cardId, state, creditedCount }
  })
}

export function HandScoringExercise({
  scenario,
  step,
  mode,
  dispatch,
  hintedIds = [],
  submitAs = "submit",
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
  const foundGroups = detailed.groups.filter((g) => step.found.includes(g.id))
  const revealedGroups = mode === "example"
    ? required.slice(0, step.revealed)
    : foundGroups
  // Example mode highlights only the single combination currently on screen
  // (RM-5 item 2) — cards from earlier "Show the next combination" presses
  // stop glowing unless they are also part of this one. Practice mode never
  // highlights already-found cards this way: a card can score in more than
  // one combination, so marking it as permanently "credited" made it look
  // off-limits, and clearing the selection after a submit did not make that
  // highlight go away (it just swapped from the "selected" look to the
  // "credited" one). `GroupList`'s "Counted so far" list is the record of
  // what has already scored.
  const currentExampleGroup = mode === "example" ? required[step.revealed - 1] : undefined
  const creditGroups = mode === "example"
    ? (currentExampleGroup ? [currentExampleGroup] : [])
    : []

  return (
    <div>
      {starterCard ? (
        mode === "practice" ? (
          <SelectableHand
            deck={deck}
            label="Starter"
            mode="checkbox"
            cards={toSelectable([scenario.starter as CardSpec], step, mode, hintedIds, creditGroups)}
            onToggle={(id) => dispatch({ type: "toggle-card", cardId: id })}
          />
        ) : (
          <SelectableHand
            deck={deck}
            label="Starter"
            mode="none"
            cards={toSelectable([scenario.starter as CardSpec], step, mode, hintedIds, creditGroups)}
          />
        )
      ) : null}
      <SelectableHand
        deck={deck}
        label={mode === "example" ? "The hand" : "Select the cards that score together"}
        mode={mode === "example" ? "none" : "checkbox"}
        cards={toSelectable(scenario.hand, step, mode, hintedIds, creditGroups)}
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
        ) : step.submitted ? (
          <>
            <button
              type="button"
              className="btn btn-warning"
              onClick={() => dispatch({ type: "clear-selection" })}
            >
              Clear selection
            </button>
            <button
              type="button"
              className="btn btn-outline-light"
              onClick={() => dispatch({ type: "restart-count" })}
            >
              Start this count again
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-warning"
              onClick={() => dispatch(
                submitAs === "submit-count" ? { type: "submit-count", scenario } : { type: "submit" },
              )}
              disabled={step.selected.length === 0}
            >
              Count selected cards
            </button>
            <button
              type="button"
              className="btn btn-outline-light"
              onClick={() => dispatch({ type: "clear-selection" })}
              disabled={step.selected.length === 0}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn btn-outline-light"
              onClick={() => dispatch({ type: "restart-count" })}
            >
              Start this count again
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
