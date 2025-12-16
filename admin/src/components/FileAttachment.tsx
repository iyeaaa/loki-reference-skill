import { Paperclip, X } from "lucide-react"
import { useRef } from "react"
import { Button } from "./ui/button"

type FileAttachmentProps = {
  files: File[]
  onFilesChange: (files: File[]) => void
  maxSize?: number // in bytes, default 30MB
  maxFiles?: number
}

export function FileAttachment({
  files,
  onFilesChange,
  maxSize = 30 * 1024 * 1024, // 30MB
  maxFiles = 10,
}: FileAttachmentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])

    // Check max files
    if (files.length + selectedFiles.length > maxFiles) {
      alert(`최대 ${maxFiles}개의 파일만 첨부할 수 있습니다.`)
      return
    }

    // Check total size
    const currentSize = files.reduce((sum, file) => sum + file.size, 0)
    const newSize = selectedFiles.reduce((sum, file) => sum + file.size, 0)

    if (currentSize + newSize > maxSize) {
      const maxSizeMB = Math.round(maxSize / 1024 / 1024)
      alert(`첨부 파일 총 크기는 ${maxSizeMB}MB를 초과할 수 없습니다.`)
      return
    }

    onFilesChange([...files, ...selectedFiles])

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    onFilesChange(newFiles)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) {
      return "0 Bytes"
    }
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          className="gap-2"
          onClick={() => fileInputRef.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          <Paperclip className="h-4 w-4" />
          파일 첨부
        </Button>
        {files.length > 0 && (
          <span className="text-gray-500 text-sm">
            {files.length}개 파일 ({formatFileSize(totalSize)})
          </span>
        )}
      </div>

      <input
        className="hidden"
        multiple
        onChange={handleFileSelect}
        ref={fileInputRef}
        type="file"
      />

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file, index) => (
            <div
              className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-gray-50 p-2"
              key={`${file.name}-${index}`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Paperclip className="h-4 w-4 flex-shrink-0 text-gray-400" />
                <span className="truncate text-sm" title={file.name}>
                  {file.name}
                </span>
                <span className="flex-shrink-0 text-gray-500 text-xs">
                  {formatFileSize(file.size)}
                </span>
              </div>
              <button
                className="flex-shrink-0 text-gray-400 hover:text-red-500"
                onClick={() => removeFile(index)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
