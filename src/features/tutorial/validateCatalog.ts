import { Card, cardKey } from '../../app/entities'
import { explainPegPlay, rankDiscards, scoreHandDetailed } from '../../app/game'
import { BEGINNER_PATH, QUICK_PRACTICE } from './lessonCatalog'
import {
  DISCARD_SCENARIOS,
  PEG_SCENARIOS,
  ROUND_SCRIPTS,
  SCORE_SCENARIOS,
} from './scenarios'
import { discardPairKey, specToCard, specsToCards } from './tutorialCards'
import {
  CHECKPOINT_CONCEPTS,
  REQUIRED_CONCEPTS,
  type ConceptId,
  type DiscardScenario,
  type Lesson,
  type PegScenario,
  type RoundScript,
  type ScoreScenario,
  type TutorialStep,
} from './tutorialTypes'

export type CatalogProblem = { where: string; problem: string }

const SLUG = /^[a-z0-9-]+$/
const REAL_SUITS = new Set(["hearts", "diamonds", "spades", "clubs"])

function add(problems: CatalogProblem[], where: string, problem: string): void {
  problems.push({ where, problem })
}

/** Exported so tests can prove this check actually rejects a duplicate id
 *  instead of `validateCatalog() === []` only meaning "nobody broke it yet". */
export function uniqueSlug(seen: Set<string>, id: string, where: string, problems: CatalogProblem[]): void {
  if (!SLUG.test(id)) {
    add(problems, where, `id "${id}" is not slug-shaped`)
  }
  if (seen.has(id)) {
    add(problems, where, `duplicate id "${id}"`)
  }
  seen.add(id)
}

/** Exported for the same reason as `uniqueSlug` — negative fixtures (an
 *  authored "joker" suit, an out-of-range rank, a duplicate card) must be
 *  provably caught, not merely assumed caught because the real catalog is clean. */
export function checkCards(where: string, specs: ReadonlyArray<readonly [string, number]>, problems: CatalogProblem[]): void {
  const keys = new Set<string>()
  for (const [suit, rank] of specs) {
    if (!REAL_SUITS.has(suit)) {
      add(problems, where, `suit "${suit}" is not a real suit`)
    }
    if (rank < 1 || rank > 13) {
      add(problems, where, `rank ${rank} is out of range`)
    }
    const key = cardKey(new Card(suit as "hearts", rank as 1))
    if (keys.has(key)) {
      add(problems, where, `duplicate card ${key}`)
    }
    keys.add(key)
  }
}

/** Exported so a zero-total (unscored) score scenario can be proven to fail
 *  validation, rather than only asserted true of the real catalog. */
export function checkScoreScenario(id: string, sc: ScoreScenario): ReadonlyArray<CatalogProblem> {
  const problems: CatalogProblem[] = []
  const where = `score:${id}`
  if (sc.id !== id) {
    add(problems, where, "record key does not match scenario.id")
  }
  checkCards(where, [...sc.hand, ...(sc.starter ? [sc.starter] : [])], problems)
  const hand = specsToCards(sc.hand)
  const starter = sc.starter ? specToCard(sc.starter) : undefined
  const result = scoreHandDetailed(hand, starter, sc.isCrib)
  if (result.total <= 0) {
    add(problems, where, "scoreHandDetailed total is not > 0")
  }
  if (sc.require) {
    for (const cat of sc.require) {
      if (!result.groups.some((g) => g.category === cat)) {
        add(problems, where, `require category ${cat} is missing from the hand`)
      }
    }
  }
  const selectable = new Set(
    [...sc.hand, ...(sc.starter ? [sc.starter] : [])].map((spec) => cardKey(specToCard(spec))),
  )
  const required = sc.require
    ? result.groups.filter((g) => sc.require?.includes(g.category))
    : result.groups
  if (required.length === 0) {
    add(problems, where, "no required scoring group is reachable")
  }
  for (const g of required) {
    for (const cardId of g.cardIds) {
      if (!selectable.has(cardId)) {
        add(problems, where, `group ${g.id} needs card ${cardId}, which is not selectable (hand plus starter)`)
      }
    }
  }
  return problems
}

