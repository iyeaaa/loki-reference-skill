import { GripVertical } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

interface ResizableDividerProps {
  onResize: (leftWidthPercent: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
  minLeftWidth?: number
  maxLeftWidth?: number
}

/**
 * ResizableDivider - Draggable divider for resizing split panes
 * Optimized with requestAnimationFrame for smooth 60fps performance
 */
export function ResizableDivider({
  onResize,
  onDragStart,
  onDragEnd,
  minLeftWidth = 30,
  maxLeftWidth = 70,
}: ResizableDividerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const dividerRef = useRef<HTMLDivElement>(null)
  const rafIdRef = useRef<number | null>(null)
  const lastUpdateRef = useRef<number>(0)
  const dragOffsetRef = useRef<number>(0) // Track where on divider user clicked

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()

      // Calculate offset from divider's left edge to click position
      const dividerRect = dividerRef.current?.getBoundingClientRect()
      if (dividerRect) {
        dragOffsetRef.current = e.clientX - dividerRect.left
      }

      setIsDragging(true)
      onDragStart?.()
    },
    [onDragStart],
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return

      // Cancel previous frame if it hasn't executed yet
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }

      // Schedule update for next frame (60fps max)
      rafIdRef.current = requestAnimationFrame(() => {
        const now = performance.now()
        // Throttle to ~60fps (16ms between updates)
        if (now - lastUpdateRef.current < 16) return

        lastUpdateRef.current = now

        const containerWidth = window.innerWidth
        // Subtract drag offset so divider stays under cursor where user clicked
        const adjustedX = e.clientX - dragOffsetRef.current
        const leftWidthPercent = (adjustedX / containerWidth) * 100

        // Clamp between min and max
        const clampedWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, leftWidthPercent))

        onResize(clampedWidth)
      })
    },
    [isDragging, onResize, minLeftWidth, maxLeftWidth],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)

    // Clean up any pending animation frame
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    onDragEnd?.()
  }, [onDragEnd])

  // Keyboard navigation support
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Arrow keys to resize (5% steps for smooth control)
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        const containerWidth = window.innerWidth
        const currentPercent =
          ((dividerRef.current?.getBoundingClientRect().left ?? 0) / containerWidth) * 100
        const newPercent = Math.max(minLeftWidth, currentPercent - 5)
        onResize(newPercent)
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        const containerWidth = window.innerWidth
        const currentPercent =
          ((dividerRef.current?.getBoundingClientRect().left ?? 0) / containerWidth) * 100
        const newPercent = Math.min(maxLeftWidth, currentPercent + 5)
        onResize(newPercent)
      }
    },
    [onResize, minLeftWidth, maxLeftWidth],
  )

  // Add global mouse event listeners when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      // Prevent text selection while dragging
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"

      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.userSelect = ""
        document.body.style.cursor = ""

        // Clean up animation frame on unmount
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current)
        }
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <div
      ref={dividerRef}
      role="slider"
      aria-label="Resize panels"
      aria-orientation="vertical"
      aria-valuenow={50}
      aria-valuemin={minLeftWidth}
      aria-valuemax={maxLeftWidth}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      className={`
        group relative w-4 flex-shrink-0 cursor-col-resize
        flex items-center justify-center
        transition-all duration-150
        ${isDragging ? "bg-blue-50 dark:bg-blue-950" : "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-blue-500"}
      `}
    >
      {/* Center line - always visible */}
      <div
        className={`
          absolute left-1/2 -translate-x-1/2 w-px h-full
          transition-colors duration-150
          ${isDragging ? "bg-blue-500" : "bg-border group-hover:bg-blue-400"}
        `}
      />

      {/* Grip icon - shows on hover or drag */}
      <div
        className={`
          relative z-10 flex items-center justify-center
          w-4 h-8 rounded
          transition-all duration-150
          ${isDragging ? "bg-blue-500 text-white scale-110" : "bg-transparent text-muted-foreground group-hover:text-blue-500 group-hover:bg-background group-hover:shadow-sm"}
        `}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
    </div>
  )
}
