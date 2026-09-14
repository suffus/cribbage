import type { DiscardOption, PegPlayResult, ScoringCategory, ScoringGroup } from '../../app/game'

export function describeGroup(g: ScoringGroup): string {
  return `${g.label} for ${g.points}`
}

export function describeMissingCategory(c: ScoringCategory): string {
  switch (c) {
    case "fifteen":
      return "There is still a fifteen to find."
    case "pair":
      return "There is still a pair to find. Select each pair on its own."
    case "run":
      return "There is still a run."
    case "flush":
      return "There is still a flush."
    case "nobs":
      return "There is still nobs — the jack of the starter's suit."
  }
}

export function describeDiscardComparison(
  chosen: DiscardOption,
  best: DiscardOption,
  isPlayerCrib: boolean,
): { plain: string; math: string } {
  const crib = isPlayerCrib ? "your crib" : "their crib"
  const sameKeep = chosen.keep.length === best.keep.length
    && chosen.keep.every((c, i) => c.suit === best.keep[i]?.suit && c.rank === best.keep[i]?.rank)
  const plain = sameKeep
    ? `That keep is the one the engine likes best for ${crib}.`
    : `Another keep scores more on balance for ${crib}. Because this is ${crib}, think about what those two cards will do after they leave your hand.`
  const math = `Chosen keep expected value ${chosen.score.toFixed(2)}; best keep ${best.score.toFixed(2)}.`
  return { plain, math }
}

export function describePegOutcome(r: PegPlayResult): string {
  if (!r.legal) {
    return `That would make ${r.newCount}, which is over 31, so it cannot be played.`
  }
  if (r.events.length === 0) {
    return `Legal play. The count is now ${r.newCount}.`
  }
  const names = r.events.map((e) => e.label).join("; ")
  return `That scores ${r.total}. ${names}. The count is now ${r.newCount}.`
}

/** I6: labelled a training deal. Must not be read as a claim about shuffle fairness. */
export const TRAINING_DEAL_NOTICE =
  "This is a training deal, arranged so the useful moments come up. It is not a shuffled hand from a regular game."
