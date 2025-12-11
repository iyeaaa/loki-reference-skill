import { Loader2, Mail, Sparkles } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { SignatureEditorModal } from "@/components/SignatureEditorModal"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useSequenceSteps } from "@/lib/api/hooks/sequences"

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
      <div className="space-y-4 rounded-lg border p-4 bg-card">
        <div className="flex items-center space-x-2">
          <Checkbox
            id={signatureCheckboxId}
            checked={includeSignature}
            onCheckedChange={(checked) => onIncludeSignatureChange?.(checked as boolean)}
            disabled={isGenerating}
          />
          <Label htmlFor={signatureCheckboxId} className="text-sm font-medium cursor-pointer">
            이메일에 서명 추가
          </Label>
        </div>

        {includeSignature && (
          <div className="space-y-3 pl-6 border-l-2 border-primary/20">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">서명 설정</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSignatureModalOpen(true)}
                disabled={isGenerating}
                className="h-8"
              >
                <Mail className="h-3 w-3 mr-1" />
                서명 편집
              </Button>
            </div>

            {/* Signature Preview */}
            {signature && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">서명 미리보기</Label>
                <div
                  className="text-xs prose prose-sm max-w-none dark:prose-invert"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: User-managed signature content is safe
                  dangerouslySetInnerHTML={{ __html: signature }}
                />
                <p className="text-xs text-muted-foreground">
                  이 서명은 생성된 모든 이메일 본문 하단에 자동으로 추가됩니다.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

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

      {/* Signature Editor Modal */}
      {getUserSignature && (
        <SignatureEditorModal
          isOpen={isSignatureModalOpen}
          onClose={() => setIsSignatureModalOpen(false)}
          defaultSignature={signature || getUserSignature()}
          onSave={(newSignature) => {
            onSignatureChange?.(newSignature)
            setIsSignatureModalOpen(false)
          }}
          workspaceId={workspaceId}
          userId={userId}
        />
      )}
    </div>
  )
}
