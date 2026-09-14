import { cardKey } from '../../app/entities'
import { DISCARD_SCENARIOS, PEG_SCENARIOS, SCORE_SCENARIOS } from './scenarios'
import { specToCard } from './tutorialCards'
import { gradeDiscard, gradePegChoice, gradeScoreSelection, hintFor } from './tutorialGrading'
import type { ConceptId, Lesson, TutorialStep } from './tutorialTypes'

/** Throws instead of silently no-op'ing so a new `TutorialStep.kind` that
 *  forgets a `submit` branch fails loudly in dev/tests rather than quietly
 *  ignoring the learner's input (gap-report defect 17). */
function assertNeverStepKind(step: never): never {
  throw new Error(`Unhandled step kind in submit: ${JSON.stringify(step)}`)
}

export type Feedback = {
  tone: "neutral" | "good" | "retry"
  text: string
  /** T6's "Show the math" EV disclosure, set only by a discard submission.
   *  Kept out of the plain feedback text so `CoachPanel` can hide it behind
   *  its own disclosure toggle instead of narrating a number up front. */
  math?: string
}

export type StepState = {
  stepId: string
  selected: ReadonlyArray<string>
  found: ReadonlyArray<string>
  attempts: number
  hintLevel: 0 | 1 | 2 | 3
  revealed: number
  status: "in-progress" | "complete" | "skipped"
  feedback: Feedback | null
  earned: number
  subIndex: number
}

export type RunnerState = {
  lessonId: string
  stepIndex: number
  step: StepState
  completedStepIds: ReadonlyArray<string>
  lessonComplete: boolean
  /** The id of the step most recently skipped, so the host screen can persist
   *  it to `skippedStepIds` — the reducer replaces `state.step` with a fresh
   *  `StepState` for the *next* step as part of the same `skip` action, so
   *  the "skipped" status is otherwise never observable except on the final
   *  step of a lesson. `null` once nothing new has been skipped. */
  lastSkippedStepId: string | null
}

export type RunnerAction =
  | { type: "toggle-card"; cardId: string }
  | { type: "clear-selection" }
  | { type: "submit" }
  | { type: "reveal-next" }
  | { type: "request-hint" }
  | { type: "next" }
  | { type: "back" }
  | { type: "skip" }
  | { type: "restart-step" }
  | { type: "restart-lesson" }
  | { type: "complete-guided-round" }
  /** T7 play-sequence: PeggingExercise drives its own local turn engine
   *  (tutorialGrading's PegSequenceState) and reports back only once the
   *  whole scripted exchange is done, the same "external process, one
   *  completion signal" shape as complete-guided-round. */
  | { type: "complete-peg-sequence"; earned: number }

function passiveKind(kind: TutorialStep["kind"]): boolean {
  return kind === "explain" || kind === "round-map" || kind === "recap"
}

export function emptyStepState(step: TutorialStep): StepState {
  return {
    stepId: step.id,
    selected: [],
    found: [],
    attempts: 0,
    hintLevel: 0,
    revealed: 0,
    status: passiveKind(step.kind) ? "complete" : "in-progress",
    feedback: null,
    earned: 0,
    subIndex: 0,
  }
}

export function initialRunnerState(lesson: Lesson, startAtStep?: number): RunnerState {
  const max = Math.max(0, lesson.steps.length - 1)
  const stepIndex = startAtStep === undefined
    ? 0
    : Math.min(max, Math.max(0, Math.floor(startAtStep)))
  return {
    lessonId: lesson.id,
    stepIndex,
    step: emptyStepState(lesson.steps[stepIndex]),
    completedStepIds: [],
    lessonComplete: false,
    lastSkippedStepId: null,
  }
}

/** Steps that are actually graded — the only kinds whose completion should
 *  move concept mastery (R3). `explain` / `round-map` / `recap` / `score-example`
 *  / `guided-round` are informational or narrated by the engine elsewhere and
 *  must not award independent-correct credit just for being viewed. */
export function isAssessedStepKind(kind: TutorialStep["kind"]): boolean {
  return kind === "score-practice" || kind === "discard-practice" || kind === "peg-practice" || kind === "checkpoint"
}

