import { useEffect, useRef, useState } from 'react'
import { StdDeck, cardKey } from '../../app/entities'
import { explainPegPlay } from '../../app/game'
import { SelectableHand } from './SelectableHand'
import { TrickRow } from './TrickRow'
import { TutorialBoard } from './TutorialBoard'
import { specToCard, specsToCards } from '../../features/tutorial/tutorialCards'
import {
  gradePegChoice,
  initPegSequence,
  learnerGo,
  learnerLegalCardIds,
  opponentTurn,
  playLearnerCard,
  type PegSequenceEvent,
  type PegSequenceParty,
  type PegSequenceState,
} from '../../features/tutorial/tutorialGrading'
import type { PegScenario } from '../../features/tutorial/tutorialTypes'
import type { RunnerAction, StepState } from '../../features/tutorial/tutorialReducer'

function ownerOf(party: PegSequenceParty): "you" | "opponent" {
  return party === "learner" ? "you" : "opponent"
}

function calloutText(event: PegSequenceEvent): string {
  return `${event.message} — ${event.points} ${event.points === 1 ? "point" : "points"} to ${event.by === "learner" ? "you" : "them"}.`
}

/** The newly appended scoring event between two states, or `null` when
 *  nothing scored — scans only the tail appended since `prev`. */
function newScoringEvent(prev: PegSequenceState, next: PegSequenceState): PegSequenceEvent | null {
  const appended = next.events.slice(prev.events.length)
  return appended.find((e) => e.points > 0) ?? null
}

export type PeggingExerciseProps = {
  scenario: PegScenario
  step: StepState
  dispatch: (action: RunnerAction) => void
}

const deck = new StdDeck("rc")

