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
  if (!str || str.length === 0) {
    return false
  }
  // Base64 strings should be at least 4 chars and have valid characters
  // Also check that it doesn't look like regular HTML or plain text
  if (str.startsWith("<") || str.startsWith("<!")) {
    return false
  }
  if (str.startsWith("Dear") || str.startsWith("Hi") || str.startsWith("Hello")) {
    return false
  }
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
  if (!str) {
    return ""
  }
  if (isBase64(str)) {
    return decodeBase64(str)
  }
  return str
}

type RepliedEmailsListItemProps = {
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
    // biome-ignore lint/a11y/useSemanticElements: Cannot use <button> because it contains nested <button> elements for checkbox and star
    <div
      className={`flex w-full cursor-pointer items-start gap-2 px-3 py-2.5 text-left transition-all hover:bg-gray-50 dark:hover:bg-gray-800/50 ${isActive ? "border-blue-500 border-l-4 bg-blue-50 dark:bg-blue-900/20" : "bg-white dark:bg-gray-800"}
        ${email.isRead ? "" : "font-semibold"}border-b border-gray-200 dark:border-gray-700`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      role="button"
      tabIndex={0}
    >
      {/* Checkbox */}
      <button
        aria-label="Toggle selection"
        className="flex-shrink-0 pt-0.5"
        onClick={onToggleCheckbox}
        type="button"
      >
        <Checkbox checked={isSelected} />
      </button>

      {/* Star/Important button */}
      <button
        aria-label="Toggle important"
        className="flex-shrink-0 pt-0.5 transition-transform hover:scale-110"
        onClick={onToggleImportant}
        type="button"
      >
        <Star
          className={`h-4 w-4 ${email.isImportant ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`}
        />
      </button>

      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-1">
        {/* Top row: Lead name + Subject + Date */}
        <div className="flex items-center justify-between gap-2">
          {/* Lead name */}
          <h3 className="truncate font-semibold text-gray-900 text-sm dark:text-gray-100">
            <HighlightedText searchTerm={searchQuery} text={leadDisplayName} />
          </h3>

          {/* Subject - in the middle */}
          {email.subject && (
            <div className="flex-1 truncate text-gray-600 text-xs dark:text-gray-400">
              <HighlightedText searchTerm={searchQuery} text={email.subject} />
            </div>
          )}

          {/* Latest reply date */}
          <div className="flex-shrink-0 whitespace-nowrap text-gray-500 text-xs dark:text-gray-400">
            {formatAbsoluteDateTime(email.latestActivityAt || email.createdAt)}
          </div>
        </div>

        {/* Second row: Message preview + Tags */}
        <div className="flex items-center gap-2">
          {/* Message preview - 1 line max */}
          <div className="flex-1 truncate text-gray-600 text-xs dark:text-gray-400">
            <HighlightedText searchTerm={searchQuery} text={messagePreview} />
          </div>

          {/* Tags (compact) */}
          <div className="flex flex-shrink-0 items-center gap-1">
            {/* Intent badge */}
            {email.replyIntent && <IntentBadge intent={email.replyIntent} size="sm" />}

            {/* Message count */}
            {email.messageCount && email.messageCount > 1 && (
              <span className="flex items-center gap-0.5 text-gray-500 text-xs">
                <MessageSquare className="h-3 w-3" />
                {email.messageCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
