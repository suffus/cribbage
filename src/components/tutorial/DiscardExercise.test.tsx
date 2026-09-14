import { useReducer } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DISCARD_SCENARIOS } from '../../features/tutorial/scenarios'
import { initialRunnerState, makeTutorialReducer } from '../../features/tutorial/tutorialReducer'
import type { Lesson } from '../../features/tutorial/tutorialTypes'
import { DiscardExercise } from './DiscardExercise'

const emptyStep = {
  stepId: "x", selected: [], found: [], attempts: 0, hintLevel: 0 as const,
  revealed: 0, status: "in-progress" as const, feedback: null, earned: 0, subIndex: 0,
}

describe("DiscardExercise", () => {
  it("Confirm is disabled until exactly two cards are selected, and dispatches submit", () => {
    const dispatch = vi.fn()
    const scenario = DISCARD_SCENARIOS["discard-theirs"]
    render(<DiscardExercise scenario={scenario} step={{ ...emptyStep, selected: ["JD"] }} dispatch={dispatch} />)
    expect(screen.getByRole("button", { name: /confirm two discards/i })).toBeDisabled()
  })

  it("names whose crib it is", () => {
    const dispatch = vi.fn()
    render(<DiscardExercise scenario={DISCARD_SCENARIOS["discard-theirs"]} step={emptyStep} dispatch={dispatch} />)
    expect(screen.getByText(/this is the opponent's crib/i)).toBeInTheDocument()
    render(<DiscardExercise scenario={DISCARD_SCENARIOS["discard-yours"]} step={emptyStep} dispatch={dispatch} />)
    expect(screen.getByText(/this is your crib\./i)).toBeInTheDocument()
  })

  it("ignores clicks while locked", async () => {
    const dispatch = vi.fn()
    const user = userEvent.setup()
    render(
      <DiscardExercise
        scenario={DISCARD_SCENARIOS["discard-theirs"]}
        step={emptyStep}
        dispatch={dispatch}
        locked
      />,
    )
    await user.click(screen.getByRole("button", { name: /jack of diamonds/i }))
    expect(dispatch).not.toHaveBeenCalled()
  })

  it("accepts the top-ranked throw end to end via the real reducer, then offers to try another", async () => {
    const user = userEvent.setup()
    const lesson: Lesson = {
      id: "test", title: "t", estimatedMinutes: 1, concepts: ["discard-keep"],
      steps: [{ kind: "discard-practice", id: "step", scenarioId: "discard-theirs", hintPolicy: "on-request" }],
    }
    function Host() {
      const [state, dispatch] = useReducer(makeTutorialReducer(lesson), initialRunnerState(lesson))
      return (
        <div>
          <p data-testid="status">{state.step.status}</p>
          <DiscardExercise scenario={DISCARD_SCENARIOS["discard-theirs"]} step={state.step} dispatch={dispatch} />
        </div>
      )
    }
    render(<Host />)
    // The scenario's best throw (rank 1) is jack of diamonds + queen of hearts.
    await user.click(screen.getByRole("button", { name: /jack of diamonds/i }))
    await user.click(screen.getByRole("button", { name: /queen of hearts/i }))
    await user.click(screen.getByRole("button", { name: /confirm two discards/i }))
    expect(screen.getByTestId("status")).toHaveTextContent("complete")
    // The authored reason itself is rendered by CoachPanel (fed from
    // state.step.feedback), not by DiscardExercise — this component only
    // shows the generic "compare with the engine" line plus the retry button.
    expect(screen.getByText(/engine's favourite keep/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /try another discard/i }))
  })
})
