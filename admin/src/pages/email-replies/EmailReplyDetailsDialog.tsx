import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { EmailReplyWithDetails } from "@/lib/api/types/email-reply"
import { formatRelativeTime } from "@/lib/date-utils"

type EmailReplyDetailsDialogProps = {
  reply: EmailReplyWithDetails
  onClose: () => void
}

export function EmailReplyDetailsDialog({ reply, onClose }: EmailReplyDetailsDialogProps) {
  const { t } = useTranslation()

  const getSentimentBadge = (sentiment: string | null) => {
    if (!sentiment) {
      return {
        label: t("email-replies.filters.sentiment.pending"),
        color: "bg-gray-100 text-gray-800",
      }
    }

    switch (sentiment) {
      case "positive":
        return {
          label: t("email-replies.filters.sentiment.positive"),
          color: "bg-green-100 text-green-800",
        }
      case "neutral":
        return {
          label: t("email-replies.filters.sentiment.neutral"),
          color: "bg-gray-100 text-gray-800",
        }
      case "negative":
        return {
          label: t("email-replies.filters.sentiment.negative"),
          color: "bg-red-100 text-red-800",
        }
      case "interested":
        return {
          label: t("email-replies.filters.sentiment.interested"),
          color: "bg-blue-100 text-blue-800",
        }
      case "not_interested":
        return {
          label: t("email-replies.filters.sentiment.notInterested"),
          color: "bg-orange-100 text-orange-800",
        }
      default:
        return { label: sentiment, color: "bg-gray-100 text-gray-800" }
    }
  }

  const sentimentBadge = getSentimentBadge(reply.sentiment)

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">{t("email-replies.details.title")}</h3>
          <Badge className={sentimentBadge.color} variant="outline">
            {sentimentBadge.label}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">
              {t("email-replies.details.readStatus.label")}:
            </span>
            <span className="ml-2 font-medium">
              {reply.isRead
                ? t("email-replies.details.readStatus.read")
                : t("email-replies.details.readStatus.unread")}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{t("email-replies.details.receivedAt")}:</span>
            <span className="ml-2 font-medium">
              {reply.createdAt ? formatRelativeTime(new Date(reply.createdAt)) : "-"}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Original Email */}
      <div className="space-y-3">
        <h4 className="font-semibold text-md">{t("email-replies.details.originalEmail")}</h4>
        {reply.originalEmail ? (
          <div className="space-y-2 rounded-lg bg-muted p-4">
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">
                  {t("email-replies.details.subject")}:
                </span>
                <span className="ml-2">
                  {reply.originalEmail.subject || t("email-replies.details.noSubject")}
                </span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">
                  {t("email-replies.details.from")}:
                </span>
                <span className="ml-2">{reply.originalEmail.fromEmail}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">
                  {t("email-replies.details.to")}:
                </span>
                <span className="ml-2">{reply.originalEmail.toEmail}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">
                  {t("email-replies.details.sentAt")}:
                </span>
                <span className="ml-2">
                  {reply.originalEmail.sentAt
                    ? formatRelativeTime(new Date(reply.originalEmail.sentAt))
                    : "-"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">
            {t("email-replies.details.noOriginalEmail")}
          </div>
        )}
      </div>

      <Separator />

      {/* Reply Email */}
      <div className="space-y-3">
        <h4 className="font-semibold text-md">{t("email-replies.details.replyEmail")}</h4>
        {reply.replyEmail ? (
          <div className="space-y-3">
            <div className="space-y-2 rounded-lg bg-muted p-4">
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">
                    {t("email-replies.details.subject")}:
                  </span>
                  <span className="ml-2">
                    {reply.replyEmail.subject || t("email-replies.details.noSubject")}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    {t("email-replies.details.from")}:
                  </span>
                  <span className="ml-2">{reply.replyEmail.fromEmail}</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    {t("email-replies.details.to")}:
                  </span>
                  <span className="ml-2">{reply.replyEmail.toEmail}</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    {t("email-replies.details.receivedDate")}:
                  </span>
                  <span className="ml-2">
                    {reply.replyEmail.sentAt
                      ? formatRelativeTime(new Date(reply.replyEmail.sentAt))
                      : "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* Email Body */}
            <div className="max-h-96 overflow-y-auto rounded-lg border p-4">
              {reply.replyEmail.bodyHtml ? (
                <div className="prose prose-sm max-w-none">
                  {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Email HTML content from trusted webhook source */}
                  <div dangerouslySetInnerHTML={{ __html: reply.replyEmail.bodyHtml }} />
                </div>
              ) : reply.replyEmail.bodyText ? (
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {reply.replyEmail.bodyText}
                </pre>
              ) : (
                <div className="text-muted-foreground text-sm">
                  {t("email-replies.details.noContent")}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">
            {t("email-replies.details.noReplyEmail")}
          </div>
        )}
      </div>

      {/* AI Summary */}
      {reply.aiSummary && (
        <>
          <Separator />
          <div className="space-y-3">
            <h4 className="font-semibold text-md">{t("email-replies.details.aiSummary")}</h4>
            <div className="rounded-lg bg-blue-50 p-4 text-sm">{reply.aiSummary}</div>
          </div>
        </>
      )}

      {/* Intent */}
      {reply.intent && (
        <>
          <Separator />
          <div className="space-y-3">
            <h4 className="font-semibold text-md">{t("email-replies.details.intentAnalysis")}</h4>
            <div className="rounded-lg bg-purple-50 p-4 text-sm">{reply.intent}</div>
          </div>
        </>
      )}

      {/* Close Button */}
      <div className="flex justify-end pt-4">
        <Button onClick={onClose}>{t("email-replies.details.close")}</Button>
      </div>
    </div>
  )
}
