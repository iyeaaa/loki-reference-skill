import { AnimatePresence, motion } from "framer-motion"
import { Check, Download, Edit2, FileUp, Plus, Save, Upload, X } from "lucide-react"
import type React from "react"
import { useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  searchCriteria: string[]
  onSearchCriteriaChange: (criteria: string[]) => void
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
  searchCriteria,
  onSearchCriteriaChange,
}: EmptyStateProps) {
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
    <div className="flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">
      <div className="mx-auto w-full space-y-6" style={{ maxWidth: "670px" }}>
        {/* Logo - Centered at top */}
        <div className="flex flex-col justify-center items-center gap-2.5">
          <motion.img
            src="/images/web-extraction-logo.webp"
            alt="웹데추"
            className="h-[80px] w-[80px] object-contain rounded-lg cursor-pointer"
            whileHover={{ scale: 1.1, rotate: 6 }}
            whileTap={{ scale: 1.5 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            style={{ boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)" }}
            onClick={() => {
              toast.success("웹데추! 🎉")
            }}
          />
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">웹데추</h2>
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

        {/* Search Criteria Section */}
        <div className="border rounded-lg p-4 space-y-3 bg-card">
          <div>
            <Label className="text-sm font-semibold">검색 조건 (선택사항)</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
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
