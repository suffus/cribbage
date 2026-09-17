import { cardKey, cardName, type Card } from '../../app/entities'
import {
  explainPegPlay,
  rankDiscards,
  scoreHandDetailed,
  type ScoringCategory,
  type ScoringGroup,
} from '../../app/game'
import type { DiscardOption, PegPlayResult } from '../../app/game'
import type { PCard } from '../../features/game/gameSlice'
import { describeDiscardComparison, describeGroup, describeMissingCategory, describePegOutcome } from './tutorialCopy'
import { discardPairKey, specToCard, specsToCards } from './tutorialCards'
import type {
  CardSpec,
  DiscardScenario,
  PegScenario,
  ScoreScenario,
  TutorialStep,
} from './tutorialTypes'
import { DISCARD_SCENARIOS, PEG_SCENARIOS, SCORE_SCENARIOS } from './scenarios'

export type HintState = {
  found: ReadonlyArray<string>
  subIndex: number
}

export type ScoreGradeResult = {
  matched: ReadonlyArray<ScoringGroup>
  credited: boolean
  required: ReadonlyArray<ScoringGroup>
  remainingByCategory: Readonly<Record<ScoringCategory, number>>
  message: string
}

/** T4's category-progress `<dl>` ("Fifteens 1 of 2", "Pairs not started") is
 *  driven from this shape, computed here rather than in the component layer
 *  so `CoachPanel` never has to re-derive scoring categories from a scenario. */
export type CategoryProgress = Partial<Record<ScoringCategory, { found: number; total: number }>>

function sameIdSet(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) {
    return false
  }
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((id, i) => id === sb[i])
}

function emptyRemaining(): Record<ScoringCategory, number> {
  return { fifteen: 0, pair: 0, run: 0, flush: 0, nobs: 0 }
}

function requiredGroups(scenario: ScoreScenario): ScoringGroup[] {
  const result = scoreHandDetailed(
    specsToCards(scenario.hand),
    scenario.starter ? specToCard(scenario.starter) : undefined,
    scenario.isCrib,
  )
  if (!scenario.require) {
    return [...result.groups]
  }
  return result.groups.filter((g) => scenario.require?.includes(g.category))
}

function remainingOf(required: ReadonlyArray<ScoringGroup>, found: ReadonlyArray<string>): Record<ScoringCategory, number> {
  const remaining = emptyRemaining()
  for (const g of required) {
    if (!found.includes(g.id)) {
      remaining[g.category] += 1
    }
  }
  return remaining
}

function whyNotScore(selected: ReadonlyArray<string>, scenario: ScoreScenario): string {
  const cards = [...scenario.hand, ...(scenario.starter ? [scenario.starter] : [])]
    .map(specToCard)
    .filter((c) => selected.includes(cardKey(c)))
  if (cards.length < 2) {
    return "Select two or more cards that score together."
  }
  const sum = cards.reduce((s, c) => s + c.value, 0)
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b)
  const allPair = cards.length === 2 && ranks[0] === ranks[1]
  if (allPair) {
    return "Those two cards are a pair — if they were not credited, they may already be counted."
  }
  const consecutive = ranks.every((r, i) => i === 0 || r === ranks[i - 1] || r === ranks[i - 1] + 1)
  const distinct = new Set(ranks).size
  if (sum === 15) {
    return "Those cards add to 15. If they were not credited, that fifteen may already be counted."
  }
  if (cards.length >= 3 && consecutive && distinct >= 3) {
    return "Those ranks look like a run. If they were not credited, that run may already be counted."
  }
  if (cards.length >= 3 && !consecutive) {
    return `Those ranks are not consecutive, so they are not a run. Their values add to ${sum}, which is not 15.`
  }
  if (cards.length === 2 && ranks[0] !== ranks[1]) {
    return `Those ranks differ, so they are not a pair. Their values add to ${sum}, which is not 15.`
  }
  return `Those cards add to ${sum}, which is not 15, and they are not a pair or a run.`
}

