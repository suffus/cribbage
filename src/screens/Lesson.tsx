import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Button, Offcanvas } from 'react-bootstrap'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { thePlayer } from '../app/gamePlayer'
import {
  loadTutorialProgress,
  recordConceptAttempt,
  savePreferences,
  saveTutorialProgress,
} from '../app/persistence'
import { useAppDispatch } from '../app/hooks'
import { resetGameUi, setDifficulty } from '../features/game/gameSlice'
import { BEGINNER_PATH, QUICK_PRACTICE, findLesson, nextLessonId } from '../features/tutorial/lessonCatalog'
import { GuidedRound } from '../features/tutorial/guidedRound'
import { RoundDemo } from '../features/tutorial/roundDemo'
import { ROUND_SCRIPTS } from '../features/tutorial/scenarios'
import { track } from '../features/tutorial/tutorialAnalytics'
import {
  initialRunnerState,
  isAssessedStepKind,
  makeTutorialReducer,
  stepConcepts,
} from '../features/tutorial/tutorialReducer'
import { CURRICULUM_VERSION, tutorialEnabled } from '../features/tutorial/tutorialTypes'
import type { ConceptId } from '../features/tutorial/tutorialTypes'
import { TutorialShell } from '../components/tutorial/TutorialShell'
import { GuidedRoundView } from '../components/tutorial/GuidedRoundView'
import { RoundDemoView } from '../components/tutorial/RoundDemo'
import { RulesReference } from './RulesReference'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

const lastBeginnerLessonId = BEGINNER_PATH[BEGINNER_PATH.length - 1]?.id

function pillClass(state: "ready" | "practised" | "not yet"): string {
  return state === "not yet" ? "notyet" : state
}

function masteryState(
  progress: ReturnType<typeof loadTutorialProgress>,
  concept: ConceptId,
): "ready" | "practised" | "not yet" {
  const row = progress.conceptMastery[concept]
  if (!row || row.attempts === 0) {
    return "not yet"
  }
  if (row.independentCorrect > 0 && row.hintsUsed < 2) {
    return "ready"
  }
  return "practised"
}

/** Route wrapper only: forces a fresh mount of `LessonBody` (and therefore a
 *  fresh `useReducer`/refs) whenever the lesson changes. Without the `key`,
 *  navigating from a completed lesson straight into the next one (the "Next
 *  lesson" button) kept the previous `RunnerState`, whose `lessonComplete`
 *  was still `true` from the lesson just finished. The completion effect
 *  below then fired again for the *new* lesson before the learner had done
 *  anything, marking it completed/skipped on arrival. */
export function Lesson() {
  const { lessonId } = useParams()
  return <LessonBody key={lessonId ?? "none"} lessonId={lessonId} />
}

