import { configureStore } from '@reduxjs/toolkit'
import { GameAction } from '../../app/game'
import { thePlayer } from '../../app/gamePlayer'
import gameReducer, {
  clearFinalBreakdown,
  initialState,
  resetDifficultyChoice,
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
