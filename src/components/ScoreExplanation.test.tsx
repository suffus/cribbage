import { render, screen } from '@testing-library/react'
import { ScoreExplanation } from './ScoreExplanation'

describe("ScoreExplanation", () => {
  it("renders the total and the coming-soon contract body", () => {
    render(
      <ScoreExplanation
        hand={[{ suit: "hearts", rank: 11 }]}
        starter={{ suit: "spades", rank: 5 }}
        isCrib={false}
        total={12}
      />
    )
    expect(screen.getByText("12")).toBeInTheDocument()
    expect(screen.getByText(/point-by-point breakdown coming soon/i)).toBeInTheDocument()
  })
})
