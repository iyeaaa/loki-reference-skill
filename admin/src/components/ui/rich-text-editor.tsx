import type { RefObject } from "react"
import { lazy, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"

// 동적 임포트로 MDEditor 로드 (번들 크기 최적화)
const MDEditor = lazy(() => import("@uiw/react-md-editor"))

type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  height?: string | number
  className?: string
  readOnly?: boolean
}

export type RichTextEditorRef = {
  insertTextAtCursor: (text: string) => void
}

export const RichTextEditor = ({
  value,
  onChange,
  placeholder,
  height = "200px",
  className = "",
  readOnly = false,
  ref,
}: RichTextEditorProps & { ref?: RefObject<RichTextEditorRef | null> }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [measuredHeightPx, setMeasuredHeightPx] = useState<number | null>(null)

  const resolveHeightPx = useMemo(() => {
    return (h: string | number): number | null => {
      if (typeof h === "number" && Number.isFinite(h)) {
        return h
      }
      if (typeof h === "string") {
        const trimmed = h.trim()
        if (trimmed.endsWith("px")) {
          const n = Number.parseFloat(trimmed.replace("px", ""))
          return Number.isFinite(n) ? n : null
        }
        // For percentages (e.g. "100%") and other units, we measure actual px via ResizeObserver.
        return null
      }
      return null
    }
  }, [])

  const heightPx = resolveHeightPx(height) ?? measuredHeightPx

  useImperativeHandle(ref, () => ({
    insertTextAtCursor: (text: string) => {
      // Find the textarea element
      const textarea = containerRef.current?.querySelector("textarea")
      if (!textarea) {
        // Fallback: append to end
        onChange(value + text)
        return
      }

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = value.substring(0, start) + text + value.substring(end)

      onChange(newValue)

      // Set cursor position after the inserted text
      setTimeout(() => {
        textarea.focus()
        const newCursorPos = start + text.length
        textarea.setSelectionRange(newCursorPos, newCursorPos)
      }, 0)
    },
  }))

  useEffect(() => {
    const el = measureRef.current
    if (!el) {
      return
    }

    // Only needed when height is not a resolvable px number.
    if (resolveHeightPx(height) !== null) {
      setMeasuredHeightPx(null)
      return
    }

    const update = () => {
      const next = Math.floor(el.getBoundingClientRect().height)
      setMeasuredHeightPx(next > 0 ? next : null)
    }

    update()

    const ro = new ResizeObserver(() => update())
    ro.observe(el)
    return () => ro.disconnect()
  }, [height, resolveHeightPx])

  return (
    <div
      className={`rich-text-editor-container ${className}`}
      ref={containerRef}
      style={{ height: typeof height === "number" ? `${height}px` : height }}
    >
      <Suspense
        fallback={
          <div
            className="flex items-center justify-center rounded-md border bg-gray-50"
            style={{ height: typeof height === "number" ? `${height}px` : height }}
          >
            <div className="text-gray-500 text-sm">에디터 로딩 중...</div>
          </div>
        }
      >
        <div className="h-full" ref={measureRef}>
          <MDEditor
            data-color-mode="light"
            height={heightPx ?? 200}
            hideToolbar={false}
            onChange={(val: string | undefined) => onChange(val || "")}
            preview="edit"
            textareaProps={{
              placeholder,
              readOnly,
            }}
            value={value}
          />
        </div>
      </Suspense>
    </div>
  )
}

RichTextEditor.displayName = "RichTextEditor"
