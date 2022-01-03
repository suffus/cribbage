import React from 'react'


class Peg {
  track : number
  currentPoint: number
  previousPoint: number
  score( n : number ) : Peg {
    if( n === 0 ) {
      return this
    }
    let rV : Peg = new Peg( this.track )
    rV.previousPoint = this.currentPoint
    rV.currentPoint += this.currentPoint + n
    if( rV.currentPoint >= 121 ) {
      rV.currentPoint = 121
    }
    console.log( "Scoring Peg:", n, this, rV )
    return rV
  }
  constructor( trk : number, points: number[] ) {
    if( points.length < 2 ) {
      points[0] = 0
      points[1] = -1
    }
    this.track = trk
    this.currentPoint = points[0]
    this.previousPoint = points[1]
  }
  reset() {
    this.currentPoint = 0
    this.previousPoint = -1
  }
}

type CBProps = {
  playerPeg: Peg;
  opponentPeg: Peg;
}


type Point = {
  x: number;
  y: number;
}

function getPoints( x : number ) : Array<Point> {
  const trackStartY = 580
  const pitch = 12.68
  const topTrackY = trackStartY - 34 * pitch
  const greenTrackX = tracks[1]
  const cX = 113.5
  const cY = 142
  const r2 = cX - greenTrackX
  const c2X = cX + r2/2
  const c2Y = trackStartY + pitch/2
  const winPointY = 128
  const r1 = cX - x
  const r2R = cX + r1 - c2X
  return [
    ...[...Array(35).keys()].map( (n) => { return {x: x, y: trackStartY-n*pitch}} ),
    ...[9,27,45,63,81,99,117,135,153,171].map( (n) => { return {x: cX - r1 * Math.cos( n * Math.PI / 180 ), y:cY - Math.sin( n * Math.PI / 180 )*r1} } ),
    ...[...Array(35).keys()].map( (n) => { return {x: x + 2 * r1, y: topTrackY + n * pitch}}),
    ...[18, 54, 90, 126, 162].map( (n) => { return {x: c2X + r2R * Math.cos( n * Math.PI / 180 ), y: c2Y + Math.sin( n * Math.PI / 180 )*r2R}} ),
    ...[...Array(35).keys()].map( (n) => { return {x: c2X - r2R, y: (trackStartY - n * pitch)}}),
    {x: cX, y: winPointY}
  ]
}

const tracks=[21,42,63]
const peggingPoints = tracks.map( (n) => getPoints( n ) )
function CribbageBoard( {playerPeg, opponentPeg}: CBProps ) {
  //console.log("BOARD RENDER")
  const trackStartY = 580
  const cX = 113.5
  const winPointY = 128
  const getPegPoints = ( peg : Peg ) => {
      const rV = [peg.currentPoint, peg.previousPoint].map( (n) => {
        if( n > 0 ) {
          if( n < 121 ) {
            return peggingPoints[ peg.track ][n-1]
          } else {
            return {x: cX, y: winPointY}
          }
        } else {
            return {x: tracks[peg.track], y: trackStartY + 25 }
        }
      } )
      return rV
  }
  //console.log( "POINTS ARE:", getPegPoints( playerPeg )  )

  return (
      <div>
      <img src="/img/Cribbage_Board.svg" alt="Cribbage board with 3 tracks"/>
      <svg style={ {position:"absolute", top:0, left:0} } width={300} height={800}>
      { getPegPoints( playerPeg ).map( (pt) => <circle cx={pt.x} cy={pt.y} r={5.5} fill='blue' />) }
      { getPegPoints( opponentPeg ).map( (pt) => <circle cx={pt.x} cy={pt.y} r={5.5} fill='red' />) }
      </svg>
      </div>
  )

}

export { CribbageBoard, Peg }
