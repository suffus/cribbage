import React, { useState } from 'react'
import { Card, Deck } from '../app/entities'
import { Button, Modal } from 'react-bootstrap'
import CSS from 'csstype'

type PCProps = {
  card : Card;
  deck : Deck;
  cardSize? : number;
  offsetStep? : number;
  onClickCallback? : ( ) => void;
  top : number;
  left : number;
  offset? : number;
  animate? : boolean;
}

type PHProps = {
  deck: Deck;
  top : number;
  left : number;
  hand: Array<Card>;
  cardSize? : number;
  spacing? : number;
  cardClick?: ( c: Card, idx: number) => void;
}

type CHProps = {
  deck: Deck;
  hand: Array<Card>;
  top: number;
  left: number;
  animate?: boolean;
  cardSize?: number;
  spacing?: number;
  score?: number;
  clickCallback?: ( c: Card, idx: number ) => () => void;
}

type DSProps = {
  decks: Deck[];
  selectCallback: ( d: Deck ) => void
}


function DeckSelector( {decks, selectCallback}: DSProps ) {
  const hand = [new Card("clubs", 2), new Card("hearts", 7), new Card("spades", 5)]
  hand[1].isFaceUp = true
  hand[0].isFaceUp = false
  hand[2].isFaceUp = true

  return (
    <div>
    { decks.map( (deck, idx) => { return <CardHand key={idx} hand={ hand } cardSize={ 150 } spacing={160} deck={deck} top={80+idx*200} left={100} clickCallback={() => () => selectCallback( deck )} />  } ) }
    </div>
  )
}


function PlayingCard( { card, deck, cardSize, offsetStep, offset, onClickCallback, animate, top, left }: PCProps ) {
  if( card === undefined ) {
    console.log( "Card undefined!!!" )
    console.log( cardSize )
  }
  if( offset === undefined ) { offset = 2 }
  if( cardSize === undefined ) { cardSize = 350 }
  if( offsetStep === undefined ) { offsetStep = Math.floor(cardSize/4)}
  if( onClickCallback === undefined ) { onClickCallback = () => undefined }
  const topOffset = animate ? -0.1*cardSize : 0
  const styles : CSS.Properties = {
    position: 'absolute',
    display: 'inline',
    top: `${top + topOffset}px`,    // computed based on child and parent's height
    left: `${offsetStep*offset + left}px`   // computed based on child and parent's width
  };
  if( animate ) {
    if( card.selected ) {
      styles['animation']='slide 0.3s ease forwards'
      //styles['animationDirection'] = 'forwards'
    } else {
      styles['animation']='sliderev 0.3s ease forwards'
      //styles['animationDirection']='normal'
    }
  }
//  console.log("PC",card, styles)
  const uri = card.isFaceUp ? deck.getFaceImageUri( card ) : deck.getBackImageUri( )
  const ccb = () => onClickCallback && onClickCallback()
  return onClickCallback && (
    <div className='playing-card' style={ styles } onClick={ ccb }>
    <img width={ cardSize } src={ uri } alt={card.toString()}/>
    </div>
  )
}

function CardHand( { deck, hand, animate, cardSize, spacing, clickCallback, top, left, score }: CHProps ) {
  clickCallback = clickCallback ? clickCallback : ( ) => {return () => undefined}
  cardSize = cardSize || 180
  spacing = spacing || Math.floor(cardSize*2/3)
  return (
    <div className="cardHand">
    { hand.map( (c, idx) => (
      <PlayingCard animate={ animate } key={ idx }
        deck={ deck } cardSize={ cardSize }
        top={ top } left={ left }
        card={c} offset={ idx } offsetStep = { spacing }
        onClickCallback={ clickCallback && clickCallback( c, idx ) } />
      )
    )}
    { (score !== undefined && score >= 0) && <span className="peggingHandTotal" style={ {left: left+spacing*(hand.length) + 70} }>{score}</span> }
    </div>
  )
}

function PlayerHand( { deck, hand, cardClick, top, left, cardSize, spacing }: PHProps ) {
  const [selectedCards, setSelectedCards] = useState<Array<Card>>( [] )
  hand.sort( (x,y) => {
    const rcpr = x.rank - y.rank
    if( rcpr !== 0 ) {
      return rcpr
    }
    return x.suit.localeCompare( y.suit )
  } )

  cardSize = cardSize || 110
  spacing = spacing || 90

  const cardCallback = function( c: Card, idx: number ): ()=>void {
    const rv = () =>  {
      if( cardClick !== undefined ) {
        cardClick( c, idx )
      }
      let totalSelected = 0
      let firstCardSelected : Card | null = null

      hand.forEach( (cx) => {
        if( cx.selected && cx !== c ) {
          totalSelected++;
          if( firstCardSelected === null )
          {
            firstCardSelected = cx
          }
        }
      } )

      if( totalSelected === 2 && firstCardSelected !== null ) {
        const cf = firstCardSelected as Card
        cf.selected = false;
      }
      c.selected = !c.selected
      setSelectedCards( hand.filter( x => x.selected ) )
      console.log( "Slected cards are: ", selectedCards)
    }
    return rv;
  }
  return (
    <CardHand deck={ deck } animate={ true } hand={ hand } top={ top } left={ left }
      clickCallback={ cardCallback } cardSize={ cardSize } spacing={ spacing }/>
  )
}

type PopupImagePropsType = {
  imageUrl : string;
  onClose: ( ) => void;
}

function PopupImage( {imageUrl, onClose} : PopupImagePropsType ) {
  return (
      <Modal.Dialog style={ { zIndex: 3, color: 'black'} }>
      <Modal.Header>
        <Modal.Title>Card View</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <img src={imageUrl} style={ {width: "100%"} } alt="look at me"/>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="primary" onClick={ onClose }>Close</Button>
      </Modal.Footer>
    </Modal.Dialog>
  )
}


export { PlayingCard, PlayerHand, CardHand, DeckSelector, PopupImage }
