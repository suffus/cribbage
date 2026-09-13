import { Accordion, Button, Card, Col, Container, Row } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import {
  DIFFICULTY_DESCRIPTIONS,
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
} from '../app/difficulty'

const LESSONS = [
  "Your first hand",
  "Counting practice",
  "Discard strategy",
  "Pegging strategy",
] as const

export function Learn() {
  const navigate = useNavigate()

  return (
    <div className="learn-page">
      <Container>
        <header className="screen-header">
          <h1>Learn Cribbage</h1>
          <Button variant="outline-light" onClick={() => navigate("/")}>Back</Button>
        </header>

        <Accordion defaultActiveKey="0" className="learn-accordion">
          <Accordion.Item eventKey="0">
            <Accordion.Header>Object of the game</Accordion.Header>
            <Accordion.Body>
              Cribbage is a two-player race to 121 points. The first player to peg out — to reach
              or pass 121 — wins. Points come from the play (pegging), from counting each four-card
              hand, and from the crib.
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="1">
            <Accordion.Header>Deal and cut for dealer</Accordion.Header>
            <Accordion.Body>
              Each player cuts a card. The low card deals first. After that the deal alternates.
              The dealer gives six cards to each player.
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="2">
            <Accordion.Header>The crib</Accordion.Header>
            <Accordion.Body>
              Each player discards two cards face down. Those four cards form the crib, which
              belongs to the dealer and is counted after the hands.
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="3">
            <Accordion.Header>Starter card</Accordion.Header>
            <Accordion.Body>
              After the discard, a starter (cut) card is turned. If it is a jack, the dealer scores
              two points — his heels, also called his nibs.
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="4">
            <Accordion.Header>The play</Accordion.Header>
            <Accordion.Body>
              Players alternate laying cards. The running count must not exceed 31. Scoring in the
              play includes fifteens (2), pairs, runs, reaching 31 (2), and the last card (1). A
              player who cannot play says go; the other may continue if able.
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="5">
            <Accordion.Header>The show</Accordion.Header>
            <Accordion.Body>
              Hands are counted in order: non-dealer, then dealer, then the crib. The starter is
              shared by every count.
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="6">
            <Accordion.Header>Scoring reference</Accordion.Header>
            <Accordion.Body>
              <table className="learn-score-table">
                <thead>
                  <tr><th>Combination</th><th>Points</th></tr>
                </thead>
                <tbody>
                  <tr><td>Each 15</td><td>2</td></tr>
                  <tr><td>Pair / three of a kind / four of a kind</td><td>2 / 6 / 12</td></tr>
                  <tr><td>Run</td><td>1 per card</td></tr>
                  <tr><td>Flush in hand (four cards)</td><td>4</td></tr>
                  <tr><td>Flush in hand with matching starter</td><td>5</td></tr>
                  <tr><td>Crib flush (five cards the same suit only)</td><td>5</td></tr>
                  <tr><td>Nobs (jack of the starter&apos;s suit)</td><td>1</td></tr>
                  <tr><td>His heels (jack as starter)</td><td>2 to the dealer</td></tr>
                </tbody>
              </table>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="7">
            <Accordion.Header>Winning, and what a skunk is</Accordion.Header>
            <Accordion.Body>
              First to 121 wins. A skunk is a lopsided finish: the loser has not reached 91. A
              double skunk is when the loser has not reached 61. CribbageX does not yet flag skunks
              on the game-over screen; the terms are here so you know the table talk.
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="8">
            <Accordion.Header>How the opponent plays</Accordion.Header>
            <Accordion.Body>
              <ul className="learn-difficulty-list">
                {DIFFICULTY_ORDER.map((level) => (
                  <li key={level}>
                    <strong>{DIFFICULTY_LABELS[level]}</strong> — {DIFFICULTY_DESCRIPTIONS[level]}
                  </li>
                ))}
              </ul>
              <p>The same shuffle at every difficulty — only the opponent&apos;s strategy changes.</p>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>

        <section className="learn-lessons" aria-labelledby="lessons-heading">
          <h2 id="lessons-heading">Guided lessons</h2>
          <Row xs={1} md={2} className="g-3">
            {LESSONS.map((title) => (
              <Col key={title}>
                <Card className="learn-lesson-tile">
                  <Card.Body>
                    <Card.Title>{title}</Card.Title>
                    <Button disabled variant="outline-light">{title}</Button>
                    <p className="coming-soon">Coming soon</p>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </section>
      </Container>
    </div>
  )
}
