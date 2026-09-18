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
import { PlayNotice } from './components/PlayNotice'
import { ScoreBreakdownModal } from './components/ScoreBreakdownModal'
import { Button } from 'react-bootstrap'
import { userPlay, UserGamePlay, PCard } from './features/game/gameSlice'

type ShowBreakdown = "player" | "opponent" | "crib"

function Cribbage( {deck } : {deck? : Deck}  ) {
  const dispatch = useAppDispatch()
  const uiState = useAppSelector( (s) => s.game )
  const [selectedDeck, setSelectedDeck] = useState( deck )
  const [needDeck, setNeedDeck] = useState( deck ? false : true )
  const [showCard, setShowCard] = useState( "" )
  const [showBreakdown, setShowBreakdown] = useState<ShowBreakdown | null>(null)
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

  const starterCard = game.starter ? game.starter.toObject() as PCard : null
  const breakdownOpen =
    (showBreakdown === "player" && uiState.showPlayer)
    || (showBreakdown === "opponent" && uiState.showOpponent)
    || (showBreakdown === "crib" && uiState.showCrib)
  const breakdownHand =
    showBreakdown === "player" ? game.savedPlayerHand.hand
    : showBreakdown === "opponent" ? game.savedOpponentHand.hand
    : game.crib.hand
  const breakdownTitle =
    showBreakdown === "player" ? "Your hand"
    : showBreakdown === "opponent" ? "Opponent"
    : "Crib"
  const breakdownTotal =
    showBreakdown === "player" ? game.scores["player-hand"]
    : showBreakdown === "opponent" ? game.scores["opponent-hand"]
    : game.scores.crib
  const breakdownIsCrib = showBreakdown === "crib"

  if( needDeck ) {
    const decks = ["vv", "br1", "em1t", "em2", "rc"].map( x => new StdDeck( x ))
    return (
    <div><DeckSelector decks={decks} selectCallback={ (deck) => {doSetSelectedDeck(deck); setNeedDeck( false )} } /></div>
  )
  } else {
  return (
    <div className="play">
    <PlayNotice message={uiState.message} noticeId={uiState.updateId} />
    { showCard && <PopupImage imageUrl={showCard} onClose={() => {setShowCard( "" )}} /> }
    { !uiState.difficultyChosen && <DifficultyModal /> }
    { uiState.finalBreakdown !== null && <GameOverModal /> }
    { breakdownOpen && showBreakdown && (
      <ScoreBreakdownModal
        title={breakdownTitle}
        hand={breakdownHand.map((c) => c.toObject() as PCard)}
        starter={starterCard}
        isCrib={breakdownIsCrib}
        total={breakdownTotal}
        deck={theDeck}
        onClose={() => setShowBreakdown(null)}
      />
    )}
    <div className="board">
    { ["playing", "showing", "ending", "dealing", "selection"].includes( gameState)  && <CribbageBoard playerPeg={playerPeg} opponentPeg={opponentPeg}/> }
    </div>
    <div className="playerHand">
    <div className="playerScore">{ game.scores.player }</div>
    { gameState !== "showing" && <PlayerHand deck={ theDeck } hand={ game.playerHand.hand } cardSize={ cardSize} cardClick={ ccb } top={ 80 } left={handLeft }/> }
    { uiState.showPlayer && <CardHand deck={ theDeck } hand={ game.savedPlayerHand.hand } top={80} left={ handLeft } spacing={showSpacing} clickCallback={showCardCallback} cardSize={cardSize} score={game.scores['player-hand'] } onScoreInfo={() => setShowBreakdown("player")} scoreInfoLabel="How your hand was counted"/> }
    </div>
    <div className="deck">
    { (gameState === "cutting") && <CardHand deck={theDeck} hand={theDeck.getRemainingDeck()} clickCallback={ playerCut } top={50} left={ 100 } spacing={ 450/theDeck.getRemainingDeck().length } cardSize={ cardSize } /> }
    { (gameState === "playing" || gameState === "showing" || gameState === "ending") && game.starter &&  <CardHand deck={ theDeck } hand={[game.starter as Card]} top={50} left={0} spacing={0} cardSize={ cardSize } clickCallback={ showCardCallback }/>}
    { (gameState === "playing" || gameState === "ending") && <CardHand deck={theDeck} hand={game.playingHand.hand} top={50} left={ handLeft } spacing={showSpacing} cardSize={ cardSize } score={ playHandSum } /> }
    { uiState.showCrib && <CardHand deck={ theDeck } hand={game.crib.hand} top={50} left={handLeft } spacing={showSpacing} cardSize={cardSize} clickCallback={showCardCallback} score={game.scores.crib } onScoreInfo={() => setShowBreakdown("crib")} scoreInfoLabel="How the crib was counted"/>  }
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
    { uiState.showOpponent && <CardHand deck={ theDeck } hand={ game.savedOpponentHand.hand } top={80} left={handLeft} spacing={showSpacing} cardSize={cardSize} clickCallback={showCardCallback} score={game.scores['opponent-hand']} onScoreInfo={() => setShowBreakdown("opponent")} scoreInfoLabel="How the opponent's hand was counted"/> }
    </div>
    <div className='commitCrib'>
    { !gated && ["starting", "showing", "ending"].includes( gameState ) && <div className="btn-row"><Button variant="warning" onClick={ start }>Start The Round!</Button> <Button variant="outline-light" onClick={quit}>Quit!</Button></div> }
    { !gated && gameState === "selection" && <div className="btn-row"><Button variant="warning" onClick={ playerDiscard } disabled={ game.playerHand.hand.filter( (c) => c.selected ).length !== 2 }> Select for Crib</Button>  <Button variant="outline-light" onClick={ autoSelect } disabled={ game.playerHand.hand.length !== 6 }> Auto Select </Button></div> }
    </div>
    </div>
  )
}
}

export default Cribbage
