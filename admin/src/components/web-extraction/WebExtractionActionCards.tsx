import { Key } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface WebExtractionActionCardsProps {
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
      hoverable
      animated
      onClick={() => {
        if (!isProcessing) {
          onApiKeyClick()
        }
      }}
      className={`transition-all ${
        isProcessing ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:shadow-md"
      }`}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Key className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-foreground">API 키 설정</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {apiKeyCount > 0 ? `${apiKeyCount}개 키 등록됨` : "OpenAI API 키를 설정하세요"}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
