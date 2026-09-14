import { cardKey } from '../../app/entities'
import { CribbageGame, GameAction, explainPegPlay, scoreHand } from '../../app/game'
import type { GameStage } from '../../app/game'
import { SCORE_REASON_COPY } from '../../app/scoreCopy'
import { TRAINING_DEAL_NOTICE } from './tutorialCopy'
import { FixedDeck } from './fixedDeck'
import { specToCard } from './tutorialCards'
import type { CardSpec, RoundPhase, RoundScript } from './tutorialTypes'
import type { PCard } from '../game/gameSlice'

export type RoundLogEntry = { id: string; who: "you" | "opponent"; text: string; points: number }

export type GuidedRoundView = {
  phase: RoundPhase
  stage: GameStage
  awaiting: "acknowledge" | "discard" | "play-card" | "count-hand" | "done" | "error"
  coach: string
  trainingNotice: string
  cribOwner: "you" | "opponent"
  playerHand: ReadonlyArray<PCard>
  playerHandIds: ReadonlyArray<string>
  opponentCardCount: number
  opponentHand: ReadonlyArray<PCard>
  playingSequence: ReadonlyArray<PCard>
  count: number
  starter: PCard | null
  crib: ReadonlyArray<PCard>
  scores: { player: number; opponent: number }
  pegPoints: { player: number[]; opponent: number[] }
  countTask: { hand: ReadonlyArray<PCard>; starter: PCard | null; isCrib: boolean; total: number } | null
  log: ReadonlyArray<RoundLogEntry>
  complete: boolean
}

function toPCard(card: { suit: PCard["suit"]; rank: PCard["rank"] }): PCard {
  return { suit: card.suit, rank: card.rank }
}

export class GuidedRound {
  private readonly script: RoundScript
  private readonly deckCode: string
  private deck!: FixedDeck
  private game!: CribbageGame
  private queue: GameAction[] = []
  private awaiting: GuidedRoundView["awaiting"] = "acknowledge"
  private coach = ""
  private complete = false
  private log: RoundLogEntry[] = []
  private logSeq = 0
  private pegPoints = { player: [0, -1, -1], opponent: [0, -1, -1] }
  private opponentPlayIndex = 0
  private pending: GameAction | null = null
  private countTask: GuidedRoundView["countTask"] = null
  private acknowledged = new Set<RoundPhase>()
  private errorReason = ""
  private resumePending = false

  constructor(script: RoundScript, deckCode: string = "rc") {
    this.script = script
    this.deckCode = deckCode
    this.boot()
  }

  view(): GuidedRoundView {
    const revealShow = this.game.stage === "showing" || this.complete
    const revealCrib = this.game.scores.crib >= 0
    return {
      phase: this.phaseOf(),
      stage: this.game.stage,
      awaiting: this.awaiting,
      coach: this.awaiting === "error" ? this.errorReason : this.coach,
      trainingNotice: TRAINING_DEAL_NOTICE,
      cribOwner: this.script.dealer === "player" ? "you" : "opponent",
      playerHand: this.game.playerHand.hand.map(toPCard),
      playerHandIds: this.game.playerHand.hand.map(cardKey),
      opponentCardCount: this.game.opponentHand.hand.length,
      opponentHand: revealShow ? this.game.savedOpponentHand.hand.map(toPCard) : [],
      playingSequence: this.game.playingHand.hand.map(toPCard),
      count: this.game.playingHand.sum(),
      starter: this.game.starter ? toPCard(this.game.starter) : null,
      crib: revealCrib ? this.game.crib.hand.map(toPCard) : [],
      scores: { player: this.game.scores.player, opponent: this.game.scores.opponent },
      pegPoints: {
        player: [...this.pegPoints.player],
        opponent: [...this.pegPoints.opponent],
      },
      countTask: this.countTask,
      // Snapshot, not a live reference — callers (and tests) may hold onto a
      // view() result across later mutating calls; this.log keeps growing.
      log: [...this.log],
      complete: this.complete,
    }
  }

  reset(): void {
    this.boot()
  }

  acknowledge(): void {
    if (this.awaiting !== "acknowledge") {
      return
    }
    const phase = this.pending?.action === "his-nibs" ? "starter" : this.phaseOf()
    this.acknowledged.add(phase)
    if (!this.pending && this.game.starter) {
      this.acknowledged.add("starter")
    }
    if (this.pending) {
      const action = this.pending
      this.pending = null
      this.resumePending = true
      this.pump([action])
    } else {
      this.pump([])
    }
  }

  submitDiscard(cardIds: ReadonlyArray<string>): { ok: boolean; message: string } {
    if (cardIds.length !== 2) {
      return { ok: false, message: "Choose exactly two cards." }
    }
    const cards = cardIds.map((id) => this.game.playerHand.hand.find((c) => cardKey(c) === id))
    if (cards.some((c) => !c)) {
      return { ok: false, message: "Those cards are not in your hand." }
    }
    const act = new GameAction("discard", "player")
    act.cards = cards as typeof act.cards
    this.pump([act])
    return { ok: true, message: "" }
  }

