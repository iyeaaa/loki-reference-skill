import { format } from "date-fns"
import { CalendarClock, CheckCircle2, Clock, Loader2, Mail, Send } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useEmailAccountByWorkspaceAndUser } from "@/lib/api/hooks/email-accounts"
import { useEmails } from "@/lib/api/hooks/emails"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import type { Email } from "@/lib/api/types/email"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { cn } from "@/lib/utils"
import { ConnectEmailCard } from "./ConnectEmailCard"
import { EmailDetailDialog } from "./EmailDetailDialog"

type EmailFilter = "all" | "sent" | "scheduled"

export function SentEmailsTab() {
  const { t, i18n } = useTranslation()
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [emailFilter, setEmailFilter] = useState<EmailFilter>("all")
  const isKorean = i18n.language === "ko"

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}")
    } catch {
      return {}
    }
  }, [])
  const userId = currentUser?.id || ""

  // Get selected workspace from sidebar selection
  const { selectedWorkspace } = useWorkspace()
  const isAllWorkspaces = selectedWorkspace?.id === "all"

  // Get user's workspaces to find the actual workspace ID
  const { data: userWorkspaces } = useUserWorkspaces(!!userId)
  const userWorkspaceId = userWorkspaces?.[0]?.id || ""

  // Use user's actual workspace ID for email account queries
  const workspaceId =
    isAllWorkspaces || !selectedWorkspace?.id ? userWorkspaceId : selectedWorkspace.id

  // Check if user has a trial preview account
  const { data: emailAccount, isLoading: emailAccountLoading } = useEmailAccountByWorkspaceAndUser(
    workspaceId || "",
    !!workspaceId,
  )
  const isTrialPreviewAccount = emailAccount?.apiKey === "TRIAL_PREVIEW"

  // Fetch emails with status filter (use undefined for "all" workspaces in email query)
  const emailQueryWorkspaceId = isAllWorkspaces ? undefined : workspaceId || undefined

  // Fetch all outbound emails (draft, scheduled, sent) for comprehensive view
  // Use higher limit to get accurate counts
  const { data: emailsData, isLoading } = useEmails({
    workspaceId: emailQueryWorkspaceId || "",
    direction: "outbound",
    limit: 500,
  })

  // Filter emails based on selected tab
  const emails = useMemo(() => {
    const allEmails = emailsData?.emails || []
    if (emailFilter === "all") {
      // Show sent, scheduled, and draft emails
      return allEmails.filter((e) => ["sent", "scheduled", "draft", "queued"].includes(e.status))
    }
    if (emailFilter === "sent") {
      return allEmails.filter((e) => e.status === "sent")
    }
    if (emailFilter === "scheduled") {
      return allEmails.filter((e) => ["scheduled", "draft", "queued"].includes(e.status))
    }
    return allEmails
  }, [emailsData, emailFilter])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  // Get user email for connect card
  const userEmail = currentUser?.email || ""

  // If "All Workspaces" is selected, show message to select a specific workspace
  if (isAllWorkspaces && (isTrialPreviewAccount || !emailAccount)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Mail className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 font-medium text-lg">
            {t("app.dashboard.selectWorkspace", "워크스페이스를 선택해주세요")}
          </h3>
          <p className="max-w-md text-muted-foreground text-sm">
            {t(
              "app.dashboard.selectWorkspaceDesc",
              "이메일 연동을 위해 사이드바에서 특정 워크스페이스를 선택해주세요.",
            )}
          </p>
        </CardContent>
      </Card>
    )
  }

  // Show connect card for trial preview accounts (regardless of email count)
  if (isTrialPreviewAccount || !(emailAccount || emailAccountLoading)) {
    return <ConnectEmailCard userEmail={userEmail} workspaceId={workspaceId} />
  }

  // Helper function to get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge className="bg-green-100 text-green-700 text-xs" variant="secondary">
            <Send className="mr-1 h-3 w-3" />
            {isKorean ? "발송됨" : "Sent"}
          </Badge>
        )
      case "scheduled":
      case "draft":
      case "queued":
        return (
          <Badge className="bg-blue-100 text-blue-700 text-xs" variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            {isKorean ? "예약됨" : "Scheduled"}
          </Badge>
        )
      default:
        return (
          <Badge className="text-xs" variant="secondary">
            {status}
          </Badge>
        )
    }
  }

  // Helper function to get short time for list display
  const getShortEmailTime = (email: Email) => {
    if (email.status === "sent" && email.sentAt) {
      return isKorean
        ? format(new Date(email.sentAt), "M/d HH:mm")
        : format(new Date(email.sentAt), "M/d HH:mm")
    }
    if (email.scheduledAt) {
      return isKorean
        ? format(new Date(email.scheduledAt), "M/d HH:mm")
        : format(new Date(email.scheduledAt), "M/d HH:mm")
    }
    return ""
  }

  // Count emails by status for tabs
  const allEmails = emailsData?.emails || []
  const sentCount = allEmails.filter((e) => e.status === "sent").length
  const scheduledCount = allEmails.filter((e) =>
    ["scheduled", "draft", "queued"].includes(e.status),
  ).length

  if (emails.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Mail className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="font-medium text-lg">
            {emailFilter === "scheduled"
              ? isKorean
                ? "예약된 이메일이 없어요"
                : "No scheduled emails"
              : emailFilter === "sent"
                ? isKorean
                  ? "발송된 이메일이 없어요"
                  : "No sent emails yet"
                : isKorean
                  ? "이메일이 없어요"
                  : "No emails yet"}
          </h3>
          <p className="mt-1 text-muted-foreground text-sm">
            {emailFilter === "scheduled"
              ? isKorean
                ? "캠페인을 시작하면 예약된 이메일이 여기에 표시됩니다"
                : "Scheduled emails from campaigns will appear here"
              : isKorean
                ? "발송된 이메일이 여기에 표시됩니다"
                : "Emails that have been sent will appear here"}
          </p>
        </CardContent>
      </Card>
    )
  }

  const handleEmailClick = (email: Email) => {
    setSelectedEmail(email)
    setDialogOpen(true)
  }

  const totalCount = sentCount + scheduledCount

  return (
    <>
      {/* Summary Stats - Always visible cards */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            emailFilter === "all" && "shadow-md ring-2 ring-primary",
          )}
          onClick={() => setEmailFilter("all")}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <Mail className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="font-bold text-2xl">{totalCount}</p>
              <p className="text-muted-foreground text-xs">{isKorean ? "전체" : "Total"}</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            emailFilter === "sent" && "shadow-md ring-2 ring-green-500",
          )}
          onClick={() => setEmailFilter("sent")}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-bold text-2xl text-green-600">{sentCount}</p>
              <p className="text-muted-foreground text-xs">{isKorean ? "발송됨" : "Sent"}</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            emailFilter === "scheduled" && "shadow-md ring-2 ring-blue-500",
          )}
          onClick={() => setEmailFilter("scheduled")}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <CalendarClock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-2xl text-blue-600">{scheduledCount}</p>
              <p className="text-muted-foreground text-xs">{isKorean ? "예약됨" : "Scheduled"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email List */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            {emails.map((email) => (
              <button
                className="flex w-full cursor-pointer items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent/50"
                key={email.id}
                onClick={() => handleEmailClick(email)}
                type="button"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
                      email.status === "sent" ? "bg-green-100" : "bg-blue-100",
                    )}
                  >
                    {email.status === "sent" ? (
                      <Send className="h-4 w-4 text-green-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{email.toEmail}</span>
                      {getStatusBadge(email.status)}
                    </div>
                    <p className="truncate text-muted-foreground text-sm">
                      {email.subject || t("app.dashboard.noSubject", "(No subject)")}
                    </p>
                  </div>
                </div>
                <div className="ml-4 flex shrink-0 flex-col items-end text-muted-foreground text-xs">
                  <span>{getShortEmailTime(email)}</span>
                  {email.status !== "sent" && email.scheduledAt && (
                    <span className="text-blue-500">{isKorean ? "예정" : "Scheduled"}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <EmailDetailDialog email={selectedEmail} onOpenChange={setDialogOpen} open={dialogOpen} />
    </>
  )
}