/** Exported for the same reason as `checkScoreScenario`. */
export function checkDiscardScenario(id: string, sc: DiscardScenario): ReadonlyArray<CatalogProblem> {
  const problems: CatalogProblem[] = []
  const where = `discard:${id}`
  checkCards(where, sc.hand, problems)
  const hand = specsToCards(sc.hand)
  const ranked = rankDiscards(hand, [], sc.isPlayerCrib)
  if (ranked.length !== 15) {
    add(problems, where, `rankDiscards returned ${ranked.length}, expected 15`)
  }
  if (sc.acceptTopN < 1 || sc.acceptTopN > 15) {
    add(problems, where, "acceptTopN must be in 1..15")
  }
  const legalKeys = new Set<string>()
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      legalKeys.add(discardPairKey(cardKey(hand[i]), cardKey(hand[j])))
    }
  }
  for (const key of Object.keys(sc.reasons)) {
    if (!legalKeys.has(key)) {
      add(problems, where, `reasons key "${key}" is not a two-card subset`)
    }
  }
  if (ranked[0]) {
    const bestKey = discardPairKey(cardKey(ranked[0].discard[0]), cardKey(ranked[0].discard[1]))
    if (!sc.reasons[bestKey]) {
      add(problems, where, `engine best discard ${bestKey} has no reasons entry`)
    }
  }
  if (sc.hints.length !== 3) {
    add(problems, where, "hints must have exactly three tiers")
  }
  if (new Set(sc.hints).size !== sc.hints.length) {
    add(problems, where, "hint tiers must be distinct")
  }
  if (!sc.prompt.includes(sc.isPlayerCrib ? "your crib" : "their crib")) {
    add(problems, where, `prompt must name the crib owner ("${sc.isPlayerCrib ? "your crib" : "their crib"}")`)
  }
  if (!/peg/i.test(sc.prompt)) {
    add(problems, where, "prompt must mention pegging")
  }
  return problems
}

/** Exported for the same reason as `checkScoreScenario`. */
export function checkPegScenario(id: string, sc: PegScenario): ReadonlyArray<CatalogProblem> {
  const problems: CatalogProblem[] = []
  const where = `peg:${id}`
  checkCards(where, [...sc.sequence, ...sc.hand, ...sc.opponentScript], problems)
  const seq = specsToCards(sc.sequence)
  const sum = seq.reduce((s, c) => s + c.value, 0)
  if (sum > 31) {
    add(problems, where, `sequence sums to ${sum}`)
  }
  let running = [...seq]
  for (const play of sc.opponentScript) {
    const card = specToCard(play)
    const result = explainPegPlay(running, card)
    if (!result.legal) {
      add(problems, where, `scripted play ${cardKey(card)} is illegal at count ${result.newCount}`)
    }
    running = [...running, card]
  }
  return problems
}

function scenarioIdsForStep(step: TutorialStep): string[] {
  if (step.kind === "score-example" || step.kind === "score-practice"
    || step.kind === "discard-practice" || step.kind === "peg-practice") {
    return [step.scenarioId]
  }
  if (step.kind === "checkpoint") {
    return [...step.scenarioIds]
  }
  return []
}

function teachesConcepts(lesson: Lesson, step: TutorialStep): ReadonlyArray<ConceptId> {
  if (step.kind === "score-example") {
    return SCORE_SCENARIOS[step.scenarioId]?.concepts ?? []
  }
  if (step.kind === "explain" || step.kind === "round-map") {
    return lesson.concepts
  }
  if (step.kind === "recap") {
    return step.concepts
  }
  return []
}

function assessesConcepts(step: TutorialStep): ReadonlyArray<ConceptId> {
  if (step.kind === "score-practice") {
    return SCORE_SCENARIOS[step.scenarioId]?.concepts ?? []
  }
  if (step.kind === "discard-practice") {
    return DISCARD_SCENARIOS[step.scenarioId]?.concepts ?? []
  }
  if (step.kind === "peg-practice") {
    return PEG_SCENARIOS[step.scenarioId]?.concepts ?? []
  }
  if (step.kind === "checkpoint") {
    return step.scenarioIds.flatMap((id) =>
      SCORE_SCENARIOS[id]?.concepts
      ?? DISCARD_SCENARIOS[id]?.concepts
      ?? PEG_SCENARIOS[id]?.concepts
      ?? [],
    )
  }
  if (step.kind === "guided-round") {
    return ROUND_SCRIPTS[step.scriptId]?.checkpoints.flatMap((c) => c.concepts) ?? []
  }
  return []
}

