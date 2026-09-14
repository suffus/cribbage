import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { ScoreExplanation } from './ScoreExplanation'

const twentyNineHand = [
  { suit: "hearts" as const, rank: 5 as const },
  { suit: "clubs" as const, rank: 5 as const },
  { suit: "diamonds" as const, rank: 5 as const },
  { suit: "spades" as const, rank: 11 as const },
]
const starter = { suit: "spades" as const, rank: 5 as const }

describe("ScoreExplanation", () => {
  it("renders groups and the ledger total for a known hand", () => {
    render(
      <ScoreExplanation
        hand={twentyNineHand}
        starter={starter}
        isCrib={false}
        total={29}
        title="Your hand"
      />,
    )
    expect(screen.getByText("Your hand")).toBeInTheDocument()
    expect(screen.getByLabelText("Total 29")).toBeInTheDocument()
    expect(screen.getByText("Four of a kind")).toBeInTheDocument()
    expect(screen.getByText(/Nobs/)).toBeInTheDocument()
  })

  it("returns null for an empty hand or a negative total", () => {
    const { rerender } = render(
      <ScoreExplanation hand={[]} starter={null} isCrib={false} total={0} />,
    )
    expect(screen.queryByText(/Total/)).not.toBeInTheDocument()
    rerender(
      <ScoreExplanation
        hand={twentyNineHand}
        starter={starter}
        isCrib={false}
        total={-1}
      />,
    )
    expect(screen.queryByText(/Total/)).not.toBeInTheDocument()
  })

  it("shows the prop total when it disagrees with the derived total", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    render(
      <ScoreExplanation
        hand={twentyNineHand}
        starter={starter}
        isCrib={false}
        total={12}
      />,
    )
    expect(screen.getByLabelText("Total 12")).toBeInTheDocument()
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})
