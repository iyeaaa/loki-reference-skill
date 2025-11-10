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

          {/* Search Criteria Section */}
          <div className="border-t pt-4 space-y-4">
            <div>
              <Label className="text-sm font-semibold">검색 조건 (선택사항)</Label>
              <p className="text-xs text-muted-foreground mt-1">
                추가 검색 조건을 입력하면 각 웹사이트에서 해당 조건에 대한 true/false 결과가
                추가됩니다
              </p>
            </div>

            {/* Selected Criteria - Display at top */}
            {searchCriteria.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-primary">
                    선택된 조건 ({searchCriteria.length}개)
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => onSearchCriteriaChange([])}
                    disabled={isProcessing}
                  >
                    <X className="h-3 w-3 mr-1" />
                    전체 삭제
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {searchCriteria.map((criterion, index) => (
                    <motion.div
                      key={index}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {editingIndex === index ? (
                        <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveEdit(index)
                              } else if (e.key === "Escape") {
                                handleCancelEdit()
                              }
                            }}
                            className="h-7 text-xs w-[200px]"
                            autoFocus
                            disabled={isProcessing}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleSaveEdit(index)}
                            disabled={isProcessing}
                          >
                            <Check className="h-3 w-3 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={handleCancelEdit}
                            disabled={isProcessing}
                          >
                            <X className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="pl-3 pr-1 py-1.5 gap-2 text-xs hover:bg-secondary/80 transition-colors"
                        >
                          <span className="max-w-[200px] truncate">{criterion}</span>
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 hover:bg-primary/20"
                              onClick={() => handleStartEdit(index, criterion)}
                              disabled={isProcessing}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 hover:bg-destructive/20"
                              onClick={() => {
                                onSearchCriteriaChange(searchCriteria.filter((_, i) => i !== index))
                              }}
                              disabled={isProcessing}
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
              <Label className="text-xs font-medium">빠른 선택</Label>
              <div className="grid grid-cols-2 gap-2">
                {predefinedCriteria.map((predefinedCriterion) => {
                  const isAdded = searchCriteria.includes(predefinedCriterion)
                  return (
                    <Button
                      key={predefinedCriterion}
                      variant={isAdded ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "justify-start text-left h-auto py-2.5 px-3 transition-all relative",
                        isAdded && "bg-primary text-primary-foreground hover:bg-primary/90",
                      )}
                      onClick={() => {
                        if (isAdded) {
                          onSearchCriteriaChange(
                            searchCriteria.filter((c) => c !== predefinedCriterion),
                          )
                        } else {
                          onSearchCriteriaChange([...searchCriteria, predefinedCriterion])
                        }
                      }}
                      disabled={isProcessing}
                    >
                      <span className="text-xs">{predefinedCriterion}</span>
                      {isAdded && <Check className="h-3 w-3 absolute top-1 right-1" />}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Add new criterion */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">직접 입력</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="예: 이 회사는 B2C를 하는가?"
                  value={newCriterion}
                  onChange={(e) => setNewCriterion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCriterion.trim()) {
                      e.preventDefault()
                      if (!searchCriteria.includes(newCriterion.trim())) {
                        onSearchCriteriaChange([...searchCriteria, newCriterion.trim()])
                        setNewCriterion("")
                        toast.success("검색 조건이 추가되었습니다")
                      } else {
                        toast.error("이미 추가된 조건입니다")
                      }
                    }
                  }}
                  disabled={isProcessing}
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (newCriterion.trim()) {
                      if (!searchCriteria.includes(newCriterion.trim())) {
                        onSearchCriteriaChange([...searchCriteria, newCriterion.trim()])
                        setNewCriterion("")
                        toast.success("검색 조건이 추가되었습니다")
                      } else {
                        toast.error("이미 추가된 조건입니다")
                      }
                    }
                  }}
                  disabled={isProcessing || !newCriterion.trim()}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  추가
                </Button>
              </div>
            </div>
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
