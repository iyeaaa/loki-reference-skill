import { format } from "date-fns"
import { Loader2, MailOpen, User } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useEmails } from "@/lib/api/hooks/emails"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"

export function OpenedEmailsTab() {
  const { t } = useTranslation()

  // Get user's workspace
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), [])
  const userId = currentUser?.id || ""
  const { data: userWorkspaces, isLoading: isLoadingWorkspace } = useUserWorkspaces(
    userId,
    !!userId,
  )
  const workspace = userWorkspaces?.[0]

  // Fetch emails with status filter
  const { data: emailsData, isLoading: isLoadingEmails } = useEmails({
    workspaceId: workspace?.id || "",
    status: "opened",
    limit: 20,
  })

  const emails = emailsData?.emails || []
  const isLoading = isLoadingWorkspace || isLoadingEmails

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (emails.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <MailOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">
            {t("app.dashboard.noOpenedEmails", "No opened emails yet")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "app.dashboard.noOpenedEmailsDesc",
              "Emails that recipients have opened will appear here",
            )}
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
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{email.toEmail}</span>
                    <Badge variant="outline" className="text-xs">
                      {t("app.dashboard.opened", "Opened")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {email.subject || t("app.dashboard.noSubject", "(No subject)")}
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0 text-xs text-muted-foreground ml-4">
                {email.openedAt
                  ? format(new Date(email.openedAt), "MMM d, HH:mm")
                  : email.sentAt
                    ? format(new Date(email.sentAt), "MMM d, HH:mm")
                    : ""}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