function LessonBody({ lessonId }: { lessonId: string | undefined }) {
  const navigate = useNavigate()
  const storeDispatch = useAppDispatch()
  const lesson = lessonId ? findLesson(lessonId) : undefined
  const progress = useMemo(() => loadTutorialProgress(), [])
  const resumeIndex = lesson && progress.currentLessonId === lesson.id
    ? progress.currentStepIndex
    : 0
  const reducer = useMemo(() => (lesson ? makeTutorialReducer(lesson) : null), [lesson])
  const [state, dispatch] = useReducer(
    reducer ?? ((s) => s),
    lesson ? initialRunnerState(lesson, resumeIndex) : initialRunnerState(BEGINNER_PATH[0]),
  )
  const [roundView, setRoundView] = useState(0)
  const [demoView, setDemoView] = useState(0)
  const [rulesOpen, setRulesOpen] = useState(false)
  const roundRef = useRef<GuidedRound | null>(null)
  const demoRef = useRef<RoundDemo | null>(null)
  const prevComplete = useRef(false)
  const lastHandledSkipId = useRef<string | null>(null)
  const recordedStepIds = useRef<Set<string>>(new Set())

  const step = lesson?.steps[state.stepIndex]

  useEffect(() => {
    if (!lesson || !tutorialEnabled()) {
      return
    }
    if (!progress.startedAt) {
      saveTutorialProgress({ startedAt: today(), currentLessonId: lesson.id, currentStepIndex: 0 })
      track("tutorial_started", { lessonId: lesson.id, curriculumVersion: CURRICULUM_VERSION })
    }
  }, [lesson, progress.startedAt])

  useEffect(() => {
    if (!lesson) {
      return
    }
    saveTutorialProgress({
      currentLessonId: lesson.id,
      currentStepIndex: state.stepIndex,
    })
  }, [lesson, state.stepIndex])

  useEffect(() => {
    if (!lesson || !step) {
      return
    }
    // Mastery accounting (R3) only applies to steps that actually grade the
    // learner (score-practice / discard-practice / peg-practice / checkpoint).
    // Passive steps (explain, round-map, recap) and score-example demos start
    // — or become — "complete" without the learner having been assessed at
    // all, so recording an attempt for them would award false credit for
    // every concept the lesson merely mentions (defect: opening lesson 1
    // used to mark all ten of its concepts "ready").
    if (
      state.step.status === "complete"
      && !prevComplete.current
      && isAssessedStepKind(step.kind)
      && !recordedStepIds.current.has(state.step.stepId)
    ) {
      // `attempts` on an assessed step counts *wrong* submissions only (see
      // tutorialReducer.ts submitScore/submitDiscard/submitPeg), so zero
      // wrong tries — not "exactly one submission" — is the flawless signal.
      // A literal attempts === 1 would make multi-group score-practice steps
      // (e.g. count-all, which needs one correct submission per group)
      // permanently ineligible for independent-correct credit even when
      // solved perfectly.
      const correct = state.step.attempts === 0
      recordedStepIds.current.add(state.step.stepId)
      for (const concept of stepConcepts(step)) {
        recordConceptAttempt(concept, {
          correct,
          hintLevel: state.step.hintLevel,
        })
      }
    }
    if (state.step.status === "complete" && !prevComplete.current) {
      track("tutorial_step_completed", { lessonId: lesson.id, stepKind: step.kind, curriculumVersion: CURRICULUM_VERSION })
    }
    prevComplete.current = state.step.status === "complete"
  }, [lesson, step, state.step.status, state.step.attempts, state.step.hintLevel, state.step.stepId])

  // Skip persistence (defect: the reducer replaces `state.step` with a fresh
  // StepState for the *next* step as part of the same `skip` action, so
  // `state.step.status === "skipped"` was only ever observable on the final
  // step of a lesson. The reducer now surfaces the skipped step's id via
  // `lastSkippedStepId` so every skip — not just the last one — is recorded.
  useEffect(() => {
    if (!lesson || !state.lastSkippedStepId) {
      return
    }
    if (lastHandledSkipId.current === state.lastSkippedStepId) {
      return
    }
    lastHandledSkipId.current = state.lastSkippedStepId
    const skippedId = state.lastSkippedStepId
    const skipped = new Set(loadTutorialProgress().skippedStepIds)
    skipped.add(skippedId)
    saveTutorialProgress({ skippedStepIds: [...skipped] })
    const skippedStep = lesson.steps.find((s) => s.id === skippedId)
    if (skippedStep && isAssessedStepKind(skippedStep.kind)) {
      for (const concept of stepConcepts(skippedStep)) {
        recordConceptAttempt(concept, { correct: false, hintLevel: 0 })
      }
    }
  }, [lesson, state.lastSkippedStepId])

  useEffect(() => {
    if (!lesson || !state.lessonComplete) {
      return
    }
    const onPath = BEGINNER_PATH.some((item) => item.id === lesson.id)
    if (onPath) {
      const done = new Set(loadTutorialProgress().completedLessonIds)
      done.add(lesson.id)
      saveTutorialProgress({
        completedLessonIds: [...done],
        completedAt: lesson.id === lastBeginnerLessonId ? today() : loadTutorialProgress().completedAt,
      })
      track("tutorial_lesson_completed", { lessonId: lesson.id, curriculumVersion: CURRICULUM_VERSION })
    }
  }, [lesson, state.lessonComplete])

  useEffect(() => {
    if (step?.kind === "guided-round") {
      const script = ROUND_SCRIPTS[step.scriptId]
      if (script && !roundRef.current) {
        roundRef.current = new GuidedRound(script)
        setRoundView((n) => n + 1)
      }
    } else {
      roundRef.current = null
    }
  }, [step])

  useEffect(() => {
    if (step?.kind === "round-demo") {
      if (!demoRef.current) {
        demoRef.current = new RoundDemo(step.scriptIds)
        setDemoView((n) => n + 1)
      }
    } else {
      demoRef.current = null
    }
  }, [step])

  if (!tutorialEnabled() || !lesson) {
    return <Navigate to="/learn" replace />
  }

  const handoff = () => {
    savePreferences({ difficulty: "easy" })
    thePlayer.resetForNewSession()
    storeDispatch(resetGameUi())
    storeDispatch(setDifficulty("easy"))
    track("coach_game_started", { lessonId: lesson.id, curriculumVersion: CURRICULUM_VERSION })
    navigate("/play")
  }

  const latest = loadTutorialProgress()
  const nextId = nextLessonId(lesson.id)
  const isLast = lesson.id === lastBeginnerLessonId || (!nextId && BEGINNER_PATH.some((item) => item.id === lesson.id))
  const weak = (["peg-fifteen-31", "discard-keep", "fifteens"] as ConceptId[])
    .find((c) => masteryState(latest, c) !== "ready")
  const practiceId = weak === "peg-fifteen-31"
    ? "peg-practice"
    : weak === "discard-keep"
      ? "crib-and-discard"
      : "count-a-hand-practice"
  const practiceExists = QUICK_PRACTICE.some((item) => item.id === practiceId) || findLesson(practiceId)

  if (state.lessonComplete && isLast) {
    return (
      <div className="tutorial-page">
        <div className="card-surface" style={{ maxWidth: 720, margin: "2rem auto", padding: "1.25rem" }}>
          <h1>You are ready for a real game</h1>
          <p>Here is where you stand. Nothing here is a grade — it just tells you what to practise if you want to.</p>
          <ul className="mastery">
            {([
              ["round-flow", "Round flow"],
              ["fifteens", "Hand counting"],
              ["discard-keep", "The crib and the discard"],
              ["peg-legal", "Pegging"],
              ["nobs", "Nobs and his heels"],
            ] as const).map(([id, label]) => (
              <li key={id}>
                <span>{label}</span>
                <span className={`pill ${pillClass(masteryState(latest, id))}`}>
                  {masteryState(latest, id)}
                </span>
              </li>
            ))}
          </ul>
          <div className="btn-row">
            <Button variant="warning" onClick={handoff}>Play your first Easy game</Button>
            {practiceExists ? (
              <Button variant="outline-light" onClick={() => navigate(`/learn/${practiceId}`)}>
                Practise a weak concept
              </Button>
            ) : null}
            <Button variant="outline-light" onClick={() => setRulesOpen(true)}>Rules reference</Button>
            <button type="button" className="btn-link" onClick={() => navigate("/learn")}>Back to Learn</button>
          </div>
        </div>
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

  if (state.lessonComplete && nextId) {
    return (
      <div className="tutorial-page">
        <div className="card-surface" style={{ maxWidth: 640, margin: "2rem auto", padding: "1.25rem" }}>
          <h1>{lesson.title} complete</h1>
          <div className="btn-row">
            <Button variant="warning" onClick={() => navigate(`/learn/${nextId}`)}>Next lesson</Button>
            <Button variant="outline-light" onClick={() => navigate("/learn")}>Back to Learn</Button>
          </div>
        </div>
      </div>
    )
  }

  if (state.lessonComplete) {
    return (
      <div className="tutorial-page">
        <div className="card-surface" style={{ maxWidth: 640, margin: "2rem auto", padding: "1.25rem" }}>
          <h1>{lesson.title} complete</h1>
          <p>Practice does not change your progress on the beginner path.</p>
          <div className="btn-row">
            <Button variant="warning" onClick={() => dispatch({ type: "restart-lesson" })}>Practise again</Button>
            {loadTutorialProgress().completedLessonIds.length < BEGINNER_PATH.length ? (
              <Button
                variant="outline-light"
                onClick={() => navigate(`/learn/${loadTutorialProgress().currentLessonId ?? BEGINNER_PATH[0].id}`)}
              >
                Continue the beginner path
              </Button>
            ) : null}
            <Button variant="outline-light" onClick={() => navigate("/learn")}>Back to Learn</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <TutorialShell
      lesson={lesson}
      state={state}
      dispatch={dispatch}
      onExit={() => navigate("/learn")}
      coachOverride={step?.kind === "guided-round"
        ? roundRef.current?.view().coach
        : step?.kind === "round-demo"
          ? demoRef.current?.view().coach
          : undefined}
      mapPhase={step?.kind === "guided-round"
        ? roundRef.current?.view().phase
        : step?.kind === "round-demo"
          ? demoRef.current?.view().phase
          : undefined}
      mapCaption={step?.kind === "round-demo" && demoRef.current ? `Hand ${demoRef.current.view().handNumber} of 2` : undefined}
      workspaceExtra={
        step?.kind === "guided-round" && roundRef.current ? (
          <GuidedRoundView
            key={roundView}
            round={roundRef.current}
            view={roundRef.current.view()}
            step={state.step}
            dispatch={dispatch}
            onChange={() => {
              setRoundView((n) => n + 1)
              if (roundRef.current?.view().complete) {
                dispatch({ type: "complete-guided-round" })
              }
            }}
          />
        ) : step?.kind === "round-demo" && demoRef.current ? (
          <RoundDemoView
            key={demoView}
            demo={demoRef.current}
            view={demoRef.current.view()}
            onChange={() => setDemoView((n) => n + 1)}
          />
        ) : null
      }
    />
  )
}
