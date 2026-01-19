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

type TimerNodeData = {
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

type TimerNodeProps = {
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
    const days = Number.parseInt(delayDays, 10)
    if (!Number.isNaN(days) && days > 0) {
      data.onUpdate?.({ delayDays: days })
      setIsEditOpen(false)
    }
  }

  return (
    <>
      <div className="min-w-[250px] rounded-lg border-2 border-orange-500 bg-white shadow-lg">
        <Handle
          className="h-3 w-3 border-2 border-white bg-orange-500"
          position={Position.Top}
          type="target"
        />

        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-orange-100 p-2">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
              <span className="font-semibold text-gray-800">
                {t("sequences.designer.timerNode.timer")}
              </span>
            </div>
            <Button
              className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
              onClick={() => data.onDelete?.()}
              size="sm"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="rounded border border-orange-200 bg-orange-50 p-3">
              <div className="mb-1 text-orange-700 text-xs">
                {t("sequences.designer.timerNode.waitTime")}
              </div>
              <div className="font-bold text-2xl text-orange-600">
                {data.delayDays || 1}
                <span className="ml-1 font-normal text-sm">
                  {t("sequences.designer.timerNode.days")}
                </span>
              </div>
            </div>

            <div className="mb-2 text-gray-600 text-xs">
              {t("sequences.designer.timerNode.description")}
            </div>

            {/* 통계 표시 */}
            {stats && (
              <div className="space-y-1 border-orange-200 border-t pt-2">
                <div className="mb-2 font-semibold text-gray-700 text-xs">
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
              className="mt-2 w-full"
              onClick={() => setIsEditOpen(true)}
              size="sm"
              variant="outline"
            >
              {t("sequences.designer.timerNode.edit")}
            </Button>
          </div>
        </div>

        <div className="border-gray-200 border-t bg-gray-50 p-3">
          <DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
            <DropdownMenuTrigger asChild>
              <Button className="w-full" size="sm" variant="ghost">
                <Plus className="mr-2 h-4 w-4" />
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
          className="h-3 w-3 border-2 border-white bg-orange-500"
          position={Position.Bottom}
          type="source"
        />
      </div>

      <Dialog onOpenChange={setIsEditOpen} open={isEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sequences.designer.timerNode.timerSettings")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label htmlFor={delayDaysId}>{t("sequences.designer.timerNode.waitTimeDays")}</Label>
              <Input
                id={delayDaysId}
                min="1"
                onChange={(e) => setDelayDays(e.target.value)}
                placeholder={t("sequences.designer.timerNode.enterInDays")}
                type="number"
                value={delayDays}
              />
              <p className="mt-1 text-gray-500 text-sm">
                {t("sequences.designer.timerNode.noReplyDescription")}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setIsEditOpen(false)} variant="outline">
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
