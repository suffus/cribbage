import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { StdDeck } from '../app/entities'
import { ScoreBreakdownModal } from './ScoreBreakdownModal'

const twentyNineHand = [
  { suit: "hearts" as const, rank: 5 as const },
  { suit: "clubs" as const, rank: 5 as const },
  { suit: "diamonds" as const, rank: 5 as const },
  { suit: "spades" as const, rank: 11 as const },
]
const starter = { suit: "spades" as const, rank: 5 as const }

function renderBreakdown(
  overrides: Partial<ComponentProps<typeof ScoreBreakdownModal>> = {},
) {
  const onClose = overrides.onClose ?? vi.fn()
  const view = render(
    <ScoreBreakdownModal
      title="Your hand"
      hand={twentyNineHand}
      starter={starter}
      isCrib={false}
      total={29}
      deck={new StdDeck("rc")}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { ...view, onClose }
}

describe("ScoreBreakdownModal", () => {
  it("shows each combination with miniature cards and the ledger total", () => {
    renderBreakdown()
    const dialog = screen.getByRole("dialog")
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText("Your hand")).toBeInTheDocument()
    expect(screen.getByText("Four of a kind")).toBeInTheDocument()
    expect(screen.getByText(/Nobs/)).toBeInTheDocument()
    expect(screen.getByLabelText("Total 29")).toBeInTheDocument()
    expect(dialog.querySelectorAll("img.scoreBreakdown-card").length).toBeGreaterThan(4)
    expect(dialog.querySelector(".scoreBreakdown-dialog, .modal-dialog")).toBeTruthy()
    expect(document.querySelector(".scoreBreakdown-dialog")).toBeInTheDocument()
  })

  it("closes from the footer button", async () => {
    const user = userEvent.setup()
    const { onClose } = renderBreakdown()
    const closeButtons = screen.getAllByRole("button", { name: "Close" })
    await user.click(closeButtons[closeButtons.length - 1])
    expect(onClose).toHaveBeenCalled()
  })

  it("shows an empty-count message when nothing scored", () => {
    renderBreakdown({
      hand: [
        { suit: "hearts", rank: 2 },
        { suit: "clubs", rank: 4 },
        { suit: "diamonds", rank: 6 },
        { suit: "spades", rank: 8 },
      ],
      starter: { suit: "clubs", rank: 13 },
      total: 0,
    })
    expect(screen.getByText("Nothing scored in this hand.")).toBeInTheDocument()
    expect(screen.getByLabelText("Total 0")).toBeInTheDocument()
  })
})
