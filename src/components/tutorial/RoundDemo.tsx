import { ScoreExplanation } from '../ScoreExplanation'
import { SelectableHand } from './SelectableHand'
import { TrickRow } from './TrickRow'
import { TutorialBoard } from './TutorialBoard'
import { StdDeck, cardKey } from '../../app/entities'
import type { RoundDemo, DemoView, DemoBreakdown } from '../../features/tutorial/roundDemo'
import { specToCard } from '../../features/tutorial/tutorialCards'

const deck = new StdDeck("rc")

export type RoundDemoProps = {
  demo: RoundDemo
  view: DemoView
  onChange: () => void
}

function advanceLabel(view: DemoView): string {
  switch (view.stage) {
    case "deal":
      // R1: once all twelve cards are out, the next click actually resolves
      // both discards — label the button for what it is about to do.
      return view.playerHand.length + view.opponentHand.length >= 12
        ? "Discard two cards for the crib"
        : "Deal the next card"
    case "discard":
      return "Cut for the starter"
    case "starter":
      return "Start the play"
    case "pegging":
      // R1: once both hands are fully played, the next click actually
      // starts the count — label it for that, not for another play.
      return view.playerHand.length === 0 && view.opponentHand.length === 0
        ? (view.handNumber === 1 ? "Count the first hand" : "Count this hand")
        : "Play the next card"
    case "show":
      return "Count the next hand"
    case "board":
      // R6/R7: the same recap beat sits after both hands — only the label
      // (and the destination) differ.
      return view.handNumber === 1 ? "Continue to hand 2" : "See the final score"
    case "done":
      // R8: the demonstration is replayable, not a dead end.
      return "See again"
  }
}

function ShowHand({ slot }: { slot: DemoBreakdown }) {
  return (
    <div className="round-demo-show-hand">
      <div className="round-demo-show-cards">
        {/* The starter comes first with a "+" before the hand, since every
            hand (and the crib) is counted together with it as a fifth
            card — without it, the totals underneath would not make sense. */}
        {slot.starter ? (
          <SelectableHand
            deck={deck}
            label="Starter"
            mode="none"
            cards={[{ card: slot.starter, cardId: cardKey(specToCard([slot.starter.suit, slot.starter.rank])), state: "idle" }]}
          />
        ) : null}
        <span className="round-demo-plus" aria-hidden="true">+</span>
        <SelectableHand
          deck={deck}
          label={slot.title}
          mode="none"
          cards={slot.hand.map((card) => ({
            card,
            cardId: cardKey(specToCard([card.suit, card.rank])),
            state: "idle",
          }))}
        />
      </div>
      {slot.revealed ? (
        <ScoreExplanation
          hand={[...slot.hand]}
          starter={slot.starter}
          isCrib={slot.isCrib}
          total={slot.total}
          title={slot.title}
          variant="list"
        />
      ) : null}
    </div>
  )
}

export function RoundDemoView({ demo, view, onChange }: RoundDemoProps) {
  const dealPhase = view.stage === "deal" || view.stage === "discard" || view.stage === "starter" || view.stage === "pegging"
  const board = (
    <TutorialBoard
      playerPegPoints={view.pegPoints.player}
      opponentPegPoints={view.pegPoints.opponent}
      playerScore={view.scores.player}
      opponentScore={view.scores.opponent}
    />
  )

  return (
    <div>
      <p className="meta">Hand {view.handNumber} of 2 — {view.dealer === "you" ? "you deal" : "they deal"}.</p>

      {dealPhase ? (
        <>
          {/* R3: the opponent's hand stays face down until the show, just as
              it would in a real game — only the cards they actually play are
              ever visible, one at a time, in the trick row below. */}
          <SelectableHand
            deck={deck}
            label="Their cards"
            mode="none"
            faceDown
            cards={view.opponentHand.map((card) => ({
              card,
              cardId: cardKey(specToCard([card.suit, card.rank])),
              state: "idle",
            }))}
          />

          {view.crib.length > 0 ? (
            // The crib stays face down until the show, as it would in a
            // real game — it is only turned over once it is counted.
            <SelectableHand
              deck={deck}
              label="The crib"
              mode="none"
              faceDown
              cards={view.crib.map((card) => ({
                card,
                cardId: cardKey(specToCard([card.suit, card.rank])),
                state: "idle",
              }))}
            />
          ) : null}

          {view.starter ? (
            <SelectableHand
              deck={deck}
              label="Starter"
              mode="none"
              cards={[{ card: view.starter, cardId: cardKey(specToCard([view.starter.suit, view.starter.rank])), state: "idle" }]}
            />
          ) : null}

          <SelectableHand
            deck={deck}
            label="Your cards"
            mode="none"
            cards={view.playerHand.map((card) => ({
              card,
              cardId: cardKey(specToCard([card.suit, card.rank])),
              state: "idle",
            }))}
          />
        </>
      ) : null}

      {view.stage === "pegging" ? (
        // R2: name the board for what it shows during the play, instead of
        // leaving it as the one unlabelled panel next to "Their cards", "The
        // crib" and "Starter".
        <section aria-labelledby="the-play-heading">
          <h3 id="the-play-heading">The Play (or Pegging)</h3>
          {view.trick.length > 0 || view.lastTrick.length > 0 ? (
            <TrickRow
              cards={view.trick}
              count={view.count}
              label="On the table"
              previous={view.lastTrick.length > 0 ? { cards: view.lastTrick, reason: view.lastTrickReason } : undefined}
            />
          ) : null}
          {board}
        </section>
      ) : view.stage !== "show" ? board : null}

      {view.stage === "show" ? (
        // R5: all three hands face up together, each with its own
        // explanation appearing directly underneath once it has been
        // counted — not bundled at the bottom of the column.
        <>
          {view.show.nonDealer ? <ShowHand slot={view.show.nonDealer} /> : null}
          {view.show.dealer ? <ShowHand slot={view.show.dealer} /> : null}
          {view.show.crib ? <ShowHand slot={view.show.crib} /> : null}
        </>
      ) : null}

      <div className="btn-row">
        <button
          type="button"
          className="btn btn-outline-light"
          disabled={view.atStart}
          onClick={() => { demo.back(); onChange() }}
        >
          Back one step
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => { demo.reset(); onChange() }}
        >
          Start again
        </button>
        <button
          type="button"
          className="btn btn-warning"
          onClick={() => {
            if (view.stage === "done") {
              demo.reset()
            } else {
              demo.advance()
            }
            onChange()
          }}
        >
          {advanceLabel(view)}
        </button>
      </div>

      <ul className="roundlog">
        {view.log.map((entry) => (
          <li key={entry.id}>
            {entry.who === "you" ? "You" : "They"}: {entry.text}
            {entry.points > 0 ? ` — ${entry.points}` : ""}
          </li>
        ))}
      </ul>
    </div>
  )
}
