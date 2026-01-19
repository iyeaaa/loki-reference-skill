import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type MissingEmailAlertModalProps = {
  isOpen: boolean
  onClose: () => void
  leadsWithoutEmail: Array<{ id: string; companyName: string | null; hasEmail: boolean }>
  onEnrichFirst: () => void
  onProceedWithValid: () => void
}

export function MissingEmailAlertModal({
  isOpen,
  onClose,
  leadsWithoutEmail,
  onEnrichFirst,
  onProceedWithValid,
}: MissingEmailAlertModalProps) {
  const missingCount = leadsWithoutEmail.filter((l) => !l.hasEmail).length
  const validCount = leadsWithoutEmail.filter((l) => l.hasEmail).length
  const displayedLeads = leadsWithoutEmail.filter((l) => !l.hasEmail).slice(0, 5)
  const remainingCount = missingCount - displayedLeads.length

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={isOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            {missingCount}개 리드에 이메일이 없어요
          </DialogTitle>
          <DialogDescription className="pt-2">
            이메일이 있어야 영업 메일을 보낼 수 있어요. 정보 보강을 통해 이메일을 찾아보세요!
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 max-h-40 overflow-y-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <ul className="space-y-1.5 text-sm">
            {displayedLeads.map((lead) => (
              <li
                className="flex items-center gap-2 text-gray-700 dark:text-gray-300"
                key={lead.id}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                {lead.companyName || "이름 없음"}
              </li>
            ))}
            {remainingCount > 0 && (
              <li className="text-gray-500 dark:text-gray-400">... 외 {remainingCount}개</li>
            )}
          </ul>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-700 hover:to-emerald-800 sm:w-auto"
            onClick={onEnrichFirst}
          >
            정보 보강 후 진행
          </Button>
          {validCount > 0 && (
            <Button className="w-full sm:w-auto" onClick={onProceedWithValid} variant="outline">
              이메일 있는 {validCount}개 리드만 진행
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
