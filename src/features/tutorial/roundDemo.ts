import { CribbageGame, GameAction, explainPegPlay, scoreHand } from '../../app/game'
import { SCORE_REASON_COPY } from '../../app/scoreCopy'
import { FixedDeck } from './fixedDeck'
import type { RoundLogEntry } from './guidedRound'
import { ROUND_SCRIPTS } from './scenarios'
import { specToCard } from './tutorialCards'
import type { CardSpec, RoundPhase, RoundScript } from './tutorialTypes'
import type { PCard } from '../game/gameSlice'

export type DemoStage = "deal" | "discard" | "starter" | "pegging" | "show" | "board" | "done"
export type DemoOwner = "you" | "opponent"
export type DemoBreakdown = {
  title: string
  hand: ReadonlyArray<PCard>
  starter: PCard | null
  isCrib: boolean
  total: number
  /** False once the hand's cards are known (the show has started) but before
   *  this particular hand's own show beat has counted it — the cards are
   *  visible, but the score is not disclosed yet (R5). */
  revealed: boolean
}
/** The three hands counted during the show, in counting order. Each slot is
 *  null until the show starts (R5); after that its cards are visible with
 *  `revealed: false` until its own beat has scored it. */
export type DemoShowState = {
  nonDealer: DemoBreakdown | null
  dealer: DemoBreakdown | null
  crib: DemoBreakdown | null
}

export type DemoView = {
  handNumber: 1 | 2
  stage: DemoStage
  phase: RoundPhase
  coach: string
  playerHand: ReadonlyArray<PCard>
  opponentHand: ReadonlyArray<PCard>
  crib: ReadonlyArray<PCard>
  starter: PCard | null
  trick: ReadonlyArray<{ card: PCard; by: DemoOwner }>
  lastTrick: ReadonlyArray<{ card: PCard; by: DemoOwner }>
  lastTrickReason: string
  count: number
  dealer: DemoOwner
  scores: { player: number; opponent: number }
  pegPoints: { player: number[]; opponent: number[] }
  show: DemoShowState
  log: ReadonlyArray<RoundLogEntry>
  beatIndex: number
  atStart: boolean
  atEnd: boolean
}

function toPCard(card: { suit: PCard["suit"]; rank: PCard["rank"] }): PCard {
  return { suit: card.suit, rank: card.rank }
}

export class RoundDemo {
  private readonly scripts: readonly [RoundScript, RoundScript]
  private readonly deckCode: string
  private handIndex: 0 | 1 = 0
  private deck!: FixedDeck
  private game!: CribbageGame
  private queue: GameAction[] = []
  private stage: DemoStage = "deal"
  private phase: RoundPhase = "deal"
  private coach = ""
  private trick: Array<{ card: PCard; by: DemoOwner }> = []
  private lastTrick: Array<{ card: PCard; by: DemoOwner }> = []
  private lastTrickReason = ""
  private carriedScores = { player: 0, opponent: 0 }
  private pegPoints = { player: [0, -1, -1], opponent: [0, -1, -1] }
  private log: RoundLogEntry[] = []
  private logSeq = 0
  private showNonDealer: DemoBreakdown | null = null
  private showDealer: DemoBreakdown | null = null
  private showCrib: DemoBreakdown | null = null
  private beatIndex = 0
  private playerPlayIndex = 0
  private opponentPlayIndex = 0
  private discardsThisHand = 0
  /** Set on the round-end beat that follows hand 2's show, so the deferred
   *  "board" beat (R6/R7) knows whether to boot hand 2 or finish the demo. */
  private pendingFinish = false
  private done = false

  constructor(scriptIds: readonly [string, string], deckCode: string = "rc") {
    const resolved = scriptIds.map((id) => ROUND_SCRIPTS[id])
    for (let i = 0; i < 2; i++) {
      const script = resolved[i]
      if (!script) {
        throw new Error(`RoundDemo: unknown script id "${scriptIds[i]}"`)
      }
      if (script.playerDiscard === undefined || script.playerPlays === undefined) {
        throw new Error(`RoundDemo: script "${scriptIds[i]}" has no scripted learner seat`)
      }
    }
    this.scripts = [resolved[0] as RoundScript, resolved[1] as RoundScript]
    this.deckCode = deckCode
    this.reset()
  }

