import { Key } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

type WebExtractionActionCardsProps = {
  onApiKeyClick: () => void
  isProcessing?: boolean
  apiKeyCount?: number
}

export function WebExtractionActionCards({
  onApiKeyClick,
  isProcessing = false,
  apiKeyCount = 0,
}: WebExtractionActionCardsProps) {
  if (isProcessing) {
    return null
  }

  return (
    <Card
      animated
      className={`transition-all ${
        isProcessing ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:shadow-md"
      }`}
      hoverable
      onClick={() => {
        if (!isProcessing) {
          onApiKeyClick()
        }
      }}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Key className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-foreground text-sm">API 키 설정</div>
          <div className="mt-0.5 text-muted-foreground text-xs">
            {apiKeyCount > 0 ? `${apiKeyCount}개 키 등록됨` : "OpenAI API 키를 설정하세요"}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
