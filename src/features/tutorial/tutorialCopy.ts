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

/** T6's "Show the math" per-option line: `hand <H> <plus|minus> crib <C> = <T>`.
 *  Decision D11: every number here is produced at run time from `option`,
 *  never hard-coded. */
export function describeDiscardMath(option: DiscardOption, isPlayerCrib: boolean): string {
  const connective = isPlayerCrib ? "plus" : "minus"
  return `hand ${option.handScore.toFixed(1)} ${connective} crib ${option.cribScore.toFixed(1)} = ${option.score.toFixed(1)}`
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
    ? `That is the throw the engine likes best for ${crib}. It balances three things: the score your four cards keep, what your two cards are worth in ${crib}, and whether your four cards give you a spread of ranks to peg with.`
    : `Another throw does better on balance for ${crib}. Weigh three things: the score your four cards keep, what your two cards are worth in ${crib}, and whether your four cards give you a spread of ranks to peg with. Press Show the math for the first two as numbers.`
  const math = [
    `Two numbers decide this. Your four cards have an expected score, and the two you throw have an expected value in ${crib}. Because it is ${crib}, the crib number is ${isPlayerCrib ? "added" : "subtracted"}.`,
    `Your throw: ${describeDiscardMath(chosen, isPlayerCrib)}.`,
    `Engine's best throw: ${describeDiscardMath(best, isPlayerCrib)}.`,
  ].join(" ")
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
