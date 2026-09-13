import { useState } from 'react'
import { Button } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'

export function Splash() {
  const navigate = useNavigate()
  const [heroFailed, setHeroFailed] = useState(false)

  return (
    <div className={`splash${heroFailed ? " splash--fallback" : ""}`}>
      {!heroFailed && (
        <img
          className="splash-hero"
          src="/img/splash/splash-hero.png"
          alt=""
          onError={() => setHeroFailed(true)}
        />
      )}
      <div className="splash-scrim" />
      <div className="splash-content">
        <h1 className="splash-title">CribbageX</h1>
        <p className="splash-tagline">A two-player game to 121. You, one opponent, and a crib.</p>
        <div className="splash-actions">
          <Button variant="primary" size="lg" className="splash-btn splash-btn-play" onClick={() => navigate("/play")}>
            Play
          </Button>
          <Button variant="outline-light" size="lg" className="splash-btn splash-btn-learn" onClick={() => navigate("/learn")}>
            Learn
          </Button>
        </div>
        <nav className="splash-secondary" aria-label="More">
          <button type="button" className="splash-link" onClick={() => navigate("/stats")}>Stats</button>
          <button type="button" className="splash-link" onClick={() => navigate("/friend")}>Play with a Friend</button>
        </nav>
        <p className="splash-fairness">The same shuffle at every difficulty — only the opponent&apos;s strategy changes.</p>
      </div>
    </div>
  )
}
