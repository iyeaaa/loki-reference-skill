import { Dices, Zap } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAddBulkJobs, useAddJob } from "@/lib/api/hooks/bullmq-test"
import type { AddJobRequest, BulkJobRequest } from "@/lib/api/types/bullmq-test"

type AddJobModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Random test messages
const testMessages = [
  "테스트 데이터 처리",
  "이메일 발송 작업",
  "리포트 생성",
  "데이터 동기화",
  "알림 전송",
  "파일 변환 작업",
  "캐시 갱신",
  "배치 작업 실행",
  "로그 분석",
  "백업 생성",
]

// Presets for quick testing
const presets = {
  fast: {
    label: "빠른 작업",
    description: "즉시 실행, 빠른 처리",
    config: { scheduleDelay: "0", processingDelay: "100", shouldFail: false },
  },
  normal: {
    label: "일반 작업",
    description: "1초 처리 시간",
    config: { scheduleDelay: "0", processingDelay: "1000", shouldFail: false },
  },
  slow: {
    label: "느린 작업",
    description: "3초 처리 시간",
    config: { scheduleDelay: "0", processingDelay: "3000", shouldFail: false },
  },
  delayed: {
    label: "지연 작업",
    description: "5초 후 시작",
    config: { scheduleDelay: "5000", processingDelay: "1000", shouldFail: false },
  },
  failing: {
    label: "실패 작업",
    description: "의도적 실패 테스트",
    config: { scheduleDelay: "0", processingDelay: "500", shouldFail: true },
  },
  mixed: {
    label: "혼합 작업",
    description: "랜덤 딜레이, 10% 실패율",
    config: { scheduleDelay: "random", processingDelay: "random", shouldFail: false },
  },
}