  view(): DemoView {
    return {
      handNumber: this.handIndex === 0 ? 1 : 2,
      stage: this.stage,
      phase: this.phase,
      coach: this.coach,
      playerHand: this.game.playerHand.hand.map(toPCard),
      opponentHand: this.game.opponentHand.hand.map(toPCard),
      crib: this.game.crib.hand.map(toPCard),
      starter: this.game.starter ? toPCard(this.game.starter) : null,
      trick: this.trick.map((t) => ({ card: t.card, by: t.by })),
      lastTrick: this.lastTrick.map((t) => ({ card: t.card, by: t.by })),
      lastTrickReason: this.lastTrickReason,
      count: this.game.playingHand.sum(),
      dealer: this.scripts[this.handIndex].dealer === "player" ? "you" : "opponent",
      scores: {
        player: this.carriedScores.player + this.game.scores.player,
        opponent: this.carriedScores.opponent + this.game.scores.opponent,
      },
      pegPoints: {
        player: [...this.pegPoints.player],
        opponent: [...this.pegPoints.opponent],
      },
      show: { nonDealer: this.showNonDealer, dealer: this.showDealer, crib: this.showCrib },
      log: [...this.log],
      beatIndex: this.beatIndex,
      atStart: this.beatIndex === 0,
      atEnd: this.done,
    }
  }

  advance(): void {
    if (this.done) {
      return
    }
    this.produceBeat()
  }

  back(): void {
    if (this.beatIndex === 0) {
      return
    }
    const target = Math.max(0, this.beatIndex - 1)
    this.reset()
    for (let i = 0; i < target; i++) {
      this.produceBeat()
    }
  }

  reset(): void {
    this.carriedScores = { player: 0, opponent: 0 }
    this.pegPoints = { player: [0, -1, -1], opponent: [0, -1, -1] }
    this.log = []
    this.logSeq = 0
    this.beatIndex = 0
    this.done = false
    this.bootHand(0)
  }

  private bootHand(handIndex: 0 | 1): void {
    const script = this.scripts[handIndex]
    this.handIndex = handIndex
    this.deck = new FixedDeck(script.deck, this.deckCode)
    this.game = new CribbageGame(this.deck)
    this.game.dealer = script.dealer
    this.queue = [new GameAction("start-round")]
    this.stage = "deal"
    this.phase = "deal"
    this.trick = []
    this.lastTrick = []
    this.lastTrickReason = ""
    this.showNonDealer = null
    this.showDealer = null
    this.showCrib = null
    this.discardsThisHand = 0
    this.pendingFinish = false
    this.playerPlayIndex = 0
    this.opponentPlayIndex = 0
    this.coach = this.checkpointFor("deal") ?? "Watch the cards go out."
  }

  private checkpointFor(phase: RoundPhase): string | undefined {
    return this.scripts[this.handIndex].checkpoints.find((c) => c.phase === phase)?.coach
  }

  private cardsFromSpecs(specs: ReadonlyArray<CardSpec>, hand: { suit: string; rank: number }[]) {
    return specs.map((spec) => {
      const card = specToCard(spec)
      return hand.find((c) => c.suit === card.suit && c.rank === card.rank)
    }).filter((c): c is NonNullable<typeof c> => !!c)
  }

  private fail(message: string): void {
    this.stage = "done"
    this.done = true
    this.coach = message
  }

  private isBeatAction(action: GameAction): boolean {
    switch (action.action) {
      case "deal-card":
      case "starter-card":
      case "play-card":
      case "show-non-dealer":
      case "show-dealer":
      case "show-crib":
      case "round-end":
        return true
      case "discard":
        return this.discardsThisHand >= 2
      default:
        return false
    }
  }

  private applyProduced(produced: GameAction[], labels: ReadonlyArray<string>, idxRef: { i: number }): void {
    for (const next of produced) {
      if (next.action === "score") {
        this.game.doAction(next)
        const label = labels[idxRef.i]
        if (labels.length > 0) {
          idxRef.i += 1
        }
        this.logScore(next, label)
      } else if (next.action === "his-nibs" || next.action === "last-card") {
        const inner = this.game.doAction(next)
        this.applyProduced(inner, [], { i: 0 })
      } else if (next.action === "start-round") {
        // Never expected mid-hand; the engine's own round-end -> start-round
        // chain is intentionally not followed (D2/D3) — a fresh CribbageGame
        // is built for hand 2 instead.
      } else {
        this.queue.push(next)
      }
    }
  }

