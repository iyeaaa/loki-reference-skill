import type React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface TooltipCellProps {
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
          side="top"
          className={`${maxWidth} border-2 border-border bg-background p-3 shadow-lg outline outline-1 outline-border text-foreground`}
        >
          <div className="break-all text-sm whitespace-pre-wrap">{displayContent}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
