import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from './app/hooks'
import { Card, StdDeck, Deck  } from './app/entities';
import { getBestHand } from './app/game'
import { thePlayer } from './app/gamePlayer'
import { PlayerHand, CardHand, DeckSelector, PopupImage } from './components/CardComponents'
import { CribbageBoard, Peg } from './components/CribbageBoard'
import { Button } from 'react-bootstrap'
import { userPlay, updateGameState, UserGamePlay, PCard } from './features/game/gameSlice'
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
toast.configure()

function Cribbage( {deck } : {deck? : Deck}  ) {
  const dispatch = useAppDispatch()
  const uiGameState = useAppSelector( (s) => s.game )
  const [selectedDeck, setSelectedDeck] = useState( deck )
  const [needDeck, setNeedDeck] = useState( deck ? false : true )
  const [showCard, setShowCard] = useState( "" )
  const [playerPeg, setPlayerPeg] = useState( new Peg( 0, [] ) )
  const [opponentPeg, setOpponentPeg] = useState( new Peg( 1, [] ))
  const [lastMessageId, setLastMessageId] = useState( -1 )
  const [nextRerenderId, setNextRerenderId] = useState( -1 )

  const game = thePlayer.game
  const gameState = game.stage
  const uiState = uiGameState
  const theDeck = selectedDeck as Deck

  if( game.deck !== theDeck ) {
    game.deck = theDeck
  }

  console.log( "RENDER", gameState, thePlayer.playQueue, uiState, game.playerHand.hand.length )

  if( uiState.nextScheduledAction >= 0 && uiState.updateId !== nextRerenderId  ) {   //// this drives delays
    setNextRerenderId( uiState.updateId )
    setTimeout( () => play( {action: "noop", cards: []} ), uiState.nextScheduledAction )
  }

  const play = (action : UserGamePlay) => {
    dispatch( userPlay( action ) )
  }
  const redraw = ( ) => {
    play( {action : "noop", cards: []})
  }

  const ccb = (c: Card ) => {
    if( game.stage === "playing" && game.turn === "player"  ) {
      play({action: "play-card", cards: [ c.toObject() as PCard ]})
    } else {
      redraw()
    }
  }

  const showCardCallback = ( c: Card ) => () => {setShowCard(theDeck.getFaceImageUri( c ))}

  function showInfo( info_in : string ) {
    if( !info_in ) {
      return
    }
    toast.info(info_in, {
          position: 'top-left',
          autoClose: 3000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          progress: undefined
        })
  }

  if( uiState.message ) {
    if( uiState.updateId !== lastMessageId ) {
      showInfo( uiState.message )
      setLastMessageId( uiState.updateId )
    }
  }

  if( uiState.playerPeg.points[0] !== playerPeg.currentPoint ) {
    console.log("Setting the player peg!")
    setPlayerPeg( new Peg( 0, uiState.playerPeg.points ) )
  }
  if( uiState.opponentPeg.points[0] !== opponentPeg.currentPoint ) {
    setOpponentPeg( new Peg( 1, uiState.opponentPeg.points ))
  }

  //////// CALLBACKS BELOW HERE

  const start = ( ) => {
    if( game.gameOver ) {
      play( { action: "new-game", cards: [] })
      return
    } else {
      const act = gameState === "starting" ? "start-round" : "round-end"
      play( { action: act, cards: [] })
    }
  }
  const quit = ( ) => {
    play( {action: "quit", cards: [] } )
  }
  const playerCut = (c: Card ) => () => {
    play( {action: "cut", cards: [ c.toObject() as PCard ]} )
  }
  const playerDiscard = () => {
    const discards = game.getSelectedPlayerCards()
    if( discards.length !== 2 ) {
      return
    }
    play({action: "discard", cards: discards.map( (x) => {return x.toObject() as PCard })})
  }
  const autoSelect = () => {
    const keepers = getBestHand( game.playerHand.hand, [], game.dealer === "player" )
    game.playerHand.setSelected( true )
    keepers.forEach( c => c.selected = false )
    redraw()
  }
  function doSetSelectedDeck( deck: Deck ) {
    setSelectedDeck( deck )
    game.deck = deck
  }
  const setAutoPlay = ( p : boolean ) => {
    dispatch( updateGameState({ ...uiState, "autoPlay" : p }) )
  }

  const fixScores = () => {
    game.scores.player = 108
    game.scores.opponent = 108
    const newState = {...uiState}
    newState.playerPeg = {"track":0, "points":[108, 104,100]}
    newState.opponentPeg = {"track":1, "points":[108, 100,99]}
    dispatch( updateGameState( newState ))
  }

  let playHandSum = 0
  game.playingHand.hand.forEach( x => { playHandSum += x.value } )

  const cardSize = 150
  const cardSpacing = 100
  const showSpacing = 120
  const handLeft = 170
  if( needDeck ) {
    const decks = ["vv", "br1", "em1t", "em2", "rc"].map( x => new StdDeck( x ))
    return (
    <div><DeckSelector decks={decks} selectCallback={ (deck) => {doSetSelectedDeck(deck); setNeedDeck( false )} } /></div>
  )
  } else {
  return (
    <div className="play">
    { showCard && <PopupImage imageUrl={showCard} onClose={() => {setShowCard( "" )}} /> }
    <div className="board">
    { ["playing", "showing", "ending", "dealing", "selection"].includes( gameState)  && <CribbageBoard playerPeg={playerPeg} opponentPeg={opponentPeg}/> }
    </div>
    <div className="playerHand">
    <div className="playerScore">{ game.scores.player }</div>
    { gameState !== "showing" && <PlayerHand deck={ theDeck } hand={ game.playerHand.hand } cardSize={ cardSize} cardClick={ ccb } top={ 80 } left={handLeft }/> }
    { uiState.showPlayer && <CardHand deck={ theDeck } hand={ game.savedPlayerHand.hand } top={80} left={ handLeft } spacing={showSpacing} clickCallback={showCardCallback} cardSize={cardSize} score={game.scores['player-hand'] }/> }
    </div>
    <div className="deck">
    { (gameState === "cutting") && <CardHand deck={theDeck} hand={theDeck.getRemainingDeck()} clickCallback={ playerCut } top={50} left={ 100 } spacing={ 450/theDeck.getRemainingDeck().length } cardSize={ cardSize } /> }
    { gameState === "dealing" && false && <CardHand deck={theDeck} hand={theDeck.getRemainingDeck() } top={50} left={ 100 } spacing={ 5 } cardSize={ cardSize } /> }
    { (gameState === "playing" || gameState === "showing" || gameState === "ending") && game.starter &&  <CardHand deck={ theDeck } hand={[game.starter as Card]} top={50} left={0} spacing={0} cardSize={ cardSize } clickCallback={ showCardCallback }/>}
    { (gameState === "playing" || gameState === "ending") && <CardHand deck={theDeck} hand={game.playingHand.hand} top={50} left={ handLeft } spacing={showSpacing} cardSize={ cardSize } score={ playHandSum } /> }
    { uiState.showCrib && <CardHand deck={ theDeck } hand={game.crib.hand} top={50} left={handLeft } spacing={showSpacing} cardSize={cardSize} clickCallback={showCardCallback} score={game.scores.crib }/>  }
    </div>
    <div className="cribHand">
    { game.dealer === "player" && gameState !== "showing" && <CardHand deck={theDeck} hand={game.crib.hand} top={10} left={0} cardSize={ 40 } spacing={15} /> }
    </div>
    <div className="opponentCribHand">
    { game.dealer === "opponent" && gameState !== "showing" && <CardHand deck={theDeck} hand={game.crib.hand} top={30} left={0} cardSize={ 40 } spacing={15} /> }
    </div>
    <div className="opponentHand">
    <div className="opponentScore">{ game.scores.opponent }</div>
    { gameState !== "showing" && <CardHand deck={ theDeck } hand={ game.opponentHand.hand } top={ 80 } left={ handLeft } cardSize={ cardSize } spacing={ cardSpacing }/> }
    { uiState.showOpponent && <CardHand deck={ theDeck } hand={ game.savedOpponentHand.hand } top={80} left={handLeft} spacing={showSpacing} cardSize={cardSize} clickCallback={showCardCallback} score={game.scores['opponent-hand']}/> }
    </div>
    <div className='commitCrib'>
    { ["starting", "showing", "ending"].includes( gameState ) && <div><Button onClick={ start }>Start The Round!</Button> <Button onClick={quit}>Quit!</Button></div> }
    { gameState === "selection" && <div><Button onClick={ playerDiscard }> Select for Crib</Button>  <Button onClick={ autoSelect } disabled={ game.playerHand.hand.length !== 6 }> Auto Select </Button></div> }
    </div>
    </div>
  )
}
}

export default Cribbage
