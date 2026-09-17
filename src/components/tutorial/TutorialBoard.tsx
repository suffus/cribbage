import { CribbageBoard, Peg } from '../CribbageBoard'

export type TutorialBoardProps = {
  playerPegPoints: ReadonlyArray<number>
  opponentPegPoints: ReadonlyArray<number>
  playerScore: number
  opponentScore: number
}

export function TutorialBoard({ playerPegPoints, opponentPegPoints, playerScore, opponentScore }: TutorialBoardProps) {
  return (
    <div className="tutorial-board-wrap">
      <div className="tutorial-board-frame">
        <div className="tutorial-board">
          <CribbageBoard
            playerPeg={new Peg(0, [...playerPegPoints])}
            opponentPeg={new Peg(1, [...opponentPegPoints])}
          />
        </div>
      </div>
      <p className="tutorial-board-scores">You {playerScore} · Them {opponentScore}</p>
    </div>
  )
}
