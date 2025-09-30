import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SequenceEnrollmentsTable } from "./SequenceEnrollmentsTable"
import { SequenceStepsList } from "./SequenceStepsList"

interface SequenceDetailTabsProps {
  sequenceId: string
}

export function SequenceDetailTabs({ sequenceId }: SequenceDetailTabsProps) {
  const [activeTab, setActiveTab] = useState("steps")

  return (
    <Card>
      <CardContent className="pt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="steps">시퀀스 스텝</TabsTrigger>
            <TabsTrigger value="enrollments">등록 현황</TabsTrigger>
          </TabsList>

          <TabsContent value="steps" className="space-y-4">
            <SequenceStepsList sequenceId={sequenceId} isEdit={true} />
          </TabsContent>

          <TabsContent value="enrollments" className="space-y-4">
            <SequenceEnrollmentsTable sequenceId={sequenceId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
