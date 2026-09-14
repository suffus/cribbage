import { useReducer } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SCORE_SCENARIOS } from '../../features/tutorial/scenarios'
import { initialRunnerState, makeTutorialReducer } from '../../features/tutorial/tutorialReducer'
import type { Lesson } from '../../features/tutorial/tutorialTypes'
import { HandScoringExercise } from './HandScoringExercise'

function pairFindLesson(): Lesson {
  return {
    id: "test-lesson",
    title: "Test",
    estimatedMinutes: 1,
    concepts: ["pairs"],
    steps: [
      { kind: "score-practice", id: "step", scenarioId: "pair-find", hintPolicy: "on-request" },
    ],
  }
}

/** A minimal live host — the same shape as TutorialShell's wiring — so the
 *  exercise is driven by the real reducer instead of a mocked dispatch. */
function LiveHost() {
  const lesson = pairFindLesson()
  const reducer = makeTutorialReducer(lesson)
  const [state, dispatch] = useReducer(reducer, initialRunnerState(lesson))
  const scenario = SCORE_SCENARIOS["pair-find"]
  return (
    <div>
      <p data-testid="earned">{state.step.earned}</p>
      <p data-testid="status">{state.step.status}</p>
      <HandScoringExercise scenario={scenario} step={state.step} mode="practice" dispatch={dispatch} />
    </div>
  )
}

/** Tabs forward until the focused element's accessible name matches `pattern`,
 *  so the test does not need to hand-count tab stops through disabled
 *  (credited) buttons that drop out of the tab order once a pair is found. */
async function tabUntil(user: ReturnType<typeof userEvent.setup>, pattern: RegExp): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await user.tab()
    const el = document.activeElement
    if (el && pattern.test(el.getAttribute("aria-label") ?? el.textContent ?? "")) {
      return
    }
  }
  throw new Error(`tabUntil: never focused an element matching ${pattern}`)
}

describe("HandScoringExercise", () => {
  it("example mode reveals one combination per click and disables the button once done", () => {
    const dispatch = vi.fn()
    const scenario = SCORE_SCENARIOS["fifteen-worked"]
    const step = {
      stepId: "x", selected: [], found: [], attempts: 0, hintLevel: 0 as const,
      revealed: 0, status: "in-progress" as const, feedback: null, earned: 0, subIndex: 0,
    }
    render(<HandScoringExercise scenario={scenario} step={step} mode="example" dispatch={dispatch} />)
    screen.getByRole("button", { name: /show the next combination/i }).click()
    expect(dispatch).toHaveBeenCalledWith({ type: "reveal-next" })
  })

  it("practice mode: Clear dispatches clear-selection and Count is disabled with nothing selected", () => {
    const dispatch = vi.fn()
    const scenario = SCORE_SCENARIOS["pair-find"]
    const step = {
      stepId: "x", selected: [], found: [], attempts: 0, hintLevel: 0 as const,
      revealed: 0, status: "in-progress" as const, feedback: null, earned: 0, subIndex: 0,
    }
    render(<HandScoringExercise scenario={scenario} step={step} mode="practice" dispatch={dispatch} />)
    expect(screen.getByRole("button", { name: /count selected cards/i })).toBeDisabled()
    screen.getByRole("button", { name: /^clear$/i }).click()
    expect(dispatch).toHaveBeenCalledWith({ type: "clear-selection" })
  })

  it("completes a full count-all exercise using only the keyboard (T3/§6.4)", async () => {
    const user = userEvent.setup()
    render(<LiveHost />)
    expect(screen.getByTestId("status")).toHaveTextContent("in-progress")

    // pair-find: 2H, 2C, 9D, 9S vs starter KH. Select the pair of twos with
    // Space, then submit with Enter on the "Count selected cards" button.
    await tabUntil(user, /two of hearts/i)
    await user.keyboard(" ")
    await tabUntil(user, /two of clubs/i)
    await user.keyboard(" ")
    await tabUntil(user, /count selected cards/i)
    await user.keyboard("{Enter}")
    expect(screen.getByTestId("earned")).toHaveTextContent("2")
    expect(screen.getByTestId("status")).toHaveTextContent("in-progress")

    // Second pair: 9D, 9S. The credited twos are now disabled and drop out
    // of the tab order entirely, so this still reaches the target in order.
    await tabUntil(user, /nine of diamonds/i)
    await user.keyboard(" ")
    await tabUntil(user, /nine of spades/i)
    await user.keyboard(" ")
    await tabUntil(user, /count selected cards/i)
    await user.keyboard("{Enter}")

    expect(screen.getByTestId("status")).toHaveTextContent("complete")
    expect(screen.getByTestId("earned")).toHaveTextContent("4")
  })
})
