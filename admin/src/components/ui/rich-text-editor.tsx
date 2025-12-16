import type { RefObject } from "react"
import { lazy, Suspense, useImperativeHandle, useRef } from "react"

// 동적 임포트로 MDEditor 로드 (번들 크기 최적화)
const MDEditor = lazy(() => import("@uiw/react-md-editor"))

type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  height?: string
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

  return (
    <div className={`rich-text-editor-container ${className}`} ref={containerRef}>
      <Suspense
        fallback={
          <div
            className="flex items-center justify-center rounded-md border bg-gray-50"
            style={{ height }}
          >
            <div className="text-gray-500 text-sm">에디터 로딩 중...</div>
          </div>
        }
      >
        <MDEditor
          data-color-mode="light"
          height={height}
          hideToolbar={false}
          onChange={(val: string | undefined) => onChange(val || "")}
          preview="edit"
          textareaProps={{
            placeholder,
            readOnly,
          }}
          value={value}
        />
      </Suspense>
    </div>
  )
}

RichTextEditor.displayName = "RichTextEditor"
