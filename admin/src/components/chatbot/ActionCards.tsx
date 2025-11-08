import { Sparkles, Upload } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface ActionCardsProps {
  onUploadClick: () => void
  onSequenceClick: () => void
  isProcessing?: boolean
  hasAttachedFile?: boolean
  variant?: "default" | "compact"
}

export function ActionCards({
  onUploadClick,
  onSequenceClick,
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <Upload className={`${iconClass} text-primary`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground">엑셀 파일 업로드</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {isCompact ? "리드 데이터 추가" : "리드 데이터를 추가하세요"}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card
        hoverable
        animated
        onClick={() => {
          if (!isProcessing) {
            onSequenceClick()
          }
        }}
        className={`transition-all ${
          isProcessing ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:shadow-md"
        }`}
      >
        <CardContent className={`${cardPadding} flex items-center gap-3`}>
          <div
            className={`flex-shrink-0 ${iconSize} rounded-lg bg-purple-500/10 flex items-center justify-center`}
          >
            <Sparkles className={`${iconClass} text-purple-600`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground">시퀀스 자동 생성</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {isCompact ? "AI 이메일 시퀀스 생성" : "AI로 이메일 시퀀스를 만들어보세요"}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
