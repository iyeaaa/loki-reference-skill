import { CheckCircle2, Globe, XCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface WebExtractionProgress {
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
}

interface WebExtractionProgressProps {
  progress: WebExtractionProgress
}

export function WebExtractionProgress({ progress }: WebExtractionProgressProps) {
  const [_startTime] = useState<number>(Date.now())
  const prevProgressRef = useRef<WebExtractionProgress | null>(null)

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

  useEffect(() => {
    prevProgressRef.current = progress
  }, [progress])

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : isError ? (
                  <XCircle className="h-5 w-5 text-red-600" />
                ) : (
                  <Globe className="h-5 w-5 text-blue-600 animate-spin" />
                )}
                <h3 className="text-base font-semibold">
                  {isComplete
                    ? "웹 데이터 추출 완료"
                    : isError
                      ? "웹 데이터 추출 실패"
                      : "웹 데이터 추출 진행 중"}
                </h3>
              </div>
              {progress.processed !== undefined && progress.total !== undefined && (
                <Badge variant={isComplete ? "default" : "secondary"} className="text-sm font-mono">
                  {progress.processed} / {progress.total}
                </Badge>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {!isError && progress.total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>진행률</span>
                <span>
                  {progress.processed}/{progress.total} ({progress.percentage.toFixed(1)}%)
                </span>
              </div>
              <Progress value={progress.percentage} className="h-2" />
            </div>
          )}

          {/* Current Company */}
          {isProcessing && progress.currentCompany && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3">
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-blue-600" />
                <span className="text-muted-foreground">처리 중:</span>
                <span className="font-medium text-blue-900 dark:text-blue-100">
                  {progress.currentCompany}
                </span>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-green-50 dark:bg-green-950/20 p-3">
              <div className="text-xs text-muted-foreground mb-1">성공</div>
              <div className="text-2xl font-bold text-green-600">{progress.success || 0}</div>
            </div>
            <div className="rounded-lg border border-border bg-red-50 dark:bg-red-950/20 p-3">
              <div className="text-xs text-muted-foreground mb-1">실패</div>
              <div className="text-2xl font-bold text-red-600">{progress.errors || 0}</div>
            </div>
            <div className="rounded-lg border border-border bg-blue-50 dark:bg-blue-950/20 p-3">
              <div className="text-xs text-muted-foreground mb-1">이메일 발견</div>
              <div className="text-2xl font-bold text-blue-600">{progress.emailFound || 0}</div>
            </div>
            <div className="rounded-lg border border-border bg-purple-50 dark:bg-purple-950/20 p-3">
              <div className="text-xs text-muted-foreground mb-1">전화번호 발견</div>
              <div className="text-2xl font-bold text-purple-600">{progress.phoneFound || 0}</div>
            </div>
            <div className="rounded-lg border border-border bg-orange-50 dark:bg-orange-950/20 p-3">
              <div className="text-xs text-muted-foreground mb-1">주소 발견</div>
              <div className="text-2xl font-bold text-orange-600">{progress.addressFound || 0}</div>
            </div>
            <div className="rounded-lg border border-border bg-pink-50 dark:bg-pink-950/20 p-3">
              <div className="text-xs text-muted-foreground mb-1">SNS 발견</div>
              <div className="text-2xl font-bold text-pink-600">{progress.socialFound || 0}</div>
            </div>
            <div className="rounded-lg border border-border bg-indigo-50 dark:bg-indigo-950/20 p-3">
              <div className="text-xs text-muted-foreground mb-1">GPT 요청</div>
              <div className="text-2xl font-bold text-indigo-600">{progress.gptRequests || 0}</div>
            </div>
            <div className="rounded-lg border border-border bg-teal-50 dark:bg-teal-950/20 p-3">
              <div className="text-xs text-muted-foreground mb-1">처리 속도</div>
              <div className="text-2xl font-bold text-teal-600">
                {progress.itemsPerSecond?.toFixed(2) || "0.00"}
                <span className="text-sm font-normal text-muted-foreground ml-1">/초</span>
              </div>
            </div>
          </div>

          {/* Time Stats */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>경과 시간:</span>
              <span className="font-medium">{formatTime(progress.elapsedTime || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>예상 남은 시간:</span>
              <span className="font-medium">
                {isComplete ? "완료" : formatTime(progress.estimatedTimeRemaining || 0)}
              </span>
            </div>
          </div>

          {/* Message */}
          {progress.message && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">{progress.message}</p>
            </div>
          )}

          {/* Error Message */}
          {isError && progress.errorDetails && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3">
              <p className="text-sm text-red-600">{progress.errorDetails}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default WebExtractionProgress
