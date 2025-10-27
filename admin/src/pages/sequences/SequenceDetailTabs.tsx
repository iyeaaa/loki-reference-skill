import { Play } from "lucide-react";
import { useState } from "react";
import { SequenceMetrics } from "@/components/SequenceMetrics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSequence, useSequenceMetrics } from "@/lib/api/hooks/sequences";
import { EnrollLeadsDialog } from "./EnrollLeadsDialog";
import { SequenceEnrollmentsTable } from "./SequenceEnrollmentsTable";
import { SequenceStepsList } from "./SequenceStepList";

interface SequenceDetailTabsProps {
  sequenceId: string;
}

export function SequenceDetailTabs({ sequenceId }: SequenceDetailTabsProps) {
  const [activeTab, setActiveTab] = useState("steps");
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);

  const { data: sequence } = useSequence(sequenceId);
  const { data: metricsData, isLoading: metricsLoading } =
    useSequenceMetrics(sequenceId);

  // 완료된 등록이 있는지 확인
  const hasCompletedEnrollments =
    (metricsData?.data?.completedEnrollments ?? 0) > 0;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">시퀀스 상세</h3>
            <Button
              onClick={() => setShowEnrollDialog(true)}
              disabled={
                !sequence ||
                sequence.status !== "active" ||
                hasCompletedEnrollments
              }
              size="sm"
            >
              <Play className="h-4 w-4 mr-2" />
              시퀀스 실행
            </Button>
          </div>
          {hasCompletedEnrollments && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-800">
                ⚠️ 이 시퀀스에는 이미 완료된 등록이 있습니다. 중복 실행을
                방지하기 위해 실행 버튼이 비활성화되었습니다.
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="steps">시퀀스 스텝</TabsTrigger>
              <TabsTrigger value="metrics">성과 지표</TabsTrigger>
              <TabsTrigger value="enrollments">등록 현황</TabsTrigger>
            </TabsList>

            <TabsContent value="metrics" className="space-y-4">
              <SequenceMetrics
                sequenceId={sequenceId}
                sequenceName={sequence?.name || "시퀀스"}
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
  );
}
