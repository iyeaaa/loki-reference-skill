import { Sparkles } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type AIFollowUpSuggestionProps = {
  onGenerateSuggestion?: () => Promise<void> | void
  isLoading?: boolean
  error?: string | null
  className?: string
  disabled?: boolean
}

export function AIFollowUpSuggestion({
  onGenerateSuggestion,
  isLoading = false,
  error = null,
  className,
  disabled = false,
}: AIFollowUpSuggestionProps) {
  const [internalLoading, setInternalLoading] = useState(false)

  const handleGenerate = async () => {
    if (!onGenerateSuggestion) {
      return
    }

    try {
      setInternalLoading(true)
      await onGenerateSuggestion()
    } finally {
      setInternalLoading(false)
    }
  }

  const loading = isLoading || internalLoading

  return (
    <Card
      className={cn(
        "border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20",
        className,
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-5 text-blue-600 dark:text-blue-400" />
          AI Follow-up Suggestion
        </CardTitle>
        <CardDescription className="text-sm">
          AI analyzes this email and suggests follow-up actions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          className="w-full bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800"
          disabled={disabled || loading}
          onClick={handleGenerate}
          size="sm"
          variant="outline"
        >
          <Sparkles className="size-4" />
          {loading ? "Generating..." : "Generate Suggestion"}
        </Button>

        {error && <p className="text-red-600 text-sm dark:text-red-400">{error}</p>}
      </CardContent>
    </Card>
  )
}