  submitPlay(cardId: string): { ok: boolean; message: string } {
    const card = this.game.playerHand.hand.find((c) => cardKey(c) === cardId)
    if (!card) {
      return { ok: false, message: "That card is not in your hand." }
    }
    const explained = explainPegPlay(this.game.playingHand.hand, card)
    if (!explained.legal) {
      return { ok: false, message: `That would make ${explained.newCount}, which is over 31.` }
    }
    const act = new GameAction("play-card", "player")
    act.cards = [card]
    this.pump([act])
    return { ok: true, message: explained.events.map((e) => e.label).join(" ") }
  }

  completeCount(): void {
    if (this.awaiting !== "count-hand" || !this.pending) {
      return
    }
    const action = this.pending
    this.pending = null
    this.countTask = null
    this.resumePending = true
    this.pump([action])
  }

  private boot(): void {
    this.deck = new FixedDeck(this.script.deck, this.deckCode)
    this.game = new CribbageGame(this.deck)
    this.game.dealer = this.script.dealer
    this.queue = []
    this.awaiting = "done"
    this.coach = ""
    this.complete = false
    this.log = []
    this.logSeq = 0
    this.pegPoints = { player: [0, -1, -1], opponent: [0, -1, -1] }
    this.opponentPlayIndex = 0
    this.pending = null
    this.countTask = null
    this.acknowledged = new Set()
    this.errorReason = ""
    this.resumePending = false
    this.pump([new GameAction("start-round")])
  }

  private phaseOf(): RoundPhase {
    if (this.game.stage === "dealing") {
      return "deal"
    }
    if (this.game.stage === "selection") {
      return "discard"
    }
    if (this.game.stage === "playing" && !this.game.starter) {
      return "starter"
    }
    if (this.game.stage === "playing") {
      return "pegging"
    }
    if (this.game.stage === "showing" && this.game.scores.crib >= 0) {
      return "crib"
    }
    if (this.game.stage === "showing") {
      return "show"
    }
    return "deal"
  }

  private checkpointFor(phase: RoundPhase): string | undefined {
    return this.script.checkpoints.find((c) => c.phase === phase)?.coach
  }

  private applyScore(action: GameAction, specificLabel?: string): void {
    if (action.score === 0 || this.game.gameOver) {
      return
    }
    const who = action.subaction === "player" ? "player" : "opponent"
    const pga = [...this.pegPoints[who]]
    pga[2] = pga[1]
    pga[1] = pga[0]
    pga[0] += action.score
    this.pegPoints[who] = pga
    // Prefer explainPegPlay's specific label ("Run of three: 5-3-4") over the
    // generic SCORE_REASON_COPY text ("a run in the play") when the caller
    // has one — pump() supplies this for play-card scores.
    const copy = specificLabel ?? SCORE_REASON_COPY[action.reason] ?? action.reason
    this.logSeq += 1
    this.log.push({
      id: `log-${this.logSeq}`,
      who: who === "player" ? "you" : "opponent",
      text: copy,
      points: action.score,
    })
  }

  private cardsFromSpecs(specs: ReadonlyArray<CardSpec>, hand: { suit: string; rank: number }[]) {
    return specs.map((spec) => {
      const card = specToCard(spec)
      return hand.find((c) => c.suit === card.suit && c.rank === card.rank)
    }).filter((c): c is NonNullable<typeof c> => !!c)
  }

  private pump(incoming: GameAction[]): void {
    this.queue.push(...incoming)
    let guard = 0
    while (this.queue.length > 0 && guard++ < 5000) {
      const action = this.queue.shift() as GameAction
      if (action.action === "start-round" && this.complete) {
        continue
      }
      if (action.action === "error") {
        this.awaiting = "error"
        this.errorReason = action.reason || action.details || "The training deal could not continue."
        return
      }
      if (action.action.startsWith("need-")) {
        if (this.handleNeed(action)) {
          return
        }
        continue
      }
      if (action.action === "round-end") {
        this.game.doAction(action)
        this.complete = true
        this.awaiting = "done"
        this.coach = "The training deal is finished."
        return
      }
      if (this.interceptShow(action)) {
        return
      }
      // Compute the specific pegging labels ("Run of three: 5-3-4") from the
      // sequence as it stood *before* this play, so the round log names the
      // exact combination instead of the generic SCORE_REASON_COPY text.
      // doAction's play-card branch runs the same pure explainPegPlay call
      // internally (E4a) and emits its "score" sub-actions in the same
      // fifteen → thirty-one → run → pair order, so zipping by index is safe.
      const peggingLabels = action.action === "play-card" && action.cards[0]
        ? explainPegPlay(this.game.playingHand.hand, action.cards[0]).events.map((e) => e.label)
        : []
      let peggingLabelIdx = 0
      const produced = this.game.doAction(action)
      for (const next of produced) {
        if (next.action === "score") {
          this.game.doAction(next)
          const label = peggingLabels[peggingLabelIdx]
          if (peggingLabels.length > 0) {
            peggingLabelIdx += 1
          }
          this.applyScore(next, label)
        } else if (next.action === "start-round") {
          // first deal only
        } else {
          this.queue.push(next)
        }
      }
      if (this.game.gameOver) {
        this.awaiting = "error"
        this.errorReason = "The training deal reached game end unexpectedly."
        return
      }
      this.maybePauseAfter(action)
      if (this.awaiting === "acknowledge") {
        return
      }
    }
    if (guard >= 5000) {
      this.awaiting = "error"
      this.errorReason = "The training deal stopped after too many steps."
    }
  }