function PlaySequenceExercise({ scenario, dispatch }: { scenario: PegScenario; dispatch: (action: RunnerAction) => void }) {
  const [state, setState] = useState<PegSequenceState>(() => initPegSequence(scenario))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reportedDone = useRef(false)

  // The scripted exchange finishes inside PegSequenceState, not through a
  // reducer "submit" — report it exactly once, mirroring how GuidedRoundView
  // reports "complete-guided-round".
  useEffect(() => {
    if (state.done && !reportedDone.current) {
      reportedDone.current = true
      dispatch({ type: "complete-peg-sequence", earned: state.earned })
    }
  }, [state.done, state.earned, dispatch])

  const legalIds = learnerLegalCardIds(scenario, state)
  const canPlay = state.turn === "learner" && !state.done && legalIds.length > 0
  const mustGo = state.turn === "learner" && !state.done && legalIds.length === 0
  const callout = [...state.events].reverse().find((e) => e.points > 0) ?? null

  const announce = (prev: PegSequenceState, next: PegSequenceState) => {
    const event = newScoringEvent(prev, next)
    if (event) {
      dispatch({ type: "peg-note", tone: "good", text: calloutText(event) })
    }
  }

  return (
    <div>
      <TrickRow
        cards={state.active.map((card, index) => ({
          card: { suit: card.suit, rank: card.rank },
          by: ownerOf(state.activeOwners[index]),
        }))}
        count={state.count}
        label="On the table"
        previous={state.lastActive.length > 0 ? {
          cards: state.lastActive.map((card, index) => ({
            card: { suit: card.suit, rank: card.rank },
            by: ownerOf(state.lastActiveOwners[index]),
          })),
          reason: state.lastTrickReason,
        } : undefined}
      />
      <TutorialBoard
        playerPegPoints={state.pegPoints.learner}
        opponentPegPoints={state.pegPoints.opponent}
        playerScore={state.pegPoints.learner[0]}
        opponentScore={state.pegPoints.opponent[0]}
      />
      {callout ? <p className="peg-callout">{calloutText(callout)}</p> : null}

      {state.done ? (
        <p className="coach-math">The exchange is finished. Total from this sequence: {state.earned}.</p>
      ) : (
        <SelectableHand
          deck={deck}
          label={mustGo ? "You have no legal card." : "Your turn — choose one card"}
          mode="radio"
          cards={scenario.hand
            .filter((spec) => state.handRemaining.includes(cardKey(specToCard(spec))))
            .map((spec) => {
              const card = specToCard(spec)
              const cardId = cardKey(card)
              let cardState: "idle" | "selected" | "disabled" = "idle"
              if (state.turn !== "learner") {
                cardState = "disabled"
              } else if (cardId === selectedId) {
                cardState = "selected"
              } else if (!legalIds.includes(cardId)) {
                cardState = "disabled"
              }
              return { card: { suit: card.suit, rank: card.rank }, cardId, state: cardState }
            })}
          onToggle={(id) => {
            setError(null)
            setSelectedId(id)
          }}
        />
      )}

      {!state.done ? (
        <div className="btn-row">
          {state.turn === "opponent" && !state.done ? (
            <button
              type="button"
              className="btn btn-warning"
              aria-label="Let the opponent play their card"
              onClick={() => {
                const next = opponentTurn(state)
                setSelectedId(null)
                setError(null)
                setState(next)
                announce(state, next)
              }}
            >
              Let them play
            </button>
          ) : mustGo ? (
            <button
              type="button"
              className="btn btn-warning"
              onClick={() => {
                setError(null)
                setSelectedId(null)
                const next = learnerGo(state)
                setState(next)
                announce(state, next)
              }}
            >
              Say go
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-warning"
              disabled={!canPlay || !selectedId}
              onClick={() => {
                if (!selectedId) {
                  return
                }
                const result = playLearnerCard(scenario, state, selectedId)
                if (!result.ok) {
                  setError(result.message ?? "That card cannot be played.")
                  return
                }
                setError(null)
                setSelectedId(null)
                setState(result.state)
                announce(state, result.state)
              }}
            >
              Play this card
            </button>
          )}
        </div>
      ) : null}

      {error ? <p className="status retry">{error}</p> : null}

      <ul className="roundlog">
        {state.events.map((event) => (
          <li key={event.id}>
            <span className="who">{event.by === "learner" ? "you" : "opponent"}</span>
            <span>{event.message}</span>
            {event.points > 0 ? <span className="pts">+{event.points}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PeggingExercise({ scenario, step, dispatch }: PeggingExerciseProps) {
  if (scenario.task.kind === "play-sequence") {
    return <PlaySequenceExercise scenario={scenario} dispatch={dispatch} />
  }

  const sequence = specsToCards(scenario.sequence)
  const count = sequence.reduce((s, c) => s + c.value, 0)
  const mode = scenario.task.kind === "select-scoring" ? "radio" : "checkbox"

  const legalMarks = scenario.task.kind === "select-legal"
    ? Object.fromEntries(scenario.hand.map((spec) => {
      const card = specToCard(spec)
      const result = explainPegPlay(sequence, card)
      return [cardKey(card), result]
    }))
    : {}

  return (
    <div>
      <TrickRow
        cards={sequence.map((card) => ({ card: { suit: card.suit, rank: card.rank }, by: "opponent" }))}
        count={count}
        label="On the table"
      />
      <SelectableHand
        deck={deck}
        label={
          scenario.task.kind === "select-legal"
            ? "Which of these can you play?"
            : "Which one scores right now?"
        }
        mode={mode}
        cards={scenario.hand.map((spec) => {
          const card = specToCard(spec)
          const cardId = cardKey(card)
          const result = legalMarks[cardId]
          let state: "idle" | "selected" | "credited" | "hinted" | "disabled" = "idle"
          if (step.selected.includes(cardId)) {
            state = "selected"
          } else if (result && !result.legal && step.status === "complete") {
            state = "disabled"
          }
          return { card: { suit: card.suit, rank: card.rank }, cardId, state }
        })}
        onToggle={(id) => {
          if (mode === "radio") {
            for (const selected of step.selected) {
              if (selected !== id) {
                dispatch({ type: "toggle-card", cardId: selected })
              }
            }
          }
          dispatch({ type: "toggle-card", cardId: id })
        }}
      />
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-warning"
          disabled={step.selected.length === 0}
          onClick={() => dispatch({ type: "submit" })}
        >
          {scenario.task.kind === "select-legal" ? "Check these cards" : "Play this card"}
        </button>
      </div>
      {scenario.task.kind === "select-legal" && step.selected.map((id) => {
        const spec = scenario.hand.find((s) => cardKey(specToCard(s)) === id)
        if (!spec) {
          return null
        }
        const result = gradePegChoice(scenario, scenario.sequence.map(([suit, rank]) => ({ suit, rank })), id)
        return (
          <p key={id} className="meta">
            {id}: {result.legal ? `legal, count ${result.result.newCount}` : `would make ${result.result.newCount}`}
          </p>
        )
      })}
    </div>
  )
}
