import {Card, Suit, Rank, rank_map, suit_map, Hand, Deck} from './entities'

function getSubsets( n : number ) : Array<Array<number> > {
  if( n === 0 ) {
    return []
  }
  let rV : Array<Array<number> > = [];
  let sN = getSubsets( n - 1 )
  sN.forEach( (s) => {rV.push( s ); rV.push( [...s, n-1])} )
  rV.push( [n-1] )
  return rV
}

function scoreSubset( hand : Array<Card>, subset : Array<number> ) : number {

  if( subset.length === 2 ) {
    if( hand[subset[0]] === undefined || hand[subset[1]] === undefined ) {
      console.log("Error - unexpected undefinition")
      console.log( hand )
      console.log( subset )
    }
    if( hand[subset[0]].rank === hand[subset[1]].rank ) {
      return 2
    }
  }
  let tot = 0
  subset.forEach( (n) => tot += hand[n].value )
  if( tot === 15 ) {
    return 2
  }
  return 0
}

function scoreHand( hand : Array<Card>, cutCard : Card | undefined, isCrib : boolean  ) : number {
    let eH : Array<Card> = []
    if( cutCard ) {
      eH = [...hand, cutCard]
    } else {
      eH = hand
    }
//    console.log("HAND=", eH)
    const checkFlushSuit = hand[0].suit
    let isFlush = true
    hand.forEach( (c) => {if( c.suit !== checkFlushSuit ) {isFlush = false}} )
    let nobScore = 0
    if( cutCard ) {
      hand.forEach( c => {if( c.rank === 11 && c.suit === (cutCard as Card).suit ) { nobScore = 1 }} )
    }
    eH = eH.sort( (c1, c2) => c1.rank - c2.rank )
    //console.log( eH )
    let flushScore = 0
    if( isFlush && !isCrib ) {
      flushScore = 4
      if( cutCard && cutCard.suit === checkFlushSuit ) {
        flushScore += 1
      }
    }
    let runScore = 0
    let j = 0 /// this will point to the end of the run
    for( let i = 0; i < eH.length - 2; i = j + 1 ) {
      let maxSame = 1
      let runSame = 1
      for( j = i + 1; j < eH.length && (eH[j].rank - eH[j-1].rank <=1); j++ ) {
        if( eH[j].rank === eH[j-1].rank ) {
          /// so to handle multiples of the same rank we note that identifying
          /// the maximum number of identicall ranked cards will allow us to
          /// determine the score based on sequence length
          runSame++
          if( runSame > maxSame ) {
            maxSame = runSame
          }
        } else {
          runSame = 1
        }
      }
      j = j-1 // point back to top end of any run
      const seqLen = eH[j].rank - eH[i].rank + 1
      const nCards = j - i + 1
      if( seqLen >= 3 ) { /// yes there is a run here!
        if( nCards === seqLen ) {
          runScore += seqLen
        }
        if( nCards === seqLen + 1 ) {
          runScore += 2 * seqLen
        }
        /// case 5 long sequence run of 3
        /// either 2 x 2 identical or 1 x 3 identical
        if( nCards === seqLen + 2 ) {
          if( maxSame === 2 ) {
            runScore += 12
          } else {
            runScore += 9
          }
        }
      }
    }
    let compoundScore = 0
    if( eH.length === 5 ) {
      nonUnarySubsetsOf5.forEach( s => compoundScore += scoreSubset( eH, s ) )
    } else {
      nonUnarySubsetsOf4.forEach( s => compoundScore += scoreSubset( eH, s ) )
    }
    //console.log( flushScore, runScore, compoundScore, nobScore )
    return flushScore + runScore + compoundScore + nobScore
}

export function calcExpectedHandScore( hand : Array<Card>, cardsOut : Record<Rank, number>,
  suitesOut : Record<Suit, number> ) : number {
  let scoreDelta = 0
  let totCards = 0
  const baseHandScore = scoreHand( hand, undefined, false )
  for( let r = 1; r <= 13; r++ ) {
    const rank = r as Rank
    if( cardsOut[rank] === 4 ) {
      continue
    }
    const c = new Card( "joker", rank )
    scoreDelta += (scoreHand( hand, c, false ) - baseHandScore) * (4 - cardsOut[rank])
    totCards += 4 - cardsOut[rank]
  }
  hand.forEach( x => {if(x.rank === 11) {scoreDelta += 13 - suitesOut[x.suit]}})
  return baseHandScore + scoreDelta/totCards
}

