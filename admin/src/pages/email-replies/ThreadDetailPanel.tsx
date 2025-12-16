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

type ThreadDetailPanelProps = {
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
    return emails.at(-1)?.id === emailId
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

    const lastEmail = emails.at(-1)
    if (!lastEmail) {
      return
    }

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
      <Card className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
          <div className="text-muted-foreground text-sm">{t("email-replies.thread.loading")}</div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="flex h-full items-center justify-center">
        <div className="text-center text-red-600">
          <div className="text-sm">{t("email-replies.thread.loadError")}</div>
        </div>
      </Card>
    )
  }

  if (emails.length === 0) {
    return (
      <Card className="flex h-full items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="text-sm">{t("email-replies.thread.noMessages")}</div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="flex h-full flex-col">
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="flex-1 truncate font-medium text-base">
            {emails[0]?.subject || t("email-replies.thread.noSubject")}
          </h3>
          <Button className="ml-2 h-8 w-8 p-0" onClick={onClose} size="sm" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* AI Summary Section - Gmail Style */}
      {emails.length > 0 && (
        <div className="border-b bg-gray-50/50 px-4 pb-3 dark:bg-gray-900/50">
          {!(summary || summaryLoading) && (
            <div className="flex justify-start">
              <Button
                className="rounded-full bg-blue-600 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-blue-700"
                disabled={summaryLoading}
                onClick={handleGenerateAISummary}
                size="sm"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {t("email-replies.aiSummary.button.generate")}
              </Button>
            </div>
          )}

          {summaryLoading && (
            <div className="flex items-center gap-3 py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <span className="text-gray-600 text-sm dark:text-gray-400">
                {t("email-replies.aiSummary.loading")}
              </span>
            </div>
          )}

          {summary && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-blue-600 p-1">
                    <Sparkles className="h-3 w-3 text-white" />
                  </div>
                  <span className="font-medium text-gray-900 text-sm dark:text-gray-100">
                    {t("email-replies.aiSummary.title")}
                  </span>
                </div>
                <Button
                  className="h-7 px-2 text-gray-500 text-xs hover:text-gray-700"
                  disabled={summaryLoading}
                  onClick={handleGenerateAISummary}
                  size="sm"
                  variant="ghost"
                >
                  {t("email-replies.aiSummary.button.regenerate")}
                </Button>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="whitespace-pre-line text-gray-800 text-sm leading-relaxed dark:text-gray-200">
                  {summary}
                </div>
              </div>
            </div>
          )}

          {summaryError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/20">
              <div className="mb-2 flex items-center gap-2">
                <div className="rounded-full bg-red-600 p-1">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
                <span className="font-medium text-red-800 text-sm dark:text-red-200">
                  {t("email-replies.aiSummary.error.title")}
                </span>
              </div>
              <p className="mb-3 text-red-600 text-sm dark:text-red-400">{summaryError}</p>
              <Button
                className="rounded-full bg-blue-600 px-3 py-1 text-white text-xs hover:bg-blue-700"
                disabled={summaryLoading}
                onClick={handleGenerateAISummary}
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
                email={email}
                isExpanded={isExpanded(email.id)}
                key={email.id}
                onToggle={() => toggleEmail(email.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </TooltipProvider>

      {/* AI Follow-up Suggestion & Reply Button */}
      {emails.length > 0 && (
        <div className="space-y-2 border-t px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              className="flex-1"
              disabled={aiLoading}
              onClick={handleGenerateAISuggestion}
              size="sm"
              variant="outline"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {aiLoading ? t("email-replies.ai.generating") : t("email-replies.ai.suggestion")}
            </Button>
            <Button
              className="flex-1"
              onClick={() => setShowReply(true)}
              size="sm"
              variant="default"
            >
              <Reply className="mr-2 h-4 w-4" />
              {t("email-replies.thread.replyButton")}
            </Button>
          </div>
          {aiError && <p className="text-red-600 text-sm dark:text-red-400">{aiError}</p>}
        </div>
      )}

      {/* Floating Reply Popup */}
      {emails.length > 0 && (
        <FloatingReplyPopup
          initialText={initialReplyText}
          isOpen={showReply}
          isSending={isSending}
          onClose={() => {
            setShowReply(false)
            setInitialReplyText("") // Reset initial text when closing
          }}
          onSend={handleSendReply}
          subject={`Re: ${emails[0]?.subject || ""}`}
          to={emails.at(-1)?.fromEmail || ""}
        />
      )}
    </Card>
  )
}