/** Concepts a given step actually assesses, for mastery accounting (R3).
 *  For `checkpoint`, the union of every sub-scenario's concepts — the
 *  checkpoint step only reports one attempts/hintLevel figure (from the
 *  final sub-scenario) so mastery for a checkpoint is coarser than for a
 *  single practice step by design. */
export function stepConcepts(step: TutorialStep): ReadonlyArray<ConceptId> {
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
    const seen = new Set<ConceptId>()
    const out: ConceptId[] = []
    for (const id of step.scenarioIds) {
      const concepts = SCORE_SCENARIOS[id]?.concepts
        ?? DISCARD_SCENARIOS[id]?.concepts
        ?? PEG_SCENARIOS[id]?.concepts
        ?? []
      for (const c of concepts) {
        if (!seen.has(c)) {
          seen.add(c)
          out.push(c)
        }
      }
    }
    return out
  }
  return []
}

function currentScoreScenario(step: TutorialStep, subIndex: number) {
  if (step.kind === "score-example" || step.kind === "score-practice") {
    return SCORE_SCENARIOS[step.scenarioId]
  }
  if (step.kind === "checkpoint") {
    return SCORE_SCENARIOS[step.scenarioIds[subIndex]]
  }
  return undefined
}

function currentDiscardScenario(step: TutorialStep, subIndex: number) {
  if (step.kind === "discard-practice") {
    return DISCARD_SCENARIOS[step.scenarioId]
  }
  if (step.kind === "checkpoint") {
    return DISCARD_SCENARIOS[step.scenarioIds[subIndex]]
  }
  return undefined
}

function currentPegScenario(step: TutorialStep, subIndex: number) {
  if (step.kind === "peg-practice") {
    return PEG_SCENARIOS[step.scenarioId]
  }
  if (step.kind === "checkpoint") {
    return PEG_SCENARIOS[step.scenarioIds[subIndex]]
  }
  return undefined
}

function advance(lesson: Lesson, state: RunnerState, mark: "complete" | "skipped"): RunnerState {
  const completedStepIds = mark === "complete"
    ? [...state.completedStepIds, state.step.stepId]
    : state.completedStepIds
  const nextIndex = state.stepIndex + 1
  if (nextIndex >= lesson.steps.length) {
    return {
      ...state,
      step: { ...state.step, status: mark },
      completedStepIds,
      lessonComplete: true,
    }
  }
  return {
    ...state,
    stepIndex: nextIndex,
    step: emptyStepState(lesson.steps[nextIndex]),
    completedStepIds,
    lessonComplete: false,
  }
}

function finishOrAdvanceCheckpoint(
  _lesson: Lesson,
  state: RunnerState,
  step: TutorialStep,
  nextStep: StepState,
): RunnerState {
  if (step.kind === "checkpoint" && nextStep.subIndex < step.scenarioIds.length - 1) {
    return {
      ...state,
      step: {
        ...emptyStepState(step),
        subIndex: nextStep.subIndex + 1,
        status: "in-progress",
      },
    }
  }
  return { ...state, step: { ...nextStep, status: "complete" } }
}

function submitScore(
  lesson: Lesson,
  state: RunnerState,
  step: TutorialStep,
): RunnerState {
  const scenario = currentScoreScenario(step, state.step.subIndex)
  if (!scenario) {
    return state
  }
  const grade = gradeScoreSelection(scenario, state.step.selected, state.step.found)
  if (!grade.credited) {
    return {
      ...state,
      step: {
        ...state.step,
        attempts: state.step.attempts + 1,
        selected: [],
        feedback: { tone: "retry", text: grade.message },
      },
    }
  }
  const found = [...state.step.found, ...grade.matched.map((g) => g.id)]
  const earned = state.step.earned + grade.matched.reduce((s, g) => s + g.points, 0)
  const remaining = Object.values(grade.remainingByCategory).reduce((s, n) => s + n, 0)
  const nextStep: StepState = {
    ...state.step,
    found,
    earned,
    selected: [],
    feedback: { tone: "good", text: grade.message },
    status: remaining === 0 ? "complete" : "in-progress",
  }
  if (remaining === 0) {
    return finishOrAdvanceCheckpoint(lesson, state, step, nextStep)
  }
  return { ...state, step: nextStep }
}

