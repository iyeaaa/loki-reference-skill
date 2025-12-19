import { AlertTriangle, Check, Copy } from "lucide-react"
import { useEffect, useState } from "react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type ConfirmDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  title: string
  description?: string
  confirmText: string
  itemName?: string
  isLoading?: boolean
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText,
  itemName,
  isLoading = false,
}: ConfirmDeleteDialogProps) {
  const [inputValue, setInputValue] = useState("")
  const [copied, setCopied] = useState(false)

  const isConfirmEnabled = inputValue === confirmText

  useEffect(() => {
    if (!open) {
      setInputValue("")
      setCopied(false)
    }
  }, [open])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(confirmText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleConfirm = async () => {
    if (!isConfirmEnabled) {
      return
    }
    await onConfirm()
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center text-xl">{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-center">{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {itemName && (
            <div className="rounded-lg border border-muted-foreground/30 border-dashed bg-muted/30 p-3">
              <p className="text-center text-muted-foreground text-sm">삭제 대상</p>
              <p className="mt-1 text-center font-medium">{itemName}</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                삭제를 확인하려면 아래 텍스트를 입력하세요
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
              <code className="flex-1 select-all text-center font-mono text-destructive text-sm">
                {confirmText}
              </code>
              <Button
                className="h-8 w-8 shrink-0"
                onClick={handleCopy}
                size="icon"
                type="button"
                variant="ghost"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>

            <Input
              autoComplete="off"
              className={cn(
                "text-center font-mono transition-colors",
                isConfirmEnabled && "border-destructive focus-visible:ring-destructive",
              )}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={confirmText}
              value={inputValue}
            />
          </div>
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            disabled={!isConfirmEnabled || isLoading}
            onClick={handleConfirm}
            variant="destructive"
          >
            {isLoading ? "삭제 중..." : "영구 삭제"}
          </Button>
          <AlertDialogCancel className="mt-0 w-full" disabled={isLoading}>
            취소
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
