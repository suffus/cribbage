import { Card, StdDeck, Suit, Rank } from './entities'
import {
  CribbageGame,
  GameAction,
  countNobs,
  emptyBreakdown,
  getBestHand,
  playBestCard1,
  rankDiscards,
  rankPlays,
  scoreHand,
} from './game'

const SUITS: Suit[] = ["hearts", "diamonds", "spades", "clubs"]
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as Rank[]

function allCards(): Card[] {
  const cards: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push(new Card(suit, rank))
    }
  }
  return cards
}

function dealDistinct(n: number, rng: () => number = Math.random): Card[] {
  const deck = allCards()
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = deck[i]
    deck[i] = deck[j]
    deck[j] = tmp
  }
  return deck.slice(0, n)
}

function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank
}

function sameCardsInOrder(a: Card[], b: Card[]): boolean {
  return a.length === b.length && a.every((c, i) => sameCard(c, b[i]))
}

function C(suit: Suit, rank: Rank): Card {
  return new Card(suit, rank)
}

// Frozen Expert keeps. These are not derived from getBestHand (a tautology after
// the wrapper conversion); a ranking regression fails the expected keep, not a
// self-comparison.
const T1_FIXTURES: Array<{ hand: Array<[Suit, Rank]>, isPlayerCrib: boolean, keep: Array<[Suit, Rank]> }> = [
  { hand: [["spades", 8], ["spades", 10], ["spades", 2], ["spades", 3], ["hearts", 10], ["spades", 13]], isPlayerCrib: true, keep: [["spades", 2], ["spades", 3], ["spades", 10], ["spades", 13]] },
  { hand: [["spades", 1], ["spades", 5], ["spades", 7], ["diamonds", 7], ["spades", 11], ["clubs", 11]], isPlayerCrib: false, keep: [["spades", 1], ["spades", 5], ["spades", 7], ["spades", 11]] },
  { hand: [["spades", 5], ["hearts", 13], ["clubs", 3], ["diamonds", 5], ["clubs", 13], ["clubs", 10]], isPlayerCrib: true, keep: [["spades", 5], ["diamonds", 5], ["hearts", 13], ["clubs", 13]] },
  { hand: [["clubs", 7], ["spades", 4], ["spades", 10], ["diamonds", 13], ["diamonds", 6], ["clubs", 10]], isPlayerCrib: false, keep: [["spades", 4], ["diamonds", 6], ["spades", 10], ["clubs", 10]] },
  { hand: [["spades", 10], ["clubs", 3], ["diamonds", 11], ["clubs", 12], ["hearts", 7], ["hearts", 4]], isPlayerCrib: true, keep: [["hearts", 7], ["spades", 10], ["diamonds", 11], ["clubs", 12]] },
  { hand: [["hearts", 9], ["clubs", 13], ["clubs", 12], ["hearts", 4], ["clubs", 7], ["spades", 6]], isPlayerCrib: false, keep: [["hearts", 4], ["spades", 6], ["clubs", 7], ["hearts", 9]] },
  { hand: [["spades", 6], ["hearts", 6], ["diamonds", 7], ["spades", 11], ["clubs", 13], ["hearts", 11]], isPlayerCrib: true, keep: [["diamonds", 7], ["spades", 11], ["hearts", 11], ["clubs", 13]] },
  { hand: [["diamonds", 6], ["diamonds", 8], ["spades", 11], ["spades", 2], ["spades", 6], ["diamonds", 12]], isPlayerCrib: false, keep: [["diamonds", 6], ["spades", 6], ["diamonds", 8], ["spades", 11]] },
  { hand: [["spades", 10], ["clubs", 8], ["clubs", 10], ["hearts", 10], ["hearts", 6], ["diamonds", 13]], isPlayerCrib: true, keep: [["spades", 10], ["clubs", 10], ["hearts", 10], ["diamonds", 13]] },
  { hand: [["hearts", 10], ["diamonds", 11], ["diamonds", 7], ["diamonds", 4], ["diamonds", 12], ["hearts", 7]], isPlayerCrib: false, keep: [["diamonds", 4], ["diamonds", 7], ["diamonds", 11], ["diamonds", 12]] },
  { hand: [["hearts", 9], ["clubs", 2], ["diamonds", 11], ["diamonds", 5], ["hearts", 10], ["diamonds", 9]], isPlayerCrib: true, keep: [["hearts", 9], ["diamonds", 9], ["hearts", 10], ["diamonds", 11]] },
  { hand: [["diamonds", 3], ["clubs", 8], ["spades", 13], ["spades", 6], ["diamonds", 11], ["clubs", 11]], isPlayerCrib: false, keep: [["diamonds", 3], ["spades", 6], ["diamonds", 11], ["clubs", 11]] },
  { hand: [["hearts", 4], ["hearts", 1], ["diamonds", 6], ["hearts", 7], ["spades", 4], ["diamonds", 10]], isPlayerCrib: true, keep: [["hearts", 1], ["hearts", 4], ["spades", 4], ["diamonds", 10]] },
  { hand: [["clubs", 2], ["diamonds", 6], ["clubs", 9], ["hearts", 6], ["spades", 7], ["hearts", 1]], isPlayerCrib: false, keep: [["clubs", 2], ["diamonds", 6], ["hearts", 6], ["spades", 7]] },
  { hand: [["hearts", 10], ["spades", 11], ["diamonds", 4], ["clubs", 11], ["spades", 8], ["hearts", 3]], isPlayerCrib: true, keep: [["spades", 8], ["hearts", 10], ["spades", 11], ["clubs", 11]] },
  { hand: [["clubs", 3], ["clubs", 11], ["hearts", 13], ["diamonds", 6], ["diamonds", 12], ["spades", 4]], isPlayerCrib: false, keep: [["spades", 4], ["clubs", 11], ["diamonds", 12], ["hearts", 13]] },
  { hand: [["clubs", 13], ["clubs", 2], ["hearts", 9], ["hearts", 10], ["hearts", 2], ["diamonds", 7]], isPlayerCrib: true, keep: [["clubs", 2], ["hearts", 2], ["diamonds", 7], ["clubs", 13]] },
  { hand: [["diamonds", 3], ["spades", 4], ["clubs", 1], ["diamonds", 5], ["clubs", 5], ["clubs", 4]], isPlayerCrib: false, keep: [["diamonds", 3], ["clubs", 4], ["diamonds", 5], ["clubs", 5]] },
  { hand: [["clubs", 12], ["clubs", 11], ["hearts", 1], ["diamonds", 13], ["diamonds", 3], ["diamonds", 9]], isPlayerCrib: true, keep: [["diamonds", 9], ["clubs", 11], ["clubs", 12], ["diamonds", 13]] },
  { hand: [["diamonds", 13], ["clubs", 10], ["clubs", 13], ["hearts", 8], ["diamonds", 4], ["hearts", 13]], isPlayerCrib: false, keep: [["diamonds", 4], ["diamonds", 13], ["clubs", 13], ["hearts", 13]] },
  { hand: [["spades", 2], ["spades", 3], ["diamonds", 10], ["diamonds", 3], ["clubs", 13], ["clubs", 10]], isPlayerCrib: true, keep: [["spades", 2], ["spades", 3], ["diamonds", 3], ["clubs", 13]] },
  { hand: [["hearts", 6], ["clubs", 11], ["clubs", 4], ["clubs", 5], ["hearts", 1], ["clubs", 8]], isPlayerCrib: false, keep: [["clubs", 4], ["clubs", 5], ["hearts", 6], ["clubs", 11]] },
  { hand: [["hearts", 2], ["diamonds", 11], ["diamonds", 4], ["clubs", 6], ["clubs", 1], ["hearts", 12]], isPlayerCrib: true, keep: [["clubs", 1], ["diamonds", 4], ["diamonds", 11], ["hearts", 12]] },
  { hand: [["hearts", 13], ["diamonds", 10], ["diamonds", 3], ["clubs", 7], ["clubs", 13], ["diamonds", 8]], isPlayerCrib: false, keep: [["clubs", 7], ["diamonds", 8], ["hearts", 13], ["clubs", 13]] },
  { hand: [["diamonds", 5], ["hearts", 3], ["diamonds", 11], ["spades", 5], ["hearts", 4], ["clubs", 4]], isPlayerCrib: true, keep: [["hearts", 3], ["hearts", 4], ["clubs", 4], ["spades", 5]] },
  { hand: [["clubs", 7], ["clubs", 9], ["clubs", 5], ["hearts", 11], ["hearts", 1], ["spades", 12]], isPlayerCrib: false, keep: [["hearts", 1], ["clubs", 5], ["clubs", 9], ["hearts", 11]] },
  { hand: [["diamonds", 9], ["diamonds", 11], ["diamonds", 6], ["spades", 10], ["hearts", 4], ["clubs", 1]], isPlayerCrib: true, keep: [["diamonds", 6], ["diamonds", 9], ["spades", 10], ["diamonds", 11]] },
  { hand: [["clubs", 12], ["hearts", 12], ["spades", 7], ["diamonds", 7], ["diamonds", 8], ["hearts", 10]], isPlayerCrib: false, keep: [["spades", 7], ["diamonds", 7], ["diamonds", 8], ["hearts", 12]] },
  { hand: [["spades", 7], ["spades", 11], ["hearts", 11], ["spades", 9], ["diamonds", 2], ["hearts", 4]], isPlayerCrib: true, keep: [["diamonds", 2], ["hearts", 4], ["spades", 7], ["spades", 9]] },
  { hand: [["spades", 12], ["diamonds", 3], ["diamonds", 13], ["clubs", 2], ["clubs", 7], ["diamonds", 11]], isPlayerCrib: false, keep: [["clubs", 2], ["diamonds", 3], ["diamonds", 11], ["spades", 12]] },
  { hand: [["spades", 8], ["clubs", 2], ["clubs", 3], ["clubs", 6], ["spades", 13], ["hearts", 5]], isPlayerCrib: true, keep: [["clubs", 2], ["clubs", 3], ["hearts", 5], ["spades", 13]] },
  { hand: [["spades", 2], ["spades", 5], ["clubs", 10], ["spades", 12], ["hearts", 11], ["clubs", 11]], isPlayerCrib: false, keep: [["spades", 5], ["clubs", 10], ["hearts", 11], ["spades", 12]] },
]

