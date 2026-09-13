import { configureStore } from '@reduxjs/toolkit'
import { GameAction } from '../../app/game'
import { thePlayer } from '../../app/gamePlayer'
import gameReducer, {
  clearFinalBreakdown,
  initialState,
  resetDifficultyChoice,
  resetGameUi,
  setDifficulty,
} from './gameSlice'

describe("T6 difficulty survives prepare-board", () => {
  beforeEach(() => {
    thePlayer.resetForNewSession()
  })

  it("setDifficulty marks the choice and prepare-board keeps it", () => {
    const store = configureStore({ reducer: { game: gameReducer } })
    store.dispatch(setDifficulty("easy"))
    expect(store.getState().game.difficulty).toBe("easy")
    expect(store.getState().game.difficultyChosen).toBe(true)

    const state = {
      ...store.getState().game,
      finalBreakdown: {
        player: { hand: 1, crib: 0, pegging: 0, bonuses: 0, total: 1 },
        opponent: { hand: 0, crib: 0, pegging: 0, bonuses: 0, total: 0 },
        winner: "player" as const,
        rounds: 1,
        difficulty: "easy" as const,
      },
    }
    thePlayer.handleAction(state, new GameAction("prepare-board"))
    expect(thePlayer.stateUpdate.difficulty).toBe("easy")
    expect(thePlayer.stateUpdate.difficultyChosen).toBe(true)
    expect(thePlayer.stateUpdate.finalBreakdown).toBeNull()
  })

  it("resetDifficultyChoice and clearFinalBreakdown update only those fields", () => {
    const store = configureStore({ reducer: { game: gameReducer } })
    store.dispatch(setDifficulty("expert"))
    store.dispatch(resetDifficultyChoice())
    store.dispatch(clearFinalBreakdown())
    expect(store.getState().game.difficulty).toBe("expert")
    expect(store.getState().game.difficultyChosen).toBe(false)
    expect(store.getState().game.finalBreakdown).toBeNull()
    expect(initialState.difficultyChosen).toBe(false)
  })

  it("resetGameUi clears the finished-game display state and preserves difficulty", () => {
    const store = configureStore({
      reducer: { game: gameReducer },
      preloadedState: {
        game: {
          ...initialState,
          message: "opponent has won the game",
          gameStage: "ending" as const,
          nextScheduledAction: 100,
          showCrib: true,
          showPlayer: true,
          showOpponent: true,
          playerPeg: { track: 0, points: [84, 82, 80] },
          opponentPeg: { track: 1, points: [121, 119, 117] },
          difficulty: "expert" as const,
          difficultyChosen: true,
          finalBreakdown: {
            player: { hand: 50, crib: 10, pegging: 20, bonuses: 0, total: 80 },
            opponent: { hand: 80, crib: 20, pegging: 21, bonuses: 0, total: 121 },
            winner: "opponent" as const,
            rounds: 8,
            difficulty: "expert" as const,
          },
        },
      },
    })

    store.dispatch(resetGameUi())

    const state = store.getState().game
    expect(state.message).toBe("")
    expect(state.gameStage).toBe("starting")
    expect(state.nextScheduledAction).toBe(-1)
    expect(state.showCrib).toBe(false)
    expect(state.showPlayer).toBe(false)
    expect(state.showOpponent).toBe(false)
    expect(state.playerPeg.points).toEqual([0, -1, -1])
    expect(state.opponentPeg.points).toEqual([0, -1, -1])
    expect(state.difficulty).toBe("expert")
    expect(state.difficultyChosen).toBe(false)
    expect(state.finalBreakdown).toBeNull()
  })

  it("seeds difficulty from a valid Difficulty and leaves the gate closed", () => {
    expect(["easy", "intermediate", "expert"]).toContain(initialState.difficulty)
    expect(initialState.difficultyChosen).toBe(false)
    expect(initialState.finalBreakdown).toBeNull()
  })

  it("setDifficulty does not clear an existing finalBreakdown", () => {
    const store = configureStore({ reducer: { game: gameReducer } })
    store.dispatch(setDifficulty("intermediate"))
    expect(store.getState().game.difficulty).toBe("intermediate")
    expect(store.getState().game.finalBreakdown).toBeNull()
  })
})
