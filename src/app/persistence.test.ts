import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameBreakdown } from './game'
import {
  clearAll,
  loadPreferences,
  loadSessionStats,
  loadStats,
  recordCompletedGame,
  savePreferences,
} from './persistence'

function fixture(winner: "player" | "opponent"): GameBreakdown {
  return {
    player: { hand: 10, crib: 4, pegging: 6, bonuses: 2, total: 22 },
    opponent: { hand: 8, crib: 0, pegging: 3, bonuses: 0, total: 11 },
    winner,
    rounds: 3,
    difficulty: "easy",
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  clearAll()
})

describe("T9 persistence resilience", () => {
  it("does not throw when setItem throws and loaders return defaults", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota")
    })
    expect(() => savePreferences({ difficulty: "easy" })).not.toThrow()
    expect(() => recordCompletedGame(fixture("player"))).not.toThrow()
    expect(loadPreferences()).toEqual({ difficulty: "intermediate" })
    expect(loadStats().gamesPlayed).toBe(0)
  })

  it("returns defaults for malformed JSON", () => {
    localStorage.setItem("cribbagex.v1", "{not json")
    expect(loadPreferences()).toEqual({ difficulty: "intermediate" })
    expect(loadStats().gamesPlayed).toBe(0)
  })

  it("sanitises unknown difficulty and non-finite counts", () => {
    localStorage.setItem("cribbagex.v1", JSON.stringify({
      preferences: { difficulty: "nightmare" },
      stats: { gamesPlayed: "nope", playerWins: 1, opponentWins: 0, lifetime: {} },
    }))
    expect(loadPreferences().difficulty).toBe("intermediate")
    expect(loadStats().gamesPlayed).toBe(0)
  })

  it("records games including conceded opponent wins and clears both stores", () => {
    savePreferences({ difficulty: "easy" })
    expect(loadPreferences().difficulty).toBe("easy")
    recordCompletedGame(fixture("player"))
    const afterWin = loadStats()
    expect(afterWin.gamesPlayed).toBe(1)
    expect(afterWin.playerWins).toBe(1)
    expect(afterWin.lifetime.player.total).toBe(22)
    recordCompletedGame(fixture("opponent"))
    const afterQuit = loadStats()
    expect(afterQuit.gamesPlayed).toBe(2)
    expect(afterQuit.opponentWins).toBe(1)
    expect(loadSessionStats().gamesPlayed).toBe(2)
    clearAll()
    expect(loadStats().gamesPlayed).toBe(0)
    expect(loadSessionStats().gamesPlayed).toBe(0)
    expect(loadPreferences().difficulty).toBe("intermediate")
  })

  it("discards a blob that is missing preferences or stats", () => {
    localStorage.setItem("cribbagex.v1", JSON.stringify({ preferences: { difficulty: "easy" } }))
    expect(loadPreferences()).toEqual({ difficulty: "intermediate" })
    expect(loadStats().gamesPlayed).toBe(0)
    localStorage.setItem("cribbagex.v1", JSON.stringify({ stats: { gamesPlayed: 9 } }))
    expect(loadPreferences()).toEqual({ difficulty: "intermediate" })
  })

  it("merges savePreferences without wiping recorded stats", () => {
    recordCompletedGame(fixture("player"))
    savePreferences({ difficulty: "expert" })
    expect(loadPreferences().difficulty).toBe("expert")
    expect(loadStats().gamesPlayed).toBe(1)
    expect(loadStats().lifetime.player.total).toBe(22)
  })

  it("does not throw when getItem or removeItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied")
    })
    expect(loadPreferences()).toEqual({ difficulty: "intermediate" })
    expect(loadStats().gamesPlayed).toBe(0)
    vi.restoreAllMocks()
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("denied")
    })
    expect(() => clearAll()).not.toThrow()
    expect(loadSessionStats().gamesPlayed).toBe(0)
  })

  it("sanitises Infinity and NaN and keeps an invalid save from clobbering prefs", () => {
    localStorage.setItem("cribbagex.v1", JSON.stringify({
      preferences: { difficulty: "expert" },
      stats: {
        gamesPlayed: Number.POSITIVE_INFINITY,
        playerWins: Number.NaN,
        opponentWins: 2,
        lifetime: { player: { hand: 3, crib: "x", pegging: 1, bonuses: 0 } },
      },
    }))
    const stats = loadStats()
    expect(stats.gamesPlayed).toBe(0)
    expect(stats.playerWins).toBe(0)
    expect(stats.opponentWins).toBe(2)
    expect(stats.lifetime.player).toEqual({ hand: 3, crib: 0, pegging: 1, bonuses: 0, total: 4 })
    savePreferences({ difficulty: "easy" })
    savePreferences({ difficulty: "nightmare" as unknown as "easy" })
    expect(loadPreferences().difficulty).toBe("easy")
  })

  it("copies session stats and does not count an undefined winner as a seat win", () => {
    recordCompletedGame(fixture("player"))
    const copy = loadSessionStats()
    copy.gamesPlayed = 99
    copy.lifetime.player.hand = 99
    expect(loadSessionStats().gamesPlayed).toBe(1)
    expect(loadSessionStats().lifetime.player.hand).toBe(10)
    const orphan = fixture("player")
    orphan.winner = undefined
    recordCompletedGame(orphan)
    expect(loadStats().gamesPlayed).toBe(2)
    expect(loadStats().playerWins).toBe(1)
    expect(loadStats().opponentWins).toBe(0)
    expect(loadSessionStats().gamesPlayed).toBe(2)
  })
})

describe("persistence module boundary", () => {
  it("does not import the Redux slice or GamePlayer", async () => {
    const source = await import('./persistence.ts?raw')
    expect(source.default).not.toMatch(/gameSlice/)
    expect(source.default).not.toMatch(/gamePlayer/)
    expect(source.default).toMatch(/cribbagex\.v1/)
  })
})
