export type Difficulty = "easy" | "intermediate" | "expert"

export const DIFFICULTY_ORDER: ReadonlyArray<Difficulty> = ["easy", "intermediate", "expert"]

/** Probability of choosing the 1st / 2nd / 3rd / 4th best candidate.
 *  These are the only tuning knobs; selection logic must not special-case a level. */
export const DIFFICULTY_WEIGHTS: Record<Difficulty, ReadonlyArray<number>> = {
  easy:         [0.40, 0.25, 0.20, 0.15],
  intermediate: [0.70, 0.20, 0.07, 0.03],
  expert:       [1.00],
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy:         "Easy",
  intermediate: "Intermediate",
  expert:       "Expert",
}

/** Player-facing, honest description of the strategy. Shown in the modal and on /learn. */
export const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  easy:         "Often takes the second, third, or fourth best discard and pegging card.",
  intermediate: "Usually plays the best move, but slips to a near-miss about three times in ten.",
  expert:       "Always plays the highest expected-value discard and pegging card.",
}

export function pickWeightedIndex(
  weights: ReadonlyArray<number>,
  candidateCount: number,
  rng: () => number = Math.random
): number {
  if (candidateCount <= 0) {
    return -1
  }
  const used = weights.slice(0, Math.min(weights.length, candidateCount))
  const sum = used.reduce((acc, w) => acc + w, 0)
  const r = rng()
  let cumulative = 0
  for (let i = 0; i < used.length; i++) {
    cumulative += used[i] / sum
    if (r < cumulative) {
      return i
    }
  }
  return used.length - 1
}
