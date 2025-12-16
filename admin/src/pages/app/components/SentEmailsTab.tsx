import { format } from "date-fns"
import { Loader2, Mail, User } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useEmailAccountByWorkspaceAndUser } from "@/lib/api/hooks/email-accounts"
import { useEmails } from "@/lib/api/hooks/emails"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { ConnectEmailCard } from "./ConnectEmailCard"

export function SentEmailsTab() {
  const { t } = useTranslation()

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const userId = currentUser?.id || ""

  // Get selected workspace from sidebar selection
  const { selectedWorkspace } = useWorkspace()
  // Use undefined for "all" to fetch from all workspaces
  const workspaceId = selectedWorkspace?.id === "all" ? undefined : selectedWorkspace?.id

  // Check if user has a trial preview account
  const { data: emailAccount, isLoading: emailAccountLoading } = useEmailAccountByWorkspaceAndUser(
    workspaceId || "",
    userId,
    !!workspaceId && !!userId,
  )
  const isTrialPreviewAccount = emailAccount?.apiKey === "TRIAL_PREVIEW"

  // Fetch emails with status filter
  const { data: emailsData, isLoading } = useEmails({
    workspaceId: workspaceId || "",
    status: "sent",
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

  // Show connect card for trial preview accounts (regardless of email count)
  if (isTrialPreviewAccount || (!emailAccount && !emailAccountLoading)) {
    return <ConnectEmailCard userEmail={userEmail} />
  }

  if (emails.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Mail className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">
            {t("app.dashboard.noSentEmails", "No sent emails yet")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.dashboard.noSentEmailsDesc", "Emails that have been sent will appear here")}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-2">
          {emails.map((email) => (
            <div
              key={email.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{email.toEmail}</span>
                    <Badge variant="secondary" className="text-xs">
                      {t("app.dashboard.sent", "Sent")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {email.subject || t("app.dashboard.noSubject", "(No subject)")}
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0 text-xs text-muted-foreground ml-4">
                {email.sentAt ? format(new Date(email.sentAt), "MMM d, HH:mm") : ""}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
