import { describe, expect, it } from 'vitest'
import { completeRound } from './completeRound'
import {
  checkCards,
  checkDiscardScenario,
  checkPegScenario,
  checkScoreScenario,
  uniqueSlug,
  validateCatalog,
  validateRoundScripts,
} from './validateCatalog'
import { BEGINNER_PATH, QUICK_PRACTICE } from './lessonCatalog'
import { DISCARD_SCENARIOS, PEG_SCENARIOS, SCORE_SCENARIOS } from './scenarios'

describe("catalog (C4)", () => {
  it("has no authoring problems", () => {
    expect(validateCatalog()).toEqual([])
  })

  it("completes both guided-round scripts", () => {
    expect(validateRoundScripts(completeRound)).toEqual([])
  })

  it("covers seven beginner lessons and three quick-practice lessons", () => {
    expect(BEGINNER_PATH).toHaveLength(7)
    expect(QUICK_PRACTICE).toHaveLength(3)
  })
})

// C4 negative fixtures (gap-report defect 9): validateCatalog() === [] on the
// real catalog only means something if these checks actually reject broken
// input. Each test below feeds a deliberately bad fixture through the same
// check functions validateCatalog uses internally.
describe("catalog validators reject bad authoring (C4 negative fixtures)", () => {
  it("uniqueSlug flags a duplicate id and a non-slug id", () => {
    const seen = new Set<string>(["already-used"])
    const problems: { where: string; problem: string }[] = []
    uniqueSlug(seen, "already-used", "where", problems)
    expect(problems.some((p) => p.problem.includes("duplicate id"))).toBe(true)

    const problems2: { where: string; problem: string }[] = []
    uniqueSlug(new Set(), "Not A Slug!", "where", problems2)
    expect(problems2.some((p) => p.problem.includes("not slug-shaped"))).toBe(true)
  })

  it("checkCards flags an authored joker suit, an out-of-range rank, and a duplicate card", () => {
    const problems: { where: string; problem: string }[] = []
    checkCards("where", [["joker", 1], ["hearts", 99], ["hearts", 5], ["hearts", 5]], problems)
    expect(problems.some((p) => p.problem.includes('suit "joker" is not a real suit'))).toBe(true)
    expect(problems.some((p) => p.problem.includes("rank 99 is out of range"))).toBe(true)
    expect(problems.some((p) => p.problem.includes("duplicate card 5H"))).toBe(true)
  })

  it("checkScoreScenario flags a zero-total hand and a mismatched record key", () => {
    const base = SCORE_SCENARIOS["fifteen-worked"]
    // 2, 4, 7, Q in hand and a K starter: no subset of values (2,4,7,10,10)
    // sums to 15, ranks are neither paired nor a 3-run, suits are mixed, and
    // there is no jack — a genuine zero-score hand.
    const zeroTotal = {
      ...base,
      hand: [["hearts", 2], ["clubs", 4], ["diamonds", 7], ["spades", 12]] as typeof base.hand,
      starter: ["hearts", 13] as typeof base.starter,
      require: undefined,
    }
    const problems = checkScoreScenario("fifteen-worked", zeroTotal)
    expect(problems.some((p) => p.problem.includes("total is not > 0"))).toBe(true)

    const mismatched = checkScoreScenario("some-other-id", base)
    expect(mismatched.some((p) => p.problem.includes("record key does not match"))).toBe(true)
  })

  it("checkScoreScenario flags a require category the hand cannot produce", () => {
    const base = SCORE_SCENARIOS["fifteen-worked"]
    const problems = checkScoreScenario("fifteen-worked", { ...base, require: ["flush"] })
    expect(problems.some((p) => p.problem.includes("require category flush is missing"))).toBe(true)
  })

  it("checkDiscardScenario flags an out-of-range acceptTopN and an unauthored best discard", () => {
    const base = DISCARD_SCENARIOS["discard-theirs"]
    const badRange = checkDiscardScenario("discard-theirs", { ...base, acceptTopN: 0 })
    expect(badRange.some((p) => p.problem.includes("acceptTopN must be in 1..15"))).toBe(true)

    const noReasons = checkDiscardScenario("discard-theirs", { ...base, reasons: {} })
    expect(noReasons.some((p) => p.problem.includes("has no reasons entry"))).toBe(true)
  })

  it("checkDiscardScenario flags a reasons key that is not a real two-card subset of the hand", () => {
    const base = DISCARD_SCENARIOS["discard-theirs"]
    const problems = checkDiscardScenario("discard-theirs", {
      ...base,
      reasons: { ...base.reasons, "ZZ-YY": "not a real pair" },
    })
    expect(problems.some((p) => p.problem.includes('reasons key "ZZ-YY" is not a two-card subset'))).toBe(true)
  })

  it("checkPegScenario flags a sequence over 31 and an illegal scripted opponent play", () => {
    const base = PEG_SCENARIOS["peg-legal"]
    const over31 = checkPegScenario("peg-legal", {
      ...base,
      sequence: [["hearts", 13], ["clubs", 13], ["diamonds", 13], ["spades", 13]], // 40
    })
    expect(over31.some((p) => p.problem.includes("sequence sums to"))).toBe(true)

    const illegalScript = checkPegScenario("peg-legal", {
      ...base,
      // 10 + 9 + 8 = 27 is a legal running count; the scripted opponent
      // card then pushes it to 37, which is illegal.
      sequence: [["hearts", 10], ["clubs", 9], ["diamonds", 8]],
      opponentScript: [["spades", 10]],
    })
    expect(illegalScript.some((p) => p.problem.includes("is illegal at count"))).toBe(true)
  })
})
