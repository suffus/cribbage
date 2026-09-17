import { describe, expect, it } from 'vitest'
import { describeDiscardComparison, describeGroup, describeMissingCategory, describePegOutcome, TRAINING_DEAL_NOTICE } from './tutorialCopy'
import { rankDiscards } from '../../app/game'
import type { ScoringGroup } from '../../app/game'
import { DISCARD_SCENARIOS } from './scenarios'
import { specsToCards } from './tutorialCards'

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

describe("describeDiscardComparison", () => {
  it("shows the hand number, the crib number and the signed total for their crib", () => {
    const scenario = DISCARD_SCENARIOS["discard-theirs"]
    const ranked = rankDiscards(specsToCards(scenario.hand), [], scenario.isPlayerCrib)
    const { math } = describeDiscardComparison(ranked[1], ranked[0], scenario.isPlayerCrib)
    expect(math).toMatch(/hand \d+\.\d minus crib \d+\.\d = \d+\.\d/)
    expect(math).toContain("subtracted")
    expect(math).toContain("their crib")
  })

  it("adds the crib number when the crib is the learner's", () => {
    const scenario = DISCARD_SCENARIOS["discard-yours"]
    const ranked = rankDiscards(specsToCards(scenario.hand), [], scenario.isPlayerCrib)
    const { math } = describeDiscardComparison(ranked[1], ranked[0], scenario.isPlayerCrib)
    expect(math).toMatch(/hand \d+\.\d plus crib \d+\.\d = \d+\.\d/)
    expect(math).toContain("added")
    expect(math).toContain("your crib")
  })

  it("plain copy names all three axes and carries no figures", () => {
    const scenario = DISCARD_SCENARIOS["discard-theirs"]
    const ranked = rankDiscards(specsToCards(scenario.hand), [], scenario.isPlayerCrib)
    const { plain } = describeDiscardComparison(ranked[1], ranked[0], scenario.isPlayerCrib)
    expect(plain).toMatch(/peg/i)
    expect(plain).toMatch(/crib/i)
    expect(plain).not.toMatch(/\d/)
  })
})