function getBestHand( hand : Array<Card>, otherCardsSeen : Array<Card>, isPlayerCrib : boolean ) : Array<Card> {
  let cardsSeen : Record<number, number> = {}
  for( let r in rank_map ) {
    cardsSeen[parseInt(r, 10)] = 0
  }
  let suitsSeen : Record<string, number> = {}
  for( let s in suit_map ) {
    suitsSeen[s] = 0
  }
  [...hand, ...otherCardsSeen].forEach( x => {cardsSeen[x.rank]++; suitsSeen[x.suit]++})
  let maxScore = -100
  let bestHand : Array<Card> | undefined = undefined
  for( let sel of selections ) {
    const s = sel[0]
    const crb = sel[1]
    const eH : Array<Card> = []
    const cH : Array<Card> = []
    s.forEach( (n) => eH.push( hand[n]))
    crb.forEach( (n) => cH.push( hand[n] ) )
    const eScore = calcExpectedHandScore( eH, cardsSeen, suitsSeen )
    const cScore = calcExpectedCribScore( cH, cardsSeen, suitsSeen, isPlayerCrib )
    const tScore = isPlayerCrib ? eScore + cScore : eScore - cScore
    if( tScore > maxScore ) {
      maxScore = tScore
      bestHand = eH
    }
    console.log("Expected Score for ", eH.join(), " is ", tScore, eScore, cScore )
  }
  return bestHand as Array<Card>
}

const p1Costs : Record<number, number> = {
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0.8,
  6: 0.2,
  7: 0.2,
  8: 0.2,
  9: 0.2,
  10: 0.3,
  11: 0.2,
  12: 0.2,
  13: 0.2,
  14: 0.2,
  15: 0,
  16: 0,
  17: 0,
  18: 0,
  19: 0,
  20: 0,
  21: 0.8,
  22: -0.1,
  23: -0.15,
  24: -0.18,
  25: -0.2,
  26: 0.1,
  27: -0.6,
  28: -0.7,
  29: -0.8,
  30: -0.8,
  31: 0
}

export function playBestCard1( gameHand: Array<Card>, playerHand: Array<Card>  ) : Card | null {
  let score = 0
  gameHand.forEach( (x) => {score += x.value})
  let bestPlay: Card | null = null
  let bestScore: number = -10

  for( let card of playerHand ) {
    const nS = score + card.value
    if( nS > 31 ) {
      continue
    }
    let dS = 0
    const h = new Hand( [...gameHand, card ])
    dS += h.calcTailRunScore()
    dS += h.calcTailPairScore()
    if( nS === 15 || nS === 31 ) {
      dS += 2
    }
    dS -= p1Costs[nS]
    if( dS > bestScore ) {
      bestScore = dS
      bestPlay = card

        console.log( "BEST SCORE:", bestScore, bestPlay)
    }
  }
  return bestPlay
}

//// function tries to guess likelihood of opponent throwing away
//// certain combinations
function generateCribPairs( isPlayerCrib : boolean ) : Array< [Array<Card>, number] > {
  let tot = 0
  let rV : Array<[Array<Card>, number]> = []
  for( let r = 1; r <=13; r++ ) {
    const rC : Card = new Card( "joker", r as Rank )
    for( let s = r; s <= 13; s++ ) {
      const sC = new Card( "joker", s as Rank )
      const pair = [rC, sC]
      let score = 1
      if( isPlayerCrib ) {
        if( r === s || r + s === 15 ) {
          score *= 0.2
        } else if( s === r+1 ) {
          score *= 0.5
        } else if( s === 5 || r === 5 || s+r === 5 ) {
          score *= 0.3
        } else if( s === 11 || r === 11 ) {
          score *= 0.5
        }
      } else {
        if( r === s || r + s === 15 ) {
          score *= 2
        } else if( s === r + 1 ) {
          score *= 2
        }
      }
      tot += score
      rV.push([pair, score])
    }
  }
  for( let k of rV ) {
    k[1] /= tot
  }
  return rV
}

