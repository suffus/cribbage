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
    // Lesson 1 opens on an explain step, which is "complete" the instant it
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
    // The just-graded pair is held on screen for review; clear it before
    // picking the second pair.
    await user.click(screen.getByRole("button", { name: /Clear selection/i }))
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
    // The just-graded (wrong) selection is held for review; clear it before
    // picking the real first pair.
    await user.click(screen.getByRole("button", { name: /Clear selection/i }))
    await user.click(screen.getByRole("button", { name: /two of hearts/i }))
    await user.click(screen.getByRole("button", { name: /two of clubs/i }))
    await user.click(screen.getByRole("button", { name: /Count selected cards/i }))
    await user.click(screen.getByRole("button", { name: /Clear selection/i }))
    await user.click(screen.getByRole("button", { name: /nine of diamonds/i }))
    await user.click(screen.getByRole("button", { name: /nine of spades/i }))
    await user.click(screen.getByRole("button", { name: /Count selected cards/i }))
    const mastery = loadTutorialProgress().conceptMastery
    expect(mastery.pairs?.independentCorrect).toBe(0)
    expect(mastery.pairs?.attempts).toBe(1)
  })

  it("walks the lesson-1 demonstration into the deal", async () => {
    const { user } = renderLesson("shape-of-a-round")
    await user.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByText("Hand 1 of 2")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /deal the next card/i })).toBeInTheDocument()
    for (let i = 0; i < 12; i++) {
      await user.click(screen.getByRole("button", { name: /deal the next card/i }))
    }
    // R1: once all twelve cards are out, the button names the next action.
    await user.click(screen.getByRole("button", { name: /discard two cards for the crib/i }))
    expect(screen.getByRole("button", { name: /cut for the starter/i })).toBeInTheDocument()
  })

  it("shows a completion screen with three actions after a Quick Practice lesson", async () => {
    // Deviation from the plan's literal recipe: "peg-practice" has four steps
    // (three peg-practice steps then the recap), and skipping the fourth —
    // the recap, the lesson's last step — is itself what flips
    // `state.lessonComplete` to true (src/features/tutorial/tutorialReducer.ts
    // `advance`). Lesson.tsx's new Quick Practice completion branch renders
    // as soon as that happens, the same render cycle in which the 4th skip
    // is processed, so there is no further `Next` button to click afterward
    // — clicking one, as the plan's recipe literally describes, would find
    // no matching element. The four skips alone reach the completion screen.
    const { user } = renderLesson("peg-practice")
    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByRole("button", { name: /Skip this step/i }))
    }
    expect(screen.getByRole("heading", { name: "Pegging practice complete", level: 1 })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Practise again" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue the beginner path" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Back to Learn" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Practise again" }))
    expect(screen.getByLabelText(/step 1 of 4/i)).toBeInTheDocument()
  })

  it("records a mastery attempt only once even after Back and Next", async () => {
    // Deviation from the plan's literal recipe: it calls for clicking "Back"
    // immediately after solving step 0, but step 6 of this same phase
    // relabels step 0's footer button "Back to Learn" (it exits the lesson
    // instead of dispatching { type: "back" }), so there is no button named
    // exactly "Back" to click yet. An initial "Next" first leaves step 0 —
    // which is what makes its real "Back" button available and is also what
    // exercises the completed-step-restore path this test is meant to guard.
    const { user } = renderLesson("count-a-hand-practice")
    // Step 0, "qp-pairs" (score-practice, scenario pair-find: 2H/2C/9D/9S vs KH),
    // needs both pairs credited before the step completes.
    await user.click(screen.getByRole("button", { name: /two of hearts/i }))
    await user.click(screen.getByRole("button", { name: /two of clubs/i }))
    await user.click(screen.getByRole("button", { name: /Count selected cards/i }))
    // The just-graded pair is held on screen for review; clear it before
    // picking the second pair.
    await user.click(screen.getByRole("button", { name: /Clear selection/i }))
    await user.click(screen.getByRole("button", { name: /nine of diamonds/i }))
    await user.click(screen.getByRole("button", { name: /nine of spades/i }))
    await user.click(screen.getByRole("button", { name: /Count selected cards/i }))
    await user.click(screen.getByRole("button", { name: "Next" }))
    await user.click(screen.getByRole("button", { name: "Back" }))
    await user.click(screen.getByRole("button", { name: "Next" }))
    expect(loadTutorialProgress().conceptMastery.pairs?.attempts).toBe(1)
  })

  it("persists every skipped step id, not only the last one in the lesson (defect 2)", async () => {
    const { user } = renderLesson("shape-of-a-round")
    // Step 0 (explain) is not the last step of the lesson.
    await user.click(screen.getByRole("button", { name: /Skip this step/i }))
    expect(loadTutorialProgress().skippedStepIds).toContain("shape-intro")
    await user.click(screen.getByRole("button", { name: /Skip this step/i }))
    expect(loadTutorialProgress().skippedStepIds).toContain("shape-demo")
    expect(loadTutorialProgress().skippedStepIds).toEqual(
      expect.arrayContaining(["shape-intro", "shape-demo"]),
    )
  })

  it("does not mark the next lesson complete just for landing on it via Next lesson (defect)", async () => {
    // Every step of "shape-of-a-round" is passive (explain/round-demo/recap),
    // so three "Next" clicks finish it without touching any exercise.
    const { user } = renderLesson("shape-of-a-round")
    await user.click(screen.getByRole("button", { name: "Next" }))
    await user.click(screen.getByRole("button", { name: "Next" }))
    await user.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByRole("heading", { name: "The shape of a round complete", level: 1 })).toBeInTheDocument()
    expect(loadTutorialProgress().completedLessonIds).toEqual(["shape-of-a-round"])

    await user.click(screen.getByRole("button", { name: "Next lesson" }))
    // Before the fix, the stale `RunnerState` from the finished lesson (whose
    // `lessonComplete` was still true) carried over into the new lesson and
    // immediately re-triggered the "lesson complete" screen and persistence
    // for "count-a-hand" too, skipping it outright.
    expect(screen.queryByRole("heading", { name: /complete/i, level: 1 })).toBeNull()
    expect(screen.getByRole("button", { name: /show the next combination/i })).toBeInTheDocument()
    expect(loadTutorialProgress().completedLessonIds).toEqual(["shape-of-a-round"])
  })
})
