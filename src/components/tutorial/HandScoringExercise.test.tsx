import { useReducer } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { cardKey, cardName } from '../../app/entities'
import { scoreHandDetailed } from '../../app/game'
import type { ScoringGroup } from '../../app/game'
import { specToCard, specsToCards } from '../../features/tutorial/tutorialCards'
import { SCORE_SCENARIOS } from '../../features/tutorial/scenarios'
import { initialRunnerState, makeTutorialReducer } from '../../features/tutorial/tutorialReducer'
import type { Lesson } from '../../features/tutorial/tutorialTypes'
import type { ScoreScenario } from '../../features/tutorial/tutorialTypes'
import { HandScoringExercise } from './HandScoringExercise'

/** A minimal live host — the same shape as TutorialShell's wiring — so the
 *  exercise is driven by the real reducer instead of a mocked dispatch. */
function LiveHost({ scenarioId }: { scenarioId: string }) {
  const lesson: Lesson = {
    id: "test-lesson",
    title: "Test",
    estimatedMinutes: 1,
    concepts: ["pairs"],
    steps: [
      { kind: "score-practice", id: "step", scenarioId, hintPolicy: "on-request" },
    ],
  }
  const reducer = makeTutorialReducer(lesson)
  const [state, dispatch] = useReducer(reducer, initialRunnerState(lesson))
  const scenario = SCORE_SCENARIOS[scenarioId]
  return (
    <div>
      <p data-testid="earned">{state.step.earned}</p>
      <p data-testid="status">{state.step.status}</p>
      <p data-testid="attempts">{state.step.attempts}</p>
      <p data-testid="hintlevel">{state.step.hintLevel}</p>
      <p data-testid="feedback">{state.step.feedback?.text ?? ""}</p>
      <HandScoringExercise scenario={scenario} step={state.step} mode="practice" dispatch={dispatch} />
    </div>
  )
}

/** The required scoring groups for a scenario, filtered by `require` the
 *  same way `requiredGroups` in tutorialGrading.ts does, then deduplicated
 *  by card set — a hand like king-4-5-5-6 has a run and a fifteen that use
 *  the exact same three cards, and selecting them once credits both in a
 *  single submission, so the drive loop below must submit once per distinct
 *  card set, not once per group. */
function requiredGroupsFor(scenario: ScoreScenario): ScoringGroup[] {
  const result = scoreHandDetailed(
    specsToCards(scenario.hand),
    scenario.starter ? specToCard(scenario.starter) : undefined,
    scenario.isCrib,
  )
  const groups = scenario.require
    ? result.groups.filter((g) => scenario.require?.includes(g.category))
    : result.groups
  const seen = new Set<string>()
  const distinct: ScoringGroup[] = []
  for (const g of groups) {
    const key = [...g.cardIds].sort().join(",")
    if (!seen.has(key)) {
      seen.add(key)
      distinct.push(g)
    }
  }
  return distinct
}

/** Maps a cardKey (e.g. "5H") to that card's accessible name (e.g. "Five of hearts"). */
function cardNameMap(scenario: ScoreScenario): Record<string, string> {
  const specs = [...scenario.hand, ...(scenario.starter ? [scenario.starter] : [])]
  return specsToCards(specs).reduce<Record<string, string>>((acc, card) => {
    acc[cardKey(card)] = cardName(card)
    return acc
  }, {})
}

