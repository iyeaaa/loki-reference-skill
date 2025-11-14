import { forwardRef, lazy, Suspense, useImperativeHandle, useRef } from "react"

// 동적 임포트로 MDEditor 로드 (번들 크기 최적화)
const MDEditor = lazy(() => import("@uiw/react-md-editor"))

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  height?: string
  className?: string
  readOnly?: boolean
}

export interface RichTextEditorRef {
  insertTextAtCursor: (text: string) => void
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  ({ value, onChange, placeholder, height = "200px", className = "", readOnly = false }, ref) => {
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
      <div ref={containerRef} className={`rich-text-editor-container ${className}`}>
        <Suspense
          fallback={
            <div
              className="flex items-center justify-center border rounded-md bg-gray-50"
              style={{ height }}
            >
              <div className="text-sm text-gray-500">에디터 로딩 중...</div>
            </div>
          }
        >
          <MDEditor
            value={value}
            onChange={(val: string | undefined) => onChange(val || "")}
            preview="edit"
            hideToolbar={false}
            data-color-mode="light"
            height={height}
            textareaProps={{
              placeholder: placeholder,
              readOnly: readOnly,
            }}
          />
        </Suspense>
      </div>
    )
  },
)

RichTextEditor.displayName = "RichTextEditor"
