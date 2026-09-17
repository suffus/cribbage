import { useState } from 'react'
import { Button, Modal } from 'react-bootstrap'
import {
  DIFFICULTY_DESCRIPTIONS,
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  type Difficulty,
} from '../app/difficulty'
import { savePreferences } from '../app/persistence'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { setDifficulty } from '../features/game/gameSlice'

export function DifficultyModal() {
  const dispatch = useAppDispatch()
  const current = useAppSelector((s) => s.game.difficulty)
  const [chosen, setChosen] = useState<Difficulty>(current)

  const confirm = () => {
    dispatch(setDifficulty(chosen))
    savePreferences({ difficulty: chosen })
  }

  return (
    <Modal
      show
      backdrop="static"
      keyboard={false}
      centered
      aria-labelledby="difficulty-title"
    >
      <Modal.Header>
        <Modal.Title id="difficulty-title">Choose your opponent</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div role="radiogroup" aria-labelledby="difficulty-title" className="difficulty-options">
          {DIFFICULTY_ORDER.map((level) => (
            <label key={level} className={`difficulty-option${chosen === level ? " is-selected" : ""}`}>
              <input
                type="radio"
                name="difficulty"
                value={level}
                checked={chosen === level}
                onChange={() => setChosen(level)}
              />
              <span className="difficulty-option-copy">
                <strong>{DIFFICULTY_LABELS[level]}</strong>
                <span>{DIFFICULTY_DESCRIPTIONS[level]}</span>
              </span>
            </label>
          ))}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="warning" onClick={confirm}>Start Game</Button>
      </Modal.Footer>
    </Modal>
  )
}
