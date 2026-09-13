import type { Difficulty } from './difficulty'
import type { GameBreakdown, PlayerBreakdown } from './game'

const STORAGE_KEY = "cribbagex.v1"

export type StoredPreferences = { difficulty: Difficulty }

export type StoredStats = {
  gamesPlayed: number
  playerWins: number
  opponentWins: number
  lifetime: { player: PlayerBreakdown, opponent: PlayerBreakdown }
}

type StoredV1 = {
  preferences: StoredPreferences
  stats: StoredStats
}

const DEFAULT_PREFS: StoredPreferences = { difficulty: "intermediate" }

function emptyPlayerBreakdown(): PlayerBreakdown {
  return { hand: 0, crib: 0, pegging: 0, bonuses: 0, total: 0 }
}

function emptyStats(): StoredStats {
  return {
    gamesPlayed: 0,
    playerWins: 0,
    opponentWins: 0,
    lifetime: { player: emptyPlayerBreakdown(), opponent: emptyPlayerBreakdown() },
  }
}

let sessionStats: StoredStats = emptyStats()

function isDifficulty(value: unknown): value is Difficulty {
  return value === "easy" || value === "intermediate" || value === "expert"
}

function finiteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function sanitizeBreakdown(raw: unknown): PlayerBreakdown {
  const src = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}
  const hand = finiteNumber(src.hand)
  const crib = finiteNumber(src.crib)
  const pegging = finiteNumber(src.pegging)
  const bonuses = finiteNumber(src.bonuses)
  return {
    hand,
    crib,
    pegging,
    bonuses,
    total: hand + crib + pegging + bonuses,
  }
}

function sanitizeStats(raw: unknown): StoredStats {
  const src = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}
  const lifetimeRaw = src.lifetime && typeof src.lifetime === "object"
    ? src.lifetime as Record<string, unknown>
    : {}
  return {
    gamesPlayed: finiteNumber(src.gamesPlayed),
    playerWins: finiteNumber(src.playerWins),
    opponentWins: finiteNumber(src.opponentWins),
    lifetime: {
      player: sanitizeBreakdown(lifetimeRaw.player),
      opponent: sanitizeBreakdown(lifetimeRaw.opponent),
    },
  }
}

function sanitizeBlob(raw: unknown): StoredV1 | null {
  if( !raw || typeof raw !== "object" ) {
    return null
  }
  const src = raw as Record<string, unknown>
  if( !("preferences" in src) || !("stats" in src) ) {
    return null
  }
  const prefsRaw = src.preferences && typeof src.preferences === "object"
    ? src.preferences as Record<string, unknown>
    : {}
  return {
    preferences: {
      difficulty: isDifficulty(prefsRaw.difficulty) ? prefsRaw.difficulty : "intermediate",
    },
    stats: sanitizeStats(src.stats),
  }
}

function readBlob(): StoredV1 | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if( raw === null ) {
      return null
    }
    return sanitizeBlob(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeBlob(data: StoredV1): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // private mode, quota, or disabled storage — keep in-memory defaults
  }
}

function currentBlob(): StoredV1 {
  return readBlob() ?? { preferences: { ...DEFAULT_PREFS }, stats: emptyStats() }
}

function addBreakdown(into: PlayerBreakdown, add: PlayerBreakdown): PlayerBreakdown {
  const hand = into.hand + add.hand
  const crib = into.crib + add.crib
  const pegging = into.pegging + add.pegging
  const bonuses = into.bonuses + add.bonuses
  return { hand, crib, pegging, bonuses, total: hand + crib + pegging + bonuses }
}

function applyResult(stats: StoredStats, result: GameBreakdown): StoredStats {
  return {
    gamesPlayed: stats.gamesPlayed + 1,
    playerWins: stats.playerWins + (result.winner === "player" ? 1 : 0),
    opponentWins: stats.opponentWins + (result.winner === "opponent" ? 1 : 0),
    lifetime: {
      player: addBreakdown(stats.lifetime.player, result.player),
      opponent: addBreakdown(stats.lifetime.opponent, result.opponent),
    },
  }
}

export function loadPreferences(): StoredPreferences {
  const blob = readBlob()
  return blob ? { ...blob.preferences } : { ...DEFAULT_PREFS }
}

export function savePreferences(prefs: Partial<StoredPreferences>): void {
  const blob = currentBlob()
  const nextDifficulty = prefs.difficulty
  blob.preferences = {
    difficulty: isDifficulty(nextDifficulty) ? nextDifficulty : blob.preferences.difficulty,
  }
  writeBlob(blob)
}

export function loadStats(): StoredStats {
  const blob = readBlob()
  return blob ? blob.stats : emptyStats()
}

export function loadSessionStats(): StoredStats {
  return {
    gamesPlayed: sessionStats.gamesPlayed,
    playerWins: sessionStats.playerWins,
    opponentWins: sessionStats.opponentWins,
    lifetime: {
      player: { ...sessionStats.lifetime.player },
      opponent: { ...sessionStats.lifetime.opponent },
    },
  }
}

export function recordCompletedGame(result: GameBreakdown): void {
  sessionStats = applyResult(sessionStats, result)
  const blob = currentBlob()
  blob.stats = applyResult(blob.stats, result)
  writeBlob(blob)
}

export function clearAll(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  sessionStats = emptyStats()
}
