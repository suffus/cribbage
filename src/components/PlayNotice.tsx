import { useEffect, useRef, useState } from 'react'

export const PLAY_NOTICE_HOLD_MS = 3200

export type PlayNoticeProps = {
  message: string
  noticeId: number
}

export function PlayNotice({ message, noticeId }: PlayNoticeProps) {
  const [text, setText] = useState("")
  const [visible, setVisible] = useState(false)
  const hideRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (hideRef.current !== null) {
        window.clearTimeout(hideRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // The game store blanks `message` on the next tick. Keep the current
    // line fading on its own timer so that clear does not yank it away.
    if (!message) {
      return
    }
    setText(message)
    setVisible(true)
    if (hideRef.current !== null) {
      window.clearTimeout(hideRef.current)
    }
    hideRef.current = window.setTimeout(() => {
      setVisible(false)
      hideRef.current = null
    }, PLAY_NOTICE_HOLD_MS)
  }, [message, noticeId])

  if (!text) {
    return null
  }

  return (
    <div
      className={`playNotice${visible ? " is-visible" : ""}`}
      role="status"
      aria-live="polite"
    >
      {text}
    </div>
  )
}
