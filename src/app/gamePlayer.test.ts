import { Card, StdDeck } from './entities'
import { GameAction, getBestHand, playBestCard1, rankDiscards, rankPlays } from './game'
import { thePlayer } from './gamePlayer'
import { initialState } from '../features/game/gameSlice'
import gamePlayerSource from './gamePlayer.ts?raw'

function dealSix(): Card[] {
  const deck = new StdDeck("rc")
  deck.shuffle()
  return [1, 2, 3, 4, 5, 6].map(() => deck.dealOne() as Card)
}

function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank
}

describe("GamePlayer scaffold wiring", () => {
  beforeEach(() => {
    thePlayer.resetForNewSession()
  })

  it("resetForNewSession clears queues, ledger, and scores", () => {
    thePlayer.playQueue.push(new GameAction("info"))
    thePlayer.gameQueue.push(new GameAction("info"))
    thePlayer.game.scores.player = 50
    thePlayer.game.breakdown.player.hand = 12
    thePlayer.game.rounds = 3
    thePlayer.game.gameOver = false
    thePlayer.resetForNewSession()
    expect(thePlayer.playQueue).toEqual([])
    expect(thePlayer.gameQueue).toEqual([])
    expect(thePlayer.game.scores.player).toBe(0)
    expect(thePlayer.game.rounds).toBe(0)
    expect(thePlayer.game.breakdown.player.hand).toBe(0)
    expect(thePlayer.game.gameOver).toBe(false)
    expect(thePlayer.stateUpdate).toEqual({})
  })

  it("has no stored difficulty field", () => {
    expect("difficulty" in thePlayer).toBe(false)
    expect(gamePlayerSource).not.toMatch(/this\.difficulty\s*=/)
  })

  it("selects the Expert keep for the opponent at expert difficulty", () => {
    const hand = dealSix()
    thePlayer.game.opponentHand.hand = hand
    thePlayer.game.dealer = "player"
    const act = thePlayer.selectOpponentCards("expert", 0)
    expect(act.action).toBe("discard")
    expect(act.cards).toHaveLength(2)
    const keep = getBestHand(hand, [], false)
    const discarded = rankDiscards(hand, [], false)[0].discard
    const key = (c: Card) => `${c.suit}-${c.rank}`
    expect(new Set(act.cards.map(key))).toEqual(new Set(discarded.map(key)))
    expect(keep).toHaveLength(4)
  })

  it("plays the Expert pegging card at expert difficulty", () => {
    const table = [new Card("hearts", 5)]
    const hand = [new Card("clubs", 10), new Card("spades", 3)]
    thePlayer.game.playingHand.hand = table
    thePlayer.game.opponentHand.hand = hand
    const act = thePlayer.playOpponentCard("expert", 0)
    const best = playBestCard1(table, hand)
    expect(act.action).toBe("play-card")
    expect(best).not.toBeNull()
    expect(sameCard(act.cards[0], best as Card)).toBe(true)
    expect(sameCard(act.cards[0], rankPlays(table, hand)[0].card)).toBe(true)
  })

  it("returns error when the opponent has no legal peg card", () => {
    thePlayer.game.playingHand.hand = [
      new Card("hearts", 10),
      new Card("spades", 10),
      new Card("clubs", 10),
    ]
    thePlayer.game.opponentHand.hand = [new Card("diamonds", 13)]
    expect(thePlayer.playOpponentCard("easy", 0).action).toBe("error")
  })

  it("auto-select and autoplay stay on the Expert wrappers", () => {
    const hand = dealSix()
    thePlayer.game.playerHand.hand = hand
    thePlayer.game.dealer = "opponent"
    const discard = thePlayer.autoSelectPlayerCards(0)
    expect(discard.action).toBe("discard")
    expect(discard.cards).toHaveLength(2)
    const keep = getBestHand(hand, [], false)
    const thrown = hand.filter(c => !keep.some(k => sameCard(k, c)))
    expect(discard.cards).toHaveLength(thrown.length)
    thePlayer.game.playerHand.hand = []
    thePlayer.game.playingHand.hand = []
    expect(thePlayer.autoplayPlayerCard(0).action).toBe("error")
    expect(gamePlayerSource).toMatch(/getBestHand/)
    expect(gamePlayerSource).toMatch(/playBestCard1/)
  })

  it("publishes a snapshot on game-win using the incoming state difficulty", () => {
    thePlayer.game.breakdown.player.hand = 8
    thePlayer.game.breakdown.player.total = 8
    thePlayer.game.winner = "player"
    thePlayer.game.rounds = 4
    const state = { ...initialState, difficulty: "easy" as const }
    thePlayer.handleAction(state, new GameAction("game-win", "player"))
    const snap = thePlayer.stateUpdate.finalBreakdown as {
      difficulty: string
      rounds: number
      winner: string
      player: { hand: number }
    }
    expect(snap.difficulty).toBe("easy")
    expect(snap.rounds).toBe(4)
    expect(snap.winner).toBe("player")
    expect(snap.player.hand).toBe(8)
  })
})
