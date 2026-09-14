import { render, screen } from '@testing-library/react'
import { Card } from '../app/entities'
import { scoreHandDetailed } from '../app/game'
import { GroupList } from './GroupList'

const twentyNine = scoreHandDetailed(
  [
    new Card("hearts", 5),
    new Card("clubs", 5),
    new Card("diamonds", 5),
    new Card("spades", 11),
  ],
  new Card("spades", 5),
  false,
)

describe("GroupList", () => {
  it("renders eight atomic fifteen groups on the 29-hand when pairs are not aggregated", () => {
    render(
      <GroupList
        groups={twentyNine.groups}
        total={twentyNine.total}
        aggregatePairs={false}
      />,
    )
    expect(screen.getAllByText(/Pair of fives/i)).toHaveLength(6)
    expect(screen.getAllByText(/= 15/).length).toBe(8)
    expect(screen.getByLabelText("Total 29")).toBeInTheDocument()
  })

  it("aggregates four-of-a-kind pair copy by default, without printing the points twice", () => {
    render(<GroupList groups={twentyNine.groups} total={29} />)
    expect(screen.getByText("Four of a kind")).toBeInTheDocument()
    // Points render once, in the dedicated points column — not baked into the label too.
    expect(screen.getAllByText("12")).toHaveLength(1)
  })

  it("keeps the aggregated pair row in kernel order (fifteen, pair, run, flush, nobs)", () => {
    // The 29-hand's groups are [fifteens..., pairs (4x), nobs]. Aggregating the four
    // pairs into one row must not move that row after nobs.
    const { container } = render(<GroupList groups={twentyNine.groups} total={29} />)
    const labels = [...container.querySelectorAll(".groupList-label")].map((el) => el.textContent)
    const pairIdx = labels.findIndex((t) => t?.includes("Four of a kind"))
    const nobsIdx = labels.findIndex((t) => t?.includes("Nobs"))
    expect(pairIdx).toBeGreaterThanOrEqual(0)
    expect(nobsIdx).toBeGreaterThanOrEqual(0)
    expect(pairIdx).toBeLessThan(nobsIdx)
  })

  it("marks active ids with a non-colour-only marker", () => {
    const first = twentyNine.groups[0]
    render(
      <GroupList
        groups={twentyNine.groups}
        total={29}
        activeGroupIds={[first.id]}
        variant="compact"
      />,
    )
    expect(screen.getByText("(found)")).toBeInTheDocument()
    expect(screen.getByText("▸")).toBeInTheDocument()
    expect(screen.getByLabelText("Total 29")).toBeInTheDocument()
  })
})
