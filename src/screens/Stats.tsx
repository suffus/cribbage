import { useState } from 'react'
import { Button, Container } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import { clearAll, loadSessionStats, loadStats } from '../app/persistence'
import type { PlayerBreakdown } from '../app/game'

function CategoryRows({ title, data }: { title: string, data: PlayerBreakdown }) {
  return (
    <section className="stats-block">
      <h3>{title}</h3>
      <ul>
        <li>Hand {data.hand}</li>
        <li>Crib {data.crib}</li>
        <li>Pegging {data.pegging}</li>
        <li>Bonuses {data.bonuses}</li>
        <li>Total {data.total}</li>
      </ul>
    </section>
  )
}

export function Stats() {
  const navigate = useNavigate()
  const [lifetime, setLifetime] = useState(loadStats)
  const [session, setSession] = useState(loadSessionStats)

  const clearStatistics = () => {
    clearAll()
    setLifetime(loadStats())
    setSession(loadSessionStats())
  }

  return (
    <div className="stats-page">
      <Container>
        <header className="screen-header">
          <h1>Statistics</h1>
          <Button variant="outline-light" onClick={() => navigate("/")}>Back</Button>
        </header>

        <section className="stats-block">
          <h2>Lifetime</h2>
          <ul>
            <li>Games played {lifetime.gamesPlayed}</li>
            <li>Player wins {lifetime.playerWins}</li>
            <li>Opponent wins {lifetime.opponentWins}</li>
          </ul>
          <div className="stats-split">
            <CategoryRows title="You" data={lifetime.lifetime.player} />
            <CategoryRows title="Opponent" data={lifetime.lifetime.opponent} />
          </div>
        </section>

        <section className="stats-block">
          <h2>This session</h2>
          <ul>
            <li>Games played {session.gamesPlayed}</li>
            <li>Player wins {session.playerWins}</li>
            <li>Opponent wins {session.opponentWins}</li>
          </ul>
        </section>

        <section className="stats-block">
          <h2>More detail</h2>
          <ul className="coming-soon-list">
            <li>Averages per hand — Coming soon</li>
            <li>Skunk / double-skunk counts — Coming soon</li>
            <li>Per-difficulty splits — Coming soon</li>
          </ul>
        </section>

        <Button variant="outline-warning" onClick={clearStatistics}>
          Clear statistics
        </Button>
      </Container>
    </div>
  )
}
