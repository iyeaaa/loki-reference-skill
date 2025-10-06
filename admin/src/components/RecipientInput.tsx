import { Button } from "@/components/ui/button"

interface RecipientInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  showCcBcc?: boolean
  onShowCc?: () => void
  onShowBcc?: () => void
}

export function RecipientInput({
  label,
  value,
  onChange,
  disabled = false,
  showCcBcc = false,
  onShowCc,
  onShowBcc,
}: RecipientInputProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600 w-16 flex-shrink-0">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="이메일 주소"
        disabled={disabled}
        className="flex-1 px-2 py-1 text-sm border-0 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
      />
      {showCcBcc && (
        <div className="flex gap-1">
          {onShowCc && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onShowCc}
              className="h-7 px-2 text-xs"
            >
              참조
            </Button>
          )}
          {onShowBcc && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onShowBcc}
              className="h-7 px-2 text-xs"
            >
              숨은참조
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
