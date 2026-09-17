import { useMemo, useState, type ReactNode } from 'react'
import { Button, Col, Container, Offcanvas, ProgressBar, Row } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import { DISCARD_SCENARIOS, PEG_SCENARIOS, SCORE_SCENARIOS } from '../../features/tutorial/lessonCatalog'
import { categoryProgress, hintFor } from '../../features/tutorial/tutorialGrading'
import type { DiscardScenario, Lesson, PegScenario, RoundPhase, ScoreScenario, TutorialStep } from '../../features/tutorial/tutorialTypes'
import type { RunnerAction, RunnerState } from '../../features/tutorial/tutorialReducer'
import { RulesReference } from '../../screens/RulesReference'
import { CoachPanel } from './CoachPanel'
import { DiscardExercise } from './DiscardExercise'
import { HandScoringExercise } from './HandScoringExercise'
import { PeggingExercise } from './PeggingExercise'
import { RoundMap } from './RoundMap'

export type TutorialShellProps = {
  lesson: Lesson
  state: RunnerState
  dispatch: (action: RunnerAction) => void
  onExit: () => void
  workspaceExtra?: ReactNode
  coachOverride?: string
  mapPhase?: RoundPhase
  mapCaption?: string
}

function highlightFor(lesson: Lesson, state: RunnerState): RoundPhase | undefined {
  const step = lesson.steps[state.stepIndex]
  if (step.kind === "round-map") {
    return step.highlight
  }
  if (step.kind === "explain") {
    return step.highlight
  }
  if (step.kind === "score-example" || step.kind === "score-practice" || step.kind === "checkpoint") {
    return "show"
  }
  if (step.kind === "discard-practice") {
    return "discard"
  }
  if (step.kind === "peg-practice") {
    return "pegging"
  }
  if (step.kind === "guided-round") {
    return "deal"
  }
  if (step.kind === "round-demo") {
    return "deal"
  }
  return undefined
}

function workspaceHeading(
  step: TutorialStep,
  scenario: ScoreScenario | DiscardScenario | PegScenario | undefined,
): string {
  if (step.kind === "explain" || step.kind === "round-map") {
    return step.title
  }
  if (step.kind === "recap") {
    return "Recap"
  }
  if (step.kind === "score-example") {
    return "Watch this count"
  }
  if (step.kind === "score-practice") {
    return "Count this hand"
  }
  if (step.kind === "discard-practice") {
    return "Throw two cards to the crib"
  }
  if (step.kind === "peg-practice") {
    return "The play"
  }
  if (step.kind === "guided-round") {
    return "A coached round"
  }
  if (step.kind === "round-demo") {
    return "A demonstration round"
  }
  if (step.kind === "checkpoint") {
    if (scenario && "hand" in scenario && "isCrib" in scenario) {
      return "Count this hand"
    }
    if (scenario && "isPlayerCrib" in scenario) {
      return "Throw two cards to the crib"
    }
    if (scenario && "task" in scenario) {
      return "The play"
    }
    return "Checkpoint"
  }
  return "Checkpoint"
}

