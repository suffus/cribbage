import { describe, expect, it } from 'vitest'
import { cardKey } from '../../app/entities'
import { BEGINNER_PATH, findLesson } from './lessonCatalog'
import { specToCard } from './tutorialCards'
import { initialRunnerState, makeTutorialReducer } from './tutorialReducer'

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
})
