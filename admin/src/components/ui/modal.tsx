import type { ReactNode } from "react"
import { useEffect } from "react"
import { cn } from "@/lib/utils"

type ModalProps = {
  open: boolean
  title?: string
  className?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ open, title, onClose, children, footer, className }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div
      className={cn("fixed inset-0 z-50 flex items-center justify-center", "bg-black/50")}
      role="presentation"
    >
      <button
        aria-label="배경 클릭 시 닫기"
        className="absolute inset-0"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            onClose()
          }
        }}
        type="button"
      />
      <div
        aria-modal="true"
        className={cn(
          "relative z-[1] w-[520px] max-w-[92vw] rounded-md border bg-white text-card-foreground shadow-lg",
          "outline-none",
          className,
        )}
        role="dialog"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold text-base">{title}</h3>
          <button
            aria-label="닫기"
            className="rounded p-1 text-sm hover:bg-muted"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
        {footer ? <div className="border-t px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  )
}