describe("T1 rankDiscards", () => {
  it("keeps the frozen Expert discard on a few dozen hands and is 15 descending", () => {
    for (const fixture of T1_FIXTURES) {
      const hand = fixture.hand.map(([suit, rank]) => C(suit, rank))
      const expected = fixture.keep.map(([suit, rank]) => C(suit, rank))
      const ranked = rankDiscards(hand, [], fixture.isPlayerCrib)
      expect(ranked).toHaveLength(15)
      expect(sameCardsInOrder(ranked[0].keep, expected)).toBe(true)
      for (let j = 1; j < ranked.length; j++) {
        expect(ranked[j - 1].score).toBeGreaterThanOrEqual(ranked[j].score)
      }
    }
  })
})

describe("T2 rankPlays", () => {
  it("matches playBestCard1, never exceeds 31, and is empty when every card is illegal", () => {
    for (let i = 0; i < 80; i++) {
      const dealt = dealDistinct(8)
      const gameHand = dealt.slice(0, 1 + (i % 4))
      const playerHand = dealt.slice(gameHand.length, gameHand.length + 1 + (i % 4))
      const ranked = rankPlays(gameHand, playerHand)
      const best = playBestCard1(gameHand, playerHand)
      const peg = gameHand.reduce((s, c) => s + c.value, 0)
      for (const opt of ranked) {
        expect(peg + opt.card.value).toBeLessThanOrEqual(31)
      }
      if (best === null) {
        expect(ranked).toHaveLength(0)
      } else {
        expect(sameCard(ranked[0].card, best)).toBe(true)
      }
    }

    const thirty = [C("hearts", 10), C("spades", 10), C("clubs", 10)]
    const illegal = [C("diamonds", 13), C("hearts", 12), C("clubs", 11)]
    expect(rankPlays(thirty, illegal)).toEqual([])
    expect(playBestCard1(thirty, illegal)).toBeNull()
  })
})

