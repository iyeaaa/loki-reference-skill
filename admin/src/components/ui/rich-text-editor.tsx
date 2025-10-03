import { lazy, Suspense } from "react"

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

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  height = "200px",
  className = "",
  readOnly = false,
}: RichTextEditorProps) {
  return (
    <div className={`rich-text-editor-container ${className}`}>
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
}
