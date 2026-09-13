import { StdDeck } from './entities'
import {
  DIFFICULTY_DESCRIPTIONS,
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  DIFFICULTY_WEIGHTS,
  pickWeightedIndex,
} from './difficulty'
import difficultySource from './difficulty.ts?raw'

describe("T3a pickWeightedIndex", () => {
  it("returns 0 for expert weights on every non-empty list", () => {
    for (let n = 1; n <= 15; n++) {
      expect(pickWeightedIndex([1.00], n, () => 0)).toBe(0)
      expect(pickWeightedIndex([1.00], n, () => 0.999)).toBe(0)
    }
  })

  it("returns -1 when there are no candidates", () => {
    expect(pickWeightedIndex(DIFFICULTY_WEIGHTS.easy, 0)).toBe(-1)
    expect(pickWeightedIndex(DIFFICULTY_WEIGHTS.expert, 0)).toBe(-1)
  })

  it("renormalises over the first two weights and never returns 2 or 3", () => {
    const hits = new Set<number>()
    for (let i = 0; i < 20; i++) {
      const idx = pickWeightedIndex(DIFFICULTY_WEIGHTS.easy, 2, () => i / 20)
      hits.add(idx)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(2)
    }
    expect(hits.has(2)).toBe(false)
    expect(hits.has(3)).toBe(false)
  })

  it("walks each bucket of a four-weight table for fixed rng values", () => {
    const weights = DIFFICULTY_WEIGHTS.easy
    // used sum is 1.00; stay inside buckets, not on float-edge boundaries
    expect(pickWeightedIndex(weights, 4, () => 0)).toBe(0)
    expect(pickWeightedIndex(weights, 4, () => 0.20)).toBe(0)
    expect(pickWeightedIndex(weights, 4, () => 0.50)).toBe(1)
    expect(pickWeightedIndex(weights, 4, () => 0.70)).toBe(2)
    expect(pickWeightedIndex(weights, 4, () => 0.90)).toBe(3)
    expect(pickWeightedIndex(weights, 4, () => 0.999)).toBe(3)
  })
})

describe("T3b fair-shuffle guard", () => {
  it("does not import entities or mention shuffle", () => {
    expect(difficultySource).not.toMatch(/entities/)
    expect(difficultySource).not.toMatch(/shuffle/)
  })

  it("leaves StdDeck.shuffle zero-argument", () => {
    expect(StdDeck.prototype.shuffle.length).toBe(0)
  })
})

describe("difficulty tables", () => {
  it("exports the committed order, weights, labels, and descriptions", () => {
    expect(DIFFICULTY_ORDER).toEqual(["easy", "intermediate", "expert"])
    expect(DIFFICULTY_WEIGHTS.easy).toEqual([0.40, 0.25, 0.20, 0.15])
    expect(DIFFICULTY_WEIGHTS.intermediate).toEqual([0.70, 0.20, 0.07, 0.03])
    expect(DIFFICULTY_WEIGHTS.expert).toEqual([1.00])
    expect(DIFFICULTY_LABELS).toEqual({
      easy: "Easy",
      intermediate: "Intermediate",
      expert: "Expert",
    })
    expect(DIFFICULTY_DESCRIPTIONS.easy).toMatch(/second, third, or fourth/)
    expect(DIFFICULTY_DESCRIPTIONS.intermediate).toMatch(/three times in ten/)
    expect(DIFFICULTY_DESCRIPTIONS.expert).toMatch(/highest expected-value/)
  })

  it("never returns an index past the truncated weight list", () => {
    for (let i = 0; i < 20; i++) {
      const idx = pickWeightedIndex(DIFFICULTY_WEIGHTS.easy, 15, () => i / 20)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(4)
    }
    expect(pickWeightedIndex(DIFFICULTY_WEIGHTS.intermediate, 1, () => 0.99)).toBe(0)
    expect(pickWeightedIndex(DIFFICULTY_WEIGHTS.easy, -1)).toBe(-1)
  })

  it("does not import the engine or mention a difficulty argument on shuffle", () => {
    expect(difficultySource).not.toMatch(/from ['"]\.\/game/)
    expect(difficultySource).not.toMatch(/from ['"]\.\/entities/)
    expect(difficultySource).not.toMatch(/if\s*\(\s*difficulty/)
  })
})
