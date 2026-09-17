import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useReducer, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Card, cardKey as entityCardKey, cardName } from '../../app/entities'
import { scoreHandDetailed } from '../../app/game'
import { GuidedRound } from '../../features/tutorial/guidedRound'
import type { GuidedRoundView as View } from '../../features/tutorial/guidedRound'
import type { PCard } from '../../features/game/gameSlice'
import { ROUND_SCRIPTS } from '../../features/tutorial/scenarios'
import { specToCard } from '../../features/tutorial/tutorialCards'
import { initialRunnerState, makeTutorialReducer } from '../../features/tutorial/tutorialReducer'
import type { Lesson } from '../../features/tutorial/tutorialTypes'
import { GuidedRoundView } from './GuidedRoundView'

const emptyStep = {
  stepId: "x", selected: [], found: [], attempts: 0, hintLevel: 0 as const,
  revealed: 0, status: "in-progress" as const, feedback: null, earned: 0, subIndex: 0,
  submitted: false,
}

function baseView(overrides: Partial<View>): View {
  return {
    phase: "deal",
    stage: "playing",
    awaiting: "acknowledge",
    coach: "Coach says hello.",
    trainingNotice: "This is a training deal.",
    cribOwner: "you",
    playerHand: [],
    playerHandIds: [],
    opponentCardCount: 0,
    opponentHand: [],
    playingSequence: [],
    playingSequenceOwners: [],
    count: 0,
    starter: null,
    crib: [],
    scores: { player: 0, opponent: 0 },
    pegPoints: { player: [0, -1, -1], opponent: [0, -1, -1] },
    countTask: null,
    showScores: { opponentHand: -1, crib: -1 },
    lastTrick: [],
    lastTrickOwners: [],
    lastTrickReason: "",
    log: [],
    complete: false,
    ...overrides,
  }
}

function fakeRound(): GuidedRound {
  return {
    submitDiscard: vi.fn(() => ({ ok: true })),
    submitPlay: vi.fn(() => ({ ok: true })),
    completeCount: vi.fn(),
    acknowledge: vi.fn(),
    letOpponentPlay: vi.fn(),
    reset: vi.fn(),
    view: vi.fn(() => baseView({})),
  } as unknown as GuidedRound
}