function submitDiscard(
  lesson: Lesson,
  state: RunnerState,
  step: TutorialStep,
): RunnerState {
  const scenario = currentDiscardScenario(step, state.step.subIndex)
  if (!scenario || state.step.selected.length !== 2) {
    return state
  }
  const grade = gradeDiscard(scenario, state.step.selected)
  // attempts counts wrong submissions only (mirrors submitScore / submitPeg),
  // so mastery accounting (R3) can treat "0 wrong tries" as the flawless
  // signal instead of freezing after the first miss (the previous defect).
  const attempts = state.step.attempts + (grade.accepted ? 0 : 1)
  const nextStep: StepState = {
    ...state.step,
    attempts,
    found: grade.accepted ? ["discard"] : state.step.found,
    status: grade.accepted ? "complete" : "in-progress",
    feedback: {
      tone: grade.accepted ? "good" : "retry",
      text: grade.plain,
      math: grade.math,
    },
  }
  if (grade.accepted) {
    return finishOrAdvanceCheckpoint(lesson, state, step, nextStep)
  }
  return { ...state, step: nextStep }
}

function submitPeg(
  lesson: Lesson,
  state: RunnerState,
  step: TutorialStep,
): RunnerState {
  const scenario = currentPegScenario(step, state.step.subIndex)
  if (!scenario) {
    return state
  }
  if (scenario.task.kind === "select-legal") {
    const seq = scenario.sequence.map(([suit, rank]) => ({ suit, rank }))
    const legal: string[] = []
    for (const spec of scenario.hand) {
      const id = cardKey(specToCard(spec))
      if (gradePegChoice(scenario, seq, id).legal) {
        legal.push(id)
      }
    }
    const selected = [...state.step.selected].sort()
    const expected = [...legal].sort()
    const ok = selected.length === expected.length && selected.every((id, i) => id === expected[i])
    const nextStep: StepState = {
      ...state.step,
      // attempts counts wrong submissions only, consistent with submitScore
      // and submitDiscard, so "0 wrong tries" is the flawless signal R3 uses.
      attempts: state.step.attempts + (ok ? 0 : 1),
      selected: [],
      found: ok ? expected : state.step.found,
      status: ok ? "complete" : "in-progress",
      feedback: {
        tone: ok ? "good" : "retry",
        text: ok
          ? "Those are the legal cards."
          : "Mark every card that stays at or under 31, and only those cards.",
      },
    }
    if (ok) {
      return finishOrAdvanceCheckpoint(lesson, state, step, nextStep)
    }
    return { ...state, step: nextStep }
  }

  // play-sequence never reaches here: PeggingExercise drives it entirely
  // through its own PegSequenceState and reports completion via
  // "complete-peg-sequence" instead of "submit" (T7).
  const selectedId = state.step.selected[0]
  if (!selectedId) {
    return state
  }
  const seq = scenario.sequence.map(([suit, rank]) => ({ suit, rank }))
  const grade = gradePegChoice(scenario, seq, selectedId)
  const accepted = grade.accepted
  const nextStep: StepState = {
    ...state.step,
    attempts: state.step.attempts + (accepted ? 0 : 1),
    found: accepted ? [...state.step.found, selectedId] : state.step.found,
    earned: accepted ? state.step.earned + grade.result.total : state.step.earned,
    status: accepted ? "complete" : "in-progress",
    feedback: { tone: accepted ? "good" : "retry", text: grade.message },
  }
  if (accepted) {
    return finishOrAdvanceCheckpoint(lesson, state, step, nextStep)
  }
  return { ...state, step: nextStep }
}

