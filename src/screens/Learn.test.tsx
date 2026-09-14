import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Learn } from './Learn'
import { DIFFICULTY_DESCRIPTIONS, DIFFICULTY_LABELS } from '../app/difficulty'
import { clearTutorialProgress, saveTutorialProgress } from '../app/persistence'
import { BEGINNER_PATH } from '../features/tutorial/lessonCatalog'

vi.mock('../features/tutorial/tutorialTypes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/tutorial/tutorialTypes')>()
  return {
    ...actual,
    tutorialEnabled: () => mockTutorialEnabled,
  }
})

let mockTutorialEnabled = true

function renderLearn(path = "/learn") {
  return {
    user: userEvent.setup(),
    ...render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<div>splash-home</div>} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/learn/:lessonId" element={<div>lesson-screen</div>} />
        </Routes>
      </MemoryRouter>
    ),
  }
}

afterEach(() => {
  mockTutorialEnabled = true
  clearTutorialProgress()
})

describe("Learn", () => {
  it("documents the corrected crib flush and the rest of the scoring table", () => {
    renderLearn()
    expect(screen.getByRole("heading", { name: /Learn Cribbage/i })).toBeInTheDocument()
    expect(screen.getByText(/crib flush \(five cards the same suit only\)/i)).toBeInTheDocument()
    expect(screen.getByText(/flush in hand \(four cards\)/i)).toBeInTheDocument()
    expect(screen.getByText(/nobs \(jack of the starter/i)).toBeInTheDocument()
    expect(screen.getByText(/his heels \(jack as starter\)/i)).toBeInTheDocument()
    expect(screen.getByText(/race to 121/i)).toBeInTheDocument()
    expect(screen.getByText(/the low card deals first/i)).toBeInTheDocument()
  })

  it("renders difficulty copy from the module and the beginner path", async () => {
    const { user } = renderLearn()
    await user.click(screen.getByRole("button", { name: /How the opponent plays/i }))
    for (const level of ["easy", "intermediate", "expert"] as const) {
      expect(screen.getByText(DIFFICULTY_LABELS[level])).toBeInTheDocument()
      expect(screen.getByText(DIFFICULTY_DESCRIPTIONS[level], { exact: false })).toBeInTheDocument()
    }
    expect(screen.getByText(/the same shuffle at every difficulty/i)).toBeInTheDocument()
    expect(screen.getByText(/Learn your first round in about 15 minutes/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Start beginner path/i })).toBeInTheDocument()
    for (const lesson of BEGINNER_PATH) {
      expect(screen.getByText(new RegExp(lesson.title))).toBeInTheDocument()
    }
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
  })

  it("navigates to the first lesson", async () => {
    const { user } = renderLearn()
    await user.click(screen.getByRole("button", { name: /Start beginner path/i }))
    expect(screen.getByText("lesson-screen")).toBeInTheDocument()
  })

  it("shows Resume when a lesson is in progress", () => {
    saveTutorialProgress({
      currentLessonId: "peg-to-31",
      currentStepIndex: 2,
    })
    renderLearn()
    expect(screen.getByRole("button", { name: /Resume: Peg to 31, step 3/i })).toBeInTheDocument()
  })

  it("hides the path when the tutorial flag is off", () => {
    mockTutorialEnabled = false
    renderLearn()
    expect(screen.getByRole("heading", { name: /Learn Cribbage/i })).toBeInTheDocument()
    expect(screen.getByText(/race to 121/i)).toBeInTheDocument()
    expect(screen.queryByText(/Start beginner path/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/New to cribbage/i)).not.toBeInTheDocument()
  })

  it("goes back to the splash", async () => {
    const { user } = renderLearn()
    await user.click(screen.getByRole("button", { name: "Back" }))
    expect(screen.getByText("splash-home")).toBeInTheDocument()
  })
})
