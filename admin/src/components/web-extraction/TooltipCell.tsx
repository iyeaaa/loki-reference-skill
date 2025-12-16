import type React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type TooltipCellProps = {
  content: string | null | undefined
  children: React.ReactNode
  maxWidth?: string
}

/**
 * Tooltip wrapper component for table cells
 */
export function TooltipCell({ content, children, maxWidth = "max-w-md" }: TooltipCellProps) {
  const displayContent = content || "-"
  if (displayContent === "-") {
    return <>{children}</>
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-full">{children}</div>
        </TooltipTrigger>
        <TooltipContent
          className={`${maxWidth} border-2 border-border bg-background p-3 text-foreground shadow-lg outline outline-1 outline-border`}
          side="top"
        >
          <div className="whitespace-pre-wrap break-all text-sm">{displayContent}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
