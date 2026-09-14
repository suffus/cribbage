import type { Difficulty } from './difficulty'
import type { GameBreakdown, PlayerBreakdown } from './game'
import { findLesson } from '../features/tutorial/lessonCatalog'
import { CURRICULUM_VERSION, REQUIRED_CONCEPTS } from '../features/tutorial/tutorialTypes'
import type { ConceptId } from '../features/tutorial/tutorialTypes'

const STORAGE_KEY = "cribbagex.v1"

export type StoredPreferences = { difficulty: Difficulty }

export type StoredStats = {
  gamesPlayed: number
  playerWins: number
  opponentWins: number
  lifetime: { player: PlayerBreakdown, opponent: PlayerBreakdown }
}

export type ConceptMastery = { attempts: number; independentCorrect: number; hintsUsed: number }

export type TutorialProgress = {
  curriculumVersion: number
  startedAt?: string
  completedAt?: string
  completedLessonIds: string[]
  skippedStepIds: string[]
  currentLessonId?: string
  currentStepIndex: number
  conceptMastery: Partial<Record<ConceptId, ConceptMastery>>
}

type StoredV1 = {
  preferences: StoredPreferences
  stats: StoredStats
  tutorial: TutorialProgress
}

const KNOWN_CONCEPTS = new Set<string>(REQUIRED_CONCEPTS)

export function defaultTutorialProgress(): TutorialProgress {
  return {
    curriculumVersion: CURRICULUM_VERSION,
    completedLessonIds: [],
    skippedStepIds: [],
    currentStepIndex: 0,
    conceptMastery: {},
  }
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

function isDateOnly(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function uniqueCapped(values: unknown, allowed?: (id: string) => boolean, cap = 200): string[] {
  if (!Array.isArray(values)) {
    return []
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of values) {
    if (typeof item !== "string" || seen.has(item)) {
      continue
    }
    if (allowed && !allowed(item)) {
      continue
    }
    seen.add(item)
    out.push(item)
    if (out.length >= cap) {
      break
    }
  }
  return out
}

function sanitizeMastery(raw: unknown): Partial<Record<ConceptId, ConceptMastery>> {
  if (!raw || typeof raw !== "object") {
    return {}
  }
  const src = raw as Record<string, unknown>
  const out: Partial<Record<ConceptId, ConceptMastery>> = {}
  for (const key of Object.keys(src)) {
    if (!KNOWN_CONCEPTS.has(key)) {
      continue
    }
    const row = src[key] && typeof src[key] === "object" ? src[key] as Record<string, unknown> : {}
    out[key as ConceptId] = {
      attempts: Math.max(0, finiteNumber(row.attempts)),
      independentCorrect: Math.max(0, finiteNumber(row.independentCorrect)),
      hintsUsed: Math.max(0, finiteNumber(row.hintsUsed)),
    }
  }
  return out
}

function sanitizeTutorial(raw: unknown): TutorialProgress {
  const fallback = defaultTutorialProgress()
  if (!raw || typeof raw !== "object") {
    return fallback
  }
  const src = raw as Record<string, unknown>
  const version = finiteNumber(src.curriculumVersion)
  if (version !== CURRICULUM_VERSION) {
    return fallback
  }
  const completedLessonIds = uniqueCapped(src.completedLessonIds, (id) => !!findLesson(id))
  const skippedStepIds = uniqueCapped(src.skippedStepIds)
  const currentLessonId = typeof src.currentLessonId === "string" && findLesson(src.currentLessonId)
    ? src.currentLessonId
    : undefined
  const lesson = currentLessonId ? findLesson(currentLessonId) : undefined
  const rawIndex = Math.floor(finiteNumber(src.currentStepIndex))
  const currentStepIndex = lesson
    ? Math.min(Math.max(0, rawIndex), Math.max(0, lesson.steps.length - 1))
    : 0
  return {
    curriculumVersion: CURRICULUM_VERSION,
    startedAt: isDateOnly(src.startedAt) ? src.startedAt : undefined,
    completedAt: isDateOnly(src.completedAt) ? src.completedAt : undefined,
    completedLessonIds,
    skippedStepIds,
    currentLessonId,
    currentStepIndex,
    conceptMastery: sanitizeMastery(src.conceptMastery),
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
    tutorial: sanitizeTutorial(src.tutorial),
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
  return readBlob() ?? {
    preferences: { ...DEFAULT_PREFS },
    stats: emptyStats(),
    tutorial: defaultTutorialProgress(),
  }
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
  const tutorial = currentBlob().tutorial
  sessionStats = emptyStats()
  writeBlob({
    preferences: { ...DEFAULT_PREFS },
    stats: emptyStats(),
    tutorial,
  })
}

export function loadTutorialProgress(): TutorialProgress {
  const tutorial = currentBlob().tutorial
  return { ...tutorial, conceptMastery: { ...tutorial.conceptMastery } }
}

export function saveTutorialProgress(patch: Partial<TutorialProgress>): void {
  const blob = currentBlob()
  blob.tutorial = sanitizeTutorial({ ...blob.tutorial, ...patch })
  writeBlob(blob)
}

export function recordConceptAttempt(
  concept: ConceptId,
  outcome: { correct: boolean; hintLevel: number },
): void {
  const progress = loadTutorialProgress()
  const prev = progress.conceptMastery[concept] ?? { attempts: 0, independentCorrect: 0, hintsUsed: 0 }
  const independent = outcome.correct && outcome.hintLevel < 2
  progress.conceptMastery[concept] = {
    attempts: prev.attempts + 1,
    independentCorrect: prev.independentCorrect + (independent ? 1 : 0),
    hintsUsed: prev.hintsUsed + Math.max(0, outcome.hintLevel),
  }
  saveTutorialProgress({ conceptMastery: progress.conceptMastery })
}

export function clearTutorialProgress(): void {
  const blob = currentBlob()
  blob.tutorial = defaultTutorialProgress()
  writeBlob(blob)
}
