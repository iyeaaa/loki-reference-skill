import { ArrowLeft } from "lucide-react"
import { useEffect } from "react"
import toast from "react-hot-toast"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSequence, useUpdateSequence } from "@/lib/api/hooks/sequences"
import type { SequenceStatus } from "@/lib/api/types/sequence"
import { SequenceDetailTabs } from "./SequenceDetailTabs"
import { SequenceForm } from "./SequenceForm"

export default function SequenceEditPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sequenceId = searchParams.get("id")

  const { data: sequence, isLoading, error } = useSequence(sequenceId || "", !!sequenceId)
  const updateSequence = useUpdateSequence()

  useEffect(() => {
    if (!sequenceId) {
      toast.error("시퀀스 ID가 없습니다")
      navigate("/sequences")
    }
  }, [sequenceId, navigate])

  useEffect(() => {
    if (error) {
      toast.error("시퀀스를 불러오는데 실패했습니다")
      navigate("/sequences")
    }
  }, [error, navigate])

  const handleUpdateSequence = async (sequenceData: unknown) => {
    if (!sequenceId) return

    updateSequence.mutate(
      {
        sequenceId,
        data: sequenceData as {
          name: string
          description?: string
          status: SequenceStatus
        },
      },
      {
        onSuccess: () => {
          toast.success("시퀀스가 업데이트되었습니다")
        },
      },
    )
  }

  const handleBack = () => {
    navigate("/sequences")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    )
  }

  if (!sequence) {
    return null
  }

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          뒤로
        </Button>
      </div>

      {/* Main Content Card */}
      <Card>
        <CardHeader className="pb-4 border-b">
          <CardTitle className="text-xl font-semibold">시퀀스 관리</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <SequenceForm
              sequence={sequence}
              isEdit={true}
              onSave={handleUpdateSequence}
              onCancel={handleBack}
              stepsCount={sequence.stepsCount || 0}
            />

            <div className="border-t pt-6">
              <SequenceDetailTabs sequenceId={sequence.id} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
