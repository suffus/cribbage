import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import gameReducer from '../features/game/gameSlice'
import { thePlayer } from '../app/gamePlayer'
import { clearTutorialProgress, loadTutorialProgress, saveTutorialProgress, loadPreferences } from '../app/persistence'
import { Lesson } from './Lesson'

vi.mock('../features/tutorial/tutorialTypes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/tutorial/tutorialTypes')>()
  return {
    ...actual,
    tutorialEnabled: () => mockTutorialEnabled,
  }
})

let mockTutorialEnabled = true

function renderLesson(lessonId: string) {
  const store = configureStore({ reducer: { game: gameReducer } })
  return {
    store,
    user: userEvent.setup(),
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[`/learn/${lessonId}`]}>
          <Routes>
            <Route path="/learn" element={<div>learn-home</div>} />
            <Route path="/learn/:lessonId" element={<Lesson />} />
            <Route path="/play" element={<div>play-table</div>} />
          </Routes>
        </MemoryRouter>
      </Provider>
    ),
  }
}

afterEach(() => {
  mockTutorialEnabled = true
  clearTutorialProgress()
})

describe("Lesson", () => {
  it("redirects an unknown lesson id to Learn", () => {
    renderLesson("nonsense")
    expect(screen.getByText("learn-home")).toBeInTheDocument()
  })

  it("redirects when the tutorial flag is off", () => {
    mockTutorialEnabled = false
    renderLesson("shape-of-a-round")
    expect(screen.getByText("learn-home")).toBeInTheDocument()
  })

  it("resumes at the persisted step", () => {
    saveTutorialProgress({ currentLessonId: "count-a-hand", currentStepIndex: 2 })
    renderLesson("count-a-hand")
    expect(screen.getByLabelText(/Step 3 of/i)).toBeInTheDocument()
  })

  it("shows the Easy-game handoff after skipping the last lesson and runs the S4 sequence", async () => {
    const reset = vi.spyOn(thePlayer, "resetForNewSession")
    const { user, store } = renderLesson("ready-table")
    await user.click(screen.getByRole("button", { name: /Skip this step/i }))
    await user.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByRole("heading", { name: /You are ready for a real game/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Play your first Easy game/i })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Play your first Easy game/i }))
    expect(screen.getByText("play-table")).toBeInTheDocument()
    expect(reset).toHaveBeenCalled()
    expect(store.getState().game.difficulty).toBe("easy")
    expect(store.getState().game.difficultyChosen).toBe(true)
    expect(loadPreferences().difficulty).toBe("easy")
  })

  it("does not award concept mastery just for opening a passive step (defect 1)", () => {
    // Lesson 1 opens on a round-map step, which is "complete" the instant it
    // mounts. That must not record an independent-correct attempt for any of
    // the lesson's ten concepts.
    renderLesson("shape-of-a-round")
    expect(loadTutorialProgress().conceptMastery).toEqual({})
  })

  it("records an independent-correct attempt only when a graded step is solved on the first try", async () => {
    const { user } = renderLesson("count-a-hand")
    // Step index 0 is a score-example; skip it to reach step index 1,
    // "count-pairs" (score-practice, scenario pair-find: 2H/2C/9D/9S vs KH).
    await user.click(screen.getByRole("button", { name: /Skip this step/i }))
    await user.click(screen.getByRole("button", { name: /two of hearts/i }))
    await user.click(screen.getByRole("button", { name: /two of clubs/i }))
    await user.click(screen.getByRole("button", { name: /Count selected cards/i }))
    await user.click(screen.getByRole("button", { name: /nine of diamonds/i }))
    await user.click(screen.getByRole("button", { name: /nine of spades/i }))
    await user.click(screen.getByRole("button", { name: /Count selected cards/i }))
    const mastery = loadTutorialProgress().conceptMastery
    expect(mastery.pairs?.attempts).toBe(1)
    expect(mastery.pairs?.independentCorrect).toBe(1)
  })

  it("does not award independent-correct once a graded step has taken a wrong submission", async () => {
    const { user } = renderLesson("count-a-hand")
    await user.click(screen.getByRole("button", { name: /Skip this step/i }))
    // Wrong submission first (mismatched pair), then the two real pairs.
    await user.click(screen.getByRole("button", { name: /two of hearts/i }))
    await user.click(screen.getByRole("button", { name: /nine of diamonds/i }))
    await user.click(screen.getByRole("button", { name: /Count selected cards/i }))
    await user.click(screen.getByRole("button", { name: /two of hearts/i }))
    await user.click(screen.getByRole("button", { name: /two of clubs/i }))
    await user.click(screen.getByRole("button", { name: /Count selected cards/i }))
    await user.click(screen.getByRole("button", { name: /nine of diamonds/i }))
    await user.click(screen.getByRole("button", { name: /nine of spades/i }))
    await user.click(screen.getByRole("button", { name: /Count selected cards/i }))
    const mastery = loadTutorialProgress().conceptMastery
    expect(mastery.pairs?.independentCorrect).toBe(0)
    expect(mastery.pairs?.attempts).toBe(1)
  })

  it("persists every skipped step id, not only the last one in the lesson (defect 2)", async () => {
    const { user } = renderLesson("shape-of-a-round")
    // Step 0 (round-map) is not the last step of the lesson.
    await user.click(screen.getByRole("button", { name: /Skip this step/i }))
    expect(loadTutorialProgress().skippedStepIds).toContain("shape-deal")
    await user.click(screen.getByRole("button", { name: /Skip this step/i }))
    expect(loadTutorialProgress().skippedStepIds).toContain("shape-discard")
    expect(loadTutorialProgress().skippedStepIds).toEqual(
      expect.arrayContaining(["shape-deal", "shape-discard"]),
    )
  })
})
