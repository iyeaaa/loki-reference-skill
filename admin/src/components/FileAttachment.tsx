import { Paperclip, X } from "lucide-react"
import { useRef } from "react"
import { Button } from "./ui/button"

interface FileAttachmentProps {
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
    if (bytes === 0) return "0 Bytes"
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
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="gap-2"
        >
          <Paperclip className="h-4 w-4" />
          파일 첨부
        </Button>
        {files.length > 0 && (
          <span className="text-sm text-gray-500">
            {files.length}개 파일 ({formatFileSize(totalSize)})
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded border border-gray-200"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm truncate" title={file.name}>
                  {file.name}
                </span>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {formatFileSize(file.size)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="text-gray-400 hover:text-red-500 flex-shrink-0"
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