function calcExpectedCribScore( hand : Array<Card>, cardsSeen : Record< Rank, number >,
  suitsSeen : Record< Suit, number >, isPlayerCrib : boolean ) : number {
  let exp = 0
  const cribPairs = generateCribPairs( isPlayerCrib )
  let cS = 0 /// total cards seen
  for( let r = 1; r <= 13; r++ ) {
    cS += cardsSeen[r as Rank]
    const rC = new Card( "joker", r as Rank )
    const pR = (4-cardsSeen[r as Rank])/52
    for( let p of cribPairs ) {
      const eH = [...hand, ...p[0]]
      const score = scoreHand( eH, rC, true )
      exp += score * pR * p[1]
      //console.log( "PP", p[1] )
    }
  }
  //console.log("XXXXXX")
  //// now calc expect contribution of nob and flush
  if( hand[0].suit === hand[1].suit ) {
    const s = hand[0].suit
    const cardsNotSeen = 52-cS
    const suitScore = 5 * (13 - suitsSeen[s]) * (12 - suitsSeen[s]) * (11 - suitsSeen[s]) / cardsNotSeen / (cardsNotSeen - 1) / (cardsNotSeen - 2)
    exp += suitScore
    ////console.log("Suit Score=",suitScore,cardsNotSeen,suitsSeen[s])
  }
  //// now Calculate nob score
  hand.forEach( x => {if( x.rank === 11) { exp += (13-suitsSeen[x.suit])/52 }})
  return exp
}

function makeSelections( ) : Array<[Array<number>, Array<number>] > {
  let rV : Array<[Array<number>, Array<number>]> = []
  for( let i = 0; i < 6; i++ ) {
    for( let j = i+1; j < 6; j++ ) {
      const crb : Array<number> = [i,j]
      let hnd : Array<number> = []
      for( let z = 0; z < 6; z++ ) {
        if( z !== i && z !== j ) {
          hnd.push( z )
        }
      }
      rV.push( [hnd, crb] )

    }
  }
  return rV
}


type GameStage = "game-preparation" | "starting" | "cutting" | "dealing" | "selection" | "playing" | "showing" | "ending"

type  GameEvent = "start-round" | "prepare-board" | "need-cut" | "cut" | "cut-tie" | "cut-win" | "shuffle-deck" | "deal-card" |
"need-starter-card" | "starter-card" | "his-nibs" | "info" | "play-go" | "dealing-done" |
"need-discard" | "discard" | "need-play-card" | "play-card" | "last-card" | "score" |
"start-show" | "show-dealer" | "show-non-dealer" | "show-crib" | "round-end" | "game-win" | "error" |
"new-game" | "end-game" | "abort-game" | "game-timeout" | "noop" | "quit"

type PlayerEvent = "player" | "opponent" | undefined
type ActionSource = "game" | "user" | "play" | "show-hand" | "show-crib" | "start"

class GameAction {
  public action : GameEvent
  public registered : boolean = false
  public subaction? : PlayerEvent = undefined
  public cards : Array<Card> = []
  public score : number = 0
  public scoreFor? : GameAction = undefined
  public reason : string = ""
  public responded : boolean = false
  public source : ActionSource = "game"
  public details : string = ""
  public schedule : number
  public deck? : Deck
  //public delay : number = 0
  public __id : number = Math.random()

  constructor( ev : GameEvent, sub? : PlayerEvent ) {
    this.action = ev
    this.subaction = sub
    this.schedule = new Date().getTime()
    this.__id = Math.random()
  }
  delayFor( delay : number ) : GameAction {
    this.schedule += delay
    return this
  }
  toString() : string {
    let rV = this.action
    if( this.subaction ) {
      rV += `:${this.subaction}`
    }
    if( this.cards ) {
      rV += " "+this.cards.map( x => rank_map[x.rank] + suit_map[x.suit] ).join(",")
    }
    if( this.score > 0 ) {
      rV += " " + this.score
    }
    if( this.reason ) {
      rV += " " + this.reason
    }
    return rV
  }
}


