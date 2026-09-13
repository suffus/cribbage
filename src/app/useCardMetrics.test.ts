import { useCardMetrics } from './useCardMetrics'

describe("useCardMetrics", () => {
  it("returns the table constants with no visual change", () => {
    expect(useCardMetrics()).toEqual({
      cardSize: 150,
      cardSpacing: 100,
      showSpacing: 120,
      handLeft: 170,
    })
  })
})