function synthesizeNeed(game: CribbageGame, action: GameAction): GameAction[] {
  switch (action.action) {
    case "need-cut": {
      const card = game.deck.dealOne()
      if (!card) return []
      const act = new GameAction("cut", action.subaction)
      act.cards = [card]
      return [act]
    }
    case "need-discard": {
      const hand = game.getHand(action.subaction).hand
      const keep = getBestHand(hand, [], game.dealer === action.subaction)
      const discard = hand.filter(c => !keep.includes(c))
      const act = new GameAction("discard", action.subaction)
      act.cards = discard
      return [act]
    }
    case "need-starter-card": {
      const card = game.deck.dealOne()
      if (!card) return []
      const act = new GameAction("starter-card", action.subaction)
      act.cards = [card]
      return [act]
    }
    case "need-play-card": {
      const card = playBestCard1(game.playingHand.hand, game.getHand(action.subaction).hand)
      if (!card) return []
      const act = new GameAction("play-card", action.subaction)
      act.cards = [card]
      return [act]
    }
    default:
      return []
  }
}

function pumpUntil(
  game: CribbageGame,
  incoming: GameAction[],
  pred: (g: CribbageGame) => boolean,
): GameAction[] {
  const queue = [...incoming]
  let guard = 0
  while (queue.length > 0 && guard++ < 30000 && !pred(game)) {
    const action = queue.shift() as GameAction
    if (action.action.startsWith("need-")) {
      queue.push(...synthesizeNeed(game, action))
      continue
    }
    queue.push(...game.doAction(action))
  }
  return queue
}

