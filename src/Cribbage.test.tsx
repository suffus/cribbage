import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { Card, Hand, StdDeck } from './app/entities'
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

  it("Start Round works after back-to-menu reset from a finished game", async () => {
    thePlayer.game.stage = "ending"
    thePlayer.game.gameOver = true
    thePlayer.resetForNewSession()
    const store = configureStore({
      reducer: { game: gameReducer },
      preloadedState: {
        game: {
          ...initialState,
          difficulty: "easy" as const,
          difficultyChosen: true,
        },
      },
    })
    const user = userEvent.setup()
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Cribbage deck={new StdDeck("rc")} />
        </MemoryRouter>
      </Provider>
    )
    await user.click(screen.getByRole("button", { name: "Start The Round!" }))
    expect(thePlayer.game.stage).not.toBe("ending")
    expect(["cutting", "dealing", "selection", "playing"]).toContain(thePlayer.game.stage)
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

function renderShowTable(flags: {
  showPlayer?: boolean
  showOpponent?: boolean
  showCrib?: boolean
} = { showPlayer: true }) {
  thePlayer.resetForNewSession()
  const game = thePlayer.game
  game.stage = "showing"
  const starter = new Card("spades", 5)
  starter.isFaceUp = true
  game.starter = starter
  const playerCards = [
    new Card("hearts", 5),
    new Card("clubs", 5),
    new Card("diamonds", 5),
    new Card("spades", 11),
  ]
  playerCards.forEach((c) => { c.isFaceUp = true })
  game.savedPlayerHand = new Hand(playerCards)
  game.scores["player-hand"] = 29
  const opponentCards = [
    new Card("hearts", 2),
    new Card("clubs", 3),
    new Card("diamonds", 4),
    new Card("spades", 6),
  ]
  opponentCards.forEach((c) => { c.isFaceUp = true })
  game.savedOpponentHand = new Hand(opponentCards)
  game.scores["opponent-hand"] = 7
  const cribCards = [
    new Card("hearts", 13),
    new Card("clubs", 13),
    new Card("diamonds", 2),
    new Card("spades", 3),
  ]
  cribCards.forEach((c) => { c.isFaceUp = true })
  game.crib = new Hand(cribCards)
  game.scores.crib = 6

  const store = configureStore({
    reducer: { game: gameReducer },
    preloadedState: {
      game: {
        ...initialState,
        difficulty: "easy" as const,
        difficultyChosen: true,
        showPlayer: flags.showPlayer ?? false,
        showOpponent: flags.showOpponent ?? false,
        showCrib: flags.showCrib ?? false,
        nextScheduledAction: -1,
      },
    },
  })
  return {
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

describe("play-area notices", () => {
  it("shows a game message in the play area without a dismiss control", () => {
    thePlayer.resetForNewSession()
    const store = configureStore({
      reducer: { game: gameReducer },
      preloadedState: {
        game: {
          ...initialState,
          difficulty: "easy" as const,
          difficultyChosen: true,
          message: "Click a card to cut for dealer",
          nextScheduledAction: -1,
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
    const notice = screen.getByRole("status")
    expect(notice).toHaveTextContent("Click a card to cut for dealer")
    expect(notice).toHaveClass("playNotice")
    expect(notice.querySelector("button")).toBeNull()
    expect(screen.getByRole("button", { name: "Start The Round!" })).toBeEnabled()
  })
})

describe("show-phase score breakdown", () => {
  it("keeps the count breakdown closed until the info icon is clicked", async () => {
    const { user } = renderShowTable({ showPlayer: true, showOpponent: true, showCrib: true })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByText("Four of a kind")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "How your hand was counted" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "How the opponent's hand was counted" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "How the crib was counted" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "How your hand was counted" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("Your hand")).toBeInTheDocument()
    expect(screen.getByText("Four of a kind")).toBeInTheDocument()
    expect(screen.getByLabelText("Total 29")).toBeInTheDocument()
    expect(document.querySelector(".scoreBreakdown-dialog")).toBeInTheDocument()

    const closeButtons = screen.getAllByRole("button", { name: "Close" })
    await user.click(closeButtons[closeButtons.length - 1])
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("does not put an info icon on the pegging count", () => {
    thePlayer.resetForNewSession()
    const game = thePlayer.game
    game.stage = "playing"
    game.playingHand.add([new Card("hearts", 5), new Card("clubs", 10)])
    game.playingHand.setFaceUp(true)
    const store = configureStore({
      reducer: { game: gameReducer },
      preloadedState: {
        game: {
          ...initialState,
          difficulty: "easy" as const,
          difficultyChosen: true,
          nextScheduledAction: -1,
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
    expect(screen.queryByRole("button", { name: /how .* counted/i })).not.toBeInTheDocument()
  })
})
