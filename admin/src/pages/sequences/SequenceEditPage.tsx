import { ArrowLeft, FileText, Mail, Users } from "lucide-react"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { useSequence, useUpdateSequence } from "@/lib/api/hooks/sequences"
import type { SequenceStatus } from "@/lib/api/types/sequence"
import { cn } from "@/lib/utils"
import { CampaignOverview } from "./CampaignOverview"
import { SequenceEnrollmentsTable } from "./SequenceEnrollmentsTable"
import { SequenceForm } from "./SequenceForm"
import { SequenceStepsList } from "./SequenceStepList"

export default function SequenceEditPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sequenceId = searchParams.get("id")
  const [selectedMenu, setSelectedMenu] = useState("overview")
  const [memo, setMemo] = useState("")

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

  const isDraftOrReady = sequence.status === "draft" || sequence.status === "ready"
  const isActiveOrBeyond = ["active", "paused", "completed", "archived"].includes(sequence.status)

  // Menu items based on status
  const menuItems = isDraftOrReady
    ? [
        { id: "customer-selection", label: "고객 선택", icon: Users },
        { id: "scenario", label: "시나리오", icon: Mail },
        { id: "memo", label: "메모", icon: FileText },
      ]
    : [
        { id: "overview", label: "개요", icon: FileText },
        { id: "enrollment", label: "발송현황", icon: Mail },
        { id: "memo", label: "메모", icon: FileText },
      ]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            돌아가기
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{sequence.name}</h1>
            <p className="text-sm text-muted-foreground">캠페인 상세</p>
          </div>
        </div>
      </div>

      {/* 2-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Menu */}
        <div className="w-64 border-r bg-muted/30">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedMenu(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      selectedMenu === item.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {/* Draft/Ready Status Content */}
            {isDraftOrReady && (
              <>
                {selectedMenu === "customer-selection" && (
                  <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-4">고객 선택</h2>
                    <SequenceForm
                      sequence={sequence}
                      isEdit={true}
                      onSave={handleUpdateSequence}
                      onCancel={handleBack}
                      stepsCount={sequence.stepsCount || 0}
                    />
                  </Card>
                )}

                {selectedMenu === "scenario" && (
                  <div>
                    <h2 className="text-xl font-semibold mb-4">시나리오</h2>
                    <SequenceStepsList sequenceId={sequence.id} isEdit={true} />
                  </div>
                )}

                {selectedMenu === "memo" && (
                  <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-4">메모</h2>
                    <Textarea
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      placeholder="캠페인에 대한 메모를 입력하세요..."
                      rows={10}
                    />
                    <div className="flex justify-end gap-2 mt-4">
                      <Button
                        onClick={() => {
                          // TODO: Implement memo save API (need to add 'memo' field to sequences table)
                          toast.success("메모 기능은 곧 추가될 예정입니다")
                        }}
                        disabled
                      >
                        저장
                      </Button>
                    </div>
                  </Card>
                )}
              </>
            )}

            {/* Active/Beyond Status Content */}
            {isActiveOrBeyond && (
              <>
                {selectedMenu === "overview" && <CampaignOverview sequenceId={sequence.id} />}

                {selectedMenu === "enrollment" && (
                  <div>
                    <h2 className="text-xl font-semibold mb-4">발송현황</h2>
                    <SequenceEnrollmentsTable sequenceId={sequence.id} />
                  </div>
                )}

                {selectedMenu === "memo" && (
                  <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-4">메모</h2>
                    <Textarea
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      placeholder="캠페인에 대한 메모를 입력하세요..."
                      rows={10}
                    />
                    <div className="flex justify-end gap-2 mt-4">
                      <Button
                        onClick={() => {
                          // TODO: Implement memo save API (need to add 'memo' field to sequences table)
                          toast.success("메모 기능은 곧 추가될 예정입니다")
                        }}
                        disabled
                      >
                        저장
                      </Button>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
