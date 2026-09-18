import { PlayNotice } from '../PlayNotice'
import { ScoreExplanation } from '../ScoreExplanation'
import { HandScoringExercise } from './HandScoringExercise'
import { SelectableHand } from './SelectableHand'
import { TrickRow } from './TrickRow'
import type { TrickCard } from './TrickRow'
import { TutorialBoard } from './TutorialBoard'
import { StdDeck, cardKey } from '../../app/entities'
import { scoreHandDetailed } from '../../app/game'
import type { GuidedRound } from '../../features/tutorial/guidedRound'
import type { GuidedRoundView as View } from '../../features/tutorial/guidedRound'
import type { ScoreScenario } from '../../features/tutorial/tutorialTypes'
import type { RunnerAction, StepState } from '../../features/tutorial/tutorialReducer'
import { specToCard, specsToCards } from '../../features/tutorial/tutorialCards'
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
  const trick: TrickCard[] = view.playingSequence.map((card, index) => ({
    card,
    by: view.playingSequenceOwners[index] ?? "opponent",
  }))
  const previousTrick = view.lastTrick.length > 0
    ? {
        cards: view.lastTrick.map((card, index) => ({
          card,
          by: view.lastTrickOwners[index] ?? "opponent",
        })),
        reason: view.lastTrickReason,
      }
    : undefined

  const refresh = () => {
    onChange()
    // Read the round's current state, not the `view` prop: the transition to
    // `complete` and the last user click that causes it happen inside the
    // same handler (e.g. the final acknowledge or completeCount call above),
    // so `view` here is always one render behind and would never see it.
    if (round.view().complete) {
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

  const countRequired = countScenario
    ? scoreHandDetailed(
        specsToCards(countScenario.hand),
        countScenario.starter ? specToCard(countScenario.starter) : undefined,
        countScenario.isCrib,
      ).groups
    : []
  const countComplete = countRequired.length > 0
    && countRequired.every((g) => step.found.includes(g.id))
  const lastScore = [...view.log].reverse().find((entry) => entry.points > 0)
  const scoreToast = lastScore
    ? `${lastScore.who === "you" ? "You" : "Your opponent"} scored ${lastScore.points} for ${lastScore.text}`
    : ""

  return (
    <div>
      <PlayNotice
        message={scoreToast}
        noticeId={lastScore ? Number(lastScore.id.replace(/\D/g, "")) || 0 : 0}
        variant="inline"
      />
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

      {view.starter && view.awaiting !== "count-hand" ? (
        // While counting a hand, `HandScoringExercise` below renders its own
        // "Starter" fieldset — a *selectable* one, since the starter counts
        // as a fifth card and can be part of a fifteen, run, or flush. Also
        // showing this static, non-interactive copy at the same time gave two
        // boxes both labelled "Starter" on screen — one inert, one the card
        // the learner actually needs to click (e.g. a run that only becomes
        // a run once the starter is included). Suppress the static one here
        // so there is exactly one, and it is the clickable one.
        <SelectableHand
          deck={deck}
          label="Starter"
          mode="none"
          cards={[{ card: view.starter, cardId: cardKey(specToCard([view.starter.suit, view.starter.rank])), state: "idle" }]}
        />
      ) : null}

      {view.phase === "pegging" ? (
        <TrickRow cards={trick} count={view.count} label="On the table" previous={previousTrick} />
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
          <SelectableHand
            deck={deck}
            label="Your turn — choose one card"
            mode="radio"
            cards={view.playerHand.map((card) => {
              const id = cardKey(specToCard([card.suit, card.rank]))
              const running = view.count === 31 ? 0 : view.count
              const over = running + specToCard([card.suit, card.rank]).value > 31
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

      {view.awaiting === "opponent-play" ? (
        <button
          type="button"
          className="btn btn-warning"
          aria-label="Let the opponent play their card"
          onClick={() => { round.letOpponentPlay(); refresh() }}
        >
          Let them play
        </button>
      ) : null}

      {view.awaiting === "count-hand" && countScenario ? (
        <>
          <HandScoringExercise
            scenario={countScenario}
            step={step}
            mode="practice"
            dispatch={dispatch}
            submitAs="submit-count"
          />
          <button
            type="button"
            className="btn btn-outline-light"
            onClick={() => dispatch({ type: "reveal-count", scenario: countScenario })}
          >
            Show me the count
          </button>
          {countComplete ? (
            <button
              type="button"
              className="btn btn-warning"
              onClick={() => { round.completeCount(); dispatch({ type: "restart-count" }); refresh() }}
            >
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

      <TutorialBoard
        playerPegPoints={view.pegPoints.player}
        opponentPegPoints={view.pegPoints.opponent}
        playerScore={view.scores.player}
        opponentScore={view.scores.opponent}
      />

      {view.opponentHand.length > 0 ? (
        <ScoreExplanation
          title="Opponent"
          hand={[...view.opponentHand]}
          starter={view.starter}
          isCrib={false}
          total={view.showScores.opponentHand}
          variant="list"
        />
      ) : null}
      {view.crib.length > 0 && view.awaiting !== "count-hand" ? (
        <ScoreExplanation
          title="Crib"
          hand={[...view.crib]}
          starter={view.starter}
          isCrib
          total={view.showScores.crib}
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

      <div className="guided-round-secondary">
        <button type="button" className="btn btn-outline-secondary" onClick={restart}>
          Restart this round
        </button>
      </div>
    </div>
  )
}
