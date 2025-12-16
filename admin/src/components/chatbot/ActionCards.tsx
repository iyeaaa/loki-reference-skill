import { Card, CardContent } from "@/components/ui/card"

type ActionCardsProps = {
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
        animated
        className={`transition-all ${
          hasAttachedFile || isProcessing
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer hover:shadow-md"
        }`}
        hoverable
        onClick={() => {
          if (!(hasAttachedFile || isProcessing)) {
            onUploadClick()
          }
        }}
      >
        <CardContent className={`${cardPadding} flex items-center gap-3`}>
          <div
            className={`flex-shrink-0 ${iconSize} flex items-center justify-center rounded-lg bg-primary/10`}
          >
            <img alt="Excel" className={iconClass} src="/images/excel-icon.png" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground text-sm">Upload Excel File</div>
            <div className="mt-0.5 text-muted-foreground text-xs">
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
