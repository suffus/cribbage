import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { store } from '../app/store'
import { AppRoutes } from '../App'
import gameReducer from '../features/game/gameSlice'
import { thePlayer } from '../app/gamePlayer'

function renderAt(path: string) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </Provider>
  )
}

function renderFresh(path: string) {
  thePlayer.resetForNewSession()
  const testStore = configureStore({ reducer: { game: gameReducer } })
  return {
    user: userEvent.setup(),
    ...render(
      <Provider store={testStore}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </Provider>
    ),
  }
}

describe("T7 shell routing", () => {
  it("renders Play and Learn on /", () => {
    renderAt("/")
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Learn' })).toBeInTheDocument()
  })

  it("navigates to Learn rules content", async () => {
    const user = userEvent.setup()
    renderAt("/")
    await user.click(screen.getByRole('button', { name: 'Learn' }))
    expect(screen.getByRole('heading', { name: /Learn Cribbage/i })).toBeInTheDocument()
    expect(screen.getByText(/race to 121/i)).toBeInTheDocument()
    expect(screen.getByText(/those four cards form the crib/i)).toBeInTheDocument()
  })

  it("renders /stats and /friend placeholders", () => {
    const stats = renderAt("/stats")
    expect(stats.getAllByText(/coming soon/i).length).toBeGreaterThan(0)
    stats.unmount()
    renderAt("/friend")
    expect(screen.getByText(/no network play yet/i)).toBeInTheDocument()
  })

  it("redirects unknown paths to the splash", () => {
    renderAt("/nope")
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it("shows the committed tagline, fairness line, and secondary links", async () => {
    const { user } = renderFresh("/")
    expect(screen.getByRole('heading', { name: 'CribbageX' })).toBeInTheDocument()
    expect(screen.getByText(/a two-player game to 121/i)).toBeInTheDocument()
    expect(screen.getByText(/the same shuffle at every difficulty/i)).toBeInTheDocument()
    expect(document.querySelector('img.splash-hero')).toHaveAttribute('src', '/img/splash/splash-hero.png')
    await user.click(screen.getByRole('button', { name: 'Stats' }))
    expect(screen.getByRole('heading', { name: 'Statistics' })).toBeInTheDocument()
  })

  it("navigates Play to the table gate and Friend to the placeholder", async () => {
    const play = renderFresh("/")
    await play.user.click(play.getByRole('button', { name: 'Play' }))
    expect(play.getByText(/choose your opponent/i)).toBeInTheDocument()
    expect(play.getByRole('heading', { name: 'CRIBBAGE' })).toBeInTheDocument()
    play.unmount()
    const friend = renderFresh("/")
    await friend.user.click(friend.getByRole('button', { name: 'Play with a Friend' }))
    expect(friend.getByText(/no network play yet/i)).toBeInTheDocument()
  })

  it("opens skin deep-links on the table and /select on the deck picker", () => {
    const brooke = renderFresh("/brooke")
    expect(brooke.getByRole('heading', { name: 'CRIBBAGE' })).toBeInTheDocument()
    expect(brooke.getByText(/choose your opponent/i)).toBeInTheDocument()
    expect(brooke.queryByRole('heading', { name: 'CribbageX' })).not.toBeInTheDocument()
    brooke.unmount()
    const select = renderFresh("/select")
    expect(select.queryByText(/choose your opponent/i)).not.toBeInTheDocument()
    expect(select.queryByRole('button', { name: 'Start The Round!' })).not.toBeInTheDocument()
    expect(document.querySelectorAll('img').length).toBeGreaterThan(0)
  })
})
