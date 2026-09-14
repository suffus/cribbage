import { describe, expect, it } from 'vitest'
import { describeGroup, describeMissingCategory, describePegOutcome, TRAINING_DEAL_NOTICE } from './tutorialCopy'
import type { ScoringGroup } from '../../app/game'

describe("tutorialCopy", () => {
  it("names a group and a missing category", () => {
    const group: ScoringGroup = {
      id: "g1",
      category: "fifteen",
      cardIds: ["5H", "KD"],
      points: 2,
      label: "5 + K = 15",
    }
    expect(describeGroup(group)).toBe("5 + K = 15 for 2")
    expect(describeMissingCategory("pair")).toMatch(/pair/)
    expect(describeMissingCategory("nobs")).toMatch(/nobs/)
  })

  it("describes legal and illegal peg outcomes", () => {
    expect(describePegOutcome({
      legal: false,
      newCount: 36,
      events: [],
      total: 0,
    })).toMatch(/over 31/)
    expect(describePegOutcome({
      legal: true,
      newCount: 15,
      events: [{ category: "fifteen", points: 2, cardIds: [], label: "15 for 2" }],
      total: 2,
    })).toMatch(/scores 2/)
  })

  it("labels a training deal without claiming shuffle fairness", () => {
    expect(TRAINING_DEAL_NOTICE).toMatch(/training deal/)
    expect(TRAINING_DEAL_NOTICE).not.toMatch(/fair shuffle|random deal/i)
  })
})