  private logScore(action: GameAction, specificLabel?: string): void {
    if (action.score === 0) {
      return
    }
    const who: DemoOwner = action.subaction === "player" ? "you" : "opponent"
    const bucket = who === "you" ? "player" : "opponent"
    const pga = [...this.pegPoints[bucket]]
    pga[2] = pga[1]
    pga[1] = pga[0]
    pga[0] += action.score
    this.pegPoints[bucket] = pga
    const copy = specificLabel ?? SCORE_REASON_COPY[action.reason] ?? action.reason
    this.logSeq += 1
    this.log.push({ id: `log-${this.logSeq}`, who, text: copy, points: action.score })
  }

  private resolveNeed(action: GameAction): void {
    const script = this.scripts[this.handIndex]
    if (action.action === "need-discard") {
      const isPlayer = action.subaction === "player"
      const specs: ReadonlyArray<CardSpec> = isPlayer ? (script.playerDiscard as readonly [CardSpec, CardSpec]) : script.opponentDiscard
      const hand = isPlayer ? this.game.playerHand.hand : this.game.opponentHand.hand
      const cards = this.cardsFromSpecs(specs, hand)
      const act = new GameAction("discard", action.subaction)
      act.cards = cards as typeof act.cards
      this.queue.push(act)
      return
    }
    if (action.action === "need-play-card") {
      const isPlayer = action.subaction === "player"
      const hand = isPlayer ? this.game.playerHand.hand : this.game.opponentHand.hand
      const specs: ReadonlyArray<CardSpec> = isPlayer ? (script.playerPlays as ReadonlyArray<CardSpec>) : script.opponentPlays
      const playIndex = isPlayer ? this.playerPlayIndex : this.opponentPlayIndex
      let chosen = specs
        .slice(playIndex)
        .map((spec) => hand.find((c) => c.suit === spec[0] && c.rank === spec[1]))
        .find((c) => c && this.game.playingHand.sum() + c.value <= 31)
      if (!chosen) {
        chosen = hand.find((c) => this.game.playingHand.sum() + c.value <= 31)
      }
      if (!chosen) {
        return
      }
      if (isPlayer) {
        this.playerPlayIndex += 1
      } else {
        this.opponentPlayIndex += 1
      }
      const act = new GameAction("play-card", action.subaction)
      act.cards = [chosen]
      this.queue.push(act)
      return
    }
    if (action.action === "need-starter-card") {
      const card = this.deck.dealOne()
      if (!card) {
        this.fail("The scripted deck ran out of cards.")
        return
      }
      const act = new GameAction("starter-card", action.subaction)
      act.cards = [card]
      this.queue.push(act)
    }
  }

  private breakdownFor(kind: "non-dealer" | "dealer" | "crib", revealed: boolean): DemoBreakdown {
    const script = this.scripts[this.handIndex]
    const learnerIsDealer = script.dealer === "player"
    const starter = this.game.starter ? toPCard(this.game.starter) : null
    if (kind === "crib") {
      const hand = this.game.crib.hand
      return {
        title: learnerIsDealer ? "Your crib" : "Their crib",
        hand: hand.map(toPCard),
        starter,
        isCrib: true,
        total: scoreHand(hand, this.game.starter, true),
        revealed,
      }
    }
    const isLearner = (kind === "non-dealer" && !learnerIsDealer) || (kind === "dealer" && learnerIsDealer)
    const hand = isLearner ? this.game.savedPlayerHand.hand : this.game.savedOpponentHand.hand
    return {
      title: isLearner ? "Your hand" : "Their hand",
      hand: hand.map(toPCard),
      starter,
      isCrib: false,
      total: scoreHand(hand, this.game.starter, false),
      revealed,
    }
  }

  /** R6/R7: shown on the "board" beat after each hand's show, explaining how
   *  the two pegs per player leapfrog to record the score just added. */
  private boardRecapCoach(): string {
    const totalPlayer = this.carriedScores.player + this.game.scores.player
    const totalOpponent = this.carriedScores.opponent + this.game.scores.opponent
    return "The board keeps score with two pegs for each player. One peg marks where you were "
      + "before this hand; when points are scored, the other peg jumps ahead of it — leapfrogging "
      + "past it on the board — to mark the new total. Next time, whichever peg is now behind will "
      + `leapfrog forward in turn. You are now at ${totalPlayer}, they are at ${totalOpponent}.`
  }

  private advanceToHand2(): void {
    this.carriedScores = {
      player: this.carriedScores.player + this.game.scores.player,
      opponent: this.carriedScores.opponent + this.game.scores.opponent,
    }
    this.bootHand(1)
  }

