import { File, FileSpreadsheet, X } from "lucide-react"
import { Button } from "@/components/ui/button"

type FileAttachmentProps = {
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
    if (bytes < 1024) {
      return `${bytes} B`
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // xlsx나 xls 파일인 경우 스프레드시트 아이콘 표시
  const isSpreadsheet =
    fileName.toLowerCase().endsWith(".xlsx") ||
    fileName.toLowerCase().endsWith(".xls") ||
    fileName.toLowerCase().endsWith(".csv")

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
      {isSpreadsheet ? (
        <FileSpreadsheet className="h-4 w-4 text-green-600" />
      ) : (
        <File className="h-4 w-4 text-muted-foreground" />
      )}
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{fileName}</span>
        <span className="text-muted-foreground text-xs">{formatFileSize(fileSize)}</span>
      </div>
      {variant === "removable" && onRemove && (
        <Button
          className="ml-1 h-5 w-5 hover:bg-destructive/20"
          onClick={onRemove}
          size="icon"
          variant="ghost"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
