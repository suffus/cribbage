import { act, render, screen } from '@testing-library/react'
import { PLAY_NOTICE_HOLD_MS, PlayNotice } from './PlayNotice'

describe("PlayNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders nothing until a message arrives", () => {
    render(<PlayNotice message="" noticeId={1} />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("fades a message in without offering a dismiss control", () => {
    render(<PlayNotice message="Click a card to cut for dealer" noticeId={2} />)
    const notice = screen.getByRole("status")
    expect(notice).toHaveTextContent("Click a card to cut for dealer")
    expect(notice).toHaveClass("is-visible")
    expect(notice.querySelector("button")).toBeNull()
  })

  it("fades out after the hold, and a new noticeId shows the next line", () => {
    const { rerender } = render(
      <PlayNotice message="You need to discard two cards for your crib." noticeId={3} />,
    )
    expect(screen.getByRole("status")).toHaveClass("is-visible")

    act(() => {
      vi.advanceTimersByTime(PLAY_NOTICE_HOLD_MS)
    })
    expect(screen.getByRole("status")).not.toHaveClass("is-visible")

    rerender(
      <PlayNotice message="player won the cut and will get the first crib!" noticeId={4} />,
    )
    expect(screen.getByRole("status")).toHaveClass("is-visible")
    expect(screen.getByRole("status")).toHaveTextContent("first crib")
  })

  it("keeps fading after the store blanks the message", () => {
    const { rerender } = render(
      <PlayNotice message="Click a card to cut for dealer" noticeId={5} />,
    )
    rerender(<PlayNotice message="" noticeId={6} />)
    expect(screen.getByRole("status")).toHaveClass("is-visible")
    expect(screen.getByRole("status")).toHaveTextContent("Click a card to cut for dealer")

    act(() => {
      vi.advanceTimersByTime(PLAY_NOTICE_HOLD_MS)
    })
    expect(screen.getByRole("status")).not.toHaveClass("is-visible")
  })
})
