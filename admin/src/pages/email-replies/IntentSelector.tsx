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
import { useTranslation } from "react-i18next"
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
import { useUpdateEmailIntent } from "@/lib/api/hooks/emails"
import type { EmailIntent } from "@/lib/api/types/email"
import { IntentBadge } from "./IntentBadge"

type IntentSelectorProps = {
  emailReplyId?: string // Optional: for backward compatibility
  emailId?: string // New: email ID to set intent directly
  currentIntent: EmailIntent | null | undefined
  size?: "sm" | "md" | "lg"
}

const intentOptions: Array<{
  value: EmailIntent
  labelKey: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  {
    value: "positive_interest",
    labelKey: "email-replies.intent.positive_interest",
    icon: ThumbsUp,
  },
  { value: "meeting_request", labelKey: "email-replies.intent.meeting_request", icon: Calendar },
  { value: "question", labelKey: "email-replies.intent.question", icon: HelpCircle },
  { value: "neutral", labelKey: "email-replies.intent.neutral", icon: Minus },
  { value: "objection", labelKey: "email-replies.intent.objection", icon: XCircle },
  { value: "not_interested", labelKey: "email-replies.intent.not_interested", icon: ThumbsDown },
  { value: "out_of_office", labelKey: "email-replies.intent.out_of_office", icon: Coffee },
]

export function IntentSelector({
  emailReplyId,
  emailId,
  currentIntent,
  size = "md",
}: IntentSelectorProps) {
  const { t } = useTranslation()
  const updateEmailReply = useUpdateEmailReply()
  const updateEmailIntent = useUpdateEmailIntent()

  const handleSelectIntent = (intent: EmailIntent | null) => {
    // Use emailId if available (new approach), otherwise use emailReplyId (backward compatibility)
    if (emailId) {
      updateEmailIntent.mutate({
        emailId,
        data: { intent },
      })
    } else if (emailReplyId) {
      updateEmailReply.mutate({
        id: emailReplyId,
        data: { intent },
      })
    }
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: wrapper for event propagation control
    <div
      aria-label={t("email-replies.intentSelector.selectIntent")}
      className="flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation()
        }
      }}
      role="group"
    >
      {currentIntent && <IntentBadge intent={currentIntent} size={size} />}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="h-6 gap-1 px-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
            size="sm"
            variant="ghost"
          >
            {currentIntent ? (
              <>
                <Edit2 className="h-3 w-3" />
                <span>{t("email-replies.intentSelector.change")}</span>
              </>
            ) : (
              <>
                <Plus className="h-3 w-3" />
                <span>{t("email-replies.intentSelector.addTag")}</span>
              </>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs">
            {t("email-replies.intentSelector.selectIntent")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {intentOptions.map((option) => {
            const Icon = option.icon
            const isSelected = currentIntent === option.value
            return (
              <DropdownMenuItem
                className={`cursor-pointer ${isSelected ? "bg-blue-50 dark:bg-blue-950" : ""}`}
                key={option.value}
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelectIntent(option.value)
                }}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{t(option.labelKey)}</span>
              </DropdownMenuItem>
            )
          })}
          {currentIntent && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-red-600 dark:text-red-400"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelectIntent(null)
                }}
              >
                <XCircle className="mr-2 h-4 w-4" />
                {t("email-replies.intentSelector.removeTag")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