class CribbageGame {
  public deck : Deck
  public discardHand : Hand = new Hand( [] )
  public playerHand : Hand = new Hand( [] )
  public opponentHand : Hand = new Hand( [] )
  public playingHand : Hand = new Hand( [] )
  public crib : Hand = new Hand( [] )
  public starter? : Card = undefined
  public dealer : PlayerEvent = undefined
  public stage : GameStage = "starting"
  public stageActions : Array<GameAction> = []
  public stageEvents : Set<PlayerEvent> = new Set<PlayerEvent>([])
  public allActions : Array<GameAction> = []
  public turn : PlayerEvent = undefined
  public winner : PlayerEvent = undefined
  public gameOver = false

  public savedPlayerHand : Hand = new Hand( [] )
  public savedOpponentHand : Hand = new Hand( [] )

  public scores = {
    "player" : 0,
    "opponent" : 0,
    "player-hand" : 0,
    "opponent-hand" : 0,
    "crib" : 0,
    "playing" : 0,
    "starting" : 0
  }

  getOtherPlayer( player : PlayerEvent ) : PlayerEvent {
    if( !player ) {
      return undefined
    }
    if( player === "player" ) {
      return "opponent"
    } else {
      return "player"
    }
  }

  constructor( deck : Deck ) {
    this.deck = deck
  }

  getSelectedPlayerCards( ) : Array<Card> {
    return this.playerHand.getSelected( true )
  }

  getSelectedOpponentCards( ) : Array<Card> {
    return this.opponentHand.getSelected( true )
  }

  getPlayerHandScore( ) : number {
    const starter = this.starter as Card
    return scoreHand( this.playerHand.hand, starter, false )
  }

  dealOpponentCut() : CribbageGame {
    const sCard = this.deck.dealRandomCard() as Card
    this.opponentHand.add( [sCard] )
    this.opponentHand.setFaceUp( true )
    return this
  }

  scoreAction( score: number, player : PlayerEvent, action: GameAction, reason : string, stage : ActionSource  ) : GameAction {
    if( this.gameOver ) {
      return new GameAction( "noop" )
    }
    const rV = new GameAction( "score", player )
    rV.score = score
    rV.scoreFor = action
    rV.reason = reason
    rV.source = stage
    return rV
  }

  nextStage( stage : GameStage ) : Array<GameAction> {
    this.stage = stage
    this.stageEvents.clear()
    this.stageActions = []
    switch( stage ) {
      case "game-preparation":
        return [ new GameAction( "new-game" ) ]
      case "starting":
        if( !this.gameOver ) {
          return [ new GameAction( "start-round" ) ]
        } else {
          return [ new GameAction( "prepare-board" ) ]
        }
      case "dealing":
        return [ new GameAction( "shuffle-deck", this.dealer ) ]
      case "selection":
        return [ new GameAction( "need-discard", "player" ), new GameAction( "need-discard", "opponent" )]
      case "cutting":
        return [ new GameAction( "need-cut", "player" ), new GameAction( "need-cut", "opponent" ) ]
      case "playing":
        return [ new GameAction( "need-starter-card", this.dealer ) ]
      case "showing":
        return [ new GameAction( "start-show", this.getOtherPlayer( this.dealer ) )]
      case "ending":
        return [ new GameAction( "game-win", this.winner )]
    }
    return [this.gameError( "cannot find stage " + stage )]
  }

  registerAction( action : GameAction ) : void {
    this.allActions.push( action )
    this.stageActions.push( action )
    if( action.subaction ) {
      this.stageEvents.add( action.subaction )
    }
    action.registered = true
    console.log( "ACTIONS COUNT: ", this.allActions.length )
  }

  getHand( who : PlayerEvent ) : Hand {
    if( who === "opponent" ) {
      return this.opponentHand
    } else {
      return this.playerHand
    }
  }

  getSavedHand( who : PlayerEvent ) : Hand {
    return who === "player" ? this.savedPlayerHand : this.savedOpponentHand
  }

  gameError( error : string, details? : string ) : GameAction {
    const rV =  new GameAction( "error" )
    rV.reason = error
    if( details ) {
      rV.details = details
    }
    return rV
  }

  validateCards( action : GameAction, actionCards : Array<Card>, count : number, source : Hand ) : Array<GameAction> {
    let rV = []
    if( actionCards.length !== count ) {
      rV.push( this.gameError( "bad-card-count", "An illegal number of cards has been requested to be applied") )
    }
    if( !source.includesAll( actionCards ) ) {
      rV.push( this.gameError( "bad-card-source", `Cards being applied for the action ${action.action} could not be played` ))
    }
    return rV
  }

