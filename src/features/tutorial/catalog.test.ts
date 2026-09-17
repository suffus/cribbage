import { describe, expect, it } from 'vitest'
import { completeRound } from './completeRound'
import {
  checkCards,
  checkDiscardScenario,
  checkPegScenario,
  checkPlayerSeat,
  checkScoreScenario,
  uniqueSlug,
  validateCatalog,
  validateRoundScripts,
} from './validateCatalog'
import { BEGINNER_PATH, QUICK_PRACTICE } from './lessonCatalog'
import { DISCARD_SCENARIOS, PEG_SCENARIOS, ROUND_SCRIPTS, SCORE_SCENARIOS } from './scenarios'

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

  it("every score scenario's required groups are reachable from hand plus starter", () => {
    for (const [id, sc] of Object.entries(SCORE_SCENARIOS)) {
      const problems = checkScoreScenario(id, sc).filter((p) => /not selectable|no required scoring group/.test(p.problem))
      expect(problems).toEqual([])
    }
  })

  it("the beginner path stays inside the landing promise of about half an hour", () => {
    const total = BEGINNER_PATH.reduce((sum, l) => sum + l.estimatedMinutes, 0)
    expect(total).toBeLessThanOrEqual(35)
  })

  it("has four round scripts, two of them demonstration decks with a scripted learner seat", () => {
    expect(Object.keys(ROUND_SCRIPTS)).toHaveLength(4)
    expect(ROUND_SCRIPTS).toHaveProperty("demo-hand-1")
    expect(ROUND_SCRIPTS).toHaveProperty("demo-hand-2")
    expect(ROUND_SCRIPTS["demo-hand-1"].playerDiscard).toBeDefined()
    expect(ROUND_SCRIPTS["demo-hand-1"].playerPlays).toBeDefined()
    expect(ROUND_SCRIPTS["demo-hand-2"].playerDiscard).toBeDefined()
    expect(ROUND_SCRIPTS["demo-hand-2"].playerPlays).toBeDefined()
    expect(ROUND_SCRIPTS["demo-hand-1"].dealer).toBe("opponent")
    expect(ROUND_SCRIPTS["demo-hand-2"].dealer).toBe("player")
    expect(ROUND_SCRIPTS["first-round"].playerDiscard).toBeUndefined()
    expect(ROUND_SCRIPTS["second-round"].playerDiscard).toBeUndefined()
  })

  it("rejects a demo script whose scripted learner plays are not the kept four", () => {
    const problems = checkPlayerSeat({ ...ROUND_SCRIPTS["demo-hand-1"], playerPlays: [["hearts", 9]] })
    expect(problems.length).toBeGreaterThan(0)
    expect(problems[0].problem).toContain("kept four")
  })

  it("rejects a demo script that sets only one of the two learner fields", () => {
    const problems = checkPlayerSeat({ ...ROUND_SCRIPTS["demo-hand-1"], playerPlays: undefined })
    expect(problems.some((p) => p.problem.includes("must be set together"))).toBe(true)
  })

  it("lesson 1 is an explain, a two-hand demonstration and a recap", () => {
    expect(BEGINNER_PATH[0].steps.map((s) => s.kind)).toEqual(["explain", "round-demo", "recap"])
    const demoStep = BEGINNER_PATH[0].steps[1]
    if (demoStep.kind !== "round-demo") {
      throw new Error("expected the middle step to be a round-demo")
    }
    expect(demoStep.scriptIds).toEqual(["demo-hand-1", "demo-hand-2"])
    expect(BEGINNER_PATH[0].estimatedMinutes).toBe(8)
  })

  it("the beginner path still fits inside about half an hour", () => {
    const total = BEGINNER_PATH.reduce((s, l) => s + l.estimatedMinutes, 0)
    expect(total).toBeLessThanOrEqual(35)
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

  it("rejects a discard scenario whose hint tiers repeat or whose prompt hides the crib owner", () => {
    const base = DISCARD_SCENARIOS["discard-theirs"]
    const problems = checkDiscardScenario("bad", {
      ...base,
      prompt: "Choose two cards.",
      hints: ["a", "a", "b"],
    })
    expect(problems.some((p) => p.problem.includes("distinct"))).toBe(true)
    expect(problems.some((p) => p.problem.includes("crib owner"))).toBe(true)
    expect(problems.some((p) => p.problem.includes("pegging"))).toBe(true)
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

  it("checkScoreScenario flags a required group whose card is not selectable", () => {
    // The real scenario passes: every required fifteen's cards are in the
    // hand plus starter.
    const real = SCORE_SCENARIOS["fifteen-multi"]
    const realProblems = checkScoreScenario("fifteen-multi", real)
    expect(realProblems.filter((p) => /not selectable|no required scoring group/.test(p.problem))).toEqual([])

    // Deviation from the plan's literal fixture: "fifteen-multi" with its
    // starter removed still has two fifteens fully inside its four hand
    // cards (5H-10D, 5H-KS), so that specific construction cannot fail the
    // check (scoreHandDetailed only ever returns groups built from the exact
    // cards it is given, so "selectable" and "required" can never disagree
    // for a scenario whose starter is simply omitted). "nobs-vs-heels"
    // requires the "nobs" category, which by definition needs a starter to
    // exist at all — removing its starter makes that category unreachable
    // and exercises the same code path.
    const noStarter = { ...SCORE_SCENARIOS["nobs-vs-heels"], starter: null }
    const problems = checkScoreScenario("nobs-vs-heels", noStarter)
    expect(problems.some((p) => /not selectable|no required scoring group/.test(p.problem))).toBe(true)
  })
})
