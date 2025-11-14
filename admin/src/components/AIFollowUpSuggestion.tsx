import { Sparkles } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AIFollowUpSuggestionProps {
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
    if (!onGenerateSuggestion) return

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
        "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900",
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
          onClick={handleGenerate}
          disabled={disabled || loading}
          variant="outline"
          size="sm"
          className="w-full bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Sparkles className="size-4" />
          {loading ? "Generating..." : "Generate Suggestion"}
        </Button>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </CardContent>
    </Card>
  )
}