function pumpUntilIdle(game: CribbageGame, incoming: GameAction[]): void {
  pumpUntil(game, incoming, () => false)
}

function dealCount(game: CribbageGame): number {
  return game.allActions.filter(a => a.action === "shuffle-deck").length
}

function assertBreakdownInvariant(game: CribbageGame): void {
  for (const who of ["player", "opponent"] as const) {
    const b = game.breakdown[who]
    expect(b.hand + b.crib + b.pegging + b.bonuses).toBe(game.scores[who])
    expect(b.total).toBe(game.scores[who])
  }
}

describe("T5 nobs attribution and non-crib scoreHand", () => {
  it("countNobs is 1 for the jack of the starter suit", () => {
    const hand = [C("spades", 11), C("hearts", 2), C("diamonds", 3), C("clubs", 8)]
    expect(countNobs(hand, C("spades", 5))).toBe(1)
    expect(countNobs(hand, C("hearts", 5))).toBe(0)
    expect(countNobs(hand, undefined)).toBe(0)
  })

  it("puts nobs in bonuses and excludes them from hand on show-non-dealer", () => {
    const game = new CribbageGame(new StdDeck("rc"))
    game.stage = "showing"
    game.dealer = "opponent"
    game.starter = C("spades", 5)
    const ndHand = [C("spades", 11), C("hearts", 2), C("diamonds", 3), C("clubs", 8)]
    game.savedPlayerHand.hand = ndHand
    game.savedOpponentHand.hand = [C("hearts", 4), C("diamonds", 7), C("clubs", 9), C("hearts", 10)]
    const show = new GameAction("show-non-dealer", "player")
    const next = game.doAction(show)
    const scoreAct = next.find(a => a.action === "score")
    expect(scoreAct).toBeDefined()
    game.doAction(scoreAct as GameAction)
    const total = scoreHand(ndHand, game.starter, false)
    expect(game.breakdown.player.bonuses).toBe(1)
    expect(game.breakdown.player.hand).toBe(total - 1)
    expect(game.breakdown.player.hand + game.breakdown.player.bonuses).toBe(total)
  })

  it("does not regress non-crib scoreHand fixtures", () => {
    // 29-hand: four 5s + nobs
    expect(scoreHand(
      [C("hearts", 5), C("clubs", 5), C("diamonds", 5), C("spades", 11)],
      C("spades", 5),
      false
    )).toBe(29)
    // pair + two 15s + run of 3
    expect(scoreHand(
      [C("hearts", 7), C("clubs", 8), C("diamonds", 2), C("spades", 3)],
      C("clubs", 4),
      false
    )).toBe(7)
    // 15-2 + four-card flush, off-suit starter
    expect(scoreHand(
      [C("hearts", 1), C("hearts", 4), C("hearts", 7), C("hearts", 13)],
      C("clubs", 2),
      false
    )).toBe(6)
  })
})

