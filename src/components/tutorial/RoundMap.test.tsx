import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RoundMap } from './RoundMap'

describe("RoundMap", () => {
  it("names every phase and marks the current one", () => {
    render(<RoundMap current="pegging" />)
    expect(screen.getByText(/^Deal/)).toBeInTheDocument()
    expect(screen.getByText(/^Discard/)).toBeInTheDocument()
    expect(screen.getByText(/^Starter/)).toBeInTheDocument()
    expect(screen.getByText("Pegging")).toBeInTheDocument()
    expect(screen.getByText("Show")).toBeInTheDocument()
    expect(screen.getByText("Crib")).toBeInTheDocument()
    expect(screen.getByText(/current phase/i)).toBeInTheDocument()
    const current = screen.getByText("Pegging").closest("li")
    expect(current).toHaveAttribute("aria-current", "step")
  })

  it("announces completed phases to a screen reader", () => {
    render(<RoundMap current="pegging" />)
    expect(screen.getAllByText(/— completed/)).toHaveLength(3)
    expect(screen.getByText(/— current phase/)).toBeInTheDocument()
  })
})
