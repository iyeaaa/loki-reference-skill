import { format } from "date-fns"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEmails } from "@/lib/api/hooks/emails"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { OpenedEmailsTab } from "./components/OpenedEmailsTab"
import { SalesStrategyTab } from "./components/SalesStrategyTab"
import { SentEmailsTab } from "./components/SentEmailsTab"

export default function AppDashboardPage() {
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState("sent")
  const isKorean = i18n.language === "ko"

  // Get selected workspace from sidebar selection
  const { selectedWorkspace } = useWorkspace()
  // Use undefined for "all" to fetch from all workspaces
  const workspaceId = selectedWorkspace?.id === "all" ? undefined : selectedWorkspace?.id

  // Fetch email counts (include all outbound statuses)
  const { data: openedEmailsData } = useEmails({
    workspaceId: workspaceId || "",
    status: "opened",
    limit: 100,
  })
  const { data: allEmailsData } = useEmails({
    workspaceId: workspaceId || "",
    direction: "outbound",
    limit: 100,
  })

  const openedCount = openedEmailsData?.emails?.length || 0

  // Calculate counts from all emails
  const { sentCount, scheduledCount, totalOutbound } = useMemo(() => {
    const allEmails = allEmailsData?.emails || []
    const sent = allEmails.filter((e) => e.status === "sent").length
    const scheduled = allEmails.filter((e) =>
      ["scheduled", "draft", "queued"].includes(e.status),
    ).length
    return {
      sentCount: sent,
      scheduledCount: scheduled,
      totalOutbound: sent + scheduled,
    }
  }, [allEmailsData])

  const today = new Date()

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="font-medium text-lg text-muted-foreground">
          {format(today, "EEEE, MMMM d, yyyy")}
        </p>
        <p className="mt-1 text-muted-foreground text-sm">
          {isKorean
            ? `환영합니다! 발송 ${sentCount}개, 예약 ${scheduledCount}개, 열람 ${openedCount}개의 이메일이 있어요.`
            : `Welcome back! You have ${sentCount} sent, ${scheduledCount} scheduled, and ${openedCount} opened emails.`}
        </p>
      </div>

      <Tabs onValueChange={setActiveTab} value={activeTab}>
        <TabsList>
          <TabsTrigger value="sent">
            {isKorean ? "이메일" : "Emails"} ({totalOutbound})
          </TabsTrigger>
          <TabsTrigger value="opened">
            {t("app.dashboard.openedEmails", "Opened Emails")}
          </TabsTrigger>
          <TabsTrigger value="strategy">
            {t("app.dashboard.salesStrategy", "Sales Strategy")}
          </TabsTrigger>
        </TabsList>

        <TabsContent className="mt-4" value="sent">
          <SentEmailsTab />
        </TabsContent>

        <TabsContent className="mt-4" value="opened">
          <OpenedEmailsTab />
        </TabsContent>

        <TabsContent className="mt-4" value="strategy">
          <SalesStrategyTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
