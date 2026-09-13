import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { toast } from 'react-toastify'
import { GameOverModal } from './GameOverModal'
import gameReducer, { initialState, type GamePlayingState } from '../features/game/gameSlice'
import type { GameBreakdown } from '../app/game'
import { thePlayer } from '../app/gamePlayer'

const over121: GameBreakdown = {
  player: { hand: 80, crib: 20, pegging: 18, bonuses: 12, total: 130 },
  opponent: { hand: 40, crib: 8, pegging: 10, bonuses: 2, total: 60 },
  winner: "player",
  rounds: 7,
  difficulty: "intermediate",
}

function renderOver(
  breakdown: GameBreakdown | null = over121,
  overrides: Partial<GamePlayingState> = {},
) {
  thePlayer.resetForNewSession()
  const store = configureStore({
    reducer: { game: gameReducer },
    preloadedState: {
      game: {
        ...initialState,
        ...overrides,
        difficulty: "intermediate" as const,
        difficultyChosen: true,
        finalBreakdown: breakdown,
      },
    },
  })
  return {
    store,
    user: userEvent.setup(),
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/play"]}>
          <Routes>
            <Route path="/" element={<div>splash-home</div>} />
            <Route path="/play" element={<GameOverModal />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    ),
  }
}

describe("GameOverModal", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders nothing without a snapshot", () => {
    renderOver(null)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("shows raw totals, rounds, difficulty, and the explanation slot", () => {
    renderOver()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("You win!")).toBeInTheDocument()
    expect(screen.getByText(/7 rounds/i)).toBeInTheDocument()
    expect(screen.getByText(/Intermediate/)).toBeInTheDocument()
    expect(screen.getByText("130")).toBeInTheDocument()
    expect(screen.getByText("60")).toBeInTheDocument()
    expect(screen.getByText("80")).toBeInTheDocument()
    expect(screen.getByText(/point-by-point breakdown coming soon/i)).toBeInTheDocument()
  })

  it("treats a non-player winner as an opponent win", () => {
    renderOver({ ...over121, winner: "opponent" })
    expect(screen.getByText("Your opponent wins!")).toBeInTheDocument()
  })

  it("Back to Menu resets the game UI and returns home", async () => {
    const dismiss = vi.spyOn(toast, "dismiss")
    const { store, user } = renderOver(over121, {
      message: "opponent has won the game",
      gameStage: "ending",
      nextScheduledAction: 100,
      showCrib: true,
      showPlayer: true,
      showOpponent: true,
      playerPeg: { track: 0, points: [84, 82, 80] },
      opponentPeg: { track: 1, points: [121, 119, 117] },
    })
    await user.click(screen.getByRole("button", { name: "Back to Menu" }))
    expect(screen.getByText("splash-home")).toBeInTheDocument()
    const state = store.getState().game
    expect(state.message).toBe("")
    expect(state.gameStage).toBe("starting")
    expect(state.playerPeg.points).toEqual([0, -1, -1])
    expect(state.opponentPeg.points).toEqual([0, -1, -1])
    expect(state.difficultyChosen).toBe(false)
    expect(state.finalBreakdown).toBeNull()
    expect(state.difficulty).toBe("intermediate")
    expect(dismiss).toHaveBeenCalled()
  })

  it("Play Again clears the snapshot without resetting difficulty", async () => {
    const { store, user } = renderOver()
    await user.click(screen.getByRole("button", { name: "Play Again" }))
    expect(store.getState().game.finalBreakdown).toBeNull()
    expect(store.getState().game.difficultyChosen).toBe(true)
    expect(store.getState().game.difficulty).toBe("intermediate")
  })
})