describe("T5b crib flush correction", () => {
  const fourHearts = [C("hearts", 1), C("hearts", 4), C("hearts", 10), C("hearts", 13)]
  const sevenH = C("hearts", 7)
  const sevenD = C("diamonds", 7)

  it("scores 0 for a four-card crib flush and 5 when the starter matches", () => {
    const offSuit = scoreHand(fourHearts, sevenD, true)
    const onSuit = scoreHand(fourHearts, sevenH, true)
    expect(onSuit - offSuit).toBe(5)
    expect(scoreHand(fourHearts, sevenD, false)).toBe(offSuit + 4)
    expect(scoreHand(fourHearts, sevenH, false)).toBe(onSuit)
  })
})

describe("T4 breakdown invariant", () => {
  it("balances the ledger after a completed game", () => {
    const game = new CribbageGame(new StdDeck("rc"))
    pumpUntilIdle(game, [new GameAction("start-round")])
    expect(game.gameOver).toBe(true)
    expect(game.winner === "player" || game.winner === "opponent").toBe(true)
    assertBreakdownInvariant(game)
    const snap = game.getBreakdownSnapshot("expert")
    expect(snap.player.total).toBe(game.scores.player)
    expect(snap.opponent.total).toBe(game.scores.opponent)
    expect(snap.winner).toBe(game.winner)
    expect(snap.difficulty).toBe("expert")
    expect(game.rounds).toBe(dealCount(game))
    expect(game.rounds).toBeGreaterThan(0)
  })

  it("balances the ledger after a mid-game quit and counts the unfinished deal", () => {
    let mid: CribbageGame | undefined
    for (let attempt = 0; attempt < 8 && !mid; attempt++) {
      const game = new CribbageGame(new StdDeck("rc"))
      const leftover = pumpUntil(game, [new GameAction("start-round")], g => g.rounds >= 1 || g.gameOver)
      if (game.gameOver) continue
      pumpUntil(game, leftover, g => dealCount(g) >= 2 || g.gameOver)
      if (game.gameOver) continue
      expect(game.scores.player + game.scores.opponent).toBeGreaterThan(0)
      pumpUntilIdle(game, game.doAction(new GameAction("quit")))
      mid = game
    }
    expect(mid).toBeDefined()
    const quitGame = mid as CribbageGame
    expect(quitGame.winner).toBe("opponent")
    expect(quitGame.gameOver).toBe(true)
    expect(quitGame.stage).toBe("ending")
    assertBreakdownInvariant(quitGame)
    const snap = quitGame.getBreakdownSnapshot("easy")
    expect(snap.winner).toBe("opponent")
    expect(quitGame.rounds).toBe(dealCount(quitGame))
    expect(quitGame.rounds).toBeGreaterThanOrEqual(2)
  })
})

function scoreActionFor(
  who: "player" | "opponent",
  score: number,
  source: GameAction["source"],
  reason: string,
  bonus = 0,
): GameAction {
  const act = new GameAction("score", who)
  act.score = score
  act.bonus = bonus
  act.source = source
  act.reason = reason
  return act
}

