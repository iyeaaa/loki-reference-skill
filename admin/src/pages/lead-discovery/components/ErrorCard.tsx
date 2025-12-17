/**
 * Error Card Component
 * 에러 타입별 차별화된 UI와 액션 버튼 제공
 */

import { motion } from "framer-motion"
import {
  AlertTriangle,
  Clock,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  Sparkles,
  WifiOff,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { LeadDiscoveryError, LeadDiscoveryErrorType } from "../types/errors"

// 에러 타입별 아이콘 및 스타일
const ERROR_CONFIG: Record<
  LeadDiscoveryErrorType,
  {
    icon: React.ComponentType<{ className?: string }>
    bgColor: string
    iconColor: string
    borderColor: string
  }
> = {
  network: {
    icon: WifiOff,
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    iconColor: "text-orange-500",
    borderColor: "border-orange-200 dark:border-orange-800",
  },
  timeout: {
    icon: Clock,
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    iconColor: "text-amber-500",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
  session_expired: {
    icon: XCircle,
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    iconColor: "text-purple-500",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
  server: {
    icon: Server,
    bgColor: "bg-red-50 dark:bg-red-950/30",
    iconColor: "text-red-500",
    borderColor: "border-red-200 dark:border-red-800",
  },
  validation: {
    icon: AlertTriangle,
    bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
    iconColor: "text-yellow-500",
    borderColor: "border-yellow-200 dark:border-yellow-800",
  },
  rate_limit: {
    icon: Clock,
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    iconColor: "text-blue-500",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  bigquery: {
    icon: Search,
    bgColor: "bg-cyan-50 dark:bg-cyan-950/30",
    iconColor: "text-cyan-500",
    borderColor: "border-cyan-200 dark:border-cyan-800",
  },
  ai: {
    icon: Sparkles,
    bgColor: "bg-violet-50 dark:bg-violet-950/30",
    iconColor: "text-violet-500",
    borderColor: "border-violet-200 dark:border-violet-800",
  },
  unknown: {
    icon: AlertTriangle,
    bgColor: "bg-gray-50 dark:bg-gray-950/30",
    iconColor: "text-gray-500",
    borderColor: "border-gray-200 dark:border-gray-800",
  },
}

type ErrorCardProps = {
  error: LeadDiscoveryError
  onRetry?: () => void
  onRecover?: () => void
  onNewSearch?: () => void
  isRetrying?: boolean
  className?: string
}

export function ErrorCard({
  error,
  onRetry,
  onRecover,
  onNewSearch,
  isRetrying = false,
  className,
}: ErrorCardProps) {
  const config = ERROR_CONFIG[error.type]
  const IconComponent = config.icon

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-xl border p-4", config.bgColor, config.borderColor, className)}
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-start gap-3">
        {/* 아이콘 */}
        <div
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
            config.bgColor,
          )}
        >
          <IconComponent className={cn("h-5 w-5", config.iconColor)} />
        </div>

        {/* 콘텐츠 */}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{error.message}</p>

          {error.suggestedAction && (
            <p className="mt-1 text-muted-foreground text-sm">{error.suggestedAction}</p>
          )}

          {/* 액션 버튼들 */}
          <div className="mt-4 flex flex-wrap gap-2">
            {/* 다시 시도 버튼 */}
            {error.retryable && onRetry && (
              <Button className="gap-2" disabled={isRetrying} onClick={onRetry} size="sm">
                <RefreshCw className={cn("h-4 w-4", isRetrying && "animate-spin")} />
                {isRetrying ? "시도 중..." : "다시 시도"}
              </Button>
            )}

            {/* 이전 상태 복구 버튼 */}
            {error.recoverable && onRecover && (
              <Button className="gap-2" onClick={onRecover} size="sm" variant="outline">
                <RotateCcw className="h-4 w-4" />
                이전 상태로 복구
              </Button>
            )}

            {/* 새 검색 시작 버튼 */}
            {onNewSearch && (
              <Button className="gap-2" onClick={onNewSearch} size="sm" variant="ghost">
                새 검색 시작
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
