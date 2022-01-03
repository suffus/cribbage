import { CribbageGame, GameAction, PlayerEvent, GameEvent, getBestHand, playBestCard1 } from './game'
import { Card, StdDeck } from './entities'
import { GamePlayingState, UserGamePlay, initialState } from '../features/game/gameSlice'

export function UserAction( action : GameEvent, user? : PlayerEvent ) : GameAction {
  const rV = new GameAction( action, user )
  rV.source = "user"
  return rV
}


export class GamePlayer {
  gameQueue : Array<GameAction> = []
  playQueue : Array<GameAction> = []
  autoPlay : boolean = false
  game : CribbageGame
  stateUpdate: Record<string, unknown> = {}

  constructor(  ) {
    this.game = new CribbageGame( new StdDeck( "vv" ) )
  }

  showInfo( str : string, delay : number = 0 ) : GameAction {
    const infoAction = new GameAction( "info" )
    infoAction.details = str
    return infoAction.delayFor( delay )
  }

  scheduleUserActions( state: GamePlayingState, acts : GameAction[]  ) {
    if( acts.length === 0 ) {
      return
    }
    this.playQueue = this.playQueue.concat( acts )
    console.log("SCheduled", acts, this.playQueue.length )
  }

  handleAction( state: GamePlayingState, action : GameAction ) : Set<GameAction>   {
    let addAction = true
    const rV = new Set<GameAction>()
    switch( action.action ) {
      case "cut-win":
        rV.add(this.showInfo( `${action.subaction} won the cut and will get the first crib!`, 50 ))
        action.delayFor(4000)
        break
      case "cut-tie":
        rV.add( this.showInfo( `The cut was a tie!  You will have to recut...`, 50 ) )
        action.delayFor(4000)
        break
      case "need-discard":
        if ( action.subaction === "opponent" ) {
          rV.add( this.selectOpponentCards( 2000 + Math.random()*1000  ) )
        } else {
          if( !this.autoPlay ) {
            rV.add(this.showInfo( `You need to discard two cards for ${this.game.dealer === "player" ? "your" : "the opponent's"} crib.` ))
          } else {
            rV.add( this.autoSelectPlayerCards( 2000 ) )
          }
        }
        break
      case "need-cut":
        if( action.subaction === "opponent" ) {
          rV.add( this.opponentCut( 800 ) );
        } else {
          rV.add( this.showInfo( "Click a card to cut for dealer" ) )
        }
        break
      case "need-starter-card":
        rV.add( this.dealStarter( 800 ) )
        break
      case "need-play-card":
        if( action.subaction === "opponent" ) {
          rV.add( this.playOpponentCard( 1200 ) )
        } else if( this.autoPlay ) {
          rV.add( this.autoplayPlayerCard( 600 ))
        }
        break
      case "deal-card":
        action.delayFor( 50 )
        break
      case "last-card":
      case "dealing-done":
        action.delayFor( 2500 )
        break
      case "round-end":
        if( action.source === "game") {
          return rV
        }
        break
      case "score":
        console.log( "SCORE RECEIVED!", action.score )
        if( this.game.gameOver || action.score === 0 ) {
          addAction = false
        } else {
        //// peg score
          let pga : number[]= action.subaction === "player" ? [...state.playerPeg.points] : [...state.opponentPeg.points]
          console.log( "Pegging points:", pga )
          pga[2]=pga[1]; pga[1]=pga[0]; pga[0] += action.score
          this.stateUpdate[ action.subaction + "Peg" ] = {points: pga}
        }
        break
      case "game-win":
        rV.add( this.showInfo( `${action.subaction} has won the game!`) )
        break
      case "show-crib":
        action.delayFor( 1200 )
        this.game.crib.setFaceUp( true )
        this.stateUpdate['showCrib'] = true
        break
      case "show-dealer":
        action.delayFor( 1200 )
        this.game.getHand( this.game.dealer ).setFaceUp( true )
        this.game.dealer === "player" ? this.stateUpdate['showPlayer'] = true : this.stateUpdate['showOpponent'] = true
        break
      case "discard":
        break;
      case "show-non-dealer":
        action.delayFor( 1200 )
        this.game.getHand( this.game.getOtherPlayer( this.game.dealer ) ).setFaceUp( true )
        this.game.dealer === "opponent" ? this.stateUpdate['showPlayer'] = true : this.stateUpdate['showOpponent'] = true
        break
      case "prepare-board":
        console.log( "New Game!" )
        const ups = {...initialState}
        ups.playerPeg = {...ups.playerPeg}
        ups.opponentPeg = {...ups.opponentPeg}
        ups.playerPeg.points = [0,-1,-1]
        ups.opponentPeg.points = [0,-1,-1]
        this.stateUpdate = ups
        break
      case "start-round":
        this.stateUpdate = { showCrib: false, showPlayer: false, showOpponent: false }
        break;
      case "info":
        //console.log( "MESSAGE SET:", action.details )
        this.stateUpdate = { message: action.details }
        addAction = false
        break
    }
    if( action.action.startsWith( "need-" ) ) {
      addAction = false
    }
    if( addAction ) {
      rV.add( action )
    }
    if( !this.stateUpdate.message ) {
      this.stateUpdate.message = ""
    }
    return rV
  }

