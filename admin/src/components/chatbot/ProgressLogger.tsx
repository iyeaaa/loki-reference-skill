import { useEffect, useState } from "react"
import type { ProgressLog } from "@/lib/api/services/lead-import"
import { cn } from "@/lib/utils"

export type { ProgressLog }

interface ProgressLoggerProps {
  logs: ProgressLog[]
  startTime: number
  currentProgress: number
  totalItems: number
  isComplete?: boolean
  className?: string
}

function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

function formatETA(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  const minutes = Math.ceil(seconds / 60)
  const hours = Math.ceil(minutes / 60)

  if (hours > 1) {
    return `~${hours}h`
  }
  if (minutes > 1) {
    return `~${minutes}m`
  }
  if (seconds > 0) {
    return `~${seconds}s`
  }
  return "곧 완료"
}

function calculateSpeed(processed: number, elapsedMs: number): number {
  if (elapsedMs === 0) return 0
  const elapsedSeconds = elapsedMs / 1000
  return processed / elapsedSeconds
}

function LogEntry({ log }: { log: ProgressLog }) {
  const time = new Date(log.timestamp).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  return (
    <div
      className={cn(
        "flex items-start gap-2 py-1.5 px-2 rounded text-xs font-mono",
        "hover:bg-muted/50 transition-colors",
      )}
    >
      <span className="text-muted-foreground/60 select-none min-w-[60px]">{time}</span>
      <span
        className={cn(
          "flex-1",
          log.type === "success" && "text-green-700 dark:text-green-400",
          log.type === "error" && "text-red-700 dark:text-red-400",
          log.type === "warning" && "text-amber-700 dark:text-amber-400",
          log.type === "info" && "text-foreground/80",
        )}
      >
        {log.message}
      </span>
      {log.processed !== undefined && log.total !== undefined && (
        <span className="text-muted-foreground/60 select-none">
          [{log.processed}/{log.total}]
        </span>
      )}
    </div>
  )
}

export function ProgressLogger({
  logs,
  startTime,
  currentProgress,
  totalItems,
  isComplete = false,
  className,
}: ProgressLoggerProps) {
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    // 완료되면 타이머 중지
    if (isComplete) {
      return
    }

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime)
    }, 100)

    return () => clearInterval(interval)
  }, [startTime, isComplete])

  // 완료 시 최종 경과 시간 설정
  useEffect(() => {
    if (isComplete) {
      setElapsedTime(Date.now() - startTime)
    }
  }, [isComplete, startTime])

  const speed = calculateSpeed(currentProgress, elapsedTime)
  const remainingItems = totalItems - currentProgress
  const estimatedTimeMs = speed > 0 ? (remainingItems / speed) * 1000 : 0

  return (
    <div className={cn("space-y-3", className)}>
      {/* Stats Bar - Hugging Face Style */}
      <div className="flex items-center gap-4 text-xs font-mono bg-muted/30 rounded-lg px-4 py-2.5 border">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">경과:</span>
          <span className="font-semibold text-foreground">{formatElapsedTime(elapsedTime)}</span>
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">속도:</span>
          <span className="font-semibold text-foreground">
            {speed > 0 ? `${speed.toFixed(2)}/s` : "-"}
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">예상 남은 시간:</span>
          <span className="font-semibold text-foreground">
            {currentProgress < totalItems ? formatETA(estimatedTimeMs) : "완료"}
          </span>
        </div>
      </div>

      {/* Log Entries */}
      {logs.length > 0 && (
        <div className="rounded-lg border bg-muted/20">
          <div className="border-b bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">처리 로그</span>
              <span className="text-xs text-muted-foreground/60">({logs.length}개 항목)</span>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto px-2 py-1">
            {logs.map((log, index) => (
              <LogEntry key={`${log.timestamp}-${index}`} log={log} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
