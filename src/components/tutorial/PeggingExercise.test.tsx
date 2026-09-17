import { render, screen, within } from '@testing-library/react'
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

  it("play-sequence: the opponent only moves when the learner lets them, and the total is unchanged", async () => {
    const dispatch = vi.fn()
    const user = userEvent.setup()
    const scenario = PEG_SCENARIOS["peg-go"]
    const step = emptyStepState({ kind: "peg-practice", id: "x", scenarioId: "peg-go", hintPolicy: "on-request" })
    render(<PeggingExercise scenario={scenario} step={step} dispatch={dispatch} />)

    expect(screen.getByText("Count: 8")).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: /seven of clubs/i }))
    await user.click(screen.getByRole("button", { name: /play this card/i }))

    // Only the learner's card lands — the opponent's scripted six of diamonds
    // does not auto-play (RM-4 item 2).
    expect(screen.getByText("Count: 15")).toBeInTheDocument()
    expect(screen.queryByText(/six of diamonds, played by them/i)).toBeNull()
    expect(screen.getByRole("button", { name: /let the opponent play their card/i })).toHaveTextContent(/let them play/i)

    // One press of "Let them play" resolves exactly the opponent's one reply
    // (8-7-6 is a run of three).
    await user.click(screen.getByRole("button", { name: /let the opponent play their card/i }))
    expect(screen.getByText("Count: 21")).toBeInTheDocument()
    expect(screen.getByText(/six of diamonds, played by them/i)).toBeInTheDocument()

    await user.click(screen.getByRole("radio", { name: /nine of spades/i }))
    await user.click(screen.getByRole("button", { name: /play this card/i }))
    expect(screen.getByText("Count: 30")).toBeInTheDocument()

    // The opponent's remaining scripted ten of clubs would make 40 — illegal
    // — so the opponent goes on the next press, and the learner (out of
    // cards) must say go too.
    await user.click(screen.getByRole("button", { name: /let the opponent play their card/i }))
    expect(await screen.findByRole("button", { name: /say go/i })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /say go/i }))

    // Two consecutive goes: the count resets and the learner's last card (the
    // nine) scores 1. The total is unchanged from before this phase.
    expect(screen.getByText("Count: 0")).toBeInTheDocument()
    expect(dispatch).toHaveBeenCalledWith({ type: "complete-peg-sequence", earned: 10 })
    expect(dispatch.mock.calls.filter((c) => c[0].type === "complete-peg-sequence")).toHaveLength(1)
  })

  it("lays the cards in one horizontal row with no nested fieldset", () => {
    const dispatch = vi.fn()
    const scenario = PEG_SCENARIOS["peg-legal"]
    const step = emptyStepState({ kind: "peg-practice", id: "x", scenarioId: "peg-legal", hintPolicy: "on-request" })
    const { container } = render(<PeggingExercise scenario={scenario} step={step} dispatch={dispatch} />)
    // Deviation from the plan's literal test text: step 10 explicitly sets
    // `label="On the table"` on this TrickRow (matching the label used
    // everywhere else in this phase), so the rendered accessible name is
    // "On the table", not TrickRow's default "Cards on the table" that the
    // plan's test wording names. Asserting against the actual rendered
    // label keeps the same substance (a single properly labelled list, no
    // nested fieldset) without contradicting step 10's explicit code.
    const list = screen.getByRole("list", { name: /on the table/i })
    expect(within(list).getAllByRole("listitem")).toHaveLength(3)
    expect(list.querySelector("fieldset")).toBeNull()
    expect(container.querySelector("fieldset.selectable-hand")).not.toBeNull() // the learner's own hand still uses one
  })

  it("announces a scoring play with the engine's label and the points", async () => {
    const dispatch = vi.fn()
    const user = userEvent.setup()
    const scenario = PEG_SCENARIOS["peg-go"]
    const step = emptyStepState({ kind: "peg-practice", id: "x", scenarioId: "peg-go", hintPolicy: "on-request" })
    render(<PeggingExercise scenario={scenario} step={step} dispatch={dispatch} />)
    await user.click(screen.getByRole("radio", { name: /seven of clubs/i }))
    await user.click(screen.getByRole("button", { name: /play this card/i }))
    const callout = document.querySelector(".peg-callout")
    expect(callout).not.toBeNull()
    expect(callout?.textContent).toContain("15")
    expect(callout?.textContent).toContain("2 points to you")
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "peg-note", text: expect.stringContaining("2 points to you") }),
    )
  })

  it("moves the learner's peg on the board after a scoring play", async () => {
    const dispatch = vi.fn()
    const user = userEvent.setup()
    const scenario = PEG_SCENARIOS["peg-go"]
    const step = emptyStepState({ kind: "peg-practice", id: "x", scenarioId: "peg-go", hintPolicy: "on-request" })
    render(<PeggingExercise scenario={scenario} step={step} dispatch={dispatch} />)
    expect(screen.getByAltText(/cribbage board with 3 tracks/i)).toBeInTheDocument()
    expect(screen.getByText("You 0 · Them 0")).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: /seven of clubs/i }))
    await user.click(screen.getByRole("button", { name: /play this card/i }))
    expect(screen.getByText("You 2 · Them 0")).toBeInTheDocument()
  })
})
