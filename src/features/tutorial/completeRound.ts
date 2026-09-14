import { cardKey } from '../../app/entities'
import { explainPegPlay } from '../../app/game'
import { GuidedRound } from './guidedRound'
import { ROUND_SCRIPTS } from './scenarios'
import { specToCard } from './tutorialCards'

/** Drives a scripted round with any legal learner choices so C4 check 7 can prove it finishes. */
export function completeRound(scriptId: string): { ok: boolean; reason?: string } {
  const script = ROUND_SCRIPTS[scriptId]
  if (!script) {
    return { ok: false, reason: `unknown script ${scriptId}` }
  }
  const round = new GuidedRound(script)
  let guard = 0
  while (guard++ < 400) {
    const view = round.view()
    if (view.complete || view.awaiting === "done") {
      return { ok: true }
    }
    if (view.awaiting === "error") {
      return { ok: false, reason: view.coach }
    }
    if (view.awaiting === "acknowledge") {
      round.acknowledge()
      continue
    }
    if (view.awaiting === "discard") {
      const ids = view.playerHandIds.slice(0, 2)
      const result = round.submitDiscard(ids)
      if (!result.ok) {
        return { ok: false, reason: result.message }
      }
      continue
    }
    if (view.awaiting === "play-card") {
      const legal = view.playerHand.find((card) => {
        const live = specToCard([card.suit, card.rank])
        return explainPegPlay(
          view.playingSequence.map((c) => specToCard([c.suit, c.rank])),
          live,
        ).legal
      })
      if (!legal) {
        return { ok: false, reason: `no legal play at count ${view.count}` }
      }
      const result = round.submitPlay(cardKey(specToCard([legal.suit, legal.rank])))
      if (!result.ok) {
        return { ok: false, reason: result.message }
      }
      continue
    }
    if (view.awaiting === "count-hand") {
      round.completeCount()
      continue
    }
    return { ok: false, reason: `stuck at ${view.awaiting}: ${view.coach}` }
  }
  return { ok: false, reason: "too many steps" }
}
