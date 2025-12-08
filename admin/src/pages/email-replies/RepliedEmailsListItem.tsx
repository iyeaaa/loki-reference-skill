import { MessageSquare, Star } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { HighlightedText } from "@/components/ui/highlighted-text"
import type { RepliedEmail } from "@/lib/api/types/email"
import { formatAbsoluteDateTime } from "@/lib/date-utils"
import { IntentBadge } from "./IntentBadge"

/**
 * Check if a string is Base64 encoded
 */
function isBase64(str: string): boolean {
  if (!str || str.length === 0) return false
  // Base64 strings should be at least 4 chars and have valid characters
  // Also check that it doesn't look like regular HTML or plain text
  if (str.startsWith("<") || str.startsWith("<!")) return false
  if (str.startsWith("Dear") || str.startsWith("Hi") || str.startsWith("Hello")) return false
  // Check for Base64 pattern: alphanumeric, +, /, =, and newlines
  const base64Regex = /^[A-Za-z0-9+/\r\n]+=*$/
  // Remove whitespace and check
  const cleaned = str.replace(/[\r\n\s]/g, "")
  return cleaned.length >= 4 && base64Regex.test(cleaned)
}

/**
 * Decode Base64 string to UTF-8 text
 */
function decodeBase64(str: string): string {
  try {
    // Remove whitespace/newlines that might be in the base64 string
    const cleaned = str.replace(/[\r\n\s]/g, "")
    // Decode base64 to binary string
    const binaryString = atob(cleaned)
    // Convert binary string to UTF-8
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const decoder = new TextDecoder("utf-8")
    return decoder.decode(bytes)
  } catch (_e) {
    return str
  }
}

/**
 * Decode content if it's Base64 encoded
 */
function decodeIfBase64(str: string | null | undefined): string {
  if (!str) return ""
  if (isBase64(str)) {
    return decodeBase64(str)
  }
  return str
}

interface RepliedEmailsListItemProps {
  email: RepliedEmail
  isSelected: boolean
  isActive: boolean
  onSelect: () => void
  onToggleCheckbox: (e: React.MouseEvent) => void
  onToggleImportant?: (e: React.MouseEvent) => void
  searchQuery?: string
}

export function RepliedEmailsListItem({
  email,
  isSelected,
  isActive,
  onSelect,
  onToggleCheckbox,
  onToggleImportant,
  searchQuery,
}: RepliedEmailsListItemProps) {
  // Determine the lead display name
  const leadDisplayName =
    email.companyName || email.contactName || email.leadName || email.fromEmail

  // Get message preview (use latest message - the actual reply, not original sent message)
  // Decode Base64 if needed before extracting preview
  const decodedLatestBody = decodeIfBase64(email.latestMessageBody)
  const decodedLatestHtml = decodeIfBase64(email.latestMessageBodyHtml)
  const decodedBodyText = decodeIfBase64(email.bodyText)
  const decodedBodyHtml = decodeIfBase64(email.bodyHtml)

  const messagePreview = decodedLatestBody
    ? decodedLatestBody.replace(/<[^>]*>/g, "").slice(0, 150)
    : decodedLatestHtml
      ? decodedLatestHtml.replace(/<[^>]*>/g, "").slice(0, 150)
      : decodedBodyText
        ? decodedBodyText.slice(0, 150)
        : decodedBodyHtml
          ? decodedBodyHtml.replace(/<[^>]*>/g, "").slice(0, 150)
          : ""

  return (
    <button
      type="button"
      className={`
        flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-all w-full text-left
        hover:bg-gray-50 dark:hover:bg-gray-800/50
        ${isActive ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500" : "bg-white dark:bg-gray-800"}
        ${!email.isRead ? "font-semibold" : ""}
        border-b border-gray-200 dark:border-gray-700
      `}
      onClick={onSelect}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={onToggleCheckbox}
        className="flex-shrink-0 pt-0.5"
        aria-label="Toggle selection"
      >
        <Checkbox checked={isSelected} />
      </button>

      {/* Star/Important button */}
      <button
        type="button"
        onClick={onToggleImportant}
        className="flex-shrink-0 pt-0.5 hover:scale-110 transition-transform"
        aria-label="Toggle important"
      >
        <Star
          className={`h-4 w-4 ${email.isImportant ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`}
        />
      </button>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Top row: Lead name + Subject + Date */}
        <div className="flex items-center justify-between gap-2">
          {/* Lead name */}
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
            <HighlightedText text={leadDisplayName} searchTerm={searchQuery} />
          </h3>

          {/* Subject - in the middle */}
          {email.subject && (
            <div className="flex-1 text-xs text-gray-600 dark:text-gray-400 truncate">
              <HighlightedText text={email.subject} searchTerm={searchQuery} />
            </div>
          )}

          {/* Latest reply date */}
          <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {formatAbsoluteDateTime(email.latestActivityAt || email.createdAt)}
          </div>
        </div>

        {/* Second row: Message preview + Tags */}
        <div className="flex items-center gap-2">
          {/* Message preview - 1 line max */}
          <div className="flex-1 text-xs text-gray-600 dark:text-gray-400 truncate">
            <HighlightedText text={messagePreview} searchTerm={searchQuery} />
          </div>

          {/* Tags (compact) */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Intent badge */}
            {email.replyIntent && <IntentBadge intent={email.replyIntent} size="sm" />}

            {/* Message count */}
            {email.messageCount && email.messageCount > 1 && (
              <span className="flex items-center gap-0.5 text-xs text-gray-500">
                <MessageSquare className="h-3 w-3" />
                {email.messageCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
