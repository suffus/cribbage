import { render, screen } from '@testing-library/react'
import { CribbageBoard, Peg } from './CribbageBoard'

describe("CribbageBoard", () => {
  it("lays the board out horizontally", () => {
    render(
      <CribbageBoard
        playerPeg={new Peg(0, [0, -1, -1])}
        opponentPeg={new Peg(1, [0, -1, -1])}
      />,
    )
    expect(screen.getByAltText("Cribbage board with 3 tracks")).toBeInTheDocument()
    expect(document.querySelector(".cribbage-board--horizontal")).toBeInTheDocument()
    expect(document.querySelectorAll("circle.board-peg")).toHaveLength(4)
    const overlay = document.querySelector("svg.cribbage-board-pegs")
    expect(overlay?.getAttribute("viewBox")).toBe("0 0 226.7716 680.31482")
    const pegs = [...document.querySelectorAll("circle.board-peg")]
    const xs = [...new Set(pegs.map((p) => Number(p.getAttribute("cx"))))].sort((a, b) => a - b)
    expect(xs[0]).toBeCloseTo(21.41719, 3)
    expect(xs[1]).toBeCloseTo(41.57474, 3)
  })
})
