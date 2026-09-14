import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { GuidedRound, GuidedRoundView as View } from '../../features/tutorial/guidedRound'
import { GuidedRoundView } from './GuidedRoundView'

const emptyStep = {
  stepId: "x", selected: [], found: [], attempts: 0, hintLevel: 0 as const,
  revealed: 0, status: "in-progress" as const, feedback: null, earned: 0, subIndex: 0,
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
    count: 0,
    starter: null,
    crib: [],
    scores: { player: 0, opponent: 0 },
    pegPoints: { player: [0, -1, -1], opponent: [0, -1, -1] },
    countTask: null,
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
    reset: vi.fn(),
    view: vi.fn(),
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

  it("shows Continue for count-hand only once the count step is complete, and it completes the count", async () => {
    const round = fakeRound()
    const onChange = vi.fn()
    const user = userEvent.setup()
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
    const { rerender } = render(
      <GuidedRoundView round={round} view={view} step={emptyStep} dispatch={vi.fn()} onChange={onChange} />,
    )
    expect(screen.queryByRole("button", { name: /^continue$/i })).not.toBeInTheDocument()
    rerender(
      <GuidedRoundView
        round={round}
        view={view}
        step={{ ...emptyStep, status: "complete" }}
        dispatch={vi.fn()}
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole("button", { name: /^continue$/i }))
    expect(round.completeCount).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalled()
  })
})
