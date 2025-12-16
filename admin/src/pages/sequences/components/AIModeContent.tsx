import { Loader2, Mail, Sparkles } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { SignatureEditorModal } from "@/components/SignatureEditorModal"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useSequenceSteps } from "@/lib/api/hooks/sequences"

type AIModeContentProps = {
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
  // Callback when generation is complete - auto-advance to next step
  onGenerationComplete?: () => void
  // Signature options
  includeSignature?: boolean
  onIncludeSignatureChange?: (include: boolean) => void
  signature?: string
  onSignatureChange?: (signature: string) => void
  getUserSignature?: () => string
  userId?: string
}

export function AIModeContent({
  sequenceId,
  workspaceId,
  // selectedEmailAccountId,
  // onEmailAccountChange,
  // emailAccounts,
  isGenerating,
  onGenerateAI,
  onGenerationComplete,
  includeSignature = false,
  onIncludeSignatureChange,
  signature,
  onSignatureChange,
  getUserSignature,
  userId,
}: AIModeContentProps) {
  const { t } = useTranslation()
  // const emailAccountSelectId = useId()
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false)
  const signatureCheckboxId = useId()

  // Check if we have generated steps
  const { data: steps } = useSequenceSteps(sequenceId || "", !!sequenceId)

  // When generation is complete (we have steps), auto-advance to next step
  useEffect(() => {
    if (steps && steps.length > 0 && onGenerationComplete) {
      // Call the callback to advance to Step 3 instead of showing result page here
      onGenerationComplete()
    }
  }, [steps, onGenerationComplete])

  return (
    <div className="space-y-6">
      {/* Signature Option */}
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={includeSignature}
            disabled={isGenerating}
            id={signatureCheckboxId}
            onCheckedChange={(checked) => onIncludeSignatureChange?.(checked as boolean)}
          />
          <Label className="cursor-pointer font-medium text-sm" htmlFor={signatureCheckboxId}>
            이메일에 서명 추가
          </Label>
        </div>

        {includeSignature && (
          <div className="space-y-3 border-primary/20 border-l-2 pl-6">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground text-sm">서명 설정</Label>
              <Button
                className="h-8"
                disabled={isGenerating}
                onClick={() => setIsSignatureModalOpen(true)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Mail className="mr-1 h-3 w-3" />
                서명 편집
              </Button>
            </div>

            {/* Signature Preview */}
            {signature && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <Label className="font-medium text-muted-foreground text-xs">서명 미리보기</Label>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-xs"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: User-managed signature content is safe
                  dangerouslySetInnerHTML={{ __html: signature }}
                />
                <p className="text-muted-foreground text-xs">
                  이 서명은 생성된 모든 이메일 본문 하단에 자동으로 추가됩니다.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6">
        <Button
          className="w-full shadow-lg transition-all hover:shadow-xl"
          disabled={isGenerating}
          onClick={onGenerateAI}
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t("sequences.aiMode.generating")}
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              {t("sequences.aiMode.generateButton")}
            </>
          )}
        </Button>
      </div>

      {isGenerating && (
        <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-5 shadow-md dark:border-blue-800 dark:from-blue-950/30 dark:to-blue-900/20">
          <div className="flex items-start gap-4">
            <Loader2 className="mt-0.5 h-6 w-6 flex-shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
            <div className="space-y-2">
              <p className="font-semibold text-base text-blue-900 dark:text-blue-200">
                {t("sequences.aiMode.generatingMessage")}
              </p>
              <p className="text-blue-700 text-sm dark:text-blue-300">
                {t("sequences.aiMode.generatingDetails")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Signature Editor Modal */}
      {getUserSignature && (
        <SignatureEditorModal
          defaultSignature={signature || getUserSignature()}
          isOpen={isSignatureModalOpen}
          onClose={() => setIsSignatureModalOpen(false)}
          onSave={(newSignature) => {
            onSignatureChange?.(newSignature)
            setIsSignatureModalOpen(false)
          }}
          userId={userId}
          workspaceId={workspaceId}
        />
      )}
    </div>
  )
}
