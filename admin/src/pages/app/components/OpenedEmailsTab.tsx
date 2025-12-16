import { format } from "date-fns"
import { Loader2, MailOpen, User } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useEmailAccountByWorkspaceAndUser } from "@/lib/api/hooks/email-accounts"
import { useEmails } from "@/lib/api/hooks/emails"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import type { Email } from "@/lib/api/types/email"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { ConnectEmailCard } from "./ConnectEmailCard"
import { EmailDetailDialog } from "./EmailDetailDialog"

export function OpenedEmailsTab() {
  const { t } = useTranslation()
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

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
  const { data: userWorkspaces } = useUserWorkspaces(userId, !!userId)
  const userWorkspaceId = userWorkspaces?.[0]?.id || ""

  // Use user's actual workspace ID for email account queries
  const workspaceId =
    isAllWorkspaces || !selectedWorkspace?.id ? userWorkspaceId : selectedWorkspace.id

  // Check if user has a trial preview account
  const { data: emailAccount, isLoading: emailAccountLoading } = useEmailAccountByWorkspaceAndUser(
    workspaceId || "",
    userId,
    !!workspaceId && !!userId,
  )
  const isTrialPreviewAccount = emailAccount?.apiKey === "TRIAL_PREVIEW"

  // Fetch emails with status filter (use undefined for "all" workspaces in email query)
  const emailQueryWorkspaceId = isAllWorkspaces ? undefined : workspaceId || undefined
  const { data: emailsData, isLoading } = useEmails({
    workspaceId: emailQueryWorkspaceId || "",
    status: "opened",
    limit: 20,
  })

  const emails = emailsData?.emails || []

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
          <MailOpen className="mb-4 h-12 w-12 text-muted-foreground" />
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
    return <ConnectEmailCard userEmail={userEmail} />
  }

  if (emails.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <MailOpen className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="font-medium text-lg">
            {t("app.dashboard.noOpenedEmails", "No opened emails yet")}
          </h3>
          <p className="mt-1 text-muted-foreground text-sm">
            {t(
              "app.dashboard.noOpenedEmailsDesc",
              "Emails that recipients have opened will appear here",
            )}
          </p>
        </CardContent>
      </Card>
    )
  }

  const handleEmailClick = (email: Email) => {
    setSelectedEmail(email)
    setDialogOpen(true)
  }

  return (
    <>
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
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{email.toEmail}</span>
                      <Badge className="text-xs" variant="outline">
                        {t("app.dashboard.opened", "Opened")}
                      </Badge>
                    </div>
                    <p className="truncate text-muted-foreground text-sm">
                      {email.subject || t("app.dashboard.noSubject", "(No subject)")}
                    </p>
                  </div>
                </div>
                <div className="ml-4 flex-shrink-0 text-muted-foreground text-xs">
                  {email.openedAt
                    ? format(new Date(email.openedAt), "MMM d, HH:mm")
                    : email.sentAt
                      ? format(new Date(email.sentAt), "MMM d, HH:mm")
                      : ""}
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
