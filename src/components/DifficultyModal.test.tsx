import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { DifficultyModal } from './DifficultyModal'
import gameReducer, { initialState } from '../features/game/gameSlice'
import { clearAll, loadPreferences } from '../app/persistence'
import { DIFFICULTY_DESCRIPTIONS, DIFFICULTY_LABELS } from '../app/difficulty'

function renderModal(difficulty: typeof initialState.difficulty = "intermediate") {
  const store = configureStore({
    reducer: { game: gameReducer },
    preloadedState: { game: { ...initialState, difficulty, difficultyChosen: false } },
  })
  return {
    store,
    user: userEvent.setup(),
    ...render(
      <Provider store={store}>
        <DifficultyModal />
      </Provider>
    ),
  }
}

describe("DifficultyModal", () => {
  afterEach(() => {
    clearAll()
  })

  it("lists every level from the difficulty module and has no close control", () => {
    renderModal()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("radiogroup", { name: /choose your opponent/i })).toBeInTheDocument()
    for (const level of ["easy", "intermediate", "expert"] as const) {
      expect(screen.getByRole("radio", { name: new RegExp(DIFFICULTY_LABELS[level]) })).toBeInTheDocument()
      expect(screen.getByText(DIFFICULTY_DESCRIPTIONS[level])).toBeInTheDocument()
    }
    expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument()
  })

  it("pre-selects the store difficulty and persists the confirmed choice", async () => {
    const { store, user } = renderModal("easy")
    expect(screen.getByRole("radio", { name: /easy/i })).toBeChecked()
    await user.click(screen.getByRole("radio", { name: /expert/i }))
    await user.click(screen.getByRole("button", { name: "Start Game" }))
    expect(store.getState().game.difficulty).toBe("expert")
    expect(store.getState().game.difficultyChosen).toBe(true)
    expect(loadPreferences().difficulty).toBe("expert")
  })
})
