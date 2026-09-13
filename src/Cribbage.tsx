import { useState, useEffect, useRef } from 'react';
import { useAppSelector, useAppDispatch } from './app/hooks'
import { Card, StdDeck, Deck  } from './app/entities';
import { getBestHand, GameBreakdown } from './app/game'
import { thePlayer } from './app/gamePlayer'
import { recordCompletedGame } from './app/persistence'
import { useCardMetrics } from './app/useCardMetrics'
import { PlayerHand, CardHand, DeckSelector, PopupImage } from './components/CardComponents'
import { CribbageBoard, Peg } from './components/CribbageBoard'
import { DifficultyModal } from './components/DifficultyModal'
import { GameOverModal } from './components/GameOverModal'
import { ScoreExplanation } from './components/ScoreExplanation'
import { Button } from 'react-bootstrap'
import { userPlay, UserGamePlay, PCard } from './features/game/gameSlice'
import { toast } from 'react-toastify';

function Cribbage( {deck } : {deck? : Deck}  ) {
  const dispatch = useAppDispatch()
  const uiState = useAppSelector( (s) => s.game )
  const [selectedDeck, setSelectedDeck] = useState( deck )
  const [needDeck, setNeedDeck] = useState( deck ? false : true )
  const [showCard, setShowCard] = useState( "" )
  const recordedRef = useRef<GameBreakdown | null>(null)
  const { cardSize, cardSpacing, showSpacing, handLeft } = useCardMetrics()

  const game = thePlayer.game
  const gameState = game.stage
  const theDeck = selectedDeck as Deck
  const playerPeg = new Peg( 0, uiState.playerPeg.points )
  const opponentPeg = new Peg( 1, uiState.opponentPeg.points )
  const gated = !uiState.difficultyChosen || uiState.finalBreakdown !== null

  useEffect(() => {
    if (!uiState.difficultyChosen) {
      thePlayer.resetForNewSession()
    }
  }, [uiState.difficultyChosen])

  useEffect(() => {
    const result = uiState.finalBreakdown
    if (!result || recordedRef.current === result) return
    recordedRef.current = result
    recordCompletedGame(result)
  }, [uiState.finalBreakdown])

  useEffect(() => {
    if (selectedDeck && game.deck !== selectedDeck) {
      game.deck = selectedDeck
    }
  }, [game, selectedDeck])

  useEffect(() => {
    if (uiState.nextScheduledAction < 0) {
      return
    }
    const timer = window.setTimeout(() => {
      dispatch(userPlay({ action: "noop", cards: [] }))
    }, uiState.nextScheduledAction)
    return () => window.clearTimeout(timer)
  }, [dispatch, uiState.nextScheduledAction, uiState.updateId])

  useEffect(() => {
    if (!uiState.message) {
      return
    }
    toast.info(uiState.message, {
      position: 'top-left',
      autoClose: 3000,
      hideProgressBar: true,
      closeOnClick: true,
      pauseOnHover: true,
    })
  }, [uiState.message, uiState.updateId])

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

  let playHandSum = 0
  game.playingHand.hand.forEach( x => { playHandSum += x.value } )

  if( needDeck ) {
    const decks = ["vv", "br1", "em1t", "em2", "rc"].map( x => new StdDeck( x ))
    return (
    <div><DeckSelector decks={decks} selectCallback={ (deck) => {doSetSelectedDeck(deck); setNeedDeck( false )} } /></div>
  )
  } else {
  return (
    <div className="play">
    { showCard && <PopupImage imageUrl={showCard} onClose={() => {setShowCard( "" )}} /> }
    { !uiState.difficultyChosen && <DifficultyModal /> }
    { uiState.finalBreakdown !== null && <GameOverModal /> }
    <div className="board">
    { ["playing", "showing", "ending", "dealing", "selection"].includes( gameState)  && <CribbageBoard playerPeg={playerPeg} opponentPeg={opponentPeg}/> }
    </div>
    <div className="playerHand">
    <div className="playerScore">{ game.scores.player }</div>
    { gameState !== "showing" && <PlayerHand deck={ theDeck } hand={ game.playerHand.hand } cardSize={ cardSize} cardClick={ ccb } top={ 80 } left={handLeft }/> }
    { uiState.showPlayer && <CardHand deck={ theDeck } hand={ game.savedPlayerHand.hand } top={80} left={ handLeft } spacing={showSpacing} clickCallback={showCardCallback} cardSize={cardSize} score={game.scores['player-hand'] }/> }
    { uiState.showPlayer && (
      <div className="scoreExplanationShow">
        <ScoreExplanation
          hand={game.savedPlayerHand.hand.map((c) => c.toObject() as PCard)}
          starter={game.starter ? game.starter.toObject() as PCard : null}
          isCrib={false}
          total={game.scores["player-hand"]}
        />
      </div>
    )}
    </div>
    <div className="deck">
    { (gameState === "cutting") && <CardHand deck={theDeck} hand={theDeck.getRemainingDeck()} clickCallback={ playerCut } top={50} left={ 100 } spacing={ 450/theDeck.getRemainingDeck().length } cardSize={ cardSize } /> }
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
    { !gated && ["starting", "showing", "ending"].includes( gameState ) && <div><Button onClick={ start }>Start The Round!</Button> <Button onClick={quit}>Quit!</Button></div> }
    { !gated && gameState === "selection" && <div><Button onClick={ playerDiscard }> Select for Crib</Button>  <Button onClick={ autoSelect } disabled={ game.playerHand.hand.length !== 6 }> Auto Select </Button></div> }
    </div>
    </div>
  )
}
}

export default Cribbage
