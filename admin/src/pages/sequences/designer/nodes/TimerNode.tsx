import { Handle, Position } from "@xyflow/react"
import { CheckCircle, Clock, Mail, Plus, Timer, Trash2 } from "lucide-react"
import { type FC, useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
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
import { useNodeStatistics } from "@/lib/api/hooks/workflow-execution"

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
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [delayDays, setDelayDays] = useState(data.delayDays?.toString() || "1")
  const delayDaysId = useId()

  // 실시간 통계 로드 (30초마다 자동 갱신)
  const { data: stats } = useNodeStatistics(
    data.sequenceId || "",
    data.nodeId || "",
    !!(data.sequenceId && data.nodeId),
  )

  // data가 변경되면 로컬 state 업데이트
  useEffect(() => {
    setDelayDays(data.delayDays?.toString() || "1")
  }, [data.delayDays])

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
              <span className="text-gray-800 font-semibold">
                {t("sequences.designer.timerNode.timer")}
              </span>
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
              <div className="text-xs text-orange-700 mb-1">
                {t("sequences.designer.timerNode.waitTime")}
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {data.delayDays || 1}
                <span className="text-sm ml-1 font-normal">
                  {t("sequences.designer.timerNode.days")}
                </span>
              </div>
            </div>

            <div className="text-xs text-gray-600 mb-2">
              {t("sequences.designer.timerNode.description")}
            </div>

            {/* 통계 표시 */}
            {stats && (
              <div className="space-y-1 pt-2 border-t border-orange-200">
                <div className="text-xs font-semibold text-gray-700 mb-2">
                  {t("sequences.designer.timerNode.realtimeStats")}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-blue-600">
                    <Mail className="h-3 w-3" />
                    <span>{t("sequences.designer.timerNode.sent")}</span>
                  </div>
                  <span className="font-semibold">{stats.sentCount || 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>{t("sequences.designer.timerNode.replied")}</span>
                  </div>
                  <span className="font-semibold">{stats.repliedCount || 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-orange-600">
                    <Timer className="h-3 w-3" />
                    <span>{t("sequences.designer.timerNode.waiting")}</span>
                  </div>
                  <span className="font-semibold">{stats.waitingCount || 0}</span>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              className="w-full mt-2"
            >
              {t("sequences.designer.timerNode.edit")}
            </Button>
          </div>
        </div>

        <div className="border-t border-gray-200 p-3 bg-gray-50">
          <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                {t("sequences.designer.timerNode.addNode")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleAddNode("emailDraft")}>
                {t("sequences.designer.timerNode.addEmailDraft")}
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
            <DialogTitle>{t("sequences.designer.timerNode.timerSettings")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label htmlFor={delayDaysId}>{t("sequences.designer.timerNode.waitTimeDays")}</Label>
              <Input
                id={delayDaysId}
                type="number"
                min="1"
                value={delayDays}
                onChange={(e) => setDelayDays(e.target.value)}
                placeholder={t("sequences.designer.timerNode.enterInDays")}
              />
              <p className="text-sm text-gray-500 mt-1">
                {t("sequences.designer.timerNode.noReplyDescription")}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                {t("sequences.designer.timerNode.cancel")}
              </Button>
              <Button onClick={handleSave}>{t("sequences.designer.timerNode.save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
