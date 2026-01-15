import { Copy, Loader2, Mail, Send } from "lucide-react"
import { useEffect, useId, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Tag } from "@/components/ui/tag"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { ThreadEmail } from "@/lib/api/types/email"
import { formatKoreanDateTime } from "@/lib/date-utils"

type MessageDetailViewProps = {
  isOpen: boolean
  onClose: () => void
  email: ThreadEmail | null
  loading?: boolean
}

export function MessageDetailView({
  isOpen,
  onClose,
  email,
  loading = false,
}: MessageDetailViewProps) {
  const { t } = useTranslation()
  const replyContentId = useId()
  const [replyContent, setReplyContent] = useState("")
  const [isSending, setIsSending] = useState(false)

  // Reset reply content when modal closes
  useEffect(() => {
    if (!isOpen) {
      setReplyContent("")
    }
  }, [isOpen])

  const handleSendReply = async () => {
    if (!replyContent.trim()) {
      toast.error("Please enter reply content")
      return
    }

    setIsSending(true)
    try {
      // TODO: Implement actual send reply logic
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate API call
      toast.success("Reply sent successfully")
      setReplyContent("")
      onClose()
    } catch (_error) {
      toast.error("Failed to send reply")
    } finally {
      setIsSending(false)
    }
  }

  const getInitials = (emailAddress: string) => {
    const parts = emailAddress.split("@")[0].split(".")
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return emailAddress.substring(0, 2).toUpperCase()
  }

  const getName = (emailAddress: string, leadName?: string | null) => {
    if (leadName) {
      return leadName
    }
    const localPart = emailAddress.split("@")[0]
    return localPart
      .split(".")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  const makeLinksClickable = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    return text.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            className="text-blue-600 hover:underline"
            href={part}
            key={index}
            rel="noopener noreferrer"
            target="_blank"
          >
            {part}
          </a>
        )
      }
      return part
    })
  }

  if (!(email || loading)) {
    return (
      <Sheet onOpenChange={onClose} open={isOpen}>
        <SheetContent className="flex w-full flex-col p-0 sm:max-w-2xl" side="right">
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <Mail className="mb-4 h-16 w-16 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">Select an email to view its contents</p>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  if (loading || !email) {
    return (
      <Sheet onOpenChange={onClose} open={isOpen}>
        <SheetContent className="flex w-full flex-col p-0 sm:max-w-2xl" side="right">
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">{t("message.loading")}</p>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  const senderName = getName(email.fromEmail, email.leadName)
  const recipientName = getName(email.toEmail)

  return (
    <Sheet onOpenChange={onClose} open={isOpen}>
      <SheetContent className="flex w-full flex-col overflow-hidden p-0 sm:max-w-2xl" side="right">
        <div className="flex-shrink-0 border-b px-6 pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="mb-2 pr-8 font-semibold text-xl">{email.subject || "(No Subject)"}</h2>
              <div className="flex flex-wrap gap-2">
                {email.replyIntent && (
                  <Tag size="small" variant="other-category">
                    {email.replyIntent.replace("_", " ")}
                  </Tag>
                )}
                {email.replySentiment && (
                  <Tag
                    size="small"
                    variant={
                      email.replySentiment === "positive" || email.replySentiment === "interested"
                        ? "positive"
                        : email.replySentiment === "negative" ||
                            email.replySentiment === "not_interested"
                          ? "negative"
                          : "other"
                    }
                  >
                    {email.replySentiment.replace("_", " ")}
                  </Tag>
                )}
                <Badge variant={email.direction === "inbound" ? "default" : "secondary"}>
                  {email.direction === "inbound" ? "Inbound" : "Outbound"}
                </Badge>
                <Badge variant="outline">{email.status}</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 border-b px-6 py-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
              <span className="font-medium text-gray-600 text-sm dark:text-gray-300">
                {getInitials(email.fromEmail)}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-semibold">{senderName}</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
                        onClick={() => copyToClipboard(email.fromEmail)}
                        type="button"
                      >
                        &lt;{email.fromEmail}&gt;
                        <Copy className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copy email address</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-muted-foreground text-sm">
                to {recipientName} &lt;{email.toEmail}&gt;
              </div>
              <div className="mt-1 text-muted-foreground text-xs">
                {formatKoreanDateTime(email.createdAt)}
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {email.bodyHtml ? (
              <div
                className="whitespace-pre-wrap break-words"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: Email content needs to be rendered as HTML
                dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
              />
            ) : (
              <div className="whitespace-pre-wrap break-words">
                {email.bodyText ? makeLinksClickable(email.bodyText) : "(No content)"}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Reply Section */}
        <div className="flex-shrink-0 border-t">
          {/* Reply Header */}
          <div className="border-b bg-blue-50 px-6 py-3 dark:bg-blue-950/20">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Send className="h-4 w-4" />
                <span className="font-medium text-sm">New Reply</span>
              </div>
              <span className="text-muted-foreground text-sm">Reply to {email.fromEmail}</span>
            </div>
          </div>

          {/* Reply Content Label */}
          <div className="px-6 pt-4 pb-2">
            <label
              className="font-medium text-gray-700 text-sm dark:text-gray-300"
              htmlFor={replyContentId}
            >
              Reply Content
            </label>
          </div>

          {/* Reply Textarea */}
          <div className="px-6 pb-4">
            <Textarea
              className="min-h-[120px] resize-none"
              disabled={isSending}
              id={replyContentId}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Enter reply content..."
              value={replyContent}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 bg-gray-50 px-6 py-4 dark:bg-gray-900">
            <Button
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={!replyContent.trim() || isSending}
              onClick={handleSendReply}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Reply
                </>
              )}
            </Button>
            <Button disabled={isSending} onClick={onClose} variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