  private handleNeed(action: GameAction): boolean {
    if (action.action === "need-discard") {
      if (action.subaction === "opponent") {
        const cards = this.cardsFromSpecs(this.script.opponentDiscard, this.game.opponentHand.hand)
        const act = new GameAction("discard", "opponent")
        act.cards = cards as typeof act.cards
        this.queue.push(act)
        return false
      }
      this.awaiting = "discard"
      this.coach = this.checkpointFor("discard") ?? "Choose two cards for the crib."
      return true
    }
    if (action.action === "need-play-card") {
      if (action.subaction === "opponent") {
        const hand = this.game.opponentHand.hand
        let chosen = this.script.opponentPlays
          .slice(this.opponentPlayIndex)
          .map((spec) => hand.find((c) => c.suit === spec[0] && c.rank === spec[1]))
          .find((c) => c && this.game.playingHand.sum() + c.value <= 31)
        if (!chosen) {
          chosen = hand.find((c) => this.game.playingHand.sum() + c.value <= 31)
          if (chosen) {
            console.log("GuidedRound: scripted opponent card illegal; using first legal", chosen)
          }
        }
        if (!chosen) {
          return false
        }
        this.opponentPlayIndex += 1
        const act = new GameAction("play-card", "opponent")
        act.cards = [chosen]
        this.queue.push(act)
        return false
      }
      this.awaiting = "play-card"
      this.coach = this.checkpointFor("pegging") ?? "Choose a card to play."
      return true
    }
    if (action.action === "need-starter-card") {
      const card = this.deck.dealOne()
      if (!card) {
        this.awaiting = "error"
        this.errorReason = "The scripted deck ran out of cards."
        return true
      }
      const act = new GameAction("starter-card", action.subaction)
      act.cards = [card]
      this.queue.push(act)
      return false
    }
    return false
  }

  private interceptShow(action: GameAction): boolean {
    if (this.resumePending) {
      this.resumePending = false
      return false
    }
    const learnerIsDealer = this.script.dealer === "player"
    if (action.action === "show-non-dealer") {
      if (!learnerIsDealer) {
        this.pauseCount("player", false, action, this.checkpointFor("show") ?? "You count first.")
        return true
      }
      this.pauseAck(action, "The opponent counts first.")
      return true
    }
    if (action.action === "show-dealer") {
      if (learnerIsDealer) {
        this.pauseCount("player", false, action, "You count second.")
        return true
      }
      this.pauseAck(action, "The dealer counts next.")
      return true
    }
    if (action.action === "show-crib") {
      if (learnerIsDealer) {
        this.pauseCount("crib", true, action, this.checkpointFor("crib") ?? "The crib is yours.")
        return true
      }
      this.pauseAck(action, this.checkpointFor("crib") ?? "The crib is theirs.")
      return true
    }
    if (action.action === "his-nibs" && !this.acknowledged.has("starter")) {
      this.pending = action
      this.awaiting = "acknowledge"
      this.coach = this.checkpointFor("starter") ?? SCORE_REASON_COPY["his-nibs"]
      return true
    }
    return false
  }

  private pauseCount(
    source: "player" | "crib",
    isCrib: boolean,
    action: GameAction,
    coach: string,
  ): void {
    const hand = source === "crib" ? this.game.crib.hand : this.game.savedPlayerHand.hand
    const starter = this.game.starter
    this.countTask = {
      hand: hand.map(toPCard),
      starter: starter ? toPCard(starter) : null,
      isCrib,
      total: scoreHand(hand, starter, isCrib),
    }
    this.pending = action
    this.awaiting = "count-hand"
    this.coach = coach
  }

  private pauseAck(action: GameAction, coach: string): void {
    this.pending = action
    this.awaiting = "acknowledge"
    this.coach = coach
  }

  private maybePauseAfter(action: GameAction): void {
    if (action.action === "starter-card" && !this.acknowledged.has("starter") && this.game.starter?.rank !== 11) {
      this.awaiting = "acknowledge"
      this.coach = this.checkpointFor("starter") ?? "The starter is turned."
    }
  }
}