describe("GuidedRoundView", () => {
  it("renders the error state (S-G6/error-restart) and still offers Restart this round", () => {
    const round = fakeRound()
    const onChange = vi.fn()
    const view = baseView({ awaiting: "error", coach: "the training deal broke" })
    render(<GuidedRoundView round={round} view={view} step={emptyStep} dispatch={vi.fn()} onChange={onChange} />)
    expect(screen.getByRole("heading", { name: /could not continue/i })).toBeInTheDocument()
    expect(screen.getByText(/the training deal broke/i)).toBeInTheDocument()
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("restarting calls round.reset() and onChange, from any state including error", async () => {
    const round = fakeRound()
    const onChange = vi.fn()
    const user = userEvent.setup()
    const view = baseView({ awaiting: "error" })
    render(<GuidedRoundView round={round} view={view} step={emptyStep} dispatch={vi.fn()} onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: /restart this round/i }))
    expect(round.reset).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalled()
  })

  it("disables an over-31 card during play-card and plays a legal one", async () => {
    const round = fakeRound()
    const onChange = vi.fn()
    const user = userEvent.setup()
    const view = baseView({
      awaiting: "play-card",
      count: 25,
      playerHand: [
        { suit: "hearts", rank: 13 }, // king, value 10 -> 25+10=35, over 31
        { suit: "clubs", rank: 2 },   // 25+2=27, legal
      ],
    })
    render(<GuidedRoundView round={round} view={view} step={emptyStep} dispatch={vi.fn()} onChange={onChange} />)
    expect(screen.getByRole("radio", { name: /king of hearts/i })).toBeDisabled()
    const legal = screen.getByRole("radio", { name: /two of clubs/i })
    expect(legal).toBeEnabled()
    await user.click(legal)
    await user.click(screen.getByRole("button", { name: /play this card/i }))
    expect(round.submitPlay).toHaveBeenCalledWith("2C")
    expect(onChange).toHaveBeenCalled()
  })

  it("confirms a two-card discard", async () => {
    const round = fakeRound()
    const onChange = vi.fn()
    const user = userEvent.setup()
    const view = baseView({
      awaiting: "discard",
      playerHand: [
        { suit: "hearts", rank: 5 }, { suit: "clubs", rank: 6 },
        { suit: "diamonds", rank: 7 }, { suit: "spades", rank: 8 },
      ],
    })
    render(<GuidedRoundView round={round} view={view} step={emptyStep} dispatch={vi.fn()} onChange={onChange} />)
    expect(screen.getByRole("button", { name: /confirm two discards/i })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: /five of hearts/i }))
    await user.click(screen.getByRole("button", { name: /six of clubs/i }))
    await user.click(screen.getByRole("button", { name: /confirm two discards/i }))
    expect(round.submitDiscard).toHaveBeenCalledWith(["5H", "6C"])
    expect(onChange).toHaveBeenCalled()
  })

  it("acknowledge state calls round.acknowledge() and onChange on Continue", async () => {
    const round = fakeRound()
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <GuidedRoundView
        round={round}
        view={baseView({ awaiting: "acknowledge" })}
        step={emptyStep}
        dispatch={vi.fn()}
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole("button", { name: /continue/i }))
    expect(round.acknowledge).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalled()
  })

  it("shows the played trick with each card attributed during pegging", () => {
    const round = fakeRound()
    const onChange = vi.fn()
    const view = baseView({
      phase: "pegging",
      awaiting: "play-card",
      count: 11,
      playingSequence: [
        { suit: "hearts", rank: 7 },
        { suit: "diamonds", rank: 4 },
      ],
      playingSequenceOwners: ["you", "opponent"],
      playerHand: [
        { suit: "clubs", rank: 2 },
        { suit: "spades", rank: 3 },
      ],
    })
    render(<GuidedRoundView round={round} view={view} step={emptyStep} dispatch={vi.fn()} onChange={onChange} />)
    expect(screen.getByText(/seven of hearts, played by you/i)).toBeInTheDocument()
    expect(screen.getByText(/four of diamonds, played by them/i)).toBeInTheDocument()
    expect(screen.getAllByText(/^Count: 11$/)).toHaveLength(1)
  })

  it("shows Continue only once every group in the count has been found", async () => {
    const round = fakeRound()
    const onChange = vi.fn()
    const user = userEvent.setup()
    const countHand: PCard[] = [
      { suit: "hearts", rank: 5 }, { suit: "clubs", rank: 6 },
      { suit: "diamonds", rank: 7 }, { suit: "spades", rank: 8 },
    ]
    const view = baseView({
      awaiting: "count-hand",
      countTask: { hand: countHand, starter: null, isCrib: false, total: 0 },
    })
    const requiredIds = scoreHandDetailed(
      countHand.map((c) => specToCard([c.suit, c.rank] as [never, never])),
      undefined,
      false,
    ).groups.map((g) => g.id)
    const { rerender } = render(
      <GuidedRoundView round={round} view={view} step={{ ...emptyStep, found: [] }} dispatch={vi.fn()} onChange={onChange} />,
    )
    expect(screen.queryByRole("button", { name: /^continue$/i })).not.toBeInTheDocument()
    rerender(
      <GuidedRoundView
        round={round}
        view={view}
        step={{ ...emptyStep, found: requiredIds }}
        dispatch={vi.fn()}
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole("button", { name: /^continue$/i }))
    expect(round.completeCount).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalled()
  })

  it("renders exactly one 'Starter' box during count-hand, and it is the selectable one", () => {
    const round = fakeRound()
    const view = baseView({
      awaiting: "count-hand",
      starter: { suit: "diamonds", rank: 8 },
      countTask: {
        hand: [
          { suit: "spades", rank: 5 }, { suit: "clubs", rank: 6 },
          { suit: "hearts", rank: 7 }, { suit: "spades", rank: 2 },
        ],
        starter: { suit: "diamonds", rank: 8 },
        isCrib: false,
        total: 10,
      },
    })
    render(<GuidedRoundView round={round} view={view} step={emptyStep} dispatch={vi.fn()} onChange={vi.fn()} />)
    // Previously there were two boxes labelled "Starter" on screen at once —
    // GuidedRoundView's own static, non-interactive one, plus
    // HandScoringExercise's selectable one underneath. Only the second
    // should render; the starter counts as a fifth card here and a learner
    // must be able to click it (e.g. to complete a run that only becomes a
    // run once the starter is included).
    expect(screen.getAllByText("Starter")).toHaveLength(1)
    expect(screen.getByRole("button", { name: /^eight of diamonds/i })).toBeInTheDocument()
  })

  it("names the missing card instead of a dead-end retry when a selection is a fragment of a longer run (5-6-7 out of 5-6-7-8)", async () => {
    const round = fakeRound()
    const user = userEvent.setup()
    const lesson: Lesson = {
      id: "t", title: "t", estimatedMinutes: 1, concepts: ["runs"],
      steps: [{ kind: "guided-round", id: "step", scriptId: "first-round" }],
    }
    function LiveHost() {
      const [state, dispatch] = useReducer(makeTutorialReducer(lesson), initialRunnerState(lesson))
      const view = baseView({
        awaiting: "count-hand",
        starter: { suit: "diamonds", rank: 8 },
        countTask: {
          hand: [
            { suit: "spades", rank: 5 }, { suit: "clubs", rank: 6 },
            { suit: "hearts", rank: 7 }, { suit: "spades", rank: 2 },
          ],
          starter: { suit: "diamonds", rank: 8 },
          isCrib: false,
          total: 10,
        },
      })
      return (
        <div>
          <p data-testid="feedback">{state.step.feedback?.text ?? ""}</p>
          <GuidedRoundView round={round} view={view} step={state.step} dispatch={dispatch} onChange={vi.fn()} />
        </div>
      )
    }
    render(<LiveHost />)
    await user.click(screen.getByRole("button", { name: /^five of spades/i }))
    await user.click(screen.getByRole("button", { name: /^six of clubs/i }))
    await user.click(screen.getByRole("button", { name: /^seven of hearts/i }))
    await user.click(screen.getByRole("button", { name: /^count selected cards/i }))
    // scoreHandDetailed only ever emits the run of four (5-6-7-8), never
    // also a run of three inside it — so 5-6-7 alone can never be credited,
    // no matter how many times it is resubmitted. The feedback must say
    // what to add, not the old generic "may already be counted" hedge.
    expect(screen.getByTestId("feedback")).toHaveTextContent(/add eight of diamonds to complete it/i)
    expect(screen.getByTestId("feedback")).not.toHaveTextContent(/may already be counted/i)

    await user.click(screen.getByRole("button", { name: /^clear selection/i }))
    await user.click(screen.getByRole("button", { name: /^five of spades/i }))
    await user.click(screen.getByRole("button", { name: /^six of clubs/i }))
    await user.click(screen.getByRole("button", { name: /^seven of hearts/i }))
    await user.click(screen.getByRole("button", { name: /^eight of diamonds/i }))
    await user.click(screen.getByRole("button", { name: /^count selected cards/i }))
    expect(screen.getByTestId("feedback")).toHaveTextContent(/run of four/i)
  })

  it("Show me the count reveals the whole count and then offers Continue", async () => {
    const round = fakeRound()
    const user = userEvent.setup()
    const lesson: Lesson = {
      id: "t", title: "t", estimatedMinutes: 1, concepts: ["fifteens"],
      steps: [{ kind: "guided-round", id: "step", scriptId: "first-round" }],
    }
    function LiveHost() {
      const [state, dispatch] = useReducer(makeTutorialReducer(lesson), initialRunnerState(lesson))
      const view = baseView({
        awaiting: "count-hand",
        countTask: {
          hand: [
            { suit: "hearts", rank: 5 }, { suit: "clubs", rank: 6 },
            { suit: "diamonds", rank: 7 }, { suit: "spades", rank: 8 },
          ],
          starter: null,
          isCrib: false,
          total: 0,
        },
      })
      return <GuidedRoundView round={round} view={view} step={state.step} dispatch={dispatch} onChange={vi.fn()} />
    }
    render(<LiveHost />)
    await user.click(screen.getByRole("button", { name: /show me the count/i }))
    expect(screen.getByRole("button", { name: /^continue$/i })).toBeInTheDocument()
  })

  it("offers Let them play while the opponent is to act, and nothing else advances", async () => {
    const round = fakeRound()
    const onChange = vi.fn()
    const user = userEvent.setup()
    const view = baseView({ phase: "pegging", awaiting: "opponent-play" })
    render(<GuidedRoundView round={round} view={view} step={emptyStep} dispatch={vi.fn()} onChange={onChange} />)
    const button = screen.getByRole("button", { name: /let the opponent play their card/i })
    expect(button).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^play this card$/i })).toBeNull()
    await user.click(button)
    expect(round.letOpponentPlay).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalled()
  })

  it("keeps the finished trick on screen with its reason", () => {
    const round = fakeRound()
    const onChange = vi.fn()
    const view = baseView({
      phase: "pegging",
      awaiting: "opponent-play",
      playingSequence: [],
      lastTrick: [
        { suit: "hearts", rank: 7 },
        { suit: "clubs", rank: 10 },
      ],
      lastTrickOwners: ["you", "opponent"],
      lastTrickReason: "That made 31 — 2 points. The count resets to 0.",
    })
    render(<GuidedRoundView round={round} view={view} step={emptyStep} dispatch={vi.fn()} onChange={onChange} />)
    expect(screen.getByText(/that made 31 — 2 points\. the count resets to 0\./i)).toBeInTheDocument()
    expect(screen.getByRole("list", { name: /previous trick/i })).toBeInTheDocument()
    expect(screen.getByText(/nothing played yet/i)).toBeInTheDocument()
  })
})

