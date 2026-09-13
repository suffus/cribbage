import { Button, Container, Form } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'

export function FriendPlay() {
  const navigate = useNavigate()

  return (
    <div className="friend-page">
      <Container>
        <header className="screen-header">
          <h1>Play with a Friend</h1>
          <Button variant="outline-light" onClick={() => navigate("/")}>Back</Button>
        </header>
        <p className="friend-copy">
          Playing with a friend over a room code is planned. This version is local-only — there is no network play yet.
        </p>
        <Form className="friend-form" onSubmit={(e) => e.preventDefault()}>
          <Form.Group>
            <Form.Label htmlFor="room-code">Room code</Form.Label>
            <Form.Control id="room-code" type="text" placeholder="ABCD" disabled />
          </Form.Group>
          <Button variant="primary" disabled>Create room</Button>
        </Form>
        <p className="coming-soon">Coming soon</p>
      </Container>
    </div>
  )
}
