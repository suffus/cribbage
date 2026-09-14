export type TutorialEventName =
  | "tutorial_path_viewed"
  | "tutorial_started"
  | "tutorial_step_completed"
  | "tutorial_lesson_completed"
  | "tutorial_completed"
  | "coach_game_started"

const ALLOWED_KEYS = new Set([
  "attemptBand",
  "hintBand",
  "durationBand",
  "lessonId",
  "stepKind",
  "curriculumVersion",
])

export type TutorialEvent = {
  name: TutorialEventName
  props?: Readonly<Record<string, string | number>>
}

export type AnalyticsSink = (event: TutorialEvent) => void

let sink: AnalyticsSink | null = null

export function setAnalyticsSink(next: AnalyticsSink | null): void {
  sink = next
}

export function track(name: TutorialEventName, props?: Readonly<Record<string, string | number>>): void {
  if (!sink) {
    return
  }
  const clean: Record<string, string | number> = {}
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (ALLOWED_KEYS.has(key)) {
        clean[key] = value
      }
    }
  }
  sink({ name, props: clean })
}
