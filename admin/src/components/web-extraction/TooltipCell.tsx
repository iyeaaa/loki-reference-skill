import type React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type TooltipCellProps = {
  content: string | null | undefined
  children: React.ReactNode
  maxWidth?: string
}

/**
 * Tooltip wrapper component for table cells
 * Always shows tooltip on hover for all values
 */
export function TooltipCell({ content, children, maxWidth = "max-w-md" }: TooltipCellProps) {
  const displayContent = content || "-"
  const tooltipText = displayContent === "-" ? "데이터 없음" : displayContent

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div className="w-full cursor-default">{children}</div>
        </TooltipTrigger>
        <TooltipContent
          className={`${maxWidth} border-2 border-border bg-background p-3 text-foreground shadow-lg outline outline-1 outline-border`}
          side="top"
        >
          <div className="whitespace-pre-wrap break-all text-sm">{tooltipText}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
