import { Button } from "@/components/ui/button"

type RecipientInputProps = {
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
      <span className="w-16 flex-shrink-0 text-gray-600 text-sm">{label}</span>
      <input
        className="flex-1 border-0 px-2 py-1 text-sm focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="이메일 주소"
        type="text"
        value={value}
      />
      {showCcBcc && (
        <div className="flex gap-1">
          {onShowCc && (
            <Button
              className="h-7 px-2 text-xs"
              onClick={onShowCc}
              size="sm"
              type="button"
              variant="ghost"
            >
              참조
            </Button>
          )}
          {onShowBcc && (
            <Button
              className="h-7 px-2 text-xs"
              onClick={onShowBcc}
              size="sm"
              type="button"
              variant="ghost"
            >
              숨은참조
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
