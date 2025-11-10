import { Card, CardContent } from "@/components/ui/card"

interface ActionCardsProps {
  onUploadClick: () => void
  isProcessing?: boolean
  hasAttachedFile?: boolean
  variant?: "default" | "compact"
}

export function ActionCards({
  onUploadClick,
  isProcessing = false,
  hasAttachedFile = false,
  variant = "default",
}: ActionCardsProps) {
  if (isProcessing) {
    return null
  }

  const isCompact = variant === "compact"
  const cardPadding = isCompact ? "p-3" : "p-4"
  const iconSize = isCompact ? "w-9 h-9" : "w-10 h-10"
  const iconClass = isCompact ? "h-4 w-4" : "h-5 w-5"

  return (
    <div className="grid grid-cols-1 gap-3">
      <Card
        hoverable
        animated
        onClick={() => {
          if (!hasAttachedFile && !isProcessing) {
            onUploadClick()
          }
        }}
        className={`transition-all ${
          hasAttachedFile || isProcessing
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer hover:shadow-md"
        }`}
      >
        <CardContent className={`${cardPadding} flex items-center gap-3`}>
          <div
            className={`flex-shrink-0 ${iconSize} rounded-lg bg-primary/10 flex items-center justify-center`}
          >
            <img src="/images/excel-icon.png" alt="Excel" className={iconClass} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground">Upload Excel File</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {isCompact
                ? "Add lead data"
                : "AI analyzes leads, generates email strategies, and creates automated sequences"}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
