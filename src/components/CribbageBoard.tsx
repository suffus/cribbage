import { useEffect, useRef, useState } from 'react'

class Peg {
  track : number
  currentPoint: number
  previousPoint: number
  score( n : number ) : Peg {
    if( n === 0 ) {
      return this
    }
    const rV : Peg = new Peg( this.track )
    rV.previousPoint = this.currentPoint
    rV.currentPoint += this.currentPoint + n
    if( rV.currentPoint >= 121 ) {
      rV.currentPoint = 121
    }
    return rV
  }
  constructor( trk : number, points: number[] = [0, -1] ) {
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
  const trackStartY = 580.43013
  const pitch = 12.68307
  const topTrackY = trackStartY - 34 * pitch
  const greenTrackX = tracks[1]
  const cX = 113.3858
  const cY = 142.864
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

/** First-hole centres from `Cribbage_Board.svg` (red, green, blue streets). */
const tracks=[21.41719, 41.57474, 61.73228]
const peggingPoints = tracks.map( (n) => getPoints( n ) )
const HOLE_MS = 80
/** Native size of `Cribbage_Board.svg`. Overlay and image share this box
 *  so the pegs stay circular and sit in the holes, not on the track edges. */
const BOARD_VIEWBOX = "0 0 226.7716 680.31482"

function holePoint(track: number, n: number): Point {
  if (n > 0) {
    if (n < 121) {
      return peggingPoints[track][n - 1]
    }
    return { x: 113.3858, y: 128 }
  }
  // The start street has two holes per track. Current sits in the front
  // hole (closer to 1); the trailing peg sits in the rear hole.
  return { x: tracks[track], y: n === 0 ? 604.45161 : 617.13469 }
}

function PegPair({ peg, fill }: { peg: Peg; fill: string }) {
  const [travel, setTravel] = useState(peg.currentPoint)
  const shownRef = useRef(peg.currentPoint)

  useEffect(() => {
    const from = shownRef.current
    const to = Math.min(121, peg.currentPoint)
    if (from === to) {
      return
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce || to < from) {
      shownRef.current = to
      setTravel(to)
      return
    }
    let hole = from
    let timer = 0
    const tick = () => {
      hole += 1
      setTravel(hole)
      if (hole < to) {
        timer = window.setTimeout(tick, HOLE_MS)
      } else {
        shownRef.current = to
      }
    }
    timer = window.setTimeout(tick, HOLE_MS)
    return () => window.clearTimeout(timer)
  }, [peg.currentPoint])

  const front = holePoint(peg.track, travel)
  const back = holePoint(peg.track, peg.previousPoint)
  return (
    <>
      <circle className="board-peg" cx={front.x} cy={front.y} r={6} fill={fill} stroke="#1a1a1a" strokeWidth={0.7} />
      <circle className="board-peg" cx={back.x} cy={back.y} r={6} fill={fill} stroke="#1a1a1a" strokeWidth={0.7} />
    </>
  )
}

function CribbageBoard( {playerPeg, opponentPeg}: CBProps ) {
  return (
    <div className="cribbage-board cribbage-board--horizontal">
      <div className="cribbage-board-rotator">
        <img src="/img/Cribbage_Board.svg" alt="Cribbage board with 3 tracks"/>
        <svg
          className="cribbage-board-pegs"
          viewBox={BOARD_VIEWBOX}
          preserveAspectRatio="xMidYMid meet"
        >
          <PegPair peg={playerPeg} fill="blue" />
          <PegPair peg={opponentPeg} fill="red" />
        </svg>
      </div>
    </div>
  )
}

export { CribbageBoard, Peg }
