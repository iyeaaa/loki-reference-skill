import {
  Calendar,
  ChevronDown,
  Coffee,
  Edit2,
  HelpCircle,
  Minus,
  Plus,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUpdateEmailReply } from "@/lib/api/hooks/email-replies"
import type { EmailIntent } from "@/lib/api/types/email"
import { IntentBadge } from "./IntentBadge"

interface IntentSelectorProps {
  emailReplyId: string
  currentIntent: EmailIntent | null | undefined
  size?: "sm" | "md" | "lg"
}

const intentOptions: Array<{
  value: EmailIntent
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { value: "positive_interest", label: "Positive Interest", icon: ThumbsUp },
  { value: "meeting_request", label: "Meeting Request", icon: Calendar },
  { value: "question", label: "Question", icon: HelpCircle },
  { value: "neutral", label: "Neutral", icon: Minus },
  { value: "objection", label: "Objection", icon: XCircle },
  { value: "not_interested", label: "Not Interested", icon: ThumbsDown },
  { value: "out_of_office", label: "Out of Office", icon: Coffee },
]

export function IntentSelector({ emailReplyId, currentIntent, size = "md" }: IntentSelectorProps) {
  const updateEmailReply = useUpdateEmailReply()

  const handleSelectIntent = (intent: EmailIntent | null) => {
    updateEmailReply.mutate({
      id: emailReplyId,
      data: { intent },
    })
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: wrapper for event propagation control
    <div
      className="flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation()
        }
      }}
      role="group"
      aria-label="Intent 태그 선택"
    >
      {currentIntent && <IntentBadge intent={currentIntent} size={size} />}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            {currentIntent ? (
              <>
                <Edit2 className="h-3 w-3" />
                <span>변경</span>
              </>
            ) : (
              <>
                <Plus className="h-3 w-3" />
                <span>태그 추가</span>
              </>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs">Intent 선택</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {intentOptions.map((option) => {
            const Icon = option.icon
            const isSelected = currentIntent === option.value
            return (
              <DropdownMenuItem
                key={option.value}
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelectIntent(option.value)
                }}
                className={`cursor-pointer ${isSelected ? "bg-blue-50 dark:bg-blue-950" : ""}`}
              >
                <Icon className="h-4 w-4 mr-2" />
                <span>{option.label}</span>
              </DropdownMenuItem>
            )
          })}
          {currentIntent && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelectIntent(null)
                }}
                className="cursor-pointer text-red-600 dark:text-red-400"
              >
                <XCircle className="h-4 w-4 mr-2" />
                태그 제거
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
