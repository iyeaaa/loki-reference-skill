import { useEffect, useRef, useState } from "react"

interface UseTypingEffectOptions {
  text: string
  speed?: number // milliseconds per character
  enabled?: boolean
}

/**
 * Custom hook for typing animation effect
 * Optimized to show streaming text immediately without animation
 * to prevent flickering during rapid updates
 */
export function useTypingEffect({
  text,
  speed = 20,
  enabled = true,
}: UseTypingEffectOptions): string {
  const [displayedText, setDisplayedText] = useState("")
  const previousTextRef = useRef("")
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!enabled) {
      setDisplayedText(text)
      previousTextRef.current = text
      return
    }

    if (!text) {
      setDisplayedText("")
      previousTextRef.current = ""
      return
    }

    // If new text starts with the previous text (streaming scenario)
    const previousText = previousTextRef.current

    if (text.startsWith(previousText) && previousText.length > 0) {
      // Streaming: show immediately to avoid flickering
      // Use RAF to batch DOM updates
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }

      rafRef.current = requestAnimationFrame(() => {
        setDisplayedText(text)
        previousTextRef.current = text
      })
      return
    } else {
      // New text or text changed completely, start from beginning
      setDisplayedText("")
    }

    previousTextRef.current = text

    if (text.length === 0) {
      return
    }

    let currentIndex = 0
    const intervalId = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1))
        currentIndex++
      } else {
        clearInterval(intervalId)
      }
    }, speed)

    return () => {
      clearInterval(intervalId)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [text, speed, enabled])

  return displayedText
}
