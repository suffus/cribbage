import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TutorialBoard } from './TutorialBoard'

describe("TutorialBoard", () => {
  it("renders the board and both scores", () => {
    const p = [7, 4, 0]
    const o = [2, 0, -1]
    render(
      <TutorialBoard
        playerPegPoints={p}
        opponentPegPoints={o}
        playerScore={7}
        opponentScore={2}
      />,
    )
    expect(screen.getByAltText(/cribbage board with 3 tracks/i)).toBeInTheDocument()
    expect(screen.getByText("You 7 · Them 2")).toBeInTheDocument()
    expect(p).toEqual([7, 4, 0])
    expect(o).toEqual([2, 0, -1])
  })
})
