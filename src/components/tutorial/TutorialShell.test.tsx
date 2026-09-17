import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { initialRunnerState } from '../../features/tutorial/tutorialReducer'
import type { Lesson } from '../../features/tutorial/tutorialTypes'
import { TutorialShell } from './TutorialShell'

const lesson: Lesson = {
  id: "shell-test",
  title: "Shell test lesson",
  estimatedMinutes: 1,
  concepts: ["fifteens"],
  steps: [
    { kind: "explain", id: "step-1", title: "Intro", body: ["Welcome."] },
    { kind: "score-practice", id: "step-2", scenarioId: "fifteen-worked", hintPolicy: "on-request" },
  ],
}

function renderShell(stepIndex: number, dispatch = vi.fn()) {
  const state = initialRunnerState(lesson, stepIndex)
  return {
    dispatch,
    ...render(
      <MemoryRouter>
        <TutorialShell lesson={lesson} state={state} dispatch={dispatch} onExit={vi.fn()} />
      </MemoryRouter>,
    ),
  }
}

describe("TutorialShell", () => {
  it("renders exactly one h1 and shows step count", () => {
    renderShell(0)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByText("Shell test lesson")).toBeInTheDocument()
    expect(screen.getByLabelText(/step 1 of 2/i)).toBeInTheDocument()
  })

  it("names the current activity in the workspace heading", () => {
    const { rerender, dispatch } = renderShell(0)
    expect(screen.getByRole("heading", { name: "Intro", level: 2 })).toBeInTheDocument()

    const state = initialRunnerState(lesson, 1)
    rerender(
      <MemoryRouter>
        <TutorialShell lesson={lesson} state={state} dispatch={dispatch} onExit={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByRole("heading", { name: "Count this hand", level: 2 })).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  })

  it("reports the same step number in the header and the progress bar", () => {
    renderShell(0)
    expect(screen.getByLabelText(/step 1 of 2/i)).toBeInTheDocument()
    expect(screen.getByText(/Step 1 of 2 · 50%/)).toBeInTheDocument()
  })

  it("offers a way out of step 0 and enables Back afterwards", async () => {
    const dispatch = vi.fn()
    const onExit = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <MemoryRouter>
        <TutorialShell lesson={lesson} state={initialRunnerState(lesson, 0)} dispatch={dispatch} onExit={onExit} />
      </MemoryRouter>,
    )
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument()
    const backToLearn = screen.getByRole("button", { name: "Back to Learn" })
    // Step 1 (explain) is passive, so Next is enabled immediately.
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled()
    await user.click(backToLearn)
    expect(onExit).toHaveBeenCalled()

    const state = initialRunnerState(lesson, 1)
    rerender(
      <MemoryRouter>
        <TutorialShell lesson={lesson} state={state} dispatch={dispatch} onExit={onExit} />
      </MemoryRouter>,
    )
    // Step 2 (score-practice) starts in-progress, so Next is disabled until solved.
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled()
  })

  it("marks Skip as not counting toward completion", async () => {
    const dispatch = vi.fn()
    const user = userEvent.setup()
    renderShell(0, dispatch)
    expect(screen.getByText(/Skipping does not count as completed\./)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /skip this step/i }))
    expect(dispatch).toHaveBeenCalledWith({ type: "skip" })
  })

  it("dispatches skip and next from the footer", async () => {
    const dispatch = vi.fn()
    const user = userEvent.setup()
    renderShell(0, dispatch)
    await user.click(screen.getByRole("button", { name: /skip this step/i }))
    expect(dispatch).toHaveBeenCalledWith({ type: "skip" })
    await user.click(screen.getByRole("button", { name: "Next" }))
    expect(dispatch).toHaveBeenCalledWith({ type: "next" })
  })

  it("opens the Rules offcanvas from the header", async () => {
    const user = userEvent.setup()
    renderShell(0)
    expect(screen.queryByRole("heading", { name: /rules reference/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Rules" }))
    expect(await screen.findByText(/rules reference/i)).toBeInTheDocument()
  })

  it("shows the coach prompt for the current step and a single status live region", () => {
    renderShell(0)
    expect(screen.getByRole("heading", { name: "Coach" })).toBeInTheDocument()
    expect(screen.getAllByRole("status")).toHaveLength(1)
  })
})
