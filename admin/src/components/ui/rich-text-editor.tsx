import MDEditor from "@uiw/react-md-editor"
// import { useId } from "react"

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
  // const _id = useId()

  return (
    <div className={`rich-text-editor-container ${className}`}>
      <MDEditor
        value={value}
        onChange={(val: any) => onChange(val || "")}
        preview="edit"
        hideToolbar={false}
        visibleDragBar={false}
        data-color-mode="light"
        height={height}
        textareaProps={{
          placeholder: placeholder,
          readOnly: readOnly,
        }}
      />
    </div>
  )
}