  opponentCut( delay : number  ) : GameAction {
    const card = this.game.deck.dealOne()
    const act = UserAction( "cut", "opponent" )
    act.cards = [card as Card]
    return act.delayFor( delay )
    }

    dealStarter ( delay : number ) {
    const act = UserAction( "starter-card", this.game.dealer )
    act.cards=[this.game.deck.dealOne() as Card]

    return act.delayFor( delay )
  }

  playOpponentCard( delay : number ) : GameAction {
    const card = playBestCard1( this.game.playingHand.hand, this.game.opponentHand.hand )
    if( card ) {
      const act = UserAction( "play-card", "opponent" )
      act.cards = [card]
      return act.delayFor( delay )
    }

    return new GameAction( "error" )
  }


  autoplayPlayerCard( delay : number ) {
    const card = playBestCard1( this.game.playingHand.hand, this.game.playerHand.hand )
    if( card ) {
      const act = UserAction( "play-card", "player" )
      act.cards = [card]
      return act.delayFor( delay )
    }

    return new GameAction( "error" )
  }

  selectOpponentCards( delay : number ) {
    const keepers = getBestHand( this.game.opponentHand.hand, [], this.game.dealer === "opponent" )
    this.game.opponentHand.setSelected( true )
    keepers.forEach(element => {
      element.selected = false
    });
    const act = UserAction( "discard", "opponent" )
    act.cards = this.game.getSelectedOpponentCards()
    return act.delayFor( delay )
  }

  autoSelectPlayerCards( delay : number ) {
    const keepers = getBestHand( this.game.playerHand.hand, [], this.game.dealer === "player" )
    this.game.playerHand.setSelected( true )
    keepers.forEach(element => {
      element.selected = false
    });
    const action = UserAction( "discard", "player" )
    action.cards = this.game.getSelectedPlayerCards()
    return action.delayFor( delay )
  }

  playNext( state : GamePlayingState ) : number {
    //console.log("PLAYNEXT", this.playQueue, this.gameQueue)
    if( this.playQueue.length === 0 && this.gameQueue.length === 0 ) {
        return -1 /// nothing to do
    }

    if( this.playQueue.length > 0 ) {
      /// incoming event to be considered for play
      const play = this.playQueue.shift() as GameAction
      //console.log( "HANDLING:", play )
      const aSet = this.handleAction( state, play )
      /// move everything onto the game queue
      //console.log( "ACTIONS RETURNED FOR GAME QUEUE:", aSet )
      this.gameQueue = this.gameQueue.concat( Array.from( aSet ) )
      this.gameQueue.sort( (a, b) => a.schedule - b.schedule )
      //console.log( "PUTTING ON GAME QUEUE:", aSet, this.gameQueue.length )
      return this.playQueue.length > 0 || this.gameQueue.length > 0 ? 0 : -1 //// replay
    }

    const ts = new Date().getTime()
    const dT = this.gameQueue[0].schedule - ts
    //console.log( "SCHEDULED TIME FOR OPERATION:", dT)
    if( dT <= 0 ) {
      //// time to play a move in the game
      const action = this.gameQueue.shift() as GameAction
      this.playQueue = this.playQueue.concat( this.game.doAction( action ) )
      if( this.game.stage !== state.gameStage ) {
        this.stateUpdate['gameStage'] = this.game.stage
      }
      if( this.playQueue.length > 0 || this.gameQueue.length > 0 ) {
        return 0 /// something else to do at some future time
      } else {
        return -1  /// nothing pending
      }
    } else {
      return dT  //// next action is dT away
    }
  }

  playAction( state : GamePlayingState, pa : UserGamePlay  ) : GamePlayingState | undefined {
    console.log("playAction:", pa)
    const action : GameAction = new GameAction( pa.action as GameEvent, "player" )
    switch( pa.action ) {
      case "play-card":
      case "discard":
        action.cards = []
        for( let card of pa.cards ) {
          const pc = this.game.playerHand.hand.filter( (x) => x.suit === card.suit && x.rank === card.rank )
          if( pc.length === 1 ) {
            action.cards.push( pc[0] )
          }
        }
        break;
      case "cut":
        const card = pa.cards[0]
        action.cards = this.game.deck.getRemainingDeck().filter( (x) => x.suit === card.suit && x.rank === card.rank  )
        break;
    }
    action.source = "user"
    this.scheduleUserActions( state, action.action === "noop" ? [] : [action] )
    return this.play( state )
  }

  play( state : GamePlayingState ) : GamePlayingState | undefined {
    this.stateUpdate = {}
    //console.log( "In Play", state )
    const num = this.playNext( state )
    //console.log( "Updating game state with:", this.stateUpdate, this.playQueue.length, this.gameQueue.length)
    return {...state, ...{message: ""}, ...this.stateUpdate, ...{nextScheduledAction: num, updateId: state.updateId+1}}
  }
}
export const thePlayer = new GamePlayer()
