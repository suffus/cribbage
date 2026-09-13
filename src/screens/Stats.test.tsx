import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Stats } from './Stats'
import { clearAll, recordCompletedGame } from '../app/persistence'
import type { GameBreakdown } from '../app/game'

const result: GameBreakdown = {
  player: { hand: 10, crib: 4, pegging: 6, bonuses: 2, total: 22 },
  opponent: { hand: 8, crib: 0, pegging: 3, bonuses: 0, total: 11 },
  winner: "opponent",
  rounds: 2,
  difficulty: "easy",
}

function renderStats() {
  return {
    user: userEvent.setup(),
    ...render(
      <MemoryRouter initialEntries={["/stats"]}>
        <Routes>
          <Route path="/" element={<div>splash-home</div>} />
          <Route path="/stats" element={<Stats />} />
        </Routes>
      </MemoryRouter>
    ),
  }
}

describe("Stats", () => {
  afterEach(() => {
    clearAll()
  })

  it("shows real zero counters and coming-soon rows that are not zeros", () => {
    renderStats()
    expect(screen.getAllByText(/Games played 0/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Player wins 0/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Averages per hand — Coming soon/)).toBeInTheDocument()
    expect(screen.getByText(/Skunk \/ double-skunk counts — Coming soon/)).toBeInTheDocument()
    expect(screen.getByText(/Per-difficulty splits — Coming soon/)).toBeInTheDocument()
  })

  it("renders recorded lifetime totals including a conceded opponent win", () => {
    recordCompletedGame(result)
    renderStats()
    expect(screen.getAllByText(/Games played 1/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Opponent wins 1/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Hand 10/)).toBeInTheDocument()
    expect(screen.getByText(/Total 22/)).toBeInTheDocument()
  })

  it("clears lifetime and session and returns home", async () => {
    recordCompletedGame(result)
    const { user } = renderStats()
    await user.click(screen.getByRole("button", { name: "Clear statistics" }))
    expect(screen.getAllByText(/Games played 0/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Averages per hand — Coming soon/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Back" }))
    expect(screen.getByText("splash-home")).toBeInTheDocument()
  })
})