export function makeTutorialReducer(lesson: Lesson): (s: RunnerState, a: RunnerAction) => RunnerState {
  return (state: RunnerState, action: RunnerAction): RunnerState => {
    const step = lesson.steps[state.stepIndex]
    switch (action.type) {
      case "toggle-card": {
        const has = state.step.selected.includes(action.cardId)
        return {
          ...state,
          step: {
            ...state.step,
            selected: has
              ? state.step.selected.filter((id) => id !== action.cardId)
              : [...state.step.selected, action.cardId],
          },
        }
      }
      case "clear-selection":
        return { ...state, step: { ...state.step, selected: [] } }
      case "submit": {
        switch (step.kind) {
          case "score-example":
          case "score-practice":
            return submitScore(lesson, state, step)
          case "discard-practice":
            return submitDiscard(lesson, state, step)
          case "peg-practice":
            return submitPeg(lesson, state, step)
          case "checkpoint": {
            if (currentScoreScenario(step, state.step.subIndex)) {
              return submitScore(lesson, state, step)
            }
            if (currentDiscardScenario(step, state.step.subIndex)) {
              return submitDiscard(lesson, state, step)
            }
            if (currentPegScenario(step, state.step.subIndex)) {
              return submitPeg(lesson, state, step)
            }
            return state
          }
          case "explain":
          case "round-map":
          case "recap":
          case "guided-round":
            return state
          default:
            // Exhaustiveness guard (gap-report #17): a new step kind must
            // fail loudly here instead of silently falling through to a
            // no-op, so it gets a submit branch instead of quietly ignoring input.
            return assertNeverStepKind(step)
        }
      }
      case "reveal-next": {
        if (step.kind !== "score-example") {
          return state
        }
        const scenario = SCORE_SCENARIOS[step.scenarioId]
        if (!scenario) {
          return state
        }
        const grade = gradeScoreSelection(scenario, [], [])
        const nextRevealed = Math.min(grade.required.length, state.step.revealed + 1)
        const group = grade.required[nextRevealed - 1]
        const found = group && !state.step.found.includes(group.id)
          ? [...state.step.found, group.id]
          : state.step.found
        const complete = nextRevealed >= grade.required.length
        return {
          ...state,
          step: {
            ...state.step,
            revealed: nextRevealed,
            found,
            earned: found.reduce((s, id) => s + (grade.required.find((g) => g.id === id)?.points ?? 0), 0),
            status: complete ? "complete" : "in-progress",
            feedback: group ? { tone: "neutral", text: group.label } : state.step.feedback,
          },
        }
      }
      case "request-hint": {
        const nextLevel = Math.min(3, state.step.hintLevel + 1) as 1 | 2 | 3
        const hint = hintFor(step, nextLevel, state.step)
        return {
          ...state,
          step: {
            ...state.step,
            hintLevel: nextLevel,
            feedback: { tone: "neutral", text: hint.text },
          },
        }
      }
      case "next":
        if (state.step.status === "in-progress" && !passiveKind(step.kind)) {
          return state
        }
        return advance(lesson, state, state.step.status === "skipped" ? "skipped" : "complete")
      case "back": {
        if (state.stepIndex === 0) {
          return { ...state, step: emptyStepState(step) }
        }
        const prev = state.stepIndex - 1
        return {
          ...state,
          stepIndex: prev,
          step: emptyStepState(lesson.steps[prev]),
          lessonComplete: false,
        }
      }
      case "skip": {
        const skippedId = state.step.stepId
        const advanced = advance(lesson, { ...state, step: { ...state.step, status: "skipped" } }, "skipped")
        return { ...advanced, lastSkippedStepId: skippedId }
      }
      case "restart-step":
        return { ...state, step: emptyStepState(step), lessonComplete: false }
      case "restart-lesson":
        return initialRunnerState(lesson, 0)
      case "complete-guided-round":
        if (step.kind !== "guided-round") {
          return state
        }
        return advance(lesson, { ...state, step: { ...state.step, status: "complete" } }, "complete")
      case "complete-peg-sequence":
        if (step.kind !== "peg-practice") {
          return state
        }
        return finishOrAdvanceCheckpoint(
          lesson,
          state,
          step,
          { ...state.step, earned: action.earned, status: "complete" },
        )
    }
  }
}
