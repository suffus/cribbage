import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RoundDemo } from '../../features/tutorial/roundDemo'
import { RoundDemoView } from './RoundDemo'

function Host({ demo }: { demo: RoundDemo }) {
  const [, setTick] = useState(0)
  return <RoundDemoView demo={demo} view={demo.view()} onChange={() => setTick((n) => n + 1)} />
}

describe("RoundDemoView", () => {
  it("labels the advance button for the current stage", () => {
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    render(<RoundDemoView demo={demo} view={demo.view()} onChange={() => {}} />)
    expect(screen.getByRole("button", { name: /deal the next card/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /back one step/i })).toBeDisabled()
  })

  it("relabels the button to discard once all twelve cards are dealt (R1)", () => {
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    for (let i = 0; i < 12; i++) {
      demo.advance()
    }
    render(<RoundDemoView demo={demo} view={demo.view()} onChange={() => {}} />)
    expect(screen.getByRole("button", { name: /discard two cards for the crib/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /deal the next card/i })).not.toBeInTheDocument()
  })

  it("advances the demo and reports the change", async () => {
    const user = userEvent.setup()
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    const onChange = vi.fn()
    render(<RoundDemoView demo={demo} view={demo.view()} onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: /deal the next card/i }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(demo.view().beatIndex).toBe(1)
  })

  it("shows the opponent's hand and the crib face down during the play (R2/R3)", async () => {
    const user = userEvent.setup()
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    // 12 deals + 1 discard + 1 starter + 2 plays = 16 beats.
    for (let i = 0; i < 16; i++) {
      demo.advance()
    }
    render(<Host demo={demo} />)
    expect(screen.getByRole("group", { name: /your cards/i })).toBeInTheDocument()
    const theirs = screen.getByRole("group", { name: /their cards/i })
    expect(theirs).toBeInTheDocument()
    expect(within(theirs).getAllByText("Face-down card").length).toBeGreaterThan(0)
    expect(within(theirs).queryByText(/of (hearts|diamonds|spades|clubs)/i)).not.toBeInTheDocument()
    // The crib is not revealed until the show either.
    const crib = screen.getByRole("group", { name: /the crib/i })
    expect(within(crib).getAllByText("Face-down card").length).toBeGreaterThan(0)
    // R2: the pegging board is named.
    expect(screen.getByRole("heading", { name: /the play \(or pegging\)/i })).toBeInTheDocument()
    const trick = screen.getByRole("list", { name: /on the table/i })
    expect(within(trick).getByText(/six of diamonds, played by you/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /play the next card/i }))
  })

  it("relabels the button to count the first hand once pegging finishes (R1)", () => {
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    // 12 deals + 1 discard + 1 starter + 8 plays = 22 beats — every card played.
    for (let i = 0; i < 22; i++) {
      demo.advance()
    }
    expect(demo.view().stage).toBe("pegging")
    expect(demo.view().playerHand).toHaveLength(0)
    expect(demo.view().opponentHand).toHaveLength(0)
    render(<RoundDemoView demo={demo} view={demo.view()} onChange={() => {}} />)
    expect(screen.getByRole("button", { name: /count the first hand/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /play the next card/i })).not.toBeInTheDocument()
  })

  it("shows the three hands face up at the count, each with its own explanation underneath (R5)", () => {
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    // 12 deals + 1 discard + 1 starter + 8 plays + 1 show-non-dealer = 23 beats.
    for (let i = 0; i < 23; i++) {
      demo.advance()
    }
    const { container } = render(<RoundDemoView demo={demo} view={demo.view()} onChange={() => {}} />)
    // Not the leftover pegging trick or board.
    expect(screen.queryByRole("heading", { name: /the play \(or pegging\)/i })).not.toBeInTheDocument()
    expect(container.querySelector(".tutorial-board-wrap")).not.toBeInTheDocument()

    const yourHandGroup = screen.getByRole("group", { name: /your hand/i })
    const total = screen.getByLabelText("Total 8")
    const yourHandBlock = total.closest(".round-demo-show-hand")
    expect(yourHandBlock).toContainElement(yourHandGroup)

    // The starter comes first, with a "+" before the hand — the scoring
    // underneath only makes sense with the starter counted alongside it.
    const starterGroups = within(yourHandBlock as HTMLElement).getAllByRole("group", { name: /^starter$/i })
    expect(starterGroups).toHaveLength(1)
    expect(within(yourHandBlock as HTMLElement).getByText("+")).toBeInTheDocument()

    // The dealer's hand and the crib are visible but not yet counted —
    // their cards show, but no "Total" score is disclosed for them yet.
    expect(screen.getByRole("group", { name: /their hand/i })).toBeInTheDocument()
    expect(screen.queryByLabelText("Total 4")).not.toBeInTheDocument()
    expect(screen.getByRole("group", { name: /their crib/i })).toBeInTheDocument()
    expect(screen.queryByLabelText("Total 5")).not.toBeInTheDocument()
    // Each of the three hands gets its own starter + "+", not one shared copy.
    expect(screen.getAllByRole("group", { name: /^starter$/i })).toHaveLength(3)
  })

  it("shows the board with a leapfrogging explanation between hands, and lets the learner continue (R6/R7)", () => {
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    let guard = 0
    while (demo.view().stage !== "board" && guard++ < 200) {
      demo.advance()
    }
    render(<RoundDemoView demo={demo} view={demo.view()} onChange={() => {}} />)
    expect(screen.getByRole("button", { name: /continue to hand 2/i })).toBeInTheDocument()
    // Three-hand show layout is gone; the board is back.
    expect(screen.queryByRole("group", { name: /your hand/i })).not.toBeInTheDocument()
  })

  it("replaces the ended-demonstration message with a replay button (R8)", async () => {
    const user = userEvent.setup()
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    let guard = 0
    while (!demo.view().atEnd && guard++ < 200) {
      demo.advance()
    }
    render(<Host demo={demo} />)
    expect(screen.queryByRole("button", { name: /the demonstration is over/i })).not.toBeInTheDocument()
    const seeAgain = screen.getByRole("button", { name: /see again/i })
    expect(seeAgain).toBeEnabled()
    await user.click(seeAgain)
    expect(demo.view().stage).toBe("deal")
    expect(demo.view().beatIndex).toBe(0)
  })

  it("renders the cribbage board with the cumulative score", () => {
    const demo = new RoundDemo(["demo-hand-1", "demo-hand-2"])
    let guard = 0
    while (!demo.view().atEnd && guard++ < 200) {
      demo.advance()
    }
    render(<RoundDemoView demo={demo} view={demo.view()} onChange={() => {}} />)
    expect(screen.getByText("You 36 · Them 25")).toBeInTheDocument()
  })
})