describe("ledger attribution and snapshot", () => {
  it("emptyBreakdown is all zeros for both seats", () => {
    const empty = emptyBreakdown()
    for (const who of ["player", "opponent"] as const) {
      expect(empty[who]).toEqual({ hand: 0, crib: 0, pegging: 0, bonuses: 0, total: 0 })
    }
  })

  it("getBreakdownSnapshot copies seats so later mutation cannot leak into the game", () => {
    const game = new CribbageGame(new StdDeck("rc"))
    game.breakdown.player.hand = 6
    game.breakdown.player.total = 6
    game.winner = "player"
    game.rounds = 4
    const snap = game.getBreakdownSnapshot("intermediate")
    expect(snap.difficulty).toBe("intermediate")
    expect(snap.rounds).toBe(4)
    expect(snap.winner).toBe("player")
    snap.player.hand = 99
    snap.opponent.crib = 99
    expect(game.breakdown.player.hand).toBe(6)
    expect(game.breakdown.opponent.crib).toBe(0)
  })

  it("does not keep the dead playing/starting score keys", () => {
    const game = new CribbageGame(new StdDeck("rc"))
    expect(game.scores).not.toHaveProperty("playing")
    expect(game.scores).not.toHaveProperty("starting")
  })

  it("splits nobs out of hand and crib and puts his-nibs in bonuses", () => {
    const game = new CribbageGame(new StdDeck("rc"))
    game.doAction(scoreActionFor("player", 8, "show-hand", "show-dealer", 1))
    expect(game.breakdown.player.hand).toBe(7)
    expect(game.breakdown.player.bonuses).toBe(1)
    game.doAction(scoreActionFor("player", 9, "show-crib", "show-crib", 1))
    expect(game.breakdown.player.crib).toBe(8)
    expect(game.breakdown.player.bonuses).toBe(2)
    game.doAction(scoreActionFor("player", 2, "start", "his-nibs", 0))
    expect(game.breakdown.player.bonuses).toBe(4)
    expect(game.breakdown.player.hand).toBe(7)
    expect(game.breakdown.player.total).toBe(game.scores.player)
    assertBreakdownInvariant(game)
  })

  it("attributes pegging reasons to pegging and skips an unknown category", () => {
    const game = new CribbageGame(new StdDeck("rc"))
    for (const reason of ["15", "31", "run", "pair", "the-last-card"] as const) {
      game.doAction(scoreActionFor("opponent", 2, "play", reason))
    }
    expect(game.breakdown.opponent.pegging).toBe(10)
    expect(game.breakdown.opponent.total).toBe(10)
    game.doAction(scoreActionFor("opponent", 5, "game", "mystery"))
    expect(game.scores.opponent).toBe(15)
    expect(game.breakdown.opponent.total).toBe(10)
  })

  it("keeps the raw score when a player goes past 121", () => {
    const game = new CribbageGame(new StdDeck("rc"))
    game.scores.player = 118
    game.doAction(scoreActionFor("player", 12, "show-hand", "show-non-dealer"))
    expect(game.scores.player).toBe(130)
    expect(game.gameOver).toBe(true)
    expect(game.winner).toBe("player")
    expect(game.stage).toBe("ending")
  })
})

describe("Q1-B rounds and ending path", () => {
  it("counts a later winning deal that never hits round-end", () => {
    const game = new CribbageGame(new StdDeck("rc"))
    game.stage = "showing"
    game.dealer = "player"
    const afterRound = game.doAction(new GameAction("round-end"))
    expect(game.rounds).toBe(1)
    expect(game.stage).toBe("starting")
    expect(afterRound[0].action).toBe("start-round")
    game.doAction(new GameAction("start-round"))
    game.scores.player = 119
    game.doAction(scoreActionFor("player", 5, "play", "15"))
    expect(game.scores.player).toBe(124)
    expect(game.gameOver).toBe(true)
    expect(game.stage).toBe("ending")
    expect(game.rounds).toBe(2)
  })

  it("registers game-win in ending and ignores a second quit", () => {
    const game = new CribbageGame(new StdDeck("rc"))
    game.stage = "ending"
    game.winner = "player"
    const win = new GameAction("game-win", "player")
    expect(game.doAction(win)).toEqual([])
    expect(win.registered).toBe(true)
    game.gameOver = true
    expect(game.doAction(new GameAction("quit"))).toEqual([])
    expect(game.winner).toBe("player")
  })

  it("quits from starting and showing into ending as an opponent concession", () => {
    for (const stage of ["starting", "showing"] as const) {
      const game = new CribbageGame(new StdDeck("rc"))
      game.stage = stage
      const next = game.doAction(new GameAction("quit"))
      expect(game.winner).toBe("opponent")
      expect(game.gameOver).toBe(true)
      expect(game.stage).toBe("ending")
      expect(next[0].action).toBe("game-win")
      expect(next.some(a => a.action === "new-game")).toBe(false)
    }
  })

  it("new-game from ending still leaves through prepare-board", () => {
    const game = new CribbageGame(new StdDeck("rc"))
    game.stage = "ending"
    game.gameOver = true
    const next = game.doAction(new GameAction("new-game"))
    expect(game.stage).toBe("starting")
    expect(next[0].action).toBe("prepare-board")
  })

  it("resetGame clears ledger and rounds only when the game is over", () => {
    const game = new CribbageGame(new StdDeck("rc"))
    game.breakdown.player.hand = 10
    game.breakdown.player.total = 10
    game.rounds = 3
    game.gameOver = false
    game.resetGame()
    expect(game.rounds).toBe(3)
    expect(game.breakdown.player.hand).toBe(10)
    game.gameOver = true
    game.resetGame()
    expect(game.rounds).toBe(0)
    expect(game.breakdown.player).toEqual({ hand: 0, crib: 0, pegging: 0, bonuses: 0, total: 0 })
    expect(game.scores.player).toBe(0)
  })
})