  private finishBeat(action: GameAction, note?: string): void {
    switch (action.action) {
      case "deal-card":
        this.stage = "deal"
        this.phase = "deal"
        this.coach = this.checkpointFor("deal") ?? "Watch the cards go out."
        break
      case "discard":
        this.stage = "discard"
        this.phase = "discard"
        this.coach = this.checkpointFor("discard") ?? "Watch the crib form."
        break
      case "starter-card":
        this.stage = "starter"
        this.phase = "starter"
        this.coach = this.checkpointFor("starter") ?? "The starter is turned."
        break
      case "play-card":
        this.stage = "pegging"
        this.phase = "pegging"
        this.coach = note ?? this.checkpointFor("pegging") ?? "Watch the count."
        break
      case "show-non-dealer":
        this.stage = "show"
        this.phase = "show"
        // R5: all three hands become visible together as soon as the count
        // starts; only the non-dealer's total is disclosed on this beat.
        this.showNonDealer = this.breakdownFor("non-dealer", true)
        this.showDealer = this.breakdownFor("dealer", false)
        this.showCrib = this.breakdownFor("crib", false)
        this.coach = "This is the count — the next phase of Cribbage, where each hand is scored one at a time. "
          + (this.checkpointFor("show") ?? "Now the hands are counted.")
        break
      case "show-dealer":
        this.stage = "show"
        this.phase = "show"
        this.showDealer = this.breakdownFor("dealer", true)
        this.coach = this.checkpointFor("show") ?? "Now the hands are counted."
        break
      case "show-crib":
        this.stage = "show"
        this.phase = "crib"
        this.showCrib = this.breakdownFor("crib", true)
        this.coach = this.checkpointFor("crib") ?? "The crib is counted last."
        break
      case "round-end":
        // R6/R7: pause on a dedicated "board" beat before moving on, so the
        // learner sees how the two pegs per player leapfrog to record what
        // was just scored, instead of jumping straight to the next hand.
        this.stage = "board"
        this.phase = "crib"
        this.pendingFinish = this.handIndex === 1
        this.coach = this.boardRecapCoach()
        break
      default:
        break
    }
  }

  private produceBeat(): void {
    // R6/R7: the "board" recap has no engine action of its own — it is a
    // pure UI pause inserted after round-end. Resolve it here so back()'s
    // reset-and-replay-by-count stays a straightforward beat counter.
    if (this.stage === "board") {
      this.beatIndex += 1
      if (this.pendingFinish) {
        this.stage = "done"
        this.phase = "crib"
        this.done = true
        this.coach = "That is two whole hands. The deal, the crib and the counting order all swapped between them."
      } else {
        this.advanceToHand2()
      }
      return
    }
    let guard = 0
    while (this.queue.length > 0 && guard++ < 5000) {
      const action = this.queue.shift() as GameAction
      if (action.action === "error") {
        this.fail("The demonstration stopped unexpectedly.")
        return
      }
      if (action.action.startsWith("need-")) {
        this.resolveNeed(action)
        continue
      }
      const pegResult = action.action === "play-card" && action.cards[0]
        ? explainPegPlay(this.game.playingHand.hand, action.cards[0])
        : null
      const peggingLabels = pegResult ? pegResult.events.map((e) => e.label) : []
      const produced = this.game.doAction(action)
      if (action.action === "play-card" && this.game.playingHand.hand.length === this.trick.length + 1 && action.cards[0]) {
        this.trick.push({ card: toPCard(action.cards[0]), by: action.subaction === "player" ? "you" : "opponent" })
      }
      if (action.action === "discard") {
        this.discardsThisHand += 1
      }
      this.applyProduced(produced, peggingLabels, { i: 0 })
      if (this.game.gameOver) {
        this.fail("The demonstration reached an unexpected end.")
        return
      }
      if (action.action === "play-card" && this.game.playingHand.hand.length === 0 && this.trick.length > 0) {
        this.lastTrick = [...this.trick]
        this.lastTrickReason = pegResult && pegResult.newCount === 31
          ? "The count reached 31, so it resets to 0."
          : "Neither player could play, so the count resets to 0."
        this.trick = []
      }
      if (this.isBeatAction(action)) {
        this.beatIndex += 1
        // R4: reaching 31 exactly is worth calling out explicitly, in
        // addition to the generic pegging checkpoint the script provides.
        const note = action.action === "play-card" && pegResult?.newCount === 31
          ? "Reaching exactly 31 scores 2 points for the player who played that card, and the count resets to 0 for the next cards."
          : undefined
        this.finishBeat(action, note)
        return
      }
    }
    if (guard >= 5000) {
      this.fail("The demonstration stopped unexpectedly.")
    }
  }
}