export function validateCatalog(): ReadonlyArray<CatalogProblem> {
  const problems: CatalogProblem[] = []
  const lessonIds = new Set<string>()
  const stepIds = new Set<string>()
  const scenarioIds = new Set<string>()

  for (const [id, sc] of Object.entries(SCORE_SCENARIOS)) {
    uniqueSlug(scenarioIds, id, `score:${id}`, problems)
    problems.push(...checkScoreScenario(id, sc))
  }

  for (const [id, sc] of Object.entries(DISCARD_SCENARIOS)) {
    uniqueSlug(scenarioIds, id, `discard:${id}`, problems)
    problems.push(...checkDiscardScenario(id, sc))
  }

  for (const [id, sc] of Object.entries(PEG_SCENARIOS)) {
    uniqueSlug(scenarioIds, id, `peg:${id}`, problems)
    problems.push(...checkPegScenario(id, sc))
  }

  for (const [id, script] of Object.entries(ROUND_SCRIPTS)) {
    uniqueSlug(scenarioIds, id, `script:${id}`, problems)
    checkCards(`script:${id}`, script.deck, problems)
    if (script.deck.length !== 13) {
      add(problems, `script:${id}`, "deck must have 13 cards")
    }
  }

  const allLessons = [...BEGINNER_PATH, ...QUICK_PRACTICE]
  for (const lesson of allLessons) {
    uniqueSlug(lessonIds, lesson.id, `lesson:${lesson.id}`, problems)
    const last = lesson.steps[lesson.steps.length - 1]
    if (!last || (last.kind !== "recap" && last.kind !== "checkpoint")) {
      add(problems, `lesson:${lesson.id}`, "final step must be recap or checkpoint")
    }
    for (const step of lesson.steps) {
      uniqueSlug(stepIds, step.id, `step:${step.id}`, problems)
      for (const sid of scenarioIdsForStep(step)) {
        if (!SCORE_SCENARIOS[sid] && !DISCARD_SCENARIOS[sid] && !PEG_SCENARIOS[sid]) {
          add(problems, `step:${step.id}`, `unknown scenarioId ${sid}`)
        }
      }
      if (step.kind === "guided-round" && !ROUND_SCRIPTS[step.scriptId]) {
        add(problems, `step:${step.id}`, `unknown scriptId ${step.scriptId}`)
      }
      if (step.kind === "round-demo") {
        for (const id of step.scriptIds) {
          const script = ROUND_SCRIPTS[id]
          if (!script) {
            add(problems, `step:${step.id}`, `unknown scriptId ${id}`)
          } else if (script.playerDiscard === undefined || script.playerPlays === undefined) {
            add(problems, `step:${step.id}`, `demo script ${id} needs playerDiscard and playerPlays`)
          }
        }
        const [firstId, secondId] = step.scriptIds
        const first = ROUND_SCRIPTS[firstId]
        const second = ROUND_SCRIPTS[secondId]
        if (first && second && first.dealer === second.dealer) {
          add(problems, `step:${step.id}`, "the two demo scripts must have opposite dealers")
        }
      }
    }
  }

  const covered = new Set<ConceptId>()
  for (const lesson of BEGINNER_PATH) {
    for (const c of lesson.concepts) {
      covered.add(c)
    }
  }
  for (const c of REQUIRED_CONCEPTS) {
    if (!covered.has(c)) {
      add(problems, "REQUIRED_CONCEPTS", `${c} does not appear on a beginner-path lesson`)
    }
  }

  const teachingLesson = new Map<ConceptId, number>()
  BEGINNER_PATH.forEach((lesson, lessonIdx) => {
    for (const step of lesson.steps) {
      for (const c of teachesConcepts(lesson, step)) {
        if (!teachingLesson.has(c)) {
          teachingLesson.set(c, lessonIdx)
        }
      }
    }
  })
  BEGINNER_PATH.forEach((lesson, lessonIdx) => {
    for (const step of lesson.steps) {
      for (const c of assessesConcepts(step)) {
        if (!CHECKPOINT_CONCEPTS.includes(c)) {
          continue
        }
        const taughtAt = teachingLesson.get(c)
        if (taughtAt === undefined || taughtAt >= lessonIdx) {
          add(problems, `checkpoint-order:${c}`, `${c} is assessed in ${lesson.id} before an earlier teaching lesson`)
        }
      }
    }
  })

  return problems
}