function joinNames(names: ReadonlyArray<string>): string {
  if (names.length === 1) {
    return names[0]
  }
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/** Selecting 5-6-7 out of a 5-6-7-8 run is a real, common near-miss: the
 *  learner has correctly spotted a run, but a card elsewhere in the hand or
 *  starter extends it, so the actual scoring group is bigger than what they
 *  picked. `scoreHandDetailed` only ever emits the longest run through a set
 *  of consecutive ranks (never both the run of three and the run of four
 *  that contains it — that would double-count), so the three-card subset
 *  can never itself become a required group, no matter how many times it is
 *  resubmitted. Naming exactly which card(s) complete it (instead of
 *  `whyNotScore`'s generic "may already be counted" hedge, which is simply
 *  wrong here) is the difference between a learner who is stuck forever and
 *  one who fixes their selection on the next try. */
function partialMatchMessage(
  scenario: ScoreScenario,
  selected: ReadonlyArray<string>,
  required: ReadonlyArray<ScoringGroup>,
  found: ReadonlyArray<string>,
): string | null {
  if (selected.length === 0) {
    return null
  }
  const candidates = required.filter((g) => (
    !found.includes(g.id)
    && g.cardIds.length > selected.length
    && selected.every((id) => g.cardIds.includes(id))
  ))
  if (candidates.length === 0) {
    return null
  }
  // If more than one required group is a superset of the current selection,
  // the closest (fewest extra cards) is the more useful one to name.
  const best = candidates.reduce((a, b) => (a.cardIds.length <= b.cardIds.length ? a : b))
  const allCards = [...scenario.hand, ...(scenario.starter ? [scenario.starter] : [])].map(specToCard)
  const missingNames = best.cardIds
    .filter((id) => !selected.includes(id))
    .map((id) => {
      const card = allCards.find((c) => cardKey(c) === id)
      return card ? cardName(card) : id
    })
  return `Those cards are part of a bigger combination. Add ${joinNames(missingNames)} to complete it.`
}

/** T4: per-category progress for the coach's `<dl>`, e.g. "Fifteens 1 of 2",
 *  "Pairs not started". Categories with zero required groups in this scenario
 *  are omitted entirely rather than shown as "0 of 0". */
export function categoryProgress(
  scenario: ScoreScenario,
  found: ReadonlyArray<string>,
): CategoryProgress {
  const required = requiredGroups(scenario)
  const progress: CategoryProgress = {}
  for (const g of required) {
    const row = progress[g.category] ?? { found: 0, total: 0 }
    row.total += 1
    if (found.includes(g.id)) {
      row.found += 1
    }
    progress[g.category] = row
  }
  return progress
}

export function gradeScoreSelection(
  scenario: ScoreScenario,
  selected: ReadonlyArray<string>,
  found: ReadonlyArray<string>,
): ScoreGradeResult {
  const required = requiredGroups(scenario)
  const matched = required.filter((g) => sameIdSet(g.cardIds, selected) && !found.includes(g.id))
  const credited = matched.length > 0
  const remainingByCategory = remainingOf(required, credited ? [...found, ...matched.map((g) => g.id)] : found)
  let message: string
  if (credited) {
    message = matched.map(describeGroup).join(" ")
  } else {
    const leftover = Object.entries(remainingByCategory).filter(([, n]) => n > 0)
    const hint = leftover[0] ? describeMissingCategory(leftover[0][0] as ScoringCategory) : "Every required combination is already found."
    // The exact same cards were already counted — say so plainly instead of
    // the generic "may already be counted" hedge, since cards are still
    // selectable after they score once (they can be part of another
    // combination too) and re-picking the identical set is common, not a
    // scoring mistake.
    const repeat = required.find((g) => sameIdSet(g.cardIds, selected) && found.includes(g.id))
    // A proper subset of some not-yet-found group (5-6-7 out of 5-6-7-8) is
    // also not a scoring mistake in the usual sense — name what completes it
    // instead of falling through to whyNotScore's generic pattern check.
    const partial = repeat ? null : partialMatchMessage(scenario, selected, required, found)
    message = repeat
      ? `You already counted that — ${describeGroup(repeat)}. ${hint}`
      : partial
        ? `${partial} ${hint}`
        : `${whyNotScore(selected, scenario)} ${hint}`
  }
  return { matched, credited, required, remainingByCategory, message }
}

export type DiscardGradeResult = {
  rankOfChoice: number
  accepted: boolean
  best: DiscardOption
  chosen: DiscardOption
  plain: string
  math: string
}

export function gradeDiscard(
  scenario: DiscardScenario,
  selected: ReadonlyArray<string>,
): DiscardGradeResult {
  const hand = specsToCards(scenario.hand)
  const ranked = rankDiscards(hand, [], scenario.isPlayerCrib)
  const key = selected.length === 2 ? discardPairKey(selected[0], selected[1]) : ""
  const chosenIndex = ranked.findIndex((opt) =>
    discardPairKey(cardKey(opt.discard[0]), cardKey(opt.discard[1])) === key,
  )
  const chosen = chosenIndex >= 0 ? ranked[chosenIndex] : ranked[ranked.length - 1]
  const best = ranked[0]
  const rankOfChoice = chosenIndex >= 0 ? chosenIndex + 1 : 15
  const accepted = rankOfChoice <= scenario.acceptTopN
  const generated = describeDiscardComparison(chosen, best, scenario.isPlayerCrib)
  const authored = scenario.reasons[key]
  return {
    rankOfChoice,
    accepted,
    best,
    chosen,
    plain: authored ?? generated.plain,
    math: generated.math,
  }
}

export type PegGradeResult = {
  legal: boolean
  result: PegPlayResult
  bestScoringCardIds: ReadonlyArray<string>
  accepted: boolean
  message: string
}

export function gradePegChoice(
  scenario: PegScenario,
  sequence: ReadonlyArray<PCard>,
  selectedCardId: string,
): PegGradeResult {
  const seq = sequence.map((c) => specToCard([c.suit, c.rank]))
  const hand = specsToCards(scenario.hand)
  const selected = hand.find((c) => cardKey(c) === selectedCardId) ?? specToCard(scenario.hand[0])
  const result = explainPegPlay(seq, selected)
  let bestTotal = -1
  const bestScoringCardIds: string[] = []
  for (const card of hand) {
    const r = explainPegPlay(seq, card)
    if (!r.legal) {
      continue
    }
    if (r.total > bestTotal) {
      bestTotal = r.total
      bestScoringCardIds.length = 0
      bestScoringCardIds.push(cardKey(card))
    } else if (r.total === bestTotal && r.total > 0) {
      bestScoringCardIds.push(cardKey(card))
    }
  }
  let accepted = result.legal
  if (scenario.task.kind === "select-scoring") {
    accepted = result.legal && bestScoringCardIds.includes(selectedCardId) && result.total > 0
  }
  return {
    legal: result.legal,
    result,
    bestScoringCardIds,
    accepted,
    message: describePegOutcome(result),
  }
}

// --- play-sequence (T7): a small, self-contained turn engine for the one
// PegScenario task kind that is a back-and-forth exchange rather than a
// single graded choice. It reuses explainPegPlay for every legality/scoring
// decision — the only new logic here is whose turn it is and when a "go"
// on both sides resets the count, exactly as real pegging works, but scoped
// to the fixed opponentScript instead of a live opponent AI.

export type PegSequenceParty = "learner" | "opponent"

export type PegSequenceEvent = {
  id: string
  by: PegSequenceParty
  cardId: string | null
  message: string
  points: number
}

export type PegSequenceState = {
  active: ReadonlyArray<Card>
  /** Parallel to `active` — who laid each card, same order, same length
   *  (decision D12, matching `GuidedRoundView`'s `playingSequenceOwners`). */
  activeOwners: ReadonlyArray<PegSequenceParty>
  count: number
  handRemaining: ReadonlyArray<string>
  oppRemaining: ReadonlyArray<CardSpec>
  turn: PegSequenceParty
  lastPlayedBy: PegSequenceParty | null
  consecutiveGoes: 0 | 1 | 2
  events: ReadonlyArray<PegSequenceEvent>
  done: boolean
  earned: number
  pegPoints: { learner: number[]; opponent: number[] }
  /** The trick that most recently ended (count reset to 0), kept visible
   *  dimmed instead of vanishing, plus why it ended (RM-4 item 2/3). */
  lastActive: ReadonlyArray<Card>
  lastActiveOwners: ReadonlyArray<PegSequenceParty>
  lastTrickReason: string
}

export function initPegSequence(scenario: PegScenario): PegSequenceState {
  const active = specsToCards(scenario.sequence)
  return {
    active,
    // The scenario's pre-played `sequence` was laid before the learner's
    // turn, so it is attributed to the opponent.
    activeOwners: active.map(() => "opponent" as PegSequenceParty),
    count: active.reduce((s, c) => s + c.value, 0),
    handRemaining: scenario.hand.map((spec) => cardKey(specToCard(spec))),
    oppRemaining: scenario.opponentScript,
    turn: "learner",
    lastPlayedBy: null,
    consecutiveGoes: 0,
    events: [],
    done: false,
    earned: 0,
    pegPoints: { learner: [0, -1, -1], opponent: [0, -1, -1] },
    lastActive: [],
    lastActiveOwners: [],
    lastTrickReason: "",
  }
}

/** Cards the learner can legally play right now — an empty result means the
 *  UI must offer "Say go" instead of a playable hand. */
export function learnerLegalCardIds(scenario: PegScenario, state: PegSequenceState): ReadonlyArray<string> {
  const hand = specsToCards(scenario.hand)
  return state.handRemaining.filter((id) => {
    const card = hand.find((c) => cardKey(c) === id)
    return card ? explainPegPlay(state.active, card).legal : false
  })
}

let seqLogSeq = 0

function shiftPegPoints(pga: ReadonlyArray<number>, points: number): number[] {
  const next = [...pga]
  next[2] = pga[1]
  next[1] = pga[0]
  next[0] = pga[0] + points
  return next
}

function afterPlay(state: PegSequenceState, by: PegSequenceParty, card: Card, result: PegPlayResult): PegSequenceState {
  seqLogSeq += 1
  const pegPoints = result.total > 0
    ? {
        learner: by === "learner" ? shiftPegPoints(state.pegPoints.learner, result.total) : [...state.pegPoints.learner],
        opponent: by === "opponent" ? shiftPegPoints(state.pegPoints.opponent, result.total) : [...state.pegPoints.opponent],
      }
    : { learner: [...state.pegPoints.learner], opponent: [...state.pegPoints.opponent] }
  return {
    ...state,
    active: [...state.active, card],
    activeOwners: [...state.activeOwners, by],
    count: result.newCount,
    handRemaining: by === "learner" ? state.handRemaining.filter((id) => id !== cardKey(card)) : state.handRemaining,
    oppRemaining: by === "opponent" ? state.oppRemaining.slice(1) : state.oppRemaining,
    turn: by === "learner" ? "opponent" : "learner",
    lastPlayedBy: by,
    consecutiveGoes: 0,
    events: [...state.events, {
      id: `seq-${seqLogSeq}`,
      by,
      cardId: cardKey(card),
      message: describePegOutcome(result),
      points: result.total,
    }],
    earned: state.earned + result.total,
    pegPoints,
  }
}

function afterGo(state: PegSequenceState, by: PegSequenceParty): PegSequenceState {
  const consecutiveGoes = (state.consecutiveGoes + 1) as 1 | 2
  seqLogSeq += 1
  const goEvent: PegSequenceEvent = {
    id: `seq-${seqLogSeq}`,
    by,
    cardId: null,
    message: by === "learner" ? "You have no legal card — go." : "The opponent has no legal card — go.",
    points: 0,
  }
  if (consecutiveGoes < 2) {
    return {
      ...state,
      turn: by === "learner" ? "opponent" : "learner",
      consecutiveGoes,
      events: [...state.events, goEvent],
      activeOwners: [...state.activeOwners],
      pegPoints: { learner: [...state.pegPoints.learner], opponent: [...state.pegPoints.opponent] },
      lastActive: [...state.lastActive],
      lastActiveOwners: [...state.lastActiveOwners],
      lastTrickReason: state.lastTrickReason,
    }
  }
  // Both sides just said go in a row: the count resets, and whoever played
  // the last card scores 1 for it — unless that card already made exactly
  // 31, which explainPegPlay already scored 2 for via its own "31" event.
  const bonus = state.lastPlayedBy && state.count !== 31 ? 1 : 0
  seqLogSeq += 1
  const resetEvent: PegSequenceEvent = {
    id: `seq-${seqLogSeq}`,
    by: state.lastPlayedBy ?? "opponent",
    cardId: null,
    message: bonus > 0
      ? `Nobody can play. ${state.lastPlayedBy === "learner" ? "You" : "The opponent"} played the last card, so it scores 1 for go. The count resets to 0.`
      : "Nobody can play. The count resets to 0.",
    points: bonus,
  }
  const done = state.handRemaining.length === 0 && state.oppRemaining.length === 0
  const pegPoints = bonus > 0 && state.lastPlayedBy
    ? {
        learner: state.lastPlayedBy === "learner" ? shiftPegPoints(state.pegPoints.learner, bonus) : [...state.pegPoints.learner],
        opponent: state.lastPlayedBy === "opponent" ? shiftPegPoints(state.pegPoints.opponent, bonus) : [...state.pegPoints.opponent],
      }
    : { learner: [...state.pegPoints.learner], opponent: [...state.pegPoints.opponent] }
  return {
    ...state,
    active: [],
    activeOwners: [],
    count: 0,
    turn: state.lastPlayedBy === "learner" ? "opponent" : "learner",
    lastPlayedBy: null,
    consecutiveGoes: 0,
    events: [...state.events, goEvent, resetEvent],
    done,
    earned: state.earned + bonus,
    pegPoints,
    lastActive: [...state.active],
    lastActiveOwners: [...state.activeOwners],
    lastTrickReason: resetEvent.message,
  }
}

/** Plays the opponent's next scripted card, or says go when the script is
 *  exhausted, or skips an illegal scripted card and says go — exactly the
 *  behaviour of the former private `opponentStep`, now exported so the UI
 *  can advance the opponent by exactly one action per `Let them play` press
 *  (RM-4 item 2) instead of the turn engine resolving a whole chain itself. */
export function opponentTurn(state: PegSequenceState): PegSequenceState {
  if (state.done || state.turn !== "opponent") {
    return state
  }
  const next = state.oppRemaining[0]
  if (!next) {
    return afterGo(state, "opponent")
  }
  const card = specToCard(next)
  const result = explainPegPlay(state.active, card)
  if (!result.legal) {
    // This is a fixed teaching script, not a live opponent — an illegal
    // scripted card is skipped for good (mirrors the same convention in
    // RoundScript.opponentPlays) rather than retried after a later reset,
    // so the go it demonstrates stays exactly where the scenario authored it.
    return afterGo({ ...state, oppRemaining: state.oppRemaining.slice(1) }, "opponent")
  }
  return afterPlay(state, "opponent", card, result)
}

export type PlayLearnerCardResult = { state: PegSequenceState; ok: boolean; message?: string }

/** The learner plays one of their remaining cards, then hands the turn over.
 *  The opponent's reply is a separate, explicit step (`opponentTurn`) so the
 *  learner paces the exchange (RM-4 item 2) instead of every reply landing
 *  in the same tick as the learner's play. */
export function playLearnerCard(
  scenario: PegScenario,
  state: PegSequenceState,
  cardId: string,
): PlayLearnerCardResult {
  if (state.done || state.turn !== "learner") {
    return { state, ok: false, message: "It is not your turn to play." }
  }
  const hand = specsToCards(scenario.hand)
  const card = state.handRemaining.includes(cardId) ? hand.find((c) => cardKey(c) === cardId) : undefined
  if (!card) {
    return { state, ok: false, message: "That card is not in your hand." }
  }
  const result = explainPegPlay(state.active, card)
  if (!result.legal) {
    return { state, ok: false, message: describePegOutcome(result) }
  }
  return { state: afterPlay(state, "learner", card, result), ok: true }
}

/** The learner explicitly declares they cannot play (T7's "who leads after
 *  reset" teaching moment lives in the resulting log entries). */
export function learnerGo(state: PegSequenceState): PegSequenceState {
  if (state.done || state.turn !== "learner") {
    return state
  }
  return afterGo(state, "learner")
}

export function hintFor(
  step: TutorialStep,
  level: 1 | 2 | 3,
  state: HintState,
): { text: string; highlightCardIds: ReadonlyArray<string> } {
  let scenario: ScoreScenario | DiscardScenario | PegScenario | undefined
  if (step.kind === "score-example" || step.kind === "score-practice") {
    scenario = SCORE_SCENARIOS[step.scenarioId]
  } else if (step.kind === "discard-practice") {
    scenario = DISCARD_SCENARIOS[step.scenarioId]
  } else if (step.kind === "peg-practice") {
    scenario = PEG_SCENARIOS[step.scenarioId]
  } else if (step.kind === "checkpoint") {
    const id = step.scenarioIds[state.subIndex]
    scenario = SCORE_SCENARIOS[id] ?? DISCARD_SCENARIOS[id] ?? PEG_SCENARIOS[id]
  }
  const text = scenario?.hints[level - 1] ?? "Look at the cards that still have a combination."
  if (!scenario || !("hand" in scenario) || !("starter" in scenario)) {
    return { text, highlightCardIds: [] }
  }
  const score = scenario as ScoreScenario
  const required = requiredGroups(score)
  const unfound = required.find((g) => !state.found.includes(g.id))
  if (!unfound) {
    return { text, highlightCardIds: [] }
  }
  if (level === 1) {
    return { text, highlightCardIds: [] }
  }
  if (level === 2) {
    return { text, highlightCardIds: unfound.cardIds.slice(0, 1) }
  }
  return { text, highlightCardIds: [...unfound.cardIds] }
}