export function TutorialShell({ lesson, state, dispatch, onExit, workspaceExtra, coachOverride, mapPhase, mapCaption }: TutorialShellProps) {
  const navigate = useNavigate()
  const [rulesOpen, setRulesOpen] = useState(false)
  const step = lesson.steps[state.stepIndex]
  const hint = state.step.hintLevel > 0
    ? hintFor(step, state.step.hintLevel as 1 | 2 | 3, state.step)
    : { text: "", highlightCardIds: [] as const }

  const scenario = useMemo(() => {
    if (step.kind === "score-example" || step.kind === "score-practice") {
      return SCORE_SCENARIOS[step.scenarioId]
    }
    if (step.kind === "discard-practice") {
      return DISCARD_SCENARIOS[step.scenarioId]
    }
    if (step.kind === "peg-practice") {
      return PEG_SCENARIOS[step.scenarioId]
    }
    if (step.kind === "checkpoint") {
      const id = step.scenarioIds[state.step.subIndex]
      return SCORE_SCENARIOS[id] ?? DISCARD_SCENARIOS[id] ?? PEG_SCENARIOS[id]
    }
    return undefined
  }, [step, state.step.subIndex])

  const prompt = coachOverride
    ?? (scenario && "prompt" in scenario ? scenario.prompt : (
      step.kind === "explain" || step.kind === "round-map"
        ? step.title
        : step.kind === "recap"
          ? "Recap"
          : "Follow the coach."
    ))

  // T4: category-progress `<dl>` only applies to scenarios scoreHandDetailed
  // can grade a group's worth of cards for (score-example/practice/checkpoint).
  const progress = scenario && "hand" in scenario && "isCrib" in scenario
    ? categoryProgress(scenario, state.step.found)
    : undefined

  // T6: "Show the math" only exists for discard scenarios, and only once the
  // learner has submitted a throw — there is nothing to disclose before then.
  const secondary = scenario && "isPlayerCrib" in scenario && state.step.feedback?.math
    ? <p className="coach-math">{state.step.feedback.math}</p>
    : undefined

  const nextEnabled = state.step.status !== "in-progress"
    || step.kind === "explain"
    || step.kind === "round-map"
    || step.kind === "recap"

  const percent = Math.round(((state.stepIndex + 1) / Math.max(1, lesson.steps.length)) * 100)

  return (
    <div className="tutorial-page shell">
      <Container>
        <header className="tutorial-header shell-head">
          <div>
            <h1>{lesson.title}</h1>
            <span className="tutorial-stepmeta stepcount" aria-label={`Step ${state.stepIndex + 1} of ${lesson.steps.length}`}>
              Step {state.stepIndex + 1} of {lesson.steps.length}
            </span>
          </div>
          <div className="tutorial-header-actions btn-row">
            <Button variant="outline-light" onClick={() => setRulesOpen(true)}>Rules</Button>
            <Button variant="secondary" onClick={onExit}>Exit</Button>
          </div>
        </header>

        <div className="shell-map">
          <RoundMap current={mapPhase ?? highlightFor(lesson, state)} caption={mapCaption} />
        </div>

        <Row>
          <Col xs={12} md={8} className="order-2 order-md-1">
            <section className="tutorial-workspace" aria-labelledby="workspace-heading">
              <h2 id="workspace-heading">{workspaceHeading(step, scenario)}</h2>
              {step.kind === "explain" || step.kind === "round-map" || step.kind === "recap" ? (
                <div>
                  <h3>{step.kind === "recap" ? "Recap" : step.title}</h3>
                  {"body" in step ? step.body.map((p) => <p key={p}>{p}</p>) : null}
                </div>
              ) : null}
              {(step.kind === "score-example" || (step.kind === "score-practice")
                || (step.kind === "checkpoint" && scenario && "isCrib" in scenario && "starter" in scenario))
                && scenario && "hand" in scenario && "isCrib" in scenario ? (
                <HandScoringExercise
                  scenario={scenario}
                  step={state.step}
                  mode={step.kind === "score-example" ? "example" : "practice"}
                  dispatch={dispatch}
                  hintedIds={hint.highlightCardIds}
                />
              ) : null}
              {(step.kind === "discard-practice"
                || (step.kind === "checkpoint" && scenario && "isPlayerCrib" in scenario))
                && scenario && "isPlayerCrib" in scenario ? (
                <DiscardExercise scenario={scenario} step={state.step} dispatch={dispatch} />
              ) : null}
              {(step.kind === "peg-practice"
                || (step.kind === "checkpoint" && scenario && "task" in scenario))
                && scenario && "task" in scenario ? (
                <PeggingExercise scenario={scenario} step={state.step} dispatch={dispatch} />
              ) : null}
              {workspaceExtra}
            </section>
          </Col>
          <Col xs={12} md={4} className="order-1 order-md-2">
            <section className="tutorial-coach" aria-labelledby="coach-heading">
              <h2 id="coach-heading">Coach</h2>
              <CoachPanel
                prompt={prompt}
                progress={progress}
                earned={state.step.earned}
                feedback={state.step.feedback}
                hintLevel={state.step.hintLevel}
                onHint={step.kind === "explain" || step.kind === "round-map" || step.kind === "recap" || step.kind === "guided-round"
                  ? undefined
                  : () => dispatch({ type: "request-hint" })}
                secondary={secondary}
              />
            </section>
          </Col>
        </Row>

        <footer className="tutorial-footer shell-foot">
          {state.stepIndex === 0 ? (
            <Button variant="outline-light" onClick={onExit}>Back to Learn</Button>
          ) : (
            <Button variant="outline-light" onClick={() => dispatch({ type: "back" })}>
              Back
            </Button>
          )}
          <div className="tutorial-progress">
            <ProgressBar now={percent} label={`Step ${state.stepIndex + 1} of ${lesson.steps.length} · ${percent}%`} />
          </div>
          <div className="tutorial-footer-actions btn-row">
            <span className="skip-note">Skipping does not count as completed.</span>
            <Button variant="outline-secondary" onClick={() => dispatch({ type: "skip" })}>
              Skip this step
            </Button>
            <Button
              variant="warning"
              disabled={!nextEnabled}
              onClick={() => {
                if (state.lessonComplete) {
                  navigate("/learn")
                  return
                }
                dispatch({ type: "next" })
              }}
            >
              Next
            </Button>
          </div>
        </footer>
      </Container>

      <Offcanvas show={rulesOpen} onHide={() => setRulesOpen(false)} placement="end">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Rules reference</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <RulesReference />
        </Offcanvas.Body>
      </Offcanvas>
    </div>
  )
}
