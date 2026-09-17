import { describe, expect, it } from 'vitest'
import { cardKey } from '../../app/entities'
import { BEGINNER_PATH, findLesson } from './lessonCatalog'
import { specToCard } from './tutorialCards'
import { emptyStepState, initialRunnerState, isAssessedStepKind, makeTutorialReducer } from './tutorialReducer'

describe("tutorialReducer", () => {
  it("starts explain and recap steps complete so Next is enabled", () => {
    const lesson = findLesson("shape-of-a-round")!
    const reduce = makeTutorialReducer(lesson)
    let state = initialRunnerState(lesson)
    expect(state.step.status).toBe("complete")
    state = reduce(state, { type: "next" })
    expect(state.stepIndex).toBe(1)
  })

  it("does not auto-advance a completed practice step", () => {
    const lesson = findLesson("count-a-hand")!
    const reduce = makeTutorialReducer(lesson)
    let state = initialRunnerState(lesson, 1)
    expect(lesson.steps[1].kind).toBe("score-practice")
    const twoH = cardKey(specToCard(["hearts", 2]))
    const twoC = cardKey(specToCard(["clubs", 2]))
    const nineD = cardKey(specToCard(["diamonds", 9]))
    const nineS = cardKey(specToCard(["spades", 9]))
    state = reduce(state, { type: "toggle-card", cardId: twoH })
    state = reduce(state, { type: "toggle-card", cardId: twoC })
    state = reduce(state, { type: "submit" })
    expect(state.step.status).toBe("in-progress")
    // A graded selection is held for review, so the next combo needs an
    // explicit clear before new cards can be toggled on.
    state = reduce(state, { type: "clear-selection" })
    state = reduce(state, { type: "toggle-card", cardId: nineD })
    state = reduce(state, { type: "toggle-card", cardId: nineS })
    state = reduce(state, { type: "submit" })
    expect(state.step.status).toBe("complete")
    expect(state.stepIndex).toBe(1)
    state = reduce(state, { type: "next" })
    expect(state.stepIndex).toBe(2)
  })

  it("skips without recording the step as completed", () => {
    const lesson = BEGINNER_PATH[0]
    const reduce = makeTutorialReducer(lesson)
    let state = initialRunnerState(lesson)
    state = reduce(state, { type: "skip" })
    expect(state.completedStepIds).toEqual([])
    expect(state.stepIndex).toBe(1)
  })

  it("walks a checkpoint through each scenario before completing the step", () => {
    const lesson = findLesson("ready-table")!
    const reduce = makeTutorialReducer(lesson)
    let state = initialRunnerState(lesson)
    expect(state.step.subIndex).toBe(0)
    state = reduce(state, { type: "skip" })
    expect(state.lessonComplete).toBe(false)
    expect(state.stepIndex).toBe(1)
  })

  it("restart-count clears the count without zeroing attempts or hintLevel", () => {
    const lesson = findLesson("count-a-hand")!
    const reduce = makeTutorialReducer(lesson)
    let state = initialRunnerState(lesson, 3)
    expect(lesson.steps[3].id).toBe("count-runs")
    const fourH = cardKey(specToCard(["hearts", 4]))
    const fiveC = cardKey(specToCard(["clubs", 5]))
    const sixS = cardKey(specToCard(["spades", 6]))

    // A wrong submission: two cards that do not score together.
    state = reduce(state, { type: "toggle-card", cardId: fourH })
    state = reduce(state, { type: "toggle-card", cardId: fiveC })
    state = reduce(state, { type: "submit" })
    expect(state.step.attempts).toBe(1)

    state = reduce(state, { type: "request-hint" })
    expect(state.step.hintLevel).toBe(1)

    // A graded selection is held for review; clear it before the next combo.
    state = reduce(state, { type: "clear-selection" })
    // A correct group: the run of 4H-5C-6S.
    state = reduce(state, { type: "toggle-card", cardId: fourH })
    state = reduce(state, { type: "toggle-card", cardId: fiveC })
    state = reduce(state, { type: "toggle-card", cardId: sixS })
    state = reduce(state, { type: "submit" })
    expect(state.step.found.length).toBeGreaterThan(0)

    state = reduce(state, { type: "restart-count" })
    expect(state.step.found).toEqual([])
    expect(state.step.earned).toBe(0)
    expect(state.step.selected).toEqual([])
    expect(state.step.status).toBe("in-progress")
    expect(state.step.attempts).toBe(1)
    expect(state.step.hintLevel).toBe(1)
  })

  it("advances checkpoint subIndex after a successful score submit", () => {
    const lesson = findLesson("ready-table")!
    const reduce = makeTutorialReducer(lesson)
    let state = initialRunnerState(lesson)
    const three = cardKey(specToCard(["hearts", 3]))
    const four = cardKey(specToCard(["clubs", 4]))
    const fiveD = cardKey(specToCard(["diamonds", 5]))
    state = reduce(state, { type: "toggle-card", cardId: three })
    state = reduce(state, { type: "toggle-card", cardId: four })
    state = reduce(state, { type: "toggle-card", cardId: fiveD })
    state = reduce(state, { type: "submit" })
    expect(state.step.status).toBe("in-progress")
    expect(state.step.subIndex).toBe(0)
  })

  it("treats round-demo as a passive, unassessed step", () => {
    expect(isAssessedStepKind("round-demo")).toBe(false)
    const step = { kind: "round-demo" as const, id: "d", scriptIds: ["demo-hand-1", "demo-hand-2"] as const }
    expect(emptyStepState(step).status).toBe("complete")
  })

  it("Back then Next restores the counted groups, earned total, hints and attempts", () => {
    // Deviation from the plan's literal recipe: "pair-find" (qp-pairs) has
    // two required pair groups (2H-2C and 9D-9S per src/features/tutorial/
    // scenarios.ts), so crediting only one group leaves the step
    // "in-progress" and the reducer's "next" case is a documented no-op for
    // a non-passive in-progress step — dispatching it would never move
    // stepIndex, making the round-trip trivial. Both groups are credited
    // here so the step actually completes and "next" advances, which is
    // what lets the test exercise the Back/Next restore path it names.
    const lesson = findLesson("count-a-hand-practice")!
    const reduce = makeTutorialReducer(lesson)
    let state = initialRunnerState(lesson, 0)
    expect(lesson.steps[0].id).toBe("qp-pairs")
    const twoH = cardKey(specToCard(["hearts", 2]))
    const twoC = cardKey(specToCard(["clubs", 2]))
    const nineD = cardKey(specToCard(["diamonds", 9]))
    const nineS = cardKey(specToCard(["spades", 9]))

    // A wrong submission first, so attempts is nonzero.
    state = reduce(state, { type: "toggle-card", cardId: twoH })
    state = reduce(state, { type: "submit" })
    state = reduce(state, { type: "request-hint" })
    // A graded selection is held for review; clear it before the next combo.
    state = reduce(state, { type: "clear-selection" })
    // Credit both required pair groups.
    state = reduce(state, { type: "toggle-card", cardId: twoH })
    state = reduce(state, { type: "toggle-card", cardId: twoC })
    state = reduce(state, { type: "submit" })
    state = reduce(state, { type: "clear-selection" })
    state = reduce(state, { type: "toggle-card", cardId: nineD })
    state = reduce(state, { type: "toggle-card", cardId: nineS })
    state = reduce(state, { type: "submit" })
    expect(state.step.status).toBe("complete")

    const found = state.step.found
    const earned = state.step.earned
    const hintLevel = state.step.hintLevel
    const attempts = state.step.attempts

    state = reduce(state, { type: "next" })
    expect(state.stepIndex).toBe(1)
    state = reduce(state, { type: "back" })

    expect(state.stepIndex).toBe(0)
    expect(state.step.found).toEqual(found)
    expect(state.step.earned).toBe(earned)
    expect(state.step.hintLevel).toBe(hintLevel)
    expect(state.step.attempts).toBe(attempts)
  })

  it("holds a graded selection until clear-selection (StepState.submitted, RM-5 item 2)", () => {
    const lesson = findLesson("count-a-hand-practice")!
    const reduce = makeTutorialReducer(lesson)
    let state = initialRunnerState(lesson, 0)
    const twoH = cardKey(specToCard(["hearts", 2]))
    const twoC = cardKey(specToCard(["clubs", 2]))
    expect(state.step.submitted).toBe(false)

    state = reduce(state, { type: "toggle-card", cardId: twoH })
    state = reduce(state, { type: "toggle-card", cardId: twoC })
    state = reduce(state, { type: "submit" })
    // Graded (here, correctly) — the selection is kept on screen for review
    // instead of clearing itself immediately.
    expect(state.step.submitted).toBe(true)
    expect(state.step.selected).toEqual([twoH, twoC])

    state = reduce(state, { type: "clear-selection" })
    expect(state.step.submitted).toBe(false)
    expect(state.step.selected).toEqual([])
  })

  it("toggling a card again leaves review mode, even mid-review", () => {
    const lesson = findLesson("count-a-hand-practice")!
    const reduce = makeTutorialReducer(lesson)
    let state = initialRunnerState(lesson, 0)
    const twoH = cardKey(specToCard(["hearts", 2]))
    const nineD = cardKey(specToCard(["diamonds", 9]))

    // A wrong, single-card submission also sets `submitted`.
    state = reduce(state, { type: "toggle-card", cardId: twoH })
    state = reduce(state, { type: "submit" })
    expect(state.step.submitted).toBe(true)
    expect(state.step.attempts).toBe(1)

    state = reduce(state, { type: "toggle-card", cardId: nineD })
    expect(state.step.submitted).toBe(false)
    expect(state.step.selected).toEqual([twoH, nineD])
  })

  it("restart-step clears the saved copy so the step really starts over", () => {
    const lesson = findLesson("count-a-hand-practice")!
    const reduce = makeTutorialReducer(lesson)
    let state = initialRunnerState(lesson, 0)
    const twoH = cardKey(specToCard(["hearts", 2]))
    const twoC = cardKey(specToCard(["clubs", 2]))
    state = reduce(state, { type: "toggle-card", cardId: twoH })
    state = reduce(state, { type: "toggle-card", cardId: twoC })
    state = reduce(state, { type: "submit" })
    expect(state.step.found.length).toBeGreaterThan(0)

    state = reduce(state, { type: "restart-step" })
    expect(state.step.found).toEqual([])
    expect(state.stepStates["qp-pairs"]).toBeUndefined()
  })
})
