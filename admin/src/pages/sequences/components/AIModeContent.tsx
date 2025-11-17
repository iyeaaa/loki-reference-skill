import { Loader2, Sparkles } from "lucide-react"
import {
  useEffect,
  // useId,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useSequenceSteps } from "@/lib/api/hooks/sequences"
// import { Label } from "@/components/ui/label"
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select"
import { AIModeGeneratedContent } from "./AIModeGeneratedContent"

interface AIModeContentProps {
  sequenceId?: string | null
  workspaceId: string
  // selectedEmailAccountId: string
  // onEmailAccountChange: (id: string) => void
  // emailAccounts: Array<{
  //   id: string
  //   emailAddress?: string | null | undefined
  //   displayName?: string | null | undefined
  //   userEmail: string | null | undefined
  // }>
  isGenerating: boolean
  onGenerateAI: () => void
}

export function AIModeContent({
  sequenceId,
  workspaceId: _workspaceId,
  // selectedEmailAccountId,
  // onEmailAccountChange,
  // emailAccounts,
  isGenerating,
  onGenerateAI,
}: AIModeContentProps) {
  const { t } = useTranslation()
  // const emailAccountSelectId = useId()
  const [showGeneratedContent, setShowGeneratedContent] = useState(false)

  // Check if we have generated steps
  const { data: steps } = useSequenceSteps(sequenceId || "", !!sequenceId)

  // Check if generation is complete (we have steps)
  useEffect(() => {
    if (steps && steps.length > 0) {
      setShowGeneratedContent(true)
    }
  }, [steps])

  // Show generated content if available
  if (showGeneratedContent && sequenceId) {
    return (
      <AIModeGeneratedContent
        sequenceId={sequenceId}
        onBack={() => setShowGeneratedContent(false)}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Email account is now optional - warning commented out */}
      {/* {emailAccounts.length === 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-4 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {t("sequences.aiMode.noEmailAccountsWarning")}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                {t("sequences.aiMode.noEmailAccountsMessage")}
              </p>
              <Link to="/settings?tab=workspace" className="mt-3 inline-block">
                <Button size="sm" variant="outline" className="border-amber-300">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("sequences.aiMode.addEmailAccount")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={emailAccountSelectId}>{t("sequences.aiMode.selectEmailAccount")}</Label>
        <Select
          value={selectedEmailAccountId}
          onValueChange={onEmailAccountChange}
          disabled={isGenerating || emailAccounts.length === 0}
        >
          <SelectTrigger id={emailAccountSelectId}>
            <SelectValue placeholder={t("sequences.aiMode.selectEmailAccountPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {emailAccounts.length === 0 ? (
              <SelectItem disabled value="none">
                {t("sequences.aiMode.noEmailAccounts")}
              </SelectItem>
            ) : (
              emailAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.displayName || account.emailAddress || account.userEmail || "No Info"}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div> */}

      <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-6 rounded-xl border-2 border-primary/20">
        <Button
          onClick={onGenerateAI}
          disabled={isGenerating}
          className="w-full shadow-lg hover:shadow-xl transition-all"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {t("sequences.aiMode.generating")}
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 mr-2" />
              {t("sequences.aiMode.generateButton")}
            </>
          )}
        </Button>
      </div>

      {isGenerating && (
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 p-5 border-2 border-blue-200 dark:border-blue-800 shadow-md">
          <div className="flex items-start gap-4">
            <Loader2 className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0 animate-spin" />
            <div className="space-y-2">
              <p className="text-base font-semibold text-blue-900 dark:text-blue-200">
                {t("sequences.aiMode.generatingMessage")}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {t("sequences.aiMode.generatingDetails")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
