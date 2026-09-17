import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrickRow } from './TrickRow'

describe("TrickRow", () => {
  it("lays the cards in one horizontal list with no nested fieldset", () => {
    const { container } = render(
      <TrickRow
        cards={[
          { card: { suit: "hearts", rank: 7 }, by: "you" },
          { card: { suit: "diamonds", rank: 4 }, by: "opponent" },
        ]}
        count={11}
      />,
    )
    expect(screen.getByText("Count: 11")).toBeInTheDocument()
    const list = screen.getByRole("list", { name: /cards on the table/i })
    expect(within(list).getAllByRole("listitem")).toHaveLength(2)
    expect(container.querySelectorAll("fieldset")).toHaveLength(0)
  })

  it("attributes each card to a player in text", () => {
    render(
      <TrickRow
        cards={[
          { card: { suit: "hearts", rank: 7 }, by: "you" },
          { card: { suit: "diamonds", rank: 4 }, by: "opponent" },
        ]}
        count={11}
      />,
    )
    expect(screen.getByText(/seven of hearts, played by you/i)).toBeInTheDocument()
    expect(screen.getByText(/four of diamonds, played by them/i)).toBeInTheDocument()
    expect(screen.getAllByText("you").length).toBeGreaterThan(0)
    expect(screen.getAllByText("them").length).toBeGreaterThan(0)
  })

  it("animates only the newest card", () => {
    const { container } = render(
      <TrickRow
        cards={[
          { card: { suit: "hearts", rank: 7 }, by: "you" },
          { card: { suit: "diamonds", rank: 4 }, by: "opponent" },
        ]}
        count={11}
      />,
    )
    const played = container.querySelectorAll(".is-played")
    expect(played).toHaveLength(1)
    const items = container.querySelectorAll(".peg-sequence-card")
    expect(items[items.length - 1].querySelector(".is-played")).not.toBeNull()
  })

  it("shows a previous trick with its reason", () => {
    render(
      <TrickRow
        cards={[]}
        count={0}
        previous={{
          cards: [{ card: { suit: "clubs", rank: 10 }, by: "opponent" }],
          reason: "That made 31 — 2 points. The count resets to 0.",
        }}
      />,
    )
    expect(screen.getByText("That made 31 — 2 points. The count resets to 0.")).toBeInTheDocument()
    expect(screen.getByRole("list", { name: /previous trick/i })).toBeInTheDocument()
  })

  it("says so when nothing has been played", () => {
    render(<TrickRow cards={[]} count={0} />)
    expect(screen.getByText(/nothing played yet/i)).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: /cards on the table/i })).toBeNull()
  })
})
