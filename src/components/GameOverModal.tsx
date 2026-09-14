import { Button, Modal } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { DIFFICULTY_LABELS } from '../app/difficulty'
import { thePlayer } from '../app/gamePlayer'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import type { PlayerBreakdown } from '../app/game'
import {
  clearFinalBreakdown,
  resetGameUi,
  userPlay,
} from '../features/game/gameSlice'

function BreakdownColumn({ title, data }: { title: string, data: PlayerBreakdown }) {
  return (
    <div className="gameover-col">
      <h3>{title}</h3>
      <dl>
        <div><dt>Hand</dt><dd>{data.hand}</dd></div>
        <div><dt>Crib</dt><dd>{data.crib}</dd></div>
        <div><dt>Pegging</dt><dd>{data.pegging}</dd></div>
        <div><dt>Bonuses</dt><dd>{data.bonuses}</dd></div>
        <div className="gameover-total"><dt>Total</dt><dd>{data.total}</dd></div>
      </dl>
    </div>
  )
}

export function GameOverModal() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const breakdown = useAppSelector((s) => s.game.finalBreakdown)
  if (!breakdown) {
    return null
  }

  const title = breakdown.winner === "player" ? "You win!" : "Your opponent wins!"

  const playAgain = () => {
    dispatch(userPlay({ action: "new-game", cards: [] }))
    dispatch(clearFinalBreakdown())
  }

  const backToMenu = () => {
    thePlayer.resetForNewSession()
    toast.dismiss()
    dispatch(resetGameUi())
    navigate("/")
  }

  return (
    <Modal
      show
      size="lg"
      backdrop="static"
      centered
      aria-labelledby="gameover-title"
    >
      <Modal.Header>
        <Modal.Title id="gameover-title">{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="gameover-meta">
          {breakdown.rounds} {breakdown.rounds === 1 ? "round" : "rounds"} · {DIFFICULTY_LABELS[breakdown.difficulty]}
        </p>
        <div className="gameover-grid">
          <BreakdownColumn title="You" data={breakdown.player} />
          <BreakdownColumn title="Opponent" data={breakdown.opponent} />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={playAgain}>Play Again</Button>
        <Button variant="outline-secondary" onClick={backToMenu}>Back to Menu</Button>
      </Modal.Footer>
    </Modal>
  )
}
