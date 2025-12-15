import { format } from "date-fns"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEmails } from "@/lib/api/hooks/emails"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { OpenedEmailsTab } from "./components/OpenedEmailsTab"
import { SalesStrategyTab } from "./components/SalesStrategyTab"
import { SentEmailsTab } from "./components/SentEmailsTab"

export default function AppDashboardPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState("sent")

  // Get user's workspace
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), [])
  const userId = currentUser?.id || ""
  const { data: userWorkspaces } = useUserWorkspaces(userId, !!userId)
  const workspace = userWorkspaces?.[0]

  // Fetch email counts
  const { data: openedEmailsData } = useEmails({
    workspaceId: workspace?.id || "",
    status: "opened",
    limit: 100,
  })
  const { data: sentEmailsData } = useEmails({
    workspaceId: workspace?.id || "",
    status: "sent",
    limit: 100,
  })

  const openedCount = openedEmailsData?.emails?.length || 0
  const sentCount = sentEmailsData?.emails?.length || 0
  const today = new Date()

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <p className="text-lg font-medium text-muted-foreground">
          {format(today, "EEEE, MMMM d, yyyy")}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.dashboard.greeting",
            "Welcome back! You have {{opened}} opened and {{sent}} sent emails.",
            {
              opened: openedCount,
              sent: sentCount,
            },
          )}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sent">{t("app.dashboard.sentEmails", "Sent Emails")}</TabsTrigger>
          <TabsTrigger value="opened">
            {t("app.dashboard.openedEmails", "Opened Emails")}
          </TabsTrigger>
          <TabsTrigger value="strategy">
            {t("app.dashboard.salesStrategy", "Sales Strategy")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sent" className="mt-4">
          <SentEmailsTab />
        </TabsContent>

        <TabsContent value="opened" className="mt-4">
          <OpenedEmailsTab />
        </TabsContent>

        <TabsContent value="strategy" className="mt-4">
          <SalesStrategyTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
