import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CoachPanel } from './CoachPanel'

describe("CoachPanel", () => {
  it("has one live region and cycles hint labels", async () => {
    const onHint = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <CoachPanel
        prompt="Find the fifteens."
        earned={0}
        feedback={null}
        hintLevel={0}
        onHint={onHint}
      />,
    )
    expect(screen.getAllByRole("status")).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Hint" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Hint" }))
    expect(onHint).toHaveBeenCalled()
    rerender(
      <CoachPanel
        prompt="Find the fifteens."
        earned={2}
        feedback={{ tone: "good", text: "That is a fifteen." }}
        hintLevel={1}
        onHint={onHint}
      />,
    )
    expect(screen.getByRole("button", { name: "Another hint" })).toBeInTheDocument()
    expect(screen.getByText("Nice")).toBeInTheDocument()
  })
})
