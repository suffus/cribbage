export const suit_map = {
  'hearts' : 'H',
  'diamonds' : 'D',
  'spades' : 'S',
  'clubs' : 'C',
  'joker' : 'J'
}

export type Suit = keyof typeof suit_map

export const rank_map = {
  1 : 'A',
  2 : '2',
  3 : '3',
  4 : '4',
  5 : '5',
  6 : '6',
  7 : '7',
  8 : '8',
  9 : '9',
  10 : '10',
  11 : 'J',
  12 : 'Q',
  13 : 'K'
}
export type Rank = keyof typeof rank_map

export interface Deck {
  getFaceImageUri( card: Card ) : string
  getBackImageUri( ) : string
  shuffle( ) : Deck
  reset( ) : Deck
  dealOne( ) : Card | undefined
  dealMany( count : number ) : Array<Card> | undefined
  cutOnce( place : number ) : void
  getRemainingDeck() : Array<Card>
  removeCard( c : Card ) : Deck
  dealRandomCard( ) : Card | undefined
}

class Card {
  public suit : Suit
  public rank : Rank
  public value : number
  public selected : boolean = false
  public isFaceUp : boolean = false
  constructor( suit : Suit, rank : Rank ) {
    this.suit = suit
    this.rank = rank
    this.value = rank < 10 ? rank : 10
  }
  public toString() : string {
    return `${this.suit}${this.rank}`
  }
  public toObject() : Object {
    return {suit: this.suit, rank: this.rank}
  }
}


class StdDeck implements Deck {
  base_uri : string
  deck : Array<Card> = new Array<Card>(0)

  constructor( nm : string = "vv" ) {
    this.base_uri = `/img/decks/${nm}`;
    this.buildDeck()
  }
  getRemainingDeck() : Array<Card> {
    return this.deck
  }
  reset() : Deck {
    this.buildDeck()
    return this
  }
  buildDeck() : void {
    this.deck = new Array<Card>(0)
    for( let suit of ["hearts","diamonds","spades","clubs"] ) {
      for( let rank of Object.keys(rank_map) ) {
        this.deck.push( new Card( suit as Suit, parseInt(rank,10) as Rank ) )
      }
    }
  }

  getFaceImageUri( card: Card ) : string {
    return `${this.base_uri}/${rank_map[card.rank]}${suit_map[card.suit]}.png`
  }
  getBackImageUri( ) : string {
    return `${this.base_uri}/back.png`
  }
  shuffle( ) : Deck {
    // this.buildDeck()
    var rands : Record<string,number> = {}
    this.deck.forEach( ( card ) => {rands[card.toString()] = Math.random()} )
    this.deck.sort( (i,j) => rands[i.toString()] - rands[j.toString()])
    return this
  }
  dealOne( ) : Card | undefined {
    return this.deck.pop()
  }
  dealRandomCard( ) : Card | undefined {
    if( this.deck.length === 0) {
      return undefined
    }
    const n = Math.floor( Math.random() * this.deck.length )
    const card = this.deck[n]
    this.removeCard( card )
    return card
  }
  removeCard( card : Card ) : Deck {
    this.deck = this.deck.filter( (c) => card.suit !== c.suit || card.rank !== c.rank )
    return this
  }
  dealMany( count : number ) : Array<Card> | undefined {
    const rV = new Array<Card>(0)
    for( ; count > 0; count -= 1 ) {
      const c: Card|undefined = this.deck.pop()
      if( c === undefined ) { /// outa cards
        return undefined
      }
      rV.push( c as Card )
    }
    return rV
  }
  cutOnce( place : number ) : Deck {
    const lower = this.deck.slice( place )
    const upper = this.deck.slice( -1*place )
    this.deck = upper.concat( lower )
    return this
  }
}

class Hand {
  public hand : Array<Card>
  constructor( hand : Array<Card> ) {
    this.hand = hand
  }
  getSelected( status : boolean  ) : Array<Card> {
    let rV : Array<Card> = []
    this.hand.forEach( (x) => { if( x.selected === status ) { rV.push( x ) } } )
    console.log( "THERE ARE ", rV.length, " selected player cards")
    return rV
  }
  setFaceUp( status : boolean ) : Hand {
    this.hand.forEach( x => x.isFaceUp = status )
    return this
  }
  clear() : Hand {
    this.hand = []
    return this
  }
  includesAll( cards : Array<Card> ) {
    for( let card of cards ) {
      if( !this.hand.includes( card ) ) {
        return false
      }
    }
    return true
  }
  setSelected( status : boolean ) : Hand {
    this.hand.forEach( x => x.selected = status )
    return this
  }
  moveTo( toHand : Hand ) : Hand {
    toHand.add( this.hand )
    this.hand = []
    return this
  }
  remove( set : Array<Card> ) : Hand {
    for( let card of set ) {
      this.hand = this.hand.filter( x => !(x.suit === card.suit && x.rank === card.rank) )
    }
    return this
  }
  sum( ) : number {
    let rV = 0
    this.hand.forEach( x => rV += x.value )
    return rV
  }
  calcTailRunScore( ) : number {
    for( let i = 0; i <= this.hand.length - 3; i++ ) {
      let tA = this.hand.slice( i )
      tA = tA.sort( (x,y) => x.rank - y.rank )
      let isRun = true
      for( let j = 1; j < tA.length; j++ ) {
        if( tA[j].rank !== tA[j-1].rank + 1 ) {
            isRun = false
        }
      }
      if( isRun ) {
        return tA.length
      }
    }
    return 0
  }
  calcTailPairScore() : number {
    const hlen = this.hand.length
    if( hlen < 2 ) {
      return 0
    }
    const rank = this.hand[hlen-1].rank
    let pairLen = 0
    for( let i = hlen - 1; i >= 0; i-- ) {
      if( this.hand[i].rank === rank ) {
        pairLen++
      } else {
        break
      }
    }
    return pairLen * (pairLen - 1)  ///  (runLen C 2) * 2
  }
  canPlay( peg : number ) : boolean {
    let canGo = false
    this.hand.forEach( x => {if( x.value <= (31-peg) ) {canGo = true}})
    return canGo
  }
  sort( ) : Hand {
    this.hand = this.hand.sort( (x, y) => {
      const dR = x.rank - y.rank
      if( dR !== 0 ) {
        return dR
      }
      return x.suit.localeCompare( y.suit )
    })
    return this
  }
  add( cards : Array<Card> | undefined ) : Hand {
    if( cards ) {
      this.hand = this.hand.concat( cards )
    }
    return this
  }
}

export { StdDeck, Card, Hand }
