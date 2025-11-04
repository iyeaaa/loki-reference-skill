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

interface SequenceDetailTabsProps {
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
            <h3 className="text-lg font-semibold">{t("sequences.detail.title")}</h3>
            <Button
              onClick={() => setShowEnrollDialog(true)}
              disabled={!sequence || sequence.status !== "active" || hasCompletedEnrollments}
              size="sm"
            >
              <Play className="h-4 w-4 mr-2" />
              {t("sequences.detail.button.runSequence")}
            </Button>
          </div>
          {hasCompletedEnrollments && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-800">
                {t("sequences.detail.warning.hasCompletedEnrollments")}
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="steps">{t("sequences.detail.tabs.steps")}</TabsTrigger>
              <TabsTrigger value="metrics">{t("sequences.detail.tabs.metrics")}</TabsTrigger>
              <TabsTrigger value="enrollments">
                {t("sequences.detail.tabs.enrollments")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="metrics" className="space-y-4">
              <SequenceMetrics
                sequenceId={sequenceId}
                sequenceName={sequence?.name || t("sequences.detail.fallbackName")}
                metrics={metricsData?.data}
                isLoading={metricsLoading}
              />
            </TabsContent>

            <TabsContent value="steps" className="space-y-4">
              <SequenceStepsList sequenceId={sequenceId} isEdit={true} />
            </TabsContent>

            <TabsContent value="enrollments" className="space-y-4">
              <SequenceEnrollmentsTable sequenceId={sequenceId} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 리드 등록 다이얼로그 */}
      {sequence && (
        <EnrollLeadsDialog
          open={showEnrollDialog}
          onOpenChange={setShowEnrollDialog}
          sequence={sequence}
        />
      )}
    </>
  )
}
