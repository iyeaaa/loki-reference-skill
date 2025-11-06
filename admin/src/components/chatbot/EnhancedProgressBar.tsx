import { cn } from "@/lib/utils"

interface EnhancedProgressBarProps {
  value: number
  max: number
  className?: string
  showPercentage?: boolean
  showFraction?: boolean
  animated?: boolean
}

export function EnhancedProgressBar({
  value,
  max,
  className,
  showPercentage = true,
  showFraction = true,
  animated = true,
}: EnhancedProgressBarProps) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0
  const clampedPercentage = Math.min(100, Math.max(0, percentage))

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-xs font-mono">
        {showFraction && (
          <span className="text-muted-foreground">
            {value.toLocaleString()} / {max.toLocaleString()}
          </span>
        )}
        {showPercentage && (
          <span className="font-semibold text-foreground">{clampedPercentage}%</span>
        )}
      </div>

      {/* Progress Bar - Hugging Face Style */}
      <div className="relative h-6 rounded-lg overflow-hidden bg-muted border">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-muted to-muted/50" />

        {/* Progress fill with gradient and animation */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-lg",
            "bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500",
            "transition-all duration-500 ease-out",
            animated && "animate-pulse-subtle",
          )}
          style={{
            width: `${clampedPercentage}%`,
            backgroundSize: "200% 100%",
          }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>

        {/* Percentage text overlay */}
        <div className="relative h-full flex items-center justify-center">
          <span
            className={cn(
              "text-xs font-bold font-mono transition-colors duration-300",
              clampedPercentage > 50 ? "text-white drop-shadow-md" : "text-foreground",
            )}
          >
            {clampedPercentage}%
          </span>
        </div>
      </div>

      {/* Mini stats bar */}
      <div className="flex items-center gap-2 text-xs">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${clampedPercentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}