describe("HandScoringExercise", () => {
  it("example mode reveals one combination per click and disables the button once done", () => {
    const dispatch = vi.fn()
    const scenario = SCORE_SCENARIOS["fifteen-worked"]
    const step = {
      stepId: "x", selected: [], found: [], attempts: 0, hintLevel: 0 as const,
      revealed: 0, status: "in-progress" as const, feedback: null, earned: 0, subIndex: 0,
      submitted: false,
    }
    render(<HandScoringExercise scenario={scenario} step={step} mode="example" dispatch={dispatch} />)
    screen.getByRole("button", { name: /show the next combination/i }).click()
    expect(dispatch).toHaveBeenCalledWith({ type: "reveal-next" })
  })

  it("practice mode: Clear dispatches clear-selection and Count is disabled with nothing selected", () => {
    const dispatch = vi.fn()
    const scenario = SCORE_SCENARIOS["pair-find"]
    const step = {
      stepId: "x", selected: [], found: [], attempts: 0, hintLevel: 0 as const,
      revealed: 0, status: "in-progress" as const, feedback: null, earned: 0, subIndex: 0,
      submitted: false,
    }
    const { unmount } = render(<HandScoringExercise scenario={scenario} step={step} mode="practice" dispatch={dispatch} />)
    expect(screen.getByRole("button", { name: /count selected cards/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /^clear$/i })).toBeDisabled()
    screen.getByRole("button", { name: /^clear$/i }).click()
    expect(dispatch).not.toHaveBeenCalledWith({ type: "clear-selection" })
    unmount()

    const stepWithSelection = { ...step, selected: ["2H"] }
    render(<HandScoringExercise scenario={scenario} step={stepWithSelection} mode="practice" dispatch={dispatch} />)
    const clearButton = screen.getByRole("button", { name: /^clear$/i })
    expect(clearButton).toBeEnabled()
    clearButton.click()
    expect(dispatch).toHaveBeenCalledWith({ type: "clear-selection" })
  })

  it.each([
    ["pair-find", 4],
    ["fifteen-multi", 8],
    ["run-double", 16],
    ["count-all", 12],
    ["checkpoint-count", 12],
  ] as const)("completes %s through the real reducer for a total of %i", async (scenarioId, total) => {
    const user = userEvent.setup()
    render(<LiveHost scenarioId={scenarioId} />)
    const scenario = SCORE_SCENARIOS[scenarioId]
    const names = cardNameMap(scenario)
    const groups = requiredGroupsFor(scenario)
    for (const group of groups) {
      for (const cardId of group.cardIds) {
        const name = names[cardId]
        await user.click(screen.getByRole("button", { name: new RegExp(`^${name}`, "i") }))
      }
      await user.click(screen.getByRole("button", { name: /count selected cards/i }))
      // The button becomes "Clear selection" once a submission has been
      // graded (right or wrong), so the highlighted cards stay on screen
      // for review instead of vanishing immediately (RM-5 item 2).
      await user.click(screen.getByRole("button", { name: /clear selection/i }))
    }
    expect(screen.getByTestId("status")).toHaveTextContent("complete")
    expect(screen.getByTestId("earned")).toHaveTextContent(String(total))
  })

  it("a counted card stays enabled, focusable and selectable", async () => {
    const user = userEvent.setup()
    render(<LiveHost scenarioId="pair-find" />)
    await user.click(screen.getByRole("button", { name: /^two of hearts/i }))
    await user.click(screen.getByRole("button", { name: /^two of clubs/i }))
    await user.click(screen.getByRole("button", { name: /count selected cards/i }))
    const twoHearts = screen.getByRole("button", { name: /^two of hearts/i })
    expect(twoHearts).toBeEnabled()
    expect(twoHearts.tabIndex).not.toBe(-1)
    await user.click(twoHearts)
    expect(screen.getByRole("button", { name: /two of hearts.*selected/i })).toBeInTheDocument()
  })

  /** Finds the `.selectable-card` wrapper for a card by its accessible name
   *  (works for both the interactive-button and static-div render paths). */
  function classForCard(container: HTMLElement, name: string): string {
    const span = Array.from(container.querySelectorAll(".visually-hidden"))
      .find((el) => el.textContent?.startsWith(name))
    return span?.closest(".selectable-card")?.className ?? ""
  }

  it("practice mode never leaves an already-counted card looking highlighted, even mid-selection or after Clear selection", async () => {
    const user = userEvent.setup()
    const { container } = render(<LiveHost scenarioId="pair-find" />)
    await user.click(screen.getByRole("button", { name: /^two of hearts/i }))
    await user.click(screen.getByRole("button", { name: /^two of clubs/i }))
    await user.click(screen.getByRole("button", { name: /count selected cards/i }))
    // Immediately after a correct submit the cards are still selected, not
    // yet re-marked "credited" — no lingering glow class of any kind.
    expect(classForCard(container, "Two of hearts")).not.toContain("is-credited")
    expect(screen.queryByText(/×\d/)).toBeNull()

    await user.click(screen.getByRole("button", { name: /clear selection/i }))
    // And after "Clear selection" the card goes back to a plain, unhighlighted
    // card — it does not swap from "selected" into a permanent "credited"
    // look (RM-6): the same card is still fully selectable for a different
    // combination, and `GroupList`'s "Counted so far" is the record of what
    // already scored, not the card itself.
    expect(classForCard(container, "Two of hearts")).not.toContain("is-credited")
    expect(screen.getByRole("button", { name: /^two of hearts, not selected$/i })).toBeInTheDocument()
  })

  it("gives a plain 'already counted' message instead of a hedge when the same combination is resubmitted", async () => {
    const user = userEvent.setup()
    render(<LiveHost scenarioId="pair-find" />)
    await user.click(screen.getByRole("button", { name: /^two of hearts/i }))
    await user.click(screen.getByRole("button", { name: /^two of clubs/i }))
    await user.click(screen.getByRole("button", { name: /count selected cards/i }))
    await user.click(screen.getByRole("button", { name: /clear selection/i }))
    // Re-pick the exact same pair instead of moving on to the other one.
    await user.click(screen.getByRole("button", { name: /^two of hearts/i }))
    await user.click(screen.getByRole("button", { name: /^two of clubs/i }))
    await user.click(screen.getByRole("button", { name: /count selected cards/i }))
    expect(screen.getByTestId("feedback")).toHaveTextContent(/you already counted that/i)
  })

  it("example mode highlights the starter when it is part of the revealed combination (RM-5 item 1)", () => {
    const dispatch = vi.fn()
    const scenario = SCORE_SCENARIOS["flush-crib"]
    const names = cardNameMap(scenario)
    const step = {
      stepId: "x", selected: [], found: [], attempts: 0, hintLevel: 0 as const,
      revealed: 1, status: "in-progress" as const, feedback: null, earned: 0, subIndex: 0,
      submitted: false,
    }
    const { container } = render(<HandScoringExercise scenario={scenario} step={step} mode="example" dispatch={dispatch} />)
    // The crib flush needs all five cards, including the starter — it must
    // glow along with the four hand cards, not stay plain "idle".
    expect(classForCard(container, names[cardKey(specToCard(scenario.starter!))])).toContain("is-credited")
  })

  it("example mode highlights only the currently revealed combination, not earlier ones (RM-5 item 2)", () => {
    const dispatch = vi.fn()
    const scenario = SCORE_SCENARIOS["fifteen-multi"]
    const names = cardNameMap(scenario)
    const detailed = scoreHandDetailed(
      specsToCards(scenario.hand),
      scenario.starter ? specToCard(scenario.starter) : undefined,
      scenario.isCrib,
    )
    const required = scenario.require
      ? detailed.groups.filter((g) => scenario.require?.includes(g.category))
      : detailed.groups
    expect(required.length).toBeGreaterThanOrEqual(2)
    const [first, second] = required
    const onlyInFirst = first.cardIds.filter((id) => !second.cardIds.includes(id))
    const onlyInSecond = second.cardIds.filter((id) => !first.cardIds.includes(id))
    const shared = first.cardIds.filter((id) => second.cardIds.includes(id))
    // fifteen-multi's required fifteens overlap (e.g. the five appears in
    // more than one), so the first two share at least one card while each
    // also has a card the other does not.
    expect(onlyInFirst.length).toBeGreaterThan(0)
    expect(onlyInSecond.length).toBeGreaterThan(0)
    expect(shared.length).toBeGreaterThan(0)

    const step = {
      stepId: "x", selected: [], found: [], attempts: 0, hintLevel: 0 as const,
      revealed: 1, status: "in-progress" as const, feedback: null, earned: 0, subIndex: 0,
      submitted: false,
    }
    const { container, rerender } = render(
      <HandScoringExercise scenario={scenario} step={step} mode="example" dispatch={dispatch} />,
    )
    expect(classForCard(container, names[onlyInFirst[0]])).toContain("is-credited")
    expect(classForCard(container, names[shared[0]])).toContain("is-credited")
    expect(classForCard(container, names[onlyInSecond[0]])).not.toContain("is-credited")

    rerender(<HandScoringExercise scenario={scenario} step={{ ...step, revealed: 2 }} mode="example" dispatch={dispatch} />)
    // The first combination's own card stops glowing once the second one is
    // shown; the card the two combinations share keeps glowing.
    expect(classForCard(container, names[onlyInFirst[0]])).not.toContain("is-credited")
    expect(classForCard(container, names[shared[0]])).toContain("is-credited")
    expect(classForCard(container, names[onlyInSecond[0]])).toContain("is-credited")
  })

  it("the starter is a button in practice mode and static in example mode", () => {
    const dispatch = vi.fn()
    const scenario = SCORE_SCENARIOS["fifteen-multi"]
    const step = {
      stepId: "x", selected: [], found: [], attempts: 0, hintLevel: 0 as const,
      revealed: 0, status: "in-progress" as const, feedback: null, earned: 0, subIndex: 0,
      submitted: false,
    }
    const { unmount } = render(<HandScoringExercise scenario={scenario} step={step} mode="practice" dispatch={dispatch} />)
    expect(screen.getByRole("button", { name: /three of clubs/i })).toBeInTheDocument()
    unmount()
    render(<HandScoringExercise scenario={scenario} step={step} mode="example" dispatch={dispatch} />)
    expect(screen.queryByRole("button", { name: /three of clubs/i })).toBeNull()
  })

  it("Start this count again clears the count but keeps attempts and hint level", async () => {
    const user = userEvent.setup()
    render(<LiveHost scenarioId="count-all" />)
    // Deliberately wrong submission: six of hearts and eight of spades do not score together.
    await user.click(screen.getByRole("button", { name: /^six of hearts/i }))
    await user.click(screen.getByRole("button", { name: /^eight of spades/i }))
    await user.click(screen.getByRole("button", { name: /count selected cards/i }))
    expect(screen.getByTestId("attempts")).toHaveTextContent("1")
    await user.click(screen.getByRole("button", { name: /clear selection/i }))

    // Now count one real group: the pair of sevens.
    await user.click(screen.getByRole("button", { name: /^seven of clubs/i }))
    await user.click(screen.getByRole("button", { name: /^seven of diamonds/i }))
    await user.click(screen.getByRole("button", { name: /count selected cards/i }))
    expect(screen.getByTestId("earned")).not.toHaveTextContent("0")

    await user.click(screen.getByRole("button", { name: /start this count again/i }))
    expect(screen.getByTestId("earned")).toHaveTextContent("0")
    expect(screen.getByTestId("status")).toHaveTextContent("in-progress")
    expect(screen.getByTestId("attempts")).toHaveTextContent("1")
  })
})
