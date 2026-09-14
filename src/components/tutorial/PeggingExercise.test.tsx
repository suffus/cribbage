import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { emptyStepState } from '../../features/tutorial/tutorialReducer'
import { PEG_SCENARIOS } from '../../features/tutorial/scenarios'
import { PeggingExercise } from './PeggingExercise'

describe("PeggingExercise", () => {
  it("select-legal: toggling a card dispatches toggle-card, and Check these cards is disabled until something is selected", async () => {
    const dispatch = vi.fn()
    const user = userEvent.setup()
    const scenario = PEG_SCENARIOS["peg-legal"]
    const step = emptyStepState({ kind: "peg-practice", id: "x", scenarioId: "peg-legal", hintPolicy: "on-request" })
    render(<PeggingExercise scenario={scenario} step={step} dispatch={dispatch} />)
    expect(screen.getByRole("button", { name: /check these cards/i })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: /two of hearts/i }))
    expect(dispatch).toHaveBeenCalledWith({ type: "toggle-card", cardId: "2H" })
  })

  it("select-scoring: selecting a card and submitting dispatches submit", async () => {
    const dispatch = vi.fn()
    const user = userEvent.setup()
    const scenario = PEG_SCENARIOS["peg-scoring"]
    const step = {
      ...emptyStepState({ kind: "peg-practice", id: "x", scenarioId: "peg-scoring", hintPolicy: "on-request" }),
      selected: ["5C"],
    }
    render(<PeggingExercise scenario={scenario} step={step} dispatch={dispatch} />)
    await user.click(screen.getByRole("button", { name: /play this card/i }))
    expect(dispatch).toHaveBeenCalledWith({ type: "submit" })
  })

  it("play-sequence: alternates with the opponentScript, narrates go, and reports completion once (T7)", async () => {
    const dispatch = vi.fn()
    const user = userEvent.setup()
    const scenario = PEG_SCENARIOS["peg-go"]
    const step = emptyStepState({ kind: "peg-practice", id: "x", scenarioId: "peg-go", hintPolicy: "on-request" })
    render(<PeggingExercise scenario={scenario} step={step} dispatch={dispatch} />)

    expect(screen.getByText("Count: 8")).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: /seven of clubs/i }))
    await user.click(screen.getByRole("button", { name: /play this card/i }))

    // The opponent's scripted six of diamonds auto-plays (8-7-6 is a run of
    // three), so the count is now 21 and it is the learner's turn again.
    expect(screen.getByText("Count: 21")).toBeInTheDocument()
    expect(screen.getByText(/that makes 15/i)).toBeInTheDocument()
    expect(screen.getByText(/run of three: 8-7-6/i)).toBeInTheDocument()

    await user.click(screen.getByRole("radio", { name: /nine of spades/i }))
    await user.click(screen.getByRole("button", { name: /play this card/i }))

    // 21+9=30. The opponent's remaining scripted ten of clubs would make 40
    // — illegal — so the opponent goes and the learner (out of cards) must
    // say go too.
    expect(screen.getByText("Count: 30")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: /say go/i })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /say go/i }))

    // Two consecutive goes: the count resets and the learner's last card (the
    // nine) scores 1. The exercise is done and reports its total exactly once.
    expect(screen.getByText("Count: 0")).toBeInTheDocument()
    expect(dispatch).toHaveBeenCalledWith({ type: "complete-peg-sequence", earned: 10 })
    expect(dispatch.mock.calls.filter((c) => c[0].type === "complete-peg-sequence")).toHaveLength(1)
  })
})
