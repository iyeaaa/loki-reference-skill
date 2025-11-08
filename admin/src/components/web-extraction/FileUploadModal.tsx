import { AnimatePresence, motion } from "framer-motion"
import { Download, FileUp, Save, Upload, X } from "lucide-react"
import type React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatFileSize } from "@/utils/web-extraction.utils"

interface FileUploadModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  selectedFile: File | null
  urlCount: number | null
  isValidatingFile: boolean
  isProcessing: boolean
  isDragOver: boolean
  fileInputRef: React.RefObject<HTMLInputElement> | React.MutableRefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onRemoveFile: () => void
  onUpload: () => void
  onDownloadTemplate: () => void
}

/**
 * File Upload Modal Component
 */
export function FileUploadModal({
  isOpen,
  onOpenChange,
  selectedFile,
  urlCount,
  isValidatingFile,
  isProcessing,
  isDragOver,
  fileInputRef,
  onFileChange,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemoveFile,
  onUpload,
  onDownloadTemplate,
}: FileUploadModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>파일 업로드</DialogTitle>
          <DialogDescription>website_url이 포함된 엑셀 파일을 올려주세요</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drag & Drop Zone */}
          <motion.div
            role="button"
            tabIndex={0}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            animate={{
              scale: isDragOver ? 1.02 : 1,
              borderColor: isDragOver
                ? "hsl(var(--primary))"
                : selectedFile
                  ? "hsl(var(--primary) / 0.5)"
                  : "hsl(var(--muted-foreground) / 0.25)",
              backgroundColor: isDragOver
                ? "hsl(var(--primary) / 0.05)"
                : selectedFile
                  ? "hsl(var(--primary) / 0.03)"
                  : "hsl(var(--background))",
            }}
            transition={{
              duration: 0.2,
              ease: "easeInOut",
            }}
            whileHover={
              !isProcessing && !selectedFile
                ? {
                    borderColor: "hsl(var(--primary) / 0.5)",
                    backgroundColor: "hsl(var(--accent) / 0.5)",
                  }
                : {}
            }
            whileTap={!isProcessing ? { scale: 0.98 } : {}}
            className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                ${isProcessing ? "opacity-50 pointer-events-none" : ""}
              `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onFileChange}
              className="hidden"
              disabled={isProcessing}
            />

            <AnimatePresence mode="wait">
              {selectedFile ? (
                <motion.div
                  key="file-selected-modal"
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="space-y-2"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
                    className="flex justify-center mb-2"
                  >
                    <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileUp className="h-8 w-8 text-primary" />
                    </div>
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-lg font-semibold text-primary"
                  >
                    {selectedFile.name}
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-1"
                  >
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">{formatFileSize(selectedFile.size)}</span>
                    </p>
                    {isValidatingFile ? (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-muted-foreground"
                      >
                        검증 중...
                      </motion.p>
                    ) : urlCount !== null ? (
                      <motion.p
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4, type: "spring" }}
                        className="text-sm text-muted-foreground"
                      >
                        URL{" "}
                        <span className="font-medium text-primary">
                          {urlCount.toLocaleString()}개
                        </span>
                      </motion.p>
                    ) : null}
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveFile()
                      }}
                      className="mt-2"
                    >
                      <X className="mr-2 h-4 w-4" />
                      제거
                    </Button>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="file-empty-modal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2"
                >
                  <motion.div
                    animate={{
                      y: [0, -8, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }}
                  >
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  </motion.div>
                  <p className="text-lg font-semibold">
                    website_url이 포함된 엑셀 파일을 올려주세요
                  </p>
                  <p className="text-sm text-muted-foreground">드래그하거나 클릭하면 돼요</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Template Download Button - Outside upload area */}
          <div className="flex justify-center mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDownloadTemplate}
              className="text-xs"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              템플릿 다운로드
            </Button>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
              취소
            </Button>
            <Button
              onClick={() => {
                if (selectedFile) {
                  onUpload()
                  onOpenChange(false)
                }
              }}
              disabled={
                !selectedFile ||
                isProcessing ||
                isValidatingFile ||
                urlCount === null ||
                urlCount === 0
              }
            >
              <Save className="mr-2 h-4 w-4" />
              업로드 시작
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