export function AddJobModal({ open, onOpenChange }: AddJobModalProps) {
  const messageId = useId()
  const jobNameId = useId()
  const scheduleDelayId = useId()
  const processingDelayId = useId()
  const priorityId = useId()
  const attemptsId = useId()
  const shouldFailId = useId()
  const customDataId = useId()
  const bulkCountId = useId()
  const bulkModeId = useId()

  const addJob = useAddJob()
  const addBulkJobs = useAddBulkJobs()

  const [isBulkMode, setIsBulkMode] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string>("")
  const [formData, setFormData] = useState({
    message: "",
    jobName: "",
    scheduleDelay: "",
    processingDelay: "",
    priority: "",
    attempts: "3",
    shouldFail: false,
    customData: "",
    bulkCount: "5",
  })

  const resetForm = () => {
    setFormData({
      message: "",
      jobName: "",
      scheduleDelay: "",
      processingDelay: "",
      priority: "",
      attempts: "3",
      shouldFail: false,
      customData: "",
      bulkCount: "5",
    })
    setIsBulkMode(false)
    setSelectedPreset("")
  }

  // Auto-generate random test data
  const generateRandomData = () => {
    const randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)]
    const timestamp = Date.now().toString(36).slice(-4)

    setFormData({
      ...formData,
      message: `${randomMessage} [${timestamp}]`,
      jobName: `auto-${timestamp}`,
      scheduleDelay: Math.random() < 0.3 ? String(Math.floor(Math.random() * 5000)) : "0",
      processingDelay: String(Math.floor(Math.random() * 2000) + 500),
      priority: String(Math.floor(Math.random() * 10)),
      shouldFail: Math.random() < 0.1,
      customData: JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          randomId: Math.random().toString(36).slice(2, 10),
        },
        null,
        2,
      ),
    })
    setSelectedPreset("")
  }

  // Apply preset configuration
  const applyPreset = (presetKey: string) => {
    const preset = presets[presetKey as keyof typeof presets]
    if (!preset) {
      return
    }

    const timestamp = Date.now().toString(36).slice(-4)
    const randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)]

    setFormData({
      ...formData,
      message: `${randomMessage} [${timestamp}]`,
      jobName: `${presetKey}-${timestamp}`,
      scheduleDelay:
        preset.config.scheduleDelay === "random"
          ? String(Math.floor(Math.random() * 5000))
          : preset.config.scheduleDelay,
      processingDelay:
        preset.config.processingDelay === "random"
          ? String(Math.floor(Math.random() * 2000) + 500)
          : preset.config.processingDelay,
      shouldFail: preset.config.shouldFail,
    })
    setSelectedPreset(presetKey)
  }

  // Quick add with auto-generated data
  const handleQuickAdd = () => {
    const timestamp = Date.now().toString(36).slice(-4)
    const randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)]

    const jobData: AddJobRequest = {
      message: `${randomMessage} [${timestamp}]`,
      jobName: `quick-${timestamp}`,
      processingDelay: Math.floor(Math.random() * 2000) + 500,
      shouldFail: false,
    }

    addJob.mutate(jobData)
  }

  // Quick bulk add
  const handleQuickBulkAdd = (count: number, preset: keyof typeof presets = "mixed") => {
    const jobs: BulkJobRequest[] = Array.from({ length: count }, (_, i) => {
      const timestamp = Date.now().toString(36).slice(-4)
      const randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)]
      const isMixed = preset === "mixed"

      return {
        message: `${randomMessage} #${i + 1} [${timestamp}]`,
        jobName: `bulk-${preset}-${i + 1}`,
        scheduleDelay: isMixed ? Math.floor(Math.random() * 3000) : 0,
        processingDelay: isMixed
          ? Math.floor(Math.random() * 2000) + 500
          : Number.parseInt(presets[preset].config.processingDelay, 10) || 1000,
        shouldFail: isMixed ? Math.random() < 0.1 : presets[preset].config.shouldFail,
      }
    })

    addBulkJobs.mutate(jobs)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    let customDataParsed: Record<string, unknown> | undefined
    if (formData.customData.trim()) {
      try {
        customDataParsed = JSON.parse(formData.customData)
      } catch {
        alert("Custom Data JSON 형식이 올바르지 않습니다")
        return
      }
    }

    if (isBulkMode) {
      const count = Number.parseInt(formData.bulkCount, 10) || 5
      const isMixedPreset = selectedPreset === "mixed"

      const jobs: BulkJobRequest[] = Array.from({ length: count }, (_, i) => ({
        message: `${formData.message} #${i + 1}`,
        jobName: formData.jobName ? `${formData.jobName}-${i + 1}` : undefined,
        scheduleDelay: isMixedPreset
          ? Math.floor(Math.random() * 5000)
          : formData.scheduleDelay
            ? Number.parseInt(formData.scheduleDelay, 10)
            : undefined,
        processingDelay: isMixedPreset
          ? Math.floor(Math.random() * 2000) + 500
          : formData.processingDelay
            ? Number.parseInt(formData.processingDelay, 10)
            : undefined,
        priority: formData.priority ? Number.parseInt(formData.priority, 10) : undefined,
        shouldFail: isMixedPreset ? Math.random() < 0.1 : formData.shouldFail,
        customData: customDataParsed,
      }))

      addBulkJobs.mutate(jobs, {
        onSuccess: () => {
          resetForm()
          onOpenChange(false)
        },
      })
    } else {
      const jobData: AddJobRequest = {
        message: formData.message,
        jobName: formData.jobName || undefined,
        scheduleDelay: formData.scheduleDelay
          ? Number.parseInt(formData.scheduleDelay, 10)
          : undefined,
        processingDelay: formData.processingDelay
          ? Number.parseInt(formData.processingDelay, 10)
          : undefined,
        priority: formData.priority ? Number.parseInt(formData.priority, 10) : undefined,
        attempts: formData.attempts ? Number.parseInt(formData.attempts, 10) : undefined,
        shouldFail: formData.shouldFail,
        customData: customDataParsed,
      }

      addJob.mutate(jobData, {
        onSuccess: () => {
          resetForm()
          onOpenChange(false)
        },
      })
    }
  }

  const isPending = addJob.isPending || addBulkJobs.isPending

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{isBulkMode ? "대량 작업 추가" : "작업 추가"}</DialogTitle>
          <DialogDescription>
            {isBulkMode
              ? "여러 개의 테스트 작업을 한 번에 추가합니다"
              : "새로운 테스트 작업을 큐에 추가합니다"}
          </DialogDescription>
        </DialogHeader>

        {/* Quick Actions */}
        <div className="space-y-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">빠른 추가</span>
            <div className="flex gap-2">
              <Button
                disabled={isPending}
                onClick={handleQuickAdd}
                size="sm"
                type="button"
                variant="outline"
              >
                <Zap className="mr-1 h-3 w-3" />
                1개 추가
              </Button>
              <Button
                disabled={isPending}
                onClick={() => handleQuickBulkAdd(5)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Zap className="mr-1 h-3 w-3" />
                5개 추가
              </Button>
              <Button
                disabled={isPending}
                onClick={() => handleQuickBulkAdd(10)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Zap className="mr-1 h-3 w-3" />
                10개 추가
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            랜덤 메시지와 딜레이로 즉시 작업을 추가합니다 (10% 실패율)
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Mode and Preset Selection */}
          <div className="flex items-center justify-between gap-4 border-b pb-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={isBulkMode}
                id={bulkModeId}
                onCheckedChange={(checked) => setIsBulkMode(!!checked)}
              />
              <Label className="cursor-pointer" htmlFor={bulkModeId}>
                대량 추가 모드
              </Label>
            </div>
            <Button onClick={generateRandomData} size="sm" type="button" variant="ghost">
              <Dices className="mr-1 h-4 w-4" />
              자동 생성
            </Button>
          </div>

          {/* Preset Selection */}
          <div className="space-y-2">
            <Label>프리셋 선택</Label>
            <Select onValueChange={applyPreset} value={selectedPreset}>
              <SelectTrigger>
                <SelectValue placeholder="프리셋을 선택하세요..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(presets).map(([key, preset]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex flex-col">
                      <span>{preset.label}</span>
                      <span className="text-muted-foreground text-xs">{preset.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor={messageId}>메시지 *</Label>
            <Input
              id={messageId}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="작업 메시지를 입력하세요"
              required
              value={formData.message}
            />
          </div>

          {/* Bulk Count (only in bulk mode) */}
          {isBulkMode && (
            <div className="space-y-2">
              <Label htmlFor={bulkCountId}>작업 개수</Label>
              <Input
                id={bulkCountId}
                max="100"
                min="1"
                onChange={(e) => setFormData({ ...formData, bulkCount: e.target.value })}
                type="number"
                value={formData.bulkCount}
              />
              <p className="text-gray-500 text-xs">1~100개까지 추가 가능</p>
            </div>
          )}

          {/* Job Name */}
          <div className="space-y-2">
            <Label htmlFor={jobNameId}>작업 이름</Label>
            <Input
              id={jobNameId}
              onChange={(e) => setFormData({ ...formData, jobName: e.target.value })}
              placeholder="test-job"
              value={formData.jobName}
            />
          </div>

          {/* Delays in grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Schedule Delay */}
            <div className="space-y-2">
              <Label htmlFor={scheduleDelayId}>스케줄 딜레이 (ms)</Label>
              <Input
                id={scheduleDelayId}
                min="0"
                onChange={(e) => setFormData({ ...formData, scheduleDelay: e.target.value })}
                placeholder="0"
                type="number"
                value={formData.scheduleDelay}
              />
              <p className="text-gray-500 text-xs">시작 대기 시간</p>
            </div>

            {/* Processing Delay */}
            <div className="space-y-2">
              <Label htmlFor={processingDelayId}>처리 딜레이 (ms)</Label>
              <Input
                id={processingDelayId}
                min="0"
                onChange={(e) => setFormData({ ...formData, processingDelay: e.target.value })}
                placeholder="0"
                type="number"
                value={formData.processingDelay}
              />
              <p className="text-gray-500 text-xs">처리 시뮬레이션</p>
            </div>
          </div>

          {/* Priority and Attempts in grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor={priorityId}>우선순위</Label>
              <Input
                id={priorityId}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                placeholder="낮을수록 우선"
                type="number"
                value={formData.priority}
              />
            </div>

            {/* Attempts (only in single mode) */}
            {!isBulkMode && (
              <div className="space-y-2">
                <Label htmlFor={attemptsId}>재시도 횟수</Label>
                <Input
                  id={attemptsId}
                  max="10"
                  min="1"
                  onChange={(e) => setFormData({ ...formData, attempts: e.target.value })}
                  type="number"
                  value={formData.attempts}
                />
              </div>
            )}
          </div>

          {/* Should Fail */}
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={formData.shouldFail}
              id={shouldFailId}
              onCheckedChange={(checked) => setFormData({ ...formData, shouldFail: !!checked })}
            />
            <Label className="cursor-pointer" htmlFor={shouldFailId}>
              의도적 실패 (테스트용)
            </Label>
          </div>

          {/* Custom Data */}
          <div className="space-y-2">
            <Label htmlFor={customDataId}>커스텀 데이터 (JSON)</Label>
            <Textarea
              className="font-mono text-sm"
              id={customDataId}
              onChange={(e) => setFormData({ ...formData, customData: e.target.value })}
              placeholder='{"key": "value"}'
              rows={3}
              value={formData.customData}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button
              disabled={isPending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              취소
            </Button>
            <Button
              className="min-w-[100px]"
              disabled={isPending || !formData.message}
              type="submit"
            >
              {isPending ? "추가 중..." : isBulkMode ? `${formData.bulkCount}개 추가` : "추가"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
