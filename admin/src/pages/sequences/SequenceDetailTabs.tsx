import { Play } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SequenceMetrics } from "@/components/SequenceMetrics"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSequence, useSequenceMetrics } from "@/lib/api/hooks/sequences"
import { EnrollLeadsDialog } from "./EnrollLeadsDialog"
import { SequenceEnrollmentsTable } from "./SequenceEnrollmentsTable"
import { SequenceStepsList } from "./SequenceStepList"

type SequenceDetailTabsProps = {
  sequenceId: string
}

export function SequenceDetailTabs({ sequenceId }: SequenceDetailTabsProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState("steps")
  const [showEnrollDialog, setShowEnrollDialog] = useState(false)

  const { data: sequence } = useSequence(sequenceId)
  const { data: metricsData, isLoading: metricsLoading } = useSequenceMetrics(sequenceId)

  // 완료된 등록이 있는지 확인
  const hasCompletedEnrollments = (metricsData?.data?.completedEnrollments ?? 0) > 0

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">{t("sequences.detail.title")}</h3>
            <Button
              disabled={!sequence || sequence.status !== "active" || hasCompletedEnrollments}
              onClick={() => setShowEnrollDialog(true)}
              size="sm"
            >
              <Play className="mr-2 h-4 w-4" />
              {t("sequences.detail.button.runSequence")}
            </Button>
          </div>
          {hasCompletedEnrollments && (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
              <p className="text-amber-800 text-sm">
                {t("sequences.detail.warning.hasCompletedEnrollments")}
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs onValueChange={setActiveTab} value={activeTab}>
            <TabsList className="mb-4 grid w-full grid-cols-3">
              <TabsTrigger value="steps">{t("sequences.detail.tabs.steps")}</TabsTrigger>
              <TabsTrigger value="metrics">{t("sequences.detail.tabs.metrics")}</TabsTrigger>
              <TabsTrigger value="enrollments">
                {t("sequences.detail.tabs.enrollments")}
              </TabsTrigger>
            </TabsList>

            <TabsContent className="space-y-4" value="metrics">
              <SequenceMetrics
                isLoading={metricsLoading}
                metrics={metricsData?.data}
                sequenceId={sequenceId}
                sequenceName={sequence?.name || t("sequences.detail.fallbackName")}
              />
            </TabsContent>

            <TabsContent className="space-y-4" value="steps">
              <SequenceStepsList isEdit={true} sequenceId={sequenceId} />
            </TabsContent>

            <TabsContent className="space-y-4" value="enrollments">
              <SequenceEnrollmentsTable sequenceId={sequenceId} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 리드 등록 다이얼로그 */}
      {sequence && (
        <EnrollLeadsDialog
          onOpenChange={setShowEnrollDialog}
          open={showEnrollDialog}
          sequence={sequence}
        />
      )}
    </>
  )
}
