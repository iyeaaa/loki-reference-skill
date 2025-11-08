import { AnimatePresence, motion } from "framer-motion"
import { Download, FileUp, Save, Upload, X } from "lucide-react"
import type React from "react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatFileSize } from "@/utils/web-extraction.utils"
import { SpeedBoostBanner } from "./SpeedBoostBanner"

interface EmptyStateProps {
  selectedFile: File | null
  urlCount: number | null
  isValidatingFile: boolean
  isProcessing: boolean
  isDragOver: boolean
  activeApiKeysCount: number
  fileInputRef: React.RefObject<HTMLInputElement> | React.MutableRefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onRemoveFile: () => void
  onUpload: () => void
  onDownloadTemplate: () => void
  onAddApiKey: () => void
}

/**
 * Empty state UI component for Web Data Extraction
 */
export function EmptyState({
  selectedFile,
  urlCount,
  isValidatingFile,
  isProcessing,
  isDragOver,
  activeApiKeysCount,
  fileInputRef,
  onFileChange,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemoveFile,
  onUpload,
  onDownloadTemplate,
  onAddApiKey,
}: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center px-4 pt-[20vh] pb-8">
      <div className="mx-auto w-full space-y-8" style={{ maxWidth: "670px" }}>
        {/* Logo - Centered at top */}
        <div className="flex flex-col justify-center items-center gap-3">
          <motion.img
            src="/images/web-extraction-logo.webp"
            alt="웹데추"
            className="h-[100px] w-[100px] object-contain rounded-lg cursor-pointer"
            whileHover={{ scale: 1.1, rotate: 6 }}
            whileTap={{ scale: 1.5 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            style={{ boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)" }}
            onClick={() => {
              toast.success("웹데추! 🎉")
            }}
          />
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold">웹데추</h2>
            <span className="text-xs text-muted-foreground">v1.0.0.20251108</span>
          </div>
        </div>

        {/* File Upload Section - Centered */}
        <div className="relative w-full">
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
            }}
            transition={{
              duration: 0.2,
              ease: "easeInOut",
            }}
            whileHover={!isProcessing && !selectedFile ? { scale: 1.01 } : {}}
            whileTap={!isProcessing ? { scale: 0.98 } : {}}
            className={cn(
              "relative border-2 border-dashed rounded-2xl shadow-sm transition-colors duration-200",
              isDragOver
                ? "border-primary bg-primary/5"
                : selectedFile
                  ? "border-primary/50 bg-primary/3"
                  : "border-muted-foreground/25 bg-background",
              !isProcessing && !selectedFile && "hover:border-primary/50 hover:bg-accent/50",
              isProcessing && "opacity-50 pointer-events-none",
              !isProcessing && "cursor-pointer",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onFileChange}
              className="hidden"
              disabled={isProcessing}
            />

            <div className="p-8 text-center">
              <AnimatePresence mode="wait">
                {selectedFile ? (
                  <motion.div
                    key="file-selected"
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="space-y-3"
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
                      className="flex items-center justify-center gap-2 mt-4"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveFile()
                        }}
                      >
                        <X className="mr-2 h-4 w-4" />
                        제거
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (selectedFile && urlCount !== null && urlCount > 0) {
                            onUpload()
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
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="file-empty"
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
            </div>
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
        </div>

        {/* Speed Boost Banner */}
        <SpeedBoostBanner
          activeApiKeysCount={activeApiKeysCount}
          isProcessing={isProcessing}
          onAddApiKey={onAddApiKey}
        />
      </div>
    </div>
  )
}
