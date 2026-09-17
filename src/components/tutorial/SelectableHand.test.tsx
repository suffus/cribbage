import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StdDeck } from '../../app/entities'
import { SelectableHand } from './SelectableHand'

const deck = new StdDeck("rc")

describe("SelectableHand", () => {
  it("exposes rank, suit, and state on each card button", async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(
      <SelectableHand
        deck={deck}
        label="Choose cards"
        mode="checkbox"
        onToggle={onToggle}
        cards={[
          { card: { suit: "hearts", rank: 5 }, cardId: "5H", state: "idle" },
          { card: { suit: "spades", rank: 11 }, cardId: "JS", state: "selected" },
        ]}
      />,
    )
    expect(screen.getByRole("button", { name: /five of hearts, not selected/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /jack of spades, selected/i })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /five of hearts/i }))
    expect(onToggle).toHaveBeenCalledWith("5H")
  })

  it("toggles via keyboard alone — Tab then Space, then Enter (T3, no custom key handler needed)", async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(
      <SelectableHand
        deck={deck}
        label="Choose cards"
        mode="checkbox"
        onToggle={onToggle}
        cards={[
          { card: { suit: "hearts", rank: 5 }, cardId: "5H", state: "idle" },
          { card: { suit: "spades", rank: 11 }, cardId: "JS", state: "idle" },
        ]}
      />,
    )
    await user.tab()
    expect(screen.getByRole("button", { name: /five of hearts/i })).toHaveFocus()
    await user.keyboard(" ")
    expect(onToggle).toHaveBeenCalledWith("5H")
    await user.tab()
    expect(screen.getByRole("button", { name: /jack of spades/i })).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(onToggle).toHaveBeenCalledWith("JS")
  })

  it("renders static, non-interactive cards for mode='none'", () => {
    render(
      <SelectableHand
        deck={deck}
        label="On the table"
        mode="none"
        cards={[{ card: { suit: "diamonds", rank: 8 }, cardId: "8D", state: "idle" }]}
      />,
    )
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.getByText(/eight of diamonds, not selected/i)).toBeInTheDocument()
  })

  it("renders a face-down card without revealing its rank or suit", () => {
    const { container } = render(
      <SelectableHand
        deck={deck}
        label="Their cards"
        mode="none"
        faceDown
        cards={[{ card: { suit: "diamonds", rank: 8 }, cardId: "8D", state: "idle" }]}
      />,
    )
    expect(screen.getByText("Face-down card")).toBeInTheDocument()
    expect(screen.queryByText(/eight of diamonds/i)).not.toBeInTheDocument()
    expect(container.querySelector("img")).toHaveAttribute("src", deck.getBackImageUri())
  })

  it("names a reused card without disabling it, and still disables an unavailable card", () => {
    render(
      <SelectableHand
        deck={deck}
        label="Cards"
        mode="checkbox"
        onToggle={vi.fn()}
        cards={[
          { card: { suit: "clubs", rank: 9 }, cardId: "9C", state: "credited", creditedCount: 2 },
          { card: { suit: "hearts", rank: 5 }, cardId: "5H", state: "selected", creditedCount: 1 },
          { card: { suit: "diamonds", rank: 4 }, cardId: "4D", state: "hinted" },
          { card: { suit: "spades", rank: 2 }, cardId: "2S", state: "disabled" },
        ]}
      />,
    )
    expect(screen.getByRole("button", { name: /nine of clubs, used in 2 counted combinations, not selected/i })).toBeEnabled()
    expect(screen.getByRole("button", { name: /five of hearts, used in 1 counted combination, selected/i })).toBeEnabled()
    expect(screen.getByRole("button", { name: /four of diamonds, hinted/i })).toBeEnabled()
    expect(screen.getByRole("button", { name: /two of spades, not available/i })).toBeDisabled()
  })
})
