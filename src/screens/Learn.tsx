import { useState } from 'react'
import { Button, Container } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import {
  clearTutorialProgress,
  loadTutorialProgress,
} from '../app/persistence'
import { BEGINNER_PATH, QUICK_PRACTICE, findLesson } from '../features/tutorial/lessonCatalog'
import { tutorialEnabled } from '../features/tutorial/tutorialTypes'
import { RoundMap } from '../components/tutorial/RoundMap'
import { RulesReference } from './RulesReference'

const PROMISE =
  "Learn your first round in about 15 minutes, or the whole path in about half an hour."

export function Learn() {
  const navigate = useNavigate()
  const [progress, setProgress] = useState(loadTutorialProgress)
  const enabled = tutorialEnabled()
  const current = progress.currentLessonId ? findLesson(progress.currentLessonId) : undefined
  const resumeLabel = current
    ? `Resume: ${current.title}, step ${progress.currentStepIndex + 1}`
    : null

  const startOver = () => {
    if (!window.confirm("Start the beginner path over? This clears tutorial progress only.")) {
      return
    }
    clearTutorialProgress()
    setProgress(loadTutorialProgress())
  }

  return (
    <div className="learn-page tutorial-page">
      <Container>
        <header className="screen-header">
          <h1>Learn Cribbage</h1>
          <Button variant="outline-light" onClick={() => navigate("/")}>Back</Button>
        </header>

        {enabled ? (
          <section className="card-surface learn-path" aria-labelledby="path-heading">
            <h2 id="path-heading">New to cribbage?</h2>
            <p className="promise">{PROMISE}</p>
            <div className="btn-row learn-path-actions">
              {resumeLabel ? (
                <Button
                  variant="warning"
                  onClick={() => navigate(`/learn/${progress.currentLessonId}`)}
                >
                  {resumeLabel}
                </Button>
              ) : (
                <Button variant="warning" onClick={() => navigate(`/learn/${BEGINNER_PATH[0].id}`)}>
                  Start beginner path
                </Button>
              )}
              {(progress.completedLessonIds.length > 0 || progress.currentLessonId) ? (
                <button type="button" className="btn-link" onClick={startOver}>
                  Start over
                </button>
              ) : null}
            </div>

            <p className="meta">Every lesson walks one part of this round:</p>
            <RoundMap />

            <ul className="lesson-list">
              {BEGINNER_PATH.map((lesson, index) => {
                const done = progress.completedLessonIds.includes(lesson.id)
                const isCurrent = progress.currentLessonId === lesson.id && !done
                const mark = done ? "✓" : isCurrent ? "→" : "○"
                const status = done
                  ? "complete"
                  : isCurrent
                    ? `step ${progress.currentStepIndex + 1} of ${lesson.steps.length}`
                    : "not started"
                const sr = done
                  ? "completed"
                  : isCurrent
                    ? "current lesson, "
                    : ""
                const action = done ? "Replay" : isCurrent ? "Resume" : "Start"
                return (
                  <li
                    key={lesson.id}
                    className={`lesson-row${done ? " done" : ""}${isCurrent ? " current" : ""}`}
                  >
                    <span className="mark" aria-hidden="true">{mark}</span>
                    <span className="ttl">
                      <b>{index + 1}. {lesson.title}</b>
                      <span>
                        {lesson.estimatedMinutes} min · {sr ? <span className="visually-hidden">{sr}</span> : null}
                        {status}
                      </span>
                    </span>
                    <Button
                      variant={isCurrent ? "warning" : "outline-light"}
                      onClick={() => navigate(`/learn/${lesson.id}`)}
                    >
                      {action}
                    </Button>
                  </li>
                )
              })}
            </ul>

            <h3 className="tutorial-subhead">Quick practice</h3>
            <div className="btn-row">
              {QUICK_PRACTICE.map((lesson) => (
                <Button
                  key={lesson.id}
                  variant="outline-light"
                  onClick={() => navigate(`/learn/${lesson.id}`)}
                >
                  {lesson.title}
                </Button>
              ))}
            </div>
          </section>
        ) : null}

        <section id="rules" aria-labelledby="rules-heading">
          <h2 id="rules-heading" className="visually-hidden">Rules reference</h2>
          <RulesReference />
        </section>
      </Container>
    </div>
  )
}