/** Exported for the same reason as `checkScoreScenario` — a demo script whose
 *  learner discard is not in the learner's dealt six, or whose learner plays
 *  are not the kept four, must be provably caught. */
export function checkPlayerSeat(script: RoundScript): ReadonlyArray<CatalogProblem> {
  const problems: CatalogProblem[] = []
  const where = `script:${script.id}`
  if (script.playerDiscard === undefined && script.playerPlays === undefined) {
    return problems
  }
  if (script.playerDiscard === undefined || script.playerPlays === undefined) {
    add(problems, where, "playerDiscard and playerPlays must be set together")
    return problems
  }
  const playerIdx = script.dealer === "player" ? [1, 3, 5, 7, 9, 11] : [0, 2, 4, 6, 8, 10]
  const playerSix = playerIdx.map((i) => script.deck[i])
  const playerKeys = new Set(playerSix.map((s) => cardKey(specToCard(s))))
  for (const d of script.playerDiscard) {
    const key = cardKey(specToCard(d))
    if (!playerKeys.has(key)) {
      add(problems, where, `playerDiscard ${key} is not in the learner's six`)
    }
  }
  const discardKeys = new Set(script.playerDiscard.map((s) => cardKey(specToCard(s))))
  const kept = playerSix.filter((s) => !discardKeys.has(cardKey(specToCard(s))))
  const playKeys = script.playerPlays.map((s) => cardKey(specToCard(s))).sort().join(",")
  const keptKeys = kept.map((s) => cardKey(specToCard(s))).sort().join(",")
  if (playKeys !== keptKeys) {
    add(problems, where, `playerPlays ${playKeys} !== kept four ${keptKeys}`)
  }
  return problems
}

export function validateRoundScripts(
  completeRound: (scriptId: string) => { ok: boolean; reason?: string },
): ReadonlyArray<CatalogProblem> {
  const problems: CatalogProblem[] = []
  for (const script of Object.values(ROUND_SCRIPTS)) {
    const dealer = script.dealer
    const opponentIdx = dealer === "player"
      ? [0, 2, 4, 6, 8, 10]
      : [1, 3, 5, 7, 9, 11]
    const opponentSix = opponentIdx.map((i) => script.deck[i])
    const oppKeys = new Set(opponentSix.map((s) => cardKey(specToCard(s))))
    for (const d of script.opponentDiscard) {
      if (!oppKeys.has(cardKey(specToCard(d)))) {
        add(problems, `script:${script.id}`, `opponentDiscard ${cardKey(specToCard(d))} is not in the opponent's six`)
      }
    }
    const discardKeys = new Set(script.opponentDiscard.map((s) => cardKey(specToCard(s))))
    const kept = opponentSix.filter((s) => !discardKeys.has(cardKey(specToCard(s))))
    const playKeys = script.opponentPlays.map((s) => cardKey(specToCard(s))).sort().join(",")
    const keptKeys = kept.map((s) => cardKey(specToCard(s))).sort().join(",")
    if (playKeys !== keptKeys) {
      add(problems, `script:${script.id}`, `opponentPlays ${playKeys} !== kept four ${keptKeys}`)
    }
    problems.push(...checkPlayerSeat(script))
    const result = completeRound(script.id)
    if (!result.ok) {
      add(problems, `script:${script.id}`, result.reason ?? "round did not complete")
    }
  }
  return problems
}
