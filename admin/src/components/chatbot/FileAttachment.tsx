import { File, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FileAttachmentProps {
  fileName: string
  fileSize: number
  onRemove?: () => void
  variant?: "display" | "removable"
}

export function FileAttachment({
  fileName,
  fileSize,
  onRemove,
  variant = "display",
}: FileAttachmentProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
      <File className="h-4 w-4 text-muted-foreground" />
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{fileName}</span>
        <span className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</span>
      </div>
      {variant === "removable" && onRemove && (
        <Button
          onClick={onRemove}
          variant="ghost"
          size="icon"
          className="h-5 w-5 ml-1 hover:bg-destructive/20"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
