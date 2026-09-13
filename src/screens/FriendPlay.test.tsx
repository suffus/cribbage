import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { FriendPlay } from './FriendPlay'
import friendSource from './FriendPlay.tsx?raw'

function renderFriend() {
  return {
    user: userEvent.setup(),
    ...render(
      <MemoryRouter initialEntries={["/friend"]}>
        <Routes>
          <Route path="/" element={<div>splash-home</div>} />
          <Route path="/friend" element={<FriendPlay />} />
        </Routes>
      </MemoryRouter>
    ),
  }
}

describe("FriendPlay", () => {
  it("renders the planned local-only copy with a disabled room form", () => {
    renderFriend()
    expect(screen.getByRole("heading", { name: /Play with a Friend/i })).toBeInTheDocument()
    expect(screen.getByText(/there is no network play yet/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/room code/i)).toBeDisabled()
    expect(screen.getByRole("button", { name: "Create room" })).toBeDisabled()
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })

  it("contains no network primitives and goes back home", async () => {
    const { user } = renderFriend()
    expect(friendSource).not.toMatch(/\bfetch\s*\(/)
    expect(friendSource).not.toMatch(/WebSocket/)
    expect(friendSource).not.toMatch(/XMLHttpRequest/)
    await user.click(screen.getByRole("button", { name: "Back" }))
    expect(screen.getByText("splash-home")).toBeInTheDocument()
  })
})