  //// this is the main game loop step - it takes GameAction's and updates
  //// the game state accordingly and emits new GameAction's that should be
  //// handled by the interface or requesting inputs from it.
  doAction( action : GameAction ) : Array<GameAction> {
    console.log( "RECEIVED ACTION:", this.stage, action.action, this.stage, action )
    if( action.registered ) {
      console.log("ALREADY REGISTERED - IGNORING REPEAT SUBMISSION")
      return []
    }
    let pegSum = this.playingHand.sum()
    let rV : Array<GameAction> = []
    switch( this.stage ) {
      case "starting":
        switch( action.action ) {
          case "new-game":
            this.registerAction( action )
            this.gameOver = true
            return [ new GameAction( "prepare-board" ) ]
          case "prepare-board":
            this.registerAction( action )
            return [ new GameAction( "start-round" ) ]
          case "start-round":
            // empty all hands and rebuild the deck
            this.registerAction( action )
            this.resetGame( )
            if( !this.dealer ) {
              console.log( "Shuffling!" )
              this.deck.shuffle()
              return this.nextStage( "cutting" )
            } else {
              return this.nextStage( "dealing" )
            }
          }
          break;
      case "cutting":
        switch( action.action ) {
          case "cut":
            this.registerAction( action )
            this.getHand( action.subaction ).add( action.cards )
            this.getHand( action.subaction ).setFaceUp( true )
            if( action.cards[0] ) { ///// true
              this.deck.removeCard( action.cards[0] )
            }

            if( action.cards.length !== 1 ) {
              return [ this.gameError( "card-number", "a cut can be one card only" )]
            }

            if( this.stageEvents.has("opponent") && this.stageEvents.has( "player" )) {
              const playerCut = this.playerHand.hand[0]
              const opponentCut = this.opponentHand.hand[0]
              const rP = playerCut?.rank || 0
              const rO = opponentCut?.rank || 0
              const dR = rP - rO
              if( dR !== 0 ) {
                return [new GameAction( "cut-win", dR < 0 ? "player" : "opponent") ]
              } else {
                return [new GameAction( "cut-tie" )]
              }
            }
            break;

          case "cut-win":
            this.registerAction( action )
            this.playerHand.moveTo( this.discardHand )
            this.opponentHand.moveTo( this.discardHand )
            this.dealer = action.subaction
            return this.nextStage( "dealing" )
          case "cut-tie":
            this.registerAction( action )
            this.playerHand.moveTo( this.discardHand )
            this.opponentHand.moveTo( this.discardHand )
            return this.nextStage( "cutting" )
        }
        break;

      case "dealing":
        switch( action.action ) {
          case "shuffle-deck":
            this.registerAction( action )
            this.deck.shuffle()
            return [ new GameAction( "deal-card", this.getOtherPlayer( this.dealer ) )]
          case "deal-card":
            this.registerAction( action )
            const card = this.deck.dealOne()
            if( card ) {
              if( action.subaction === "player" ) {
                card.isFaceUp = true
              } else {
                card.isFaceUp = false
              }
              this.getHand( action.subaction ).add( [card] )
              if( this.getHand( this.getOtherPlayer( action.subaction )).hand.length < 6 ) {
                const deal = new GameAction( "deal-card", this.getOtherPlayer( action.subaction ))
                deal.delayFor(180)
                return [ deal ]
              } else {
                return [new GameAction( "dealing-done" )]
              }
            } else {
              return [ this.gameError( "deck-error", "out of cards on the deck" )]
            }
          case "dealing-done":
            return this.nextStage( "selection" )
        }
        break;
      case "selection":
        switch( action.action ) {
          case "discard":
            this.registerAction( action )
            if( action.cards.length !== 2 ) {
              return [this.gameError("card-number", "discard must be of two cards only")]
            }
            if( !this.getHand( action.subaction ).includesAll( action.cards ) ) {
              return [this.gameError( "card-source", "discards must come from the hand of the player discarding them") ]
            }
            if( action.cards ) {
              this.crib.add( action.cards )
              const savedHand = this.getSavedHand( action.subaction )
              this.getHand( action.subaction ).remove( action.cards )
              savedHand.hand = [...this.getHand( action.subaction ).hand]
            }
            this.crib.setFaceUp( false )
            if( this.stageEvents.has("opponent") && this.stageEvents.has( "player" ) ) {
              this.crib.sort()
              return this.nextStage( "playing" )
            }
        }
        break;

      case "playing":
        let playNext = action.subaction ? this.getOtherPlayer( action.subaction ) : this.dealer
        switch( action.action ) {
          case "starter-card":
            this.registerAction( action )
            this.starter = action.cards?.[0]
            if( this.starter ) {
              this.starter.isFaceUp = true
            }
            if( this.starter?.rank === 11 ) {
              rV.push(new GameAction( "his-nibs", action.subaction ))
            }
            this.deck.removeCard( this.starter as Card )
            rV.push( new GameAction( "need-play-card", this.getOtherPlayer( this.dealer ) ))
            this.turn = this.getOtherPlayer( this.dealer )
            return rV
          case "his-nibs":
            this.registerAction( action )
            return [this.scoreAction( 2, action.subaction, action, "his-nibs", "start" )]
          case "play-card":
            this.registerAction( action )
            const va = this.validateCards( action, action.cards, 1, this.getHand( action.subaction ) )
            if( va.length > 0 ) {
              return va
            }
            this.playingHand.add( action.cards )
            pegSum = this.playingHand.sum()
            if( pegSum > 31 ) {
              this.playingHand.remove( action.cards )
              return [this.gameError( "over-31", "a card may not be played that takes the playing total over 31"  )]
            }
            this.playingHand.setFaceUp( true )
            this.getHand( action.subaction ).remove( action.cards as Card[] )
            if( pegSum === 15 ) {
              rV.push( this.scoreAction( 2, action.subaction, action, "15", "play" ) )
            }
            if( pegSum === 31 ) {
              rV.push( this.scoreAction( 2, action.subaction, action, "31", "play" ))
            }
            /// now calculate runs and multiples
            const runScore = this.playingHand.calcTailRunScore()
            if( runScore >= 3 ) {
              rV.push( this.scoreAction( runScore, action.subaction, action, "run", "play" ) )
            }
            const pairScore = this.playingHand.calcTailPairScore()
            if( pairScore > 0 ) {
              rV.push( this.scoreAction( pairScore, action.subaction, action, "pair", "play" ))
            }
            /// calculate if this is

            playNext = this.getOtherPlayer( action.subaction )
            const playerCanPlay = this.playerHand.canPlay( pegSum )
            const opponentCanPlay = this.opponentHand.canPlay( pegSum )
            if( !opponentCanPlay && !playerCanPlay ) { ////
              rV.push( new GameAction( "last-card", action.subaction )  )
              this.turn = undefined
              return rV
            }
            ///// now who to play next
            playNext = this.getOtherPlayer( action.subaction )
            if( (playNext === "player" && playerCanPlay) || (playNext === "opponent" && opponentCanPlay) ) {
              /// EMPTY
            } else {  /// logically some player can (and must) play
              playNext = this.getOtherPlayer( playNext )  //// longwinded way of saying the same player!
            }
            rV.push( new GameAction( "need-play-card", playNext ) )
            this.turn = playNext
            return rV
          case "last-card":
            rV = []
            pegSum = this.playingHand.sum()
            this.registerAction( action )
            this.playingHand.moveTo( this.discardHand )
            if( pegSum < 31 ) { //// otherwise 2 points will have been awarded for 31
              rV.push(this.scoreAction( 1, action.subaction, action, "the-last-card", "play") )
            }
            ///// now work out who (if anyone) is to go next
            if( !this.playerHand.canPlay( 0 ) && !this.opponentHand.canPlay( 0 ) ) { //// no cards!
              this.turn = undefined
              return rV.concat( this.nextStage( "showing" ) )
            }
            //// or work out who should (or can) go!
            playNext = this.getOtherPlayer( action.subaction )
            if( this.getHand( playNext ).hand.length === 0 ) { //// no cards
              playNext = action.subaction
            }
            this.turn = playNext
            rV.push( new GameAction( "need-play-card", playNext ) )
            return rV
        }
        break;
      case "showing":
        switch( action.action ) {
          case "start-show":
            this.registerAction( action )
            this.savedPlayerHand.setFaceUp( false )
            this.crib.setFaceUp( false )
            this.savedOpponentHand.setFaceUp( true )
            return [ new GameAction( "show-non-dealer", this.getOtherPlayer( this.dealer ) )]
          case "show-non-dealer":
            this.registerAction( action )
            this.getSavedHand( "player" ).setFaceUp( true )
            this.getSavedHand("opponent").sort()
            const nds = scoreHand( this.getSavedHand( this.getOtherPlayer( this.dealer ) ).hand, this.starter, false  )
            this.scores[ this.dealer === "player" ? "opponent-hand" : "player-hand" ] = nds
            return [ this.scoreAction( nds, this.getOtherPlayer( this.dealer ), action, "show-non-dealer", "show-hand"  ), new GameAction( "show-dealer", this.dealer ) ]
          case "show-dealer":
            this.registerAction( action  )
            this.crib.setFaceUp( true )
            const ds = scoreHand( this.getSavedHand( this.dealer ).hand, this.starter, false )
            this.scores[ this.dealer === "player" ? "player-hand" : "opponent-hand" ] = ds
            return [this.scoreAction( ds, this.dealer, action, "show-dealer", "show-hand" ), new GameAction( "show-crib" )]
          case "show-crib":
            this.registerAction( action )
            const cs = scoreHand( this.crib.hand, this.starter, true )
            this.scores["crib"] = cs
            return [this.scoreAction( cs, this.dealer, action, "show-crib", "show-crib" ), new GameAction( "round-end" )]
          case "round-end":
            this.registerAction( action )
            this.dealer = this.getOtherPlayer( this.dealer )
            return this.nextStage( "starting" )
          case "quit":
            this.registerAction( action )
            this.winner = "opponent"
            this.gameOver = true
            return [...this.nextStage( "ending" ), new GameAction("new-game")]
        }  //// close showing switch block
        break
      case "ending":
        switch( action.action ) {
          case "end-game":
            this.registerAction( action )
            //// insert logic for storing the game details
            return [new GameAction( "new-game" )]
          case "new-game":
            this.gameOver = true
            this.registerAction( action )
            return this.nextStage( "starting" )
        }

    } //// close main switch block
    ////// scores happen separately from the main loop.
    if( action.action === "score" ) {
      this.registerAction( action )
      if( !this.gameOver && action.subaction ) {
        this.scores[action.subaction] += action.score
        if( this.scores[action.subaction] > 120 ) {
          this.gameOver = true  ///// do not wait for the game-win!
          this.winner = action.subaction
          return this.nextStage( "ending" )
        }
      }
    }
    if( action.action === "info" ) {
      this.registerAction( action )
      return [action]
    }
    if( action.action === "abort-game" || action.action === "game-timeout" ) {
      if( this.gameOver ) {
        //// ignore
        return []
      }
      this.registerAction( action )
      this.gameOver = true
      this.winner = action.subaction
      return this.nextStage( "ending" )
    }
    if( !action.registered ) {
      console.log( "Unregistered Action", action )
    }
    return []
  }

  resetGame(  ) : void {
    if( this.gameOver ) {
      this.dealer = undefined
      this.scores.player = 0
      this.gameOver = false
      this.scores.opponent = 0
      this.winner = undefined
      this.allActions=[]
    }
    this.scores['player-hand'] = -1
    this.scores['opponent-hand'] = -1
    this.scores['crib'] = -1
    this.turn = undefined
    this.playerHand.clear()
    this.opponentHand.clear()
    this.crib.clear()
    this.discardHand.clear()
    this.playingHand.clear()
    this.savedOpponentHand.clear()
    this.savedPlayerHand.clear()
    this.starter=undefined
    this.deck.reset()
  }
}

const subsetsOf5 = getSubsets( 5 )
const nonUnarySubsetsOf5 = subsetsOf5.filter( s => s.length > 1 )
const nonUnarySubsetsOf4 = getSubsets( 4 ).filter( s => s.length > 1 )
const selections = makeSelections()

export type {PlayerEvent, GameEvent, GameStage, ActionSource}

export { scoreHand, getBestHand, CribbageGame, GameAction  }
