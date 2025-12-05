import { useQueryClient } from "@tanstack/react-query"
import { Reply, Sparkles, X } from "lucide-react"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { FloatingReplyPopup } from "@/components/ui/floating-reply-popup"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useSendEmail, useThreadEmails } from "@/lib/api/hooks/emails"
import { useAuth } from "@/lib/auth-provider"
import { generateQuotedText, getReplyRecipient, parseEmailList } from "@/lib/email-utils"
import { EmailItem } from "./EmailItem"

interface ThreadDetailPanelProps {
  threadId: string
  workspaceId?: string
  onClose: () => void
}

export function ThreadDetailPanel({ threadId, workspaceId, onClose }: ThreadDetailPanelProps) {
  const { t, i18n } = useTranslation("translation")
  const { user } = useAuth()
  const { data, isLoading, error } = useThreadEmails(threadId, workspaceId)
  const emails = data?.data || []
  const queryClient = useQueryClient()
  const sendEmail = useSendEmail()

  // 답장 상태
  const [showReply, setShowReply] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [initialReplyText, setInitialReplyText] = useState("")

  // AI Suggestion 상태
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // AI Summary 상태
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  // 각 이메일의 펼침/접힘 상태 (기본값: 모두 펼침)
  const [expandedEmails, setExpandedEmails] = useState<Record<string, boolean>>({})

  // threadId가 변경되면 상태 초기화
  // biome-ignore lint/correctness/useExhaustiveDependencies: threadId 변경 시에만 초기화 필요
  useEffect(() => {
    setExpandedEmails({})
    setShowReply(false)
    setAiError(null)
    setSummary(null)
    setSummaryError(null)
  }, [threadId])

  // 이메일이 펼쳐져 있는지 확인 (기본값: 마지막 이메일만 펼침)
  const isExpanded = (emailId: string) => {
    if (expandedEmails[emailId] !== undefined) {
      return expandedEmails[emailId]
    }
    // 기본값: 마지막 이메일만 펼침
    return emails[emails.length - 1]?.id === emailId
  }

  // 이메일 토글 (현재 isExpanded 상태를 기반으로 토글)
  const toggleEmail = (emailId: string) => {
    const currentState = isExpanded(emailId)
    setExpandedEmails((prev) => ({
      ...prev,
      [emailId]: !currentState,
    }))
  }

  // AI Summary 생성 핸들러
  const handleGenerateAISummary = async () => {
    setSummaryLoading(true)
    setSummaryError(null)

    try {
      const response = await fetch("/api/ai/generate-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId,
          workspaceId,
          language: i18n.language || "ko",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate AI summary")
      }

      const result = await response.json()

      if (result.success && result.data) {
        const aiSummary = result.data.summary || ""
        setSummary(aiSummary)
        toast.success(t("email-replies.aiSummary.success"))
      }
    } catch (err) {
      setSummaryError(
        err instanceof Error
          ? err.message
          : "Unable to connect. Is the computer able to access the url?",
      )
      toast.error(t("email-replies.aiSummary.error.message"))
    } finally {
      setSummaryLoading(false)
    }
  }

  // AI Suggestion 생성 핸들러
  const handleGenerateAISuggestion = async () => {
    setAiLoading(true)
    setAiError(null)

    try {
      const response = await fetch("/api/ai/generate-followup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId,
          workspaceId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate AI suggestion")
      }

      const result = await response.json()
      console.log("AI Suggestion:", result)

      if (result.success && result.data) {
        const aiReply = result.data.rawResponse || ""

        setInitialReplyText(aiReply)
        setShowReply(true)
        toast.success(t("email-replies.ai.success.reply"))
      }
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : "Unable to connect. Is the computer able to access the url?",
      )
      toast.error(t("email-replies.ai.error.suggestion"))
    } finally {
      setAiLoading(false)
    }
  }

  // 답장 전송 핸들러
  const handleSendReply = async (replyText: string, subject: string, files?: File[]) => {
    if (!user) {
      toast.error(t("email-replies.auth.loginRequired"))
      return
    }

    const lastEmail = emails[emails.length - 1]
    if (!lastEmail) return

    const effectiveWorkspaceId = lastEmail.workspaceId || workspaceId

    if (!effectiveWorkspaceId || effectiveWorkspaceId === "" || effectiveWorkspaceId === "all") {
      toast.error(t("email-replies.workspace.notSelected"))
      return
    }

    const toEmail = getReplyRecipient(lastEmail)
    const recipients = parseEmailList(toEmail)
    if (recipients.length === 0) {
      toast.error(t("email-replies.email.invalidRecipient"))
      return
    }

    const bodyWithQuote = `${replyText}\n\n${generateQuotedText(lastEmail)}`

    const payload = {
      workspaceId: effectiveWorkspaceId,
      userId: user.id,
      toEmail: recipients[0],
      subject: subject.trim(),
      bodyText: bodyWithQuote,
      inReplyTo: lastEmail.messageId ?? undefined,
      references: lastEmail.messageId ? [lastEmail.messageId] : undefined,
      includeSignature: true,
      files: files && files.length > 0 ? files : undefined,
    }

    setIsSending(true)
    try {
      await sendEmail.mutateAsync(payload)
      // 스레드 새로고침
      queryClient.invalidateQueries({ queryKey: ["thread-emails", threadId] })
      queryClient.invalidateQueries({ queryKey: ["replied-emails"] })
      setShowReply(false)
    } catch (error) {
      console.error("Failed to send email:", error)
    } finally {
      setIsSending(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <div className="text-sm text-muted-foreground">{t("email-replies.thread.loading")}</div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center text-red-600">
          <div className="text-sm">{t("email-replies.thread.loadError")}</div>
        </div>
      </Card>
    )
  }

  if (emails.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="text-sm">{t("email-replies.thread.noMessages")}</div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-base truncate flex-1">
            {emails[0]?.subject || t("email-replies.thread.noSubject")}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 ml-2">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* AI Summary Section - Gmail Style */}
      {emails.length > 0 && (
        <div className="px-4 pb-3 border-b bg-gray-50/50 dark:bg-gray-900/50">
          {!summary && !summaryLoading && (
            <div className="flex justify-start">
              <Button
                onClick={handleGenerateAISummary}
                disabled={summaryLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2 text-sm font-medium shadow-sm"
                size="sm"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {t("email-replies.aiSummary.button.generate")}
              </Button>
            </div>
          )}

          {summaryLoading && (
            <div className="flex items-center gap-3 py-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t("email-replies.aiSummary.loading")}
              </span>
            </div>
          )}

          {summary && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-600 rounded-full p-1">
                    <Sparkles className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {t("email-replies.aiSummary.title")}
                  </span>
                </div>
                <Button
                  onClick={handleGenerateAISummary}
                  disabled={summaryLoading}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                >
                  {t("email-replies.aiSummary.button.regenerate")}
                </Button>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">
                  {summary}
                </div>
              </div>
            </div>
          )}

          {summaryError && (
            <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-red-600 rounded-full p-1">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
                <span className="text-sm font-medium text-red-800 dark:text-red-200">
                  {t("email-replies.aiSummary.error.title")}
                </span>
              </div>
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">{summaryError}</p>
              <Button
                onClick={handleGenerateAISummary}
                disabled={summaryLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-3 py-1 text-xs"
                size="sm"
              >
                {t("email-replies.aiSummary.button.tryAgain")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Email thread */}
      <TooltipProvider>
        <ScrollArea className="flex-1 px-4 pb-4">
          <div className="pb-4">
            {emails.map((email) => (
              <EmailItem
                key={email.id}
                email={email}
                isExpanded={isExpanded(email.id)}
                onToggle={() => toggleEmail(email.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </TooltipProvider>

      {/* AI Follow-up Suggestion & Reply Button */}
      {emails.length > 0 && (
        <div className="px-4 py-3 border-t space-y-2">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleGenerateAISuggestion}
              disabled={aiLoading}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {aiLoading ? t("email-replies.ai.generating") : t("email-replies.ai.suggestion")}
            </Button>
            <Button
              onClick={() => setShowReply(true)}
              size="sm"
              variant="default"
              className="flex-1"
            >
              <Reply className="h-4 w-4 mr-2" />
              {t("email-replies.thread.replyButton")}
            </Button>
          </div>
          {aiError && <p className="text-sm text-red-600 dark:text-red-400">{aiError}</p>}
        </div>
      )}

      {/* Floating Reply Popup */}
      {emails.length > 0 && (
        <FloatingReplyPopup
          isOpen={showReply}
          onClose={() => {
            setShowReply(false)
            setInitialReplyText("") // Reset initial text when closing
          }}
          onSend={handleSendReply}
          to={emails[emails.length - 1]?.fromEmail || ""}
          subject={`Re: ${emails[0]?.subject || ""}`}
          isSending={isSending}
          initialText={initialReplyText}
        />
      )}
    </Card>
  )
}