describe("countNobs and his heels through the engine", () => {
  it("scores nobs only for the jack of the starter suit", () => {
    const hand = [C("hearts", 11), C("spades", 11), C("diamonds", 2), C("clubs", 8)]
    expect(countNobs(hand, C("hearts", 5))).toBe(1)
    expect(countNobs(hand, C("clubs", 5))).toBe(0)
    expect(countNobs([], C("hearts", 5))).toBe(0)
  })

  it("awards his heels to the dealer bonuses when the starter is a jack", () => {
    const game = new CribbageGame(new StdDeck("rc"))
    game.stage = "playing"
    game.dealer = "opponent"
    const cut = new GameAction("starter-card", "opponent")
    cut.cards = [C("diamonds", 11)]
    const next = game.doAction(cut)
    const heels = next.find(a => a.action === "his-nibs")
    expect(heels).toBeDefined()
    const scored = game.doAction(heels as GameAction)
    const scoreAct = scored.find(a => a.action === "score")
    expect(scoreAct).toBeDefined()
    game.doAction(scoreAct as GameAction)
    expect(game.breakdown.opponent.bonuses).toBe(2)
    expect(game.breakdown.opponent.hand).toBe(0)
    expect(game.scores.opponent).toBe(2)
  })

  it("puts crib nobs in bonuses rather than crib on show-crib", () => {
    const game = new CribbageGame(new StdDeck("rc"))
    game.stage = "showing"
    game.dealer = "player"
    game.starter = C("spades", 5)
    const crib = [C("spades", 11), C("hearts", 2), C("diamonds", 3), C("clubs", 8)]
    game.crib.hand = crib
    const next = game.doAction(new GameAction("show-crib"))
    const scoreAct = next.find(a => a.action === "score")
    expect(scoreAct).toBeDefined()
    expect((scoreAct as GameAction).bonus).toBe(1)
    game.doAction(scoreAct as GameAction)
    const total = scoreHand(crib, game.starter, true)
    expect(game.breakdown.player.bonuses).toBe(1)
    expect(game.breakdown.player.crib).toBe(total - 1)
  })
})

describe("ranking wrappers stay Expert", () => {
  it("getBestHand is the first ranked keep on both crib flags", () => {
    for (const isPlayerCrib of [true, false]) {
      const hand = dealDistinct(6)
      const ranked = rankDiscards(hand, [], isPlayerCrib)
      expect(ranked).toHaveLength(15)
      expect(sameCardsInOrder(getBestHand(hand, [], isPlayerCrib), ranked[0].keep)).toBe(true)
    }
  })

  it("playBestCard1 is the first ranked legal card", () => {
    const gameHand = [C("hearts", 5)]
    const playerHand = [C("clubs", 10), C("spades", 3)]
    const ranked = rankPlays(gameHand, playerHand)
    expect(ranked.length).toBeGreaterThan(0)
    expect(sameCard(playBestCard1(gameHand, playerHand) as Card, ranked[0].card)).toBe(true)
  })
})
