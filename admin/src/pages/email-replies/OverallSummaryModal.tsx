import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { aiEmailApi, type GenerateOverallSummaryResponse } from "@/lib/api/services/ai-email"

type OverallSummaryModalProps = {
  isOpen: boolean
  onClose: () => void
  workspaceId?: string
  intent?: string
}

export function OverallSummaryModal({
  isOpen,
  onClose,
  workspaceId,
  intent,
}: OverallSummaryModalProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summaryData, setSummaryData] = useState<GenerateOverallSummaryResponse | null>(null)
  const hasStartedRef = useRef(false)

  const handleGenerateSummary = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await aiEmailApi.generateOverallSummary({
        workspaceId,
        intent: intent === "all" ? undefined : intent,
        language: "ko",
        limit: 50,
      })
      setSummaryData(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("email-replies.overallSummary.error.message"))
    } finally {
      setLoading(false)
    }
  }, [workspaceId, intent, t])

  // Auto-start summary generation when modal opens
  useEffect(() => {
    if (isOpen && !hasStartedRef.current && !summaryData && !loading) {
      hasStartedRef.current = true
      handleGenerateSummary()
    }
  }, [isOpen, summaryData, loading, handleGenerateSummary])

  const handleClose = () => {
    onClose()
    // Reset state after close animation
    setTimeout(() => {
      setSummaryData(null)
      setError(null)
      hasStartedRef.current = false
    }, 200)
  }

  return (
    <Dialog onOpenChange={(open) => !open && handleClose()} open={isOpen}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            {t("email-replies.overallSummary.title")}
          </DialogTitle>
          <DialogDescription>{t("email-replies.overallSummary.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-muted-foreground text-sm">
                {t("email-replies.overallSummary.loading")}
              </p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-red-600 text-sm">{error}</p>
              <Button onClick={handleGenerateSummary} size="sm" variant="outline">
                {t("email-replies.overallSummary.button.tryAgain")}
              </Button>
            </div>
          )}

          {/* Summary result */}
          {summaryData && !loading && (
            <div className="flex flex-col gap-4">
              {/* Stats */}
              <div className="flex flex-wrap gap-2 rounded-lg border bg-gray-50 p-3 dark:bg-gray-800">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {t("email-replies.overallSummary.stats.emailCount")}:
                  </span>
                  <span className="text-sm">{summaryData.emailCount}</span>
                </div>
                {Object.entries(summaryData.intentDistribution).length > 0 && (
                  <div className="flex flex-wrap gap-2 border-gray-300 border-l pl-2">
                    {Object.entries(summaryData.intentDistribution).map(([key, value]) => (
                      <span
                        className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800 text-xs dark:bg-blue-900 dark:text-blue-200"
                        key={key}
                      >
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary content */}
              <div className="max-h-[50vh] overflow-y-auto rounded-lg border bg-white p-4 dark:bg-gray-900">
                <div className="prose prose-sm dark:prose-invert prose-li:my-1 prose-p:my-2 prose-ul:my-2 prose-headings:mt-4 prose-headings:mb-2 max-w-none prose-h2:border-gray-200 prose-h2:border-b prose-h2:pb-1 prose-headings:font-semibold prose-h2:text-base prose-headings:text-blue-600 prose-strong:text-gray-900 dark:prose-h2:border-gray-700 dark:prose-headings:text-blue-400 dark:prose-strong:text-gray-100">
                  <ReactMarkdown>{summaryData.summary}</ReactMarkdown>
                </div>
              </div>

              {/* Regenerate button */}
              <div className="flex justify-end">
                <Button
                  disabled={loading}
                  onClick={handleGenerateSummary}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("email-replies.overallSummary.button.regenerate")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
