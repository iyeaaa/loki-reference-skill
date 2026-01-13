import { AnimatePresence, motion } from "framer-motion"
import { Check, Download, Edit2, FileUp, Plus, Save, Upload, X } from "lucide-react"
import type React from "react"
import { useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { formatFileSize } from "@/utils/web-extraction.utils"

type FileUploadModalProps = {
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
  searchCriteria: string[]
  onSearchCriteriaChange: (criteria: string[]) => void
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
  searchCriteria,
  onSearchCriteriaChange,
}: FileUploadModalProps) {
  const [newCriterion, setNewCriterion] = useState("")
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState("")

  const predefinedCriteria = [
    "b2b 납품을 하는가?",
    "한국 기업인가?",
    "대기업인가?",
    "브랜드사인가?",
  ]

  const handleStartEdit = (index: number, value: string) => {
    setEditingIndex(index)
    setEditingValue(value)
  }

  const handleSaveEdit = (index: number) => {
    if (editingValue.trim() && !searchCriteria.includes(editingValue.trim())) {
      const newCriteria = [...searchCriteria]
      newCriteria[index] = editingValue.trim()
      onSearchCriteriaChange(newCriteria)
      setEditingIndex(null)
      setEditingValue("")
    } else if (editingValue.trim() === searchCriteria[index]) {
      setEditingIndex(null)
      setEditingValue("")
    }
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditingValue("")
  }
  return (
    <Dialog onOpenChange={onOpenChange} open={isOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>파일 업로드</DialogTitle>
          <DialogDescription>
            website_url이 포함된 파일을 올려주세요 (Excel, CSV 지원)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drag & Drop Zone */}
          <motion.div
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
            className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center ${isProcessing ? "pointer-events-none opacity-50" : ""}
              `}
            onClick={() => fileInputRef.current?.click()}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            role="button"
            tabIndex={0}
            transition={{
              duration: 0.2,
              ease: "easeInOut",
            }}
            whileHover={
              isProcessing || selectedFile
                ? {}
                : {
                    borderColor: "hsl(var(--primary) / 0.5)",
                    backgroundColor: "hsl(var(--accent) / 0.5)",
                  }
            }
            whileTap={isProcessing ? {} : { scale: 0.98 }}
          >
            <input
              accept=".xlsx,.xls,.csv"
              className="hidden"
              disabled={isProcessing}
              onChange={onFileChange}
              ref={fileInputRef}
              type="file"
            />

            <AnimatePresence mode="wait">
              {selectedFile ? (
                <motion.div
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="space-y-2"
                  exit={{ opacity: 0, scale: 0.8 }}
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  key="file-selected-modal"
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <motion.div
                    animate={{ scale: 1 }}
                    className="mb-2 flex justify-center"
                    initial={{ scale: 0 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
                      <FileUp className="h-8 w-8 text-primary" />
                    </div>
                  </motion.div>
                  <motion.p
                    animate={{ opacity: 1 }}
                    className="font-semibold text-lg text-primary"
                    initial={{ opacity: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    {selectedFile.name}
                  </motion.p>
                  <motion.div
                    animate={{ opacity: 1 }}
                    className="space-y-1"
                    initial={{ opacity: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <p className="text-muted-foreground text-sm">
                      <span className="font-medium">{formatFileSize(selectedFile.size)}</span>
                    </p>
                    {isValidatingFile ? (
                      <motion.p
                        animate={{ opacity: 1 }}
                        className="text-muted-foreground text-sm"
                        initial={{ opacity: 0 }}
                      >
                        검증 중...
                      </motion.p>
                    ) : urlCount !== null ? (
                      <motion.p
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-muted-foreground text-sm"
                        initial={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: 0.4, type: "spring" }}
                      >
                        URL{" "}
                        <span className="font-medium text-primary">
                          {urlCount.toLocaleString()}개
                        </span>
                      </motion.p>
                    ) : null}
                  </motion.div>
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    initial={{ opacity: 0, y: 10 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Button
                      className="mt-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveFile()
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      <X className="mr-2 h-4 w-4" />
                      제거
                    </Button>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  animate={{ opacity: 1 }}
                  className="space-y-2"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  key="file-empty-modal"
                  transition={{ duration: 0.2 }}
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
                    <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  </motion.div>
                  <p className="font-semibold text-lg">website_url이 포함된 파일을 올려주세요</p>
                  <p className="text-muted-foreground text-sm">
                    Excel(.xlsx, .xls) 또는 CSV 파일 지원 · 드래그하거나 클릭
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Template Download Button - Outside upload area */}
          <div className="mt-4 flex justify-center">
            <Button
              className="text-xs"
              onClick={onDownloadTemplate}
              size="sm"
              type="button"
              variant="outline"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              템플릿 다운로드
            </Button>
          </div>

          {/* Search Criteria Section */}
          <div className="space-y-4 border-t pt-4">
            <div>
              <Label className="font-semibold text-sm">검색 조건 (선택사항)</Label>
              <p className="mt-1 text-muted-foreground text-xs">
                추가 검색 조건을 입력하면 각 웹사이트에서 해당 조건에 대한 true/false 결과가
                추가됩니다
              </p>
            </div>

            {/* Selected Criteria - Display at top */}
            {searchCriteria.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-primary text-xs">
                    선택된 조건 ({searchCriteria.length}개)
                  </Label>
                  <Button
                    className="h-6 text-xs"
                    disabled={isProcessing}
                    onClick={() => onSearchCriteriaChange([])}
                    size="sm"
                    variant="ghost"
                  >
                    <X className="mr-1 h-3 w-3" />
                    전체 삭제
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {searchCriteria.map((criterion, index) => (
                    <motion.div
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      initial={{ scale: 0.8, opacity: 0 }}
                      key={index}
                      transition={{ duration: 0.2 }}
                    >
                      {editingIndex === index ? (
                        <div className="flex items-center gap-1 rounded-md bg-muted p-1">
                          <Input
                            autoFocus
                            className="h-7 w-[200px] text-xs"
                            disabled={isProcessing}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveEdit(index)
                              } else if (e.key === "Escape") {
                                handleCancelEdit()
                              }
                            }}
                            value={editingValue}
                          />
                          <Button
                            className="h-7 w-7 p-0"
                            disabled={isProcessing}
                            onClick={() => handleSaveEdit(index)}
                            size="sm"
                            variant="ghost"
                          >
                            <Check className="h-3 w-3 text-green-600" />
                          </Button>
                          <Button
                            className="h-7 w-7 p-0"
                            disabled={isProcessing}
                            onClick={handleCancelEdit}
                            size="sm"
                            variant="ghost"
                          >
                            <X className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <Badge
                          className="gap-2 py-1.5 pr-1 pl-3 text-xs transition-colors hover:bg-secondary/80"
                          variant="secondary"
                        >
                          <span className="max-w-[200px] truncate">{criterion}</span>
                          <div className="flex items-center gap-0.5">
                            <Button
                              className="h-5 w-5 p-0 hover:bg-primary/20"
                              disabled={isProcessing}
                              onClick={() => handleStartEdit(index, criterion)}
                              size="sm"
                              variant="ghost"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              className="h-5 w-5 p-0 hover:bg-destructive/20"
                              disabled={isProcessing}
                              onClick={() => {
                                onSearchCriteriaChange(searchCriteria.filter((_, i) => i !== index))
                              }}
                              size="sm"
                              variant="ghost"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </Badge>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            {searchCriteria.length > 0 && <div className="border-t" />}

            {/* Predefined criteria cards */}
            <div className="space-y-2">
              <Label className="font-medium text-xs">빠른 선택</Label>
              <div className="grid grid-cols-2 gap-2">
                {predefinedCriteria.map((predefinedCriterion) => {
                  const isAdded = searchCriteria.includes(predefinedCriterion)
                  return (
                    <Button
                      className={cn(
                        "relative h-auto justify-start px-3 py-2.5 text-left transition-all",
                        isAdded && "bg-primary text-primary-foreground hover:bg-primary/90",
                      )}
                      disabled={isProcessing}
                      key={predefinedCriterion}
                      onClick={() => {
                        if (isAdded) {
                          onSearchCriteriaChange(
                            searchCriteria.filter((c) => c !== predefinedCriterion),
                          )
                        } else {
                          onSearchCriteriaChange([...searchCriteria, predefinedCriterion])
                        }
                      }}
                      size="sm"
                      variant={isAdded ? "default" : "outline"}
                    >
                      <span className="text-xs">{predefinedCriterion}</span>
                      {isAdded && <Check className="absolute top-1 right-1 h-3 w-3" />}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Add new criterion */}
            <div className="space-y-2">
              <Label className="font-medium text-xs">직접 입력</Label>
              <div className="flex gap-2">
                <Input
                  className="text-sm"
                  disabled={isProcessing}
                  onChange={(e) => setNewCriterion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCriterion.trim()) {
                      e.preventDefault()
                      if (searchCriteria.includes(newCriterion.trim())) {
                        toast.error("이미 추가된 조건입니다")
                      } else {
                        onSearchCriteriaChange([...searchCriteria, newCriterion.trim()])
                        setNewCriterion("")
                        toast.success("검색 조건이 추가되었습니다")
                      }
                    }
                  }}
                  placeholder="예: 이 회사는 B2C를 하는가?"
                  value={newCriterion}
                />
                <Button
                  disabled={isProcessing || !newCriterion.trim()}
                  onClick={() => {
                    if (newCriterion.trim()) {
                      if (searchCriteria.includes(newCriterion.trim())) {
                        toast.error("이미 추가된 조건입니다")
                      } else {
                        onSearchCriteriaChange([...searchCriteria, newCriterion.trim()])
                        setNewCriterion("")
                        toast.success("검색 조건이 추가되었습니다")
                      }
                    }
                  }}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  추가
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button disabled={isProcessing} onClick={() => onOpenChange(false)} variant="outline">
              취소
            </Button>
            <Button
              disabled={
                !selectedFile ||
                isProcessing ||
                isValidatingFile ||
                urlCount === null ||
                urlCount === 0
              }
              onClick={() => {
                if (selectedFile) {
                  onUpload()
                  onOpenChange(false)
                }
              }}
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
