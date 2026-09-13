import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { StdDeck } from './app/entities'
import { thePlayer } from './app/gamePlayer'
import { clearAll, loadStats } from './app/persistence'
import gameReducer, { initialState } from './features/game/gameSlice'
import Cribbage from './Cribbage'
import cribbageSource from './Cribbage.tsx?raw'

function renderTable() {
  thePlayer.resetForNewSession()
  const store = configureStore({ reducer: { game: gameReducer } })
  return {
    store,
    user: userEvent.setup(),
    ...render(
      <Provider store={store}>
        <MemoryRouter>
          <Cribbage deck={new StdDeck("rc")} />
        </MemoryRouter>
      </Provider>
    ),
  }
}

describe("T8 difficulty gate", () => {
  afterEach(() => {
    clearAll()
  })

  it("shows the difficulty dialog and hides Start The Round until confirm", async () => {
    const { user } = renderTable()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/choose your opponent/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start The Round!' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quit!' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start Game' }))
    expect(screen.getByRole('button', { name: 'Start The Round!' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quit!' })).toBeInTheDocument()
  })

  it("confirms Easy and keeps Auto Select on the Expert wrapper", async () => {
    const { store, user } = renderTable()
    await user.click(screen.getByRole('radio', { name: /easy/i }))
    await user.click(screen.getByRole('button', { name: 'Start Game' }))
    expect(store.getState().game.difficulty).toBe("easy")
    expect(cribbageSource).toMatch(/const keepers = getBestHand/)
    expect(cribbageSource).not.toMatch(/pickWeightedIndex/)
  })

  it("shows the deck picker before the modal when no deck is supplied", () => {
    thePlayer.resetForNewSession()
    const store = configureStore({ reducer: { game: gameReducer } })
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Cribbage />
        </MemoryRouter>
      </Provider>
    )
    expect(screen.queryByText(/choose your opponent/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start The Round!' })).not.toBeInTheDocument()
    expect(document.querySelectorAll('img').length).toBeGreaterThan(0)
  })

  it("hides table actions and records a result when a snapshot is published", () => {
    thePlayer.resetForNewSession()
    clearAll()
    const store = configureStore({
      reducer: { game: gameReducer },
      preloadedState: {
        game: {
          ...initialState,
          difficulty: "expert" as const,
          difficultyChosen: true,
          finalBreakdown: {
            player: { hand: 6, crib: 0, pegging: 2, bonuses: 0, total: 8 },
            opponent: { hand: 4, crib: 2, pegging: 0, bonuses: 2, total: 8 },
            winner: "opponent" as const,
            rounds: 1,
            difficulty: "expert" as const,
          },
        },
      },
    })
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Cribbage deck={new StdDeck("rc")} />
        </MemoryRouter>
      </Provider>
    )
    expect(screen.getByText("Your opponent wins!")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start The Round!' })).not.toBeInTheDocument()
    expect(loadStats().gamesPlayed).toBe(1)
    expect(loadStats().opponentWins).toBe(1)
  })
})