describe("GuidedRoundView end to end", () => {
  function RoundHost({ scriptId, roundRef, onComplete }: {
    scriptId: string
    roundRef: { current: GuidedRound | null }
    onComplete: () => void
  }) {
    const lesson: Lesson = {
      id: "t", title: "t", estimatedMinutes: 1, concepts: ["fifteens"],
      steps: [{ kind: "guided-round", id: "step", scriptId }],
    }
    const [state, dispatch] = useReducer(makeTutorialReducer(lesson), initialRunnerState(lesson))
    const [roundView, setRoundView] = useState(0)
    if (!roundRef.current) {
      roundRef.current = new GuidedRound(ROUND_SCRIPTS[scriptId])
    }
    const round = roundRef.current
    const spyDispatch = (action: Parameters<typeof dispatch>[0]) => {
      if (action.type === "complete-guided-round") {
        onComplete()
      }
      dispatch(action)
    }
    return (
      <>
        <p data-testid="awaiting">{round.view().awaiting}</p>
        <p data-testid="found">{JSON.stringify(state.step.found)}</p>
        <GuidedRoundView
          key={roundView}
          round={round}
          view={round.view()}
          step={state.step}
          dispatch={spyDispatch}
          onChange={() => setRoundView((n) => n + 1)}
        />
      </>
    )
  }

  it.each(["first-round", "second-round"])("completes %s from deal to done", async (scriptId) => {
    const user = userEvent.setup()
    const roundRef: { current: GuidedRound | null } = { current: null }
    let completeCount = 0
    render(<RoundHost scriptId={scriptId} roundRef={roundRef} onComplete={() => { completeCount += 1 }} />)

    for (let i = 0; i < 200; i += 1) {
      const view = roundRef.current!.view()
      if (view.awaiting === "done") {
        break
      }
      if (view.awaiting === "acknowledge") {
        await user.click(screen.getByRole("button", { name: /^continue$/i }))
        continue
      }
      if (view.awaiting === "opponent-play") {
        await user.click(screen.getByRole("button", { name: /let the opponent play their card/i }))
        continue
      }
      if (view.awaiting === "discard") {
        const fieldset = screen.getByRole("group", { name: /choose two cards for the crib/i })
        const cardButtons = within(fieldset).getAllByRole("button")
        await user.click(cardButtons[0])
        await user.click(cardButtons[1])
        await user.click(screen.getByRole("button", { name: /confirm two discards/i }))
        continue
      }
      if (view.awaiting === "play-card") {
        const radios = screen.getAllByRole("radio")
        const legal = radios.find((r) => !(r as HTMLButtonElement).disabled)
        await user.click(legal!)
        await user.click(screen.getByRole("button", { name: /^play this card$/i }))
        continue
      }
      if (view.awaiting === "count-hand") {
        const countTask = view.countTask!
        const found: string[] = JSON.parse(screen.getByTestId("found").textContent || "[]")
        const cardKeyToName = new Map<string, string>()
        for (const spec of [...countTask.hand, ...(countTask.starter ? [countTask.starter] : [])]) {
          const live = new Card(spec.suit, spec.rank)
          cardKeyToName.set(entityCardKey(live), cardName(live))
        }
        const required = scoreHandDetailed(
          countTask.hand.map((c) => specToCard([c.suit, c.rank] as [never, never])),
          countTask.starter ? specToCard([countTask.starter.suit, countTask.starter.rank] as [never, never]) : undefined,
          countTask.isCrib,
        ).groups
        const nextGroup = required.find((g) => !found.includes(g.id))
        if (nextGroup) {
          for (const cardId of nextGroup.cardIds) {
            const name = cardKeyToName.get(cardId)
            const btn = name ? screen.queryByRole("button", { name: new RegExp(`^${name}, `, "i") }) : null
            if (btn) {
              await user.click(btn)
            }
          }
          await user.click(screen.getByRole("button", { name: /^count selected cards$/i }))
          // The button becomes "Clear selection" once a submission has been
          // graded, so the just-counted cards stay visible for review
          // instead of clearing automatically (RM-5 item 2).
          await user.click(screen.getByRole("button", { name: /^clear selection$/i }))
        } else {
          await user.click(screen.getByRole("button", { name: /^continue$/i }))
        }
        continue
      }
    }

    expect(roundRef.current!.view().awaiting).toBe("done")
    expect(roundRef.current!.view().complete).toBe(true)
    expect(completeCount).toBe(1)
  })
})
