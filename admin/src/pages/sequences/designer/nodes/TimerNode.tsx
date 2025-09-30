import { Handle, Position } from "@xyflow/react"
import { CheckCircle, Clock, Mail, Plus, Timer, Trash2 } from "lucide-react"
import { type FC, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface TimerNodeData {
  delayDays?: number
  nodeId?: string
  sequenceId?: string
  // 통계 데이터 (백엔드에서 실시간으로 업데이트)
  stats?: {
    sentCount?: number
    repliedCount?: number
    waitingCount?: number
  }
  onAddNode?: (type: string) => void
  onDelete?: () => void
  onUpdate?: (data: { delayDays: number }) => void
}

interface TimerNodeProps {
  data: TimerNodeData
}

export const TimerNode: FC<TimerNodeProps> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [delayDays, setDelayDays] = useState(data.delayDays?.toString() || "1")
  const delayDaysId = useId()

  const handleAddNode = (type: string) => {
    data.onAddNode?.(type)
    setIsOpen(false)
  }

  const handleSave = () => {
    const days = parseInt(delayDays, 10)
    if (!Number.isNaN(days) && days > 0) {
      data.onUpdate?.({ delayDays: days })
      setIsEditOpen(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-lg border-2 border-orange-500 min-w-[250px]">
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 bg-orange-500 border-2 border-white"
        />

        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="bg-orange-100 rounded-full p-2">
                <Clock className="w-4 h-4 text-orange-600" />
              </div>
              <span className="text-gray-800 font-semibold">타이머</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => data.onDelete?.()}
              className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="bg-orange-50 border border-orange-200 rounded p-3">
              <div className="text-xs text-orange-700 mb-1">대기 시간</div>
              <div className="text-2xl font-bold text-orange-600">
                {data.delayDays || 1}
                <span className="text-sm ml-1 font-normal">일</span>
              </div>
            </div>

            <div className="text-xs text-gray-600 mb-2">답장이 없으면 다음 노드 실행</div>

            {/* 통계 표시 */}
            {data.stats && (
              <div className="space-y-1 pt-2 border-t border-orange-200">
                <div className="text-xs font-semibold text-gray-700 mb-2">📊 실시간 통계</div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-blue-600">
                    <Mail className="h-3 w-3" />
                    <span>발송</span>
                  </div>
                  <span className="font-semibold">{data.stats.sentCount || 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>답장</span>
                  </div>
                  <span className="font-semibold">{data.stats.repliedCount || 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-orange-600">
                    <Timer className="h-3 w-3" />
                    <span>대기</span>
                  </div>
                  <span className="font-semibold">{data.stats.waitingCount || 0}</span>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              className="w-full mt-2"
            >
              편집
            </Button>
          </div>
        </div>

        <div className="border-t border-gray-200 p-3 bg-gray-50">
          <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                노드 추가
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleAddNode("emailDraft")}>
                이메일 초안 추가
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 bg-orange-500 border-2 border-white"
        />
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>타이머 설정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label htmlFor={delayDaysId}>대기 시간 (일)</Label>
              <Input
                id={delayDaysId}
                type="number"
                min="1"
                value={delayDays}
                onChange={(e) => setDelayDays(e.target.value)}
                placeholder="일 단위로 입력"
              />
              <p className="text-sm text-gray-500 mt-1">
                이 시간 동안 답장이 없으면 다음 노드가 실행됩니다
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                취소
              </Button>
              <Button onClick={handleSave}>저장</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
