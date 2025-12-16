import { motion } from "framer-motion"
import {
  CheckCircle2,
  Clock,
  Coffee,
  Gauge,
  Lightbulb,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { StarSpinner } from "@/components/chatbot/StarSpinner"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type ProgressLog = {
  timestamp: number
  message: string
  type: "info" | "success" | "warning" | "error"
  processed?: number
  total?: number
}

type WebExtractionProgress = {
  status: "processing" | "completed" | "error"
  total: number
  processed: number
  success: number
  errors: number
  emailFound: number
  phoneFound: number
  addressFound: number
  socialFound: number
  gptRequests: number
  percentage: number
  currentCompany?: string
  elapsedTime: number
  estimatedTimeRemaining: number
  itemsPerSecond: number
  message?: string
  errorDetails?: string
  type?: "init" | "progress" | "complete" | "error"
  logs?: ProgressLog[]
  estimatedCost?: number // 예상 GPT API 비용 (USD)
}

type WebExtractionProgressProps = {
  progress: WebExtractionProgress
  apiKeyCount?: number
  concurrency?: number
  totalTimeSaved?: number // 총 절약 시간 (초)
}

function LogEntry({ log }: { log: ProgressLog }) {
  return (
    <div
      className={cn(
        "flex items-center rounded px-2 py-1.5 font-mono text-xs",
        "transition-colors hover:bg-muted/50",
        log.type === "success" && "text-green-700 dark:text-green-300",
        log.type === "error" && "text-red-700 dark:text-red-300",
        log.type === "warning" && "text-amber-700 dark:text-amber-300",
        log.type === "info" && "text-muted-foreground",
      )}
    >
      <span className="flex-1 truncate">{log.message}</span>
    </div>
  )
}

export function WebExtractionProgress({
  progress,
  apiKeyCount,
  concurrency,
}: WebExtractionProgressProps) {
  const logContainerRef = useRef<React.ElementRef<typeof ScrollArea>>(null)

  const isComplete = progress.status === "completed"
  const isError = progress.status === "error"
  const isProcessing = progress.status === "processing"

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.floor(seconds)}초`
    }
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}분 ${secs}초`
  }

  const formatLongTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.floor(seconds)}초`
    }
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) {
      const secs = Math.floor(seconds % 60)
      return `${minutes}분 ${secs}초`
    }
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    if (hours < 24) {
      return `${hours}시간 ${mins}분`
    }
    const days = Math.floor(hours / 24)
    const hrs = Math.floor(hours % 24)
    return `${days}일 ${hrs}시간`
  }

  // 시간 절약 계산: 사람이 1개당 평균 15분(900초) 걸린다고 가정
  const MANUAL_TIME_PER_ITEM = 900 // 15분 = 900초
  // 대한민국 최저 시급 (2024년 기준: 9,860원, 2025년도도 비슷할 것으로 예상)
  const MINIMUM_WAGE_PER_HOUR = 9860 // 원/시간

  const calculateTimeSaved = () => {
    const successCount = progress.success || 0
    const manualTime = successCount * MANUAL_TIME_PER_ITEM // 사람이 걸릴 시간
    const systemTime = progress.elapsedTime || 0 // 시스템이 실제로 걸린 시간
    return Math.max(0, manualTime - systemTime) // 아낀 시간
  }

  const calculateCostSaved = (timeSavedSeconds: number) => {
    // 초를 시간으로 변환하여 최저 시급 곱하기
    const hoursSaved = timeSavedSeconds / 3600
    return Math.floor(hoursSaved * MINIMUM_WAGE_PER_HOUR)
  }

  const currentTimeSaved = calculateTimeSaved()
  const currentCostSaved = calculateCostSaved(currentTimeSaved)
  const successCount = progress.success || 0

  // 랜덤 팁 목록
  const tips = [
    {
      icon: Zap,
      title: "속도 향상 팁",
      message: "API 키를 여러 개 등록하면 처리 속도가 배수로 빨라집니다!",
      color: "text-yellow-600 dark:text-yellow-400",
      bgColor: "bg-yellow-500/10 border-yellow-500/20",
    },
    {
      icon: Coffee,
      title: "휴식 제안",
      message: "처리 중이니 잠시 휴식을 취하시는 것도 좋습니다 ☕",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500/10 border-amber-500/20",
    },
    {
      icon: Gauge,
      title: "다른 업무 추천",
      message: "처리 중에는 다른 업무를 진행하셔도 좋습니다!",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/10 border-blue-500/20",
    },
    {
      icon: Lightbulb,
      title: "시퀀스 준비",
      message: "미리 시퀀스를 설정해두면 결과가 나오자마자 바로 활용할 수 있어요!",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-500/10 border-purple-500/20",
    },
    {
      icon: TrendingUp,
      title: "효율성 팁",
      message: "대량 작업은 밤에 돌려두고 아침에 확인하는 것도 좋은 방법입니다 🌙",
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-500/10 border-indigo-500/20",
    },
    {
      icon: Clock,
      title: "시간 절약",
      message: "100개 처리 시 약 25시간을 절약합니다! 시간은 금입니다 ⏰",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-500/10 border-green-500/20",
    },
  ]

  // 랜덤 팁 선택 (세션별로 고정)
  const [randomTip] = useState(() => {
    const tipIndex = Math.floor(Math.random() * tips.length)
    return tips[tipIndex]
  })

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (logContainerRef.current && progress.logs) {
      const viewport = logContainerRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      ) as HTMLElement | null
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
    }
  }, [progress.logs])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Content - Flex layout */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* API Key Speed Boost Banner */}
        {apiKeyCount !== undefined && apiKeyCount > 0 && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 flex-shrink-0 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-3"
            initial={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-2.5">
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                }}
                className="flex-shrink-0"
                transition={{
                  duration: 2,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                  <Zap className="h-4 w-4 text-primary" fill="currentColor" />
                </div>
              </motion.div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="font-bold text-foreground text-sm">{apiKeyCount}배 속도</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <div className="flex items-center gap-1">
                    <Gauge className="h-3.5 w-3.5" />
                    <span>{concurrency || apiKeyCount * 20}개 동시 처리</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Top Section - Fixed height content */}
        <div className="flex-shrink-0 space-y-2.5 py-2.5">
          {/* Progress Bar */}
          {!isError && progress.total > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-muted-foreground text-sm">
                <span>
                  {progress.percentage.toFixed(1)}%
                  {progress.processed !== undefined && progress.total !== undefined && (
                    <span className="ml-1">
                      ({progress.processed}/{progress.total})
                    </span>
                  )}
                </span>
              </div>
              <Progress className="h-2" value={progress.percentage} />
            </div>
          )}

          {/* Current Company */}
          {isProcessing && progress.currentCompany && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <StarSpinner size={14} />
              <span className="font-medium">처리 중:</span> {progress.currentCompany}
            </div>
          )}

          {/* Status Row */}
          {(isComplete || isError) && (
            <div className="flex items-center gap-2 pb-2">
              {isComplete && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-semibold text-sm">완료</span>
                </>
              )}
              {isError && (
                <>
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="font-semibold text-sm">실패</span>
                </>
              )}
            </div>
          )}

          {/* Time Saved Banner */}
          {successCount > 0 && (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-lg border border-border bg-muted/30 p-3"
              initial={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <div className="min-w-0 flex-1">
                <div className="space-y-1.5">
                  <div className="flex items-baseline gap-2">
                    <motion.span
                      animate={{ scale: 1 }}
                      className="font-bold text-primary text-xl"
                      initial={{ scale: 0.8 }}
                      key={currentTimeSaved}
                      transition={{ type: "spring", stiffness: 200 }}
                    >
                      {formatLongTime(currentTimeSaved)}
                    </motion.span>
                    <span className="text-muted-foreground text-xs">절약했어요</span>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    수동으로 했다면{" "}
                    <span className="font-semibold text-foreground">
                      {formatLongTime(successCount * MANUAL_TIME_PER_ITEM)}
                    </span>
                    걸렸을 일을{" "}
                    <span className="font-semibold text-foreground">
                      {formatTime(progress.elapsedTime || 0)}
                    </span>
                    만에 끝냈어요
                  </p>
                  {currentCostSaved > 0 && (
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      <span className="text-muted-foreground/70">약 </span>
                      <span className="font-semibold text-primary">
                        ₩{currentCostSaved.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground/70"> 절약했어요 (최저 시급 기준)</span>
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Simplified Stats */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">성공</span>
                <span className="font-semibold text-green-600">{progress.success || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">실패</span>
                <span className="font-semibold text-red-600">{progress.errors || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">이메일</span>
                <span className="font-semibold">{progress.emailFound || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">전화</span>
                <span className="font-semibold">{progress.phoneFound || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">주소</span>
                <span className="font-semibold">{progress.addressFound || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SNS</span>
                <span className="font-semibold">{progress.socialFound || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GPT</span>
                <span className="font-semibold">{progress.gptRequests || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">속도</span>
                <span className="font-semibold">
                  {progress.itemsPerSecond?.toFixed(2) || "0.00"}건/초
                </span>
              </div>
            </div>
            <div className="border-t pt-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>예상비용</span>
                <span className="font-semibold">
                  {((progress.estimatedCost || 0) * 1300).toFixed(1)}원
                </span>
              </div>
            </div>
          </div>

          {/* Time Stats */}
          <div className="space-y-1.5 border-t pt-2 text-muted-foreground text-sm">
            <div className="flex justify-between">
              <span>경과</span>
              <span className="font-medium">{formatTime(progress.elapsedTime || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>남은 시간</span>
              <span className="font-medium">
                {isComplete ? "완료" : formatTime(progress.estimatedTimeRemaining || 0)}
              </span>
            </div>
          </div>

          {/* API Key & Concurrency Info */}
          {(apiKeyCount !== undefined || concurrency !== undefined) && (
            <div className="space-y-1.5 border-t pt-2 text-muted-foreground text-sm">
              {apiKeyCount !== undefined && (
                <div className="flex justify-between">
                  <span>API 키</span>
                  <span className="font-medium">{apiKeyCount}개</span>
                </div>
              )}
              {concurrency !== undefined && (
                <div className="flex justify-between">
                  <span>동시 처리</span>
                  <span className="font-medium">{concurrency}개</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Log Entries - Flexible height */}
        {progress.logs && progress.logs.length > 0 && (
          <Card className="flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-t-none border-t-0">
            <CardHeader className="flex-shrink-0 pt-4 pb-3">
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="font-semibold text-base">처리 로그</span>
                <Badge className="text-xs" variant="secondary">
                  {progress.logs.length}개
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-0 pt-0">
              <ScrollArea className="h-full px-3 pb-3" ref={logContainerRef}>
                <div className="space-y-0.5">
                  {progress.logs.map((log, index) => (
                    <LogEntry key={`${log.timestamp}-${index}`} log={log} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Random Tip Card - Game Style */}
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex-shrink-0"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className={`${randomTip.bgColor} relative overflow-hidden border-2`}>
            {/* Shine effect */}
            <motion.div
              animate={{ x: "200%" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              initial={{ x: "-100%" }}
              transition={{
                duration: 3,
                repeat: Number.POSITIVE_INFINITY,
                repeatDelay: 5,
                ease: "easeInOut",
              }}
            />
            <CardContent className="relative z-10 p-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <Badge
                    className={`font-bold text-xs ${randomTip.color} border-current`}
                    variant="outline"
                  >
                    💡 팁
                  </Badge>
                  <span className={`font-bold text-sm ${randomTip.color}`}>{randomTip.title}</span>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">{randomTip.message}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

export default WebExtractionProgress
