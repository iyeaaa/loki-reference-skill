import { CheckCircle2, MessageSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import type { RepliedEmail } from "@/lib/api/types/email"
import { formatAbsoluteDateTime } from "@/lib/date-utils"
import { IntentBadge } from "./IntentBadge"

interface RepliedEmailsListItemProps {
  email: RepliedEmail
  isSelected: boolean
  isActive: boolean
  onSelect: () => void
  onToggleCheckbox: (e: React.MouseEvent) => void
}

export function RepliedEmailsListItem({
  email,
  isSelected,
  isActive,
  onSelect,
  onToggleCheckbox,
}: RepliedEmailsListItemProps) {
  // Determine the lead display name
  const leadDisplayName =
    email.companyName || email.contactName || email.leadName || email.fromEmail

  // Get message preview (use latest message - the actual reply, not original sent message)
  const messagePreview = email.latestMessageBody
    ? email.latestMessageBody.slice(0, 150)
    : email.latestMessageBodyHtml
      ? email.latestMessageBodyHtml.replace(/<[^>]*>/g, "").slice(0, 150)
      : email.bodyText
        ? email.bodyText.slice(0, 150)
        : email.bodyHtml
          ? email.bodyHtml.replace(/<[^>]*>/g, "").slice(0, 150)
          : ""

  // Sentiment badge color
  const getSentimentBadge = () => {
    if (!email.replySentiment) return null

    const sentimentConfig = {
      positive: {
        label: "Positive",
        color: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300",
      },
      interested: {
        label: "Interested",
        color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300",
      },
      neutral: {
        label: "Neutral",
        color: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
      },
      negative: {
        label: "Negative",
        color: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-300",
      },
      not_interested: {
        label: "Not Interested",
        color:
          "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900 dark:text-orange-300",
      },
    }

    const config = sentimentConfig[email.replySentiment]
    if (!config) return null

    return (
      <Badge
        variant="outline"
        className={`${config.color} text-xs px-2 py-0.5 font-medium border rounded-full`}
      >
        {config.label}
      </Badge>
    )
  }

  return (
    <button
      type="button"
      className={`
        flex items-start gap-3 px-4 py-4 cursor-pointer transition-all w-full text-left
        hover:bg-gray-50 dark:hover:bg-gray-800/50
        ${isActive ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500" : "bg-white dark:bg-gray-800"}
        border-b border-gray-200 dark:border-gray-700
      `}
      onClick={onSelect}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={onToggleCheckbox}
        className="flex-shrink-0 pt-1"
        aria-label="Toggle selection"
      >
        <Checkbox checked={isSelected} />
      </button>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Top row: Lead name + Date */}
        <div className="flex items-start justify-between gap-4">
          {/* Lead name - larger and prominent */}
          <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 truncate flex-1">
            {leadDisplayName}
          </h3>

          {/* Latest reply date - top right with label */}
          <div className="flex-shrink-0 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
            <span className="font-medium">Last reply:</span>{" "}
            <span className="text-gray-900 dark:text-gray-300">
              {formatAbsoluteDateTime(email.latestActivityAt || email.createdAt)}
            </span>
          </div>
        </div>

        {/* Tags row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Lead score / priority indicator */}
          {email.leadScore && email.leadScore > 70 && (
            <Badge
              variant="outline"
              className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300 text-xs px-2 py-0.5 font-medium border rounded-full"
            >
              High
            </Badge>
          )}

          {/* Intent badge */}
          {email.replyIntent && <IntentBadge intent={email.replyIntent} size="sm" />}

          {/* Sentiment badge */}
          {getSentimentBadge()}
        </div>

        {/* Subject line */}
        {email.subject && (
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
            Re: {email.subject}
          </div>
        )}

        {/* Message preview - 2 lines max */}
        <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
          {messagePreview}
          {messagePreview.length >= 150 && "..."}
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {/* Sequence name */}
          {email.sequenceName && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {email.sequenceName}
            </span>
          )}

          {/* Message count */}
          {email.messageCount && email.messageCount > 1 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {email.messageCount} messages
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
