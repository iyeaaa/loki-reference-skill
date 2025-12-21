import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEmails } from "@/lib/api/hooks/emails"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { OpenedEmailsTab } from "./components/OpenedEmailsTab"
import { SalesStrategyTab } from "./components/SalesStrategyTab"
import { SentEmailsTab } from "./components/SentEmailsTab"

export default function AppDashboardPage() {
  const { i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState("sent")
  const isKorean = i18n.language === "ko"

  // Get current user
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}")
    } catch {
      return {}
    }
  }, [])
  const userId = currentUser?.id || ""

  // Get workspace
  const { selectedWorkspace } = useWorkspace()
  const isAllWorkspaces = selectedWorkspace?.id === "all"
  const { data: userWorkspaces } = useUserWorkspaces(!!userId)
  const userWorkspaceId = userWorkspaces?.[0]?.id || ""
  const workspaceId =
    isAllWorkspaces || !selectedWorkspace?.id ? userWorkspaceId : selectedWorkspace.id

  // Fetch email counts
  const { data: allEmailsData } = useEmails({
    workspaceId: workspaceId || "",
    direction: "outbound",
    limit: 500,
  })
  const { data: openedEmailsData } = useEmails({
    workspaceId: workspaceId || "",
    status: "opened",
    limit: 500,
  })

  // Calculate counts
  const { sentCount, scheduledCount } = useMemo(() => {
    const allEmails = allEmailsData?.emails || []
    const sent = allEmails.filter((e) => e.status === "sent").length
    const scheduled = allEmails.filter((e) =>
      ["scheduled", "draft", "queued"].includes(e.status),
    ).length
    return { sentCount: sent, scheduledCount: scheduled }
  }, [allEmailsData])
  const openedCount = openedEmailsData?.emails?.length || 0

  const today = new Date()
  const formattedDate = isKorean
    ? format(today, "yyyy년 M월 d일 EEEE", { locale: ko })
    : format(today, "EEEE, MMMM d, yyyy")

  return (
    <div className="space-y-6">
      <div>
        <p className="font-medium text-lg text-muted-foreground">{formattedDate}</p>
        <p className="mt-1 text-muted-foreground text-sm">
          {isKorean
            ? `발송 ${sentCount}개, 예약 ${scheduledCount}개, 열람 ${openedCount}개의 이메일이 있어요.`
            : `${sentCount} sent, ${scheduledCount} scheduled, ${openedCount} opened emails.`}
        </p>
      </div>

      <Tabs onValueChange={setActiveTab} value={activeTab}>
        <TabsList className="w-fit">
          <TabsTrigger value="sent">{isKorean ? "이메일" : "Emails"}</TabsTrigger>
          <TabsTrigger value="opened">{isKorean ? "열린 이메일" : "Opened Emails"}</TabsTrigger>
          <TabsTrigger value="strategy">{isKorean ? "영업 전략" : "Sales Strategy"}</TabsTrigger>
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
