import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Learn } from './Learn'
import { DIFFICULTY_DESCRIPTIONS, DIFFICULTY_LABELS } from '../app/difficulty'

function renderLearn() {
  return {
    user: userEvent.setup(),
    ...render(
      <MemoryRouter initialEntries={["/learn"]}>
        <Routes>
          <Route path="/" element={<div>splash-home</div>} />
          <Route path="/learn" element={<Learn />} />
        </Routes>
      </MemoryRouter>
    ),
  }
}

describe("Learn", () => {
  it("documents the corrected crib flush and the rest of the scoring table", () => {
    renderLearn()
    expect(screen.getByRole("heading", { name: /Learn Cribbage/i })).toBeInTheDocument()
    expect(screen.getByText(/crib flush \(five cards the same suit only\)/i)).toBeInTheDocument()
    expect(screen.getByText(/flush in hand \(four cards\)/i)).toBeInTheDocument()
    expect(screen.getByText(/nobs \(jack of the starter/i)).toBeInTheDocument()
    expect(screen.getByText(/his heels \(jack as starter\)/i)).toBeInTheDocument()
    expect(screen.getByText(/race to 121/i)).toBeInTheDocument()
    expect(screen.getByText(/the low card deals first/i)).toBeInTheDocument()
  })

  it("renders difficulty copy from the module and disables lesson tiles", async () => {
    const { user } = renderLearn()
    await user.click(screen.getByRole("button", { name: /How the opponent plays/i }))
    for (const level of ["easy", "intermediate", "expert"] as const) {
      expect(screen.getByText(DIFFICULTY_LABELS[level])).toBeInTheDocument()
      expect(screen.getByText(DIFFICULTY_DESCRIPTIONS[level], { exact: false })).toBeInTheDocument()
    }
    expect(screen.getByText(/the same shuffle at every difficulty/i)).toBeInTheDocument()
    for (const title of ["Your first hand", "Counting practice", "Discard strategy", "Pegging strategy"]) {
      expect(screen.getByRole("button", { name: title })).toBeDisabled()
    }
    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThan(0)
  })

  it("goes back to the splash", async () => {
    const { user } = renderLearn()
    await user.click(screen.getByRole("button", { name: "Back" }))
    expect(screen.getByText("splash-home")).toBeInTheDocument()
  })
})
