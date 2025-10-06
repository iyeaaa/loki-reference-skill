import { Textarea } from "@/components/ui/textarea"

interface SimpleTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SimpleTextEditor({
  value,
  onChange,
  placeholder = "메시지를 입력하세요...",
  className = "",
}: SimpleTextEditorProps) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`min-h-[200px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${className}`}
    />
  )
}
