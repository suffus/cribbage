import { CribbageBoard, Peg } from '../CribbageBoard'
import { ScoreExplanation } from '../ScoreExplanation'
import { HandScoringExercise } from './HandScoringExercise'
import { SelectableHand } from './SelectableHand'
import { StdDeck, cardKey } from '../../app/entities'
import type { GuidedRound } from '../../features/tutorial/guidedRound'
import type { GuidedRoundView as View } from '../../features/tutorial/guidedRound'
import type { ScoreScenario } from '../../features/tutorial/tutorialTypes'
import type { RunnerAction, StepState } from '../../features/tutorial/tutorialReducer'
import { specToCard } from '../../features/tutorial/tutorialCards'
import { useState } from 'react'

const deck = new StdDeck("rc")

export type GuidedRoundViewProps = {
  round: GuidedRound
  view: View
  step: StepState
  dispatch: (action: RunnerAction) => void
  onChange: () => void
}

export function GuidedRoundView({ round, view, step, dispatch, onChange }: GuidedRoundViewProps) {
  const [discardIds, setDiscardIds] = useState<string[]>([])
  const [playId, setPlayId] = useState<string | null>(null)
  const playerPeg = new Peg(0, view.pegPoints.player)
  const opponentPeg = new Peg(1, view.pegPoints.opponent)

  const refresh = () => {
    onChange()
    if (view.complete) {
      dispatch({ type: "complete-guided-round" })
    }
  }

  const restart = () => {
    round.reset()
    setDiscardIds([])
    setPlayId(null)
    onChange()
  }

  const countHand = view.countTask?.hand ?? []
  const countScenario: ScoreScenario | null = view.countTask && countHand.length === 4 ? {
    id: "guided-count",
    concepts: ["fifteens"],
    hand: [
      [countHand[0].suit, countHand[0].rank],
      [countHand[1].suit, countHand[1].rank],
      [countHand[2].suit, countHand[2].rank],
      [countHand[3].suit, countHand[3].rank],
    ],
    starter: view.countTask.starter ? [view.countTask.starter.suit, view.countTask.starter.rank] : null,
    isCrib: view.countTask.isCrib,
    prompt: view.coach,
    hints: ["Find every combination.", "Look at fifteens first.", "Select one complete group."],
  } : null

  return (
    <div>
      <div className="training-notice">
        <strong>Training deal.</strong> {view.trainingNotice} You can restart this round at any time —
        and refreshing the page will restart it from the deal.
      </div>
      <p><strong>{view.cribOwner === "you" ? "You deal, so the crib is yours." : "They deal, so the crib is theirs."}</strong></p>

      {view.awaiting === "error" ? (
        <div className="error-box" role="status" aria-live="polite">
          <h3>This training deal could not continue</h3>
          <p>The round stopped at {view.coach}. Restart the deal and it will replay from the beginning.</p>
        </div>
      ) : null}

      <div className="guided-round-meta">
        <CribbageBoard playerPeg={playerPeg} opponentPeg={opponentPeg} />
        <p>You {view.scores.player} · Them {view.scores.opponent}</p>
      </div>

      {view.starter ? (
        <SelectableHand
          deck={deck}
          label="Starter"
          mode="none"
          cards={[{ card: view.starter, cardId: cardKey(specToCard([view.starter.suit, view.starter.rank])), state: "idle" }]}
        />
      ) : null}

      {view.awaiting === "discard" ? (
        <>
          <SelectableHand
            deck={deck}
            label="Choose two cards for the crib"
            mode="checkbox"
            cards={view.playerHand.map((card) => {
              const id = cardKey(specToCard([card.suit, card.rank]))
              return { card, cardId: id, state: discardIds.includes(id) ? "selected" : "idle" }
            })}
            onToggle={(id) => setDiscardIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])}
          />
          <button
            type="button"
            className="btn btn-warning"
            disabled={discardIds.length !== 2}
            onClick={() => {
              const result = round.submitDiscard(discardIds)
              if (result.ok) {
                setDiscardIds([])
                refresh()
              }
            }}
          >
            Confirm two discards
          </button>
        </>
      ) : null}

      {view.awaiting === "play-card" ? (
        <>
          <div className="peg-strip">
            <span className="count-chip">Count: {view.count}</span>
          </div>
          <SelectableHand
            deck={deck}
            label="Your turn — choose one card"
            mode="radio"
            cards={view.playerHand.map((card) => {
              const id = cardKey(specToCard([card.suit, card.rank]))
              const over = view.count + specToCard([card.suit, card.rank]).value > 31
              return {
                card,
                cardId: id,
                state: over ? "disabled" : playId === id ? "selected" : "idle",
              }
            })}
            onToggle={(id) => setPlayId(id)}
          />
          <button
            type="button"
            className="btn btn-warning"
            disabled={!playId}
            onClick={() => {
              if (!playId) {
                return
              }
              const result = round.submitPlay(playId)
              if (result.ok) {
                setPlayId(null)
                refresh()
              }
            }}
          >
            Play this card
          </button>
        </>
      ) : null}

      {view.awaiting === "count-hand" && countScenario ? (
        <>
          <HandScoringExercise
            scenario={countScenario}
            step={step}
            mode="practice"
            dispatch={dispatch}
          />
          {step.status === "complete" ? (
            <button type="button" className="btn btn-warning" onClick={() => { round.completeCount(); refresh() }}>
              Continue
            </button>
          ) : null}
        </>
      ) : null}

      {view.awaiting === "acknowledge" ? (
        <button type="button" className="btn btn-warning" onClick={() => { round.acknowledge(); refresh() }}>
          Continue
        </button>
      ) : null}

      {view.opponentHand.length > 0 ? (
        <ScoreExplanation
          title="Opponent"
          hand={[...view.opponentHand]}
          starter={view.starter}
          isCrib={false}
          total={view.scores.opponent}
          variant="list"
        />
      ) : null}
      {view.crib.length > 0 && view.awaiting !== "count-hand" ? (
        <ScoreExplanation
          title="Crib"
          hand={[...view.crib]}
          starter={view.starter}
          isCrib
          total={view.scores.player}
          variant="list"
        />
      ) : null}

      <h3 className="tutorial-subhead">This round so far</h3>
      <ul className="roundlog">
        {view.log.map((entry) => (
          <li key={entry.id}>
            <span>{entry.text} <span className="who">{entry.who}</span></span>
            <span className="pts">{entry.points}</span>
          </li>
        ))}
      </ul>

      <div className="btn-row" style={{ marginTop: "0.8rem" }}>
        <button type="button" className="btn btn-outline-light" onClick={restart}>
          Restart this round
        </button>
      </div>
    </div>
  )
}
