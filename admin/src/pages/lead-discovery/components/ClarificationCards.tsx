/**
 * Clarification Cards Component
 * 모호한 검색어에 대해 확인 질문을 표시하고 사용자 선택을 받는 컴포넌트
 * 토스 스타일 - 심플하고 깔끔한 UI
 */

import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronRight, HelpCircle, Loader2 } from "lucide-react"
import { useState } from "react"
import type { ClarificationData, ClarificationQuestion } from "@/lib/api/hooks/lead-discovery"
import { cn } from "@/lib/utils"

type ClarificationCardsProps = {
  clarificationData: ClarificationData
  onSubmit: (answers: Record<string, string>) => void
  disabled?: boolean
  isSubmitting?: boolean
  className?: string
}

// Field labels in Korean
const FIELD_LABELS: Record<string, string> = {
  country: "국가",
  industry: "산업",
  employeeRange: "회사 규모",
}

export function ClarificationCards({
  clarificationData,
  onSubmit,
  disabled = false,
  isSubmitting = false,
  className,
}: ClarificationCardsProps) {
  const { questions, understood, confidence } = clarificationData

  // Track selected answers for each question
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})

  // Check if all required questions are answered
  const requiredQuestions = questions.filter((q) => q.required)
  const allRequiredAnswered = requiredQuestions.every((q) => selectedAnswers[q.field])

  // Handle option selection
  const handleSelect = (field: string, value: string) => {
    if (disabled || isSubmitting) {
      return
    }
    setSelectedAnswers((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Handle submit
  const handleSubmit = () => {
    if (!allRequiredAnswered || disabled || isSubmitting) {
      return
    }
    onSubmit(selectedAnswers)
  }

  if (questions.length === 0) {
    return null
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2"
        initial={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.3 }}
      >
        <HelpCircle className="h-4 w-4 text-amber-500" />
        <span className="font-medium text-foreground text-sm">검색 조건을 더 명확히 해주세요</span>
        {confidence > 0 && (
          <span className="text-muted-foreground text-xs">(신뢰도: {confidence}%)</span>
        )}
      </motion.div>

      {/* Show what was understood */}
      {Object.keys(understood).length > 0 && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-border/50 bg-muted/30 p-3"
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <p className="mb-2 text-muted-foreground text-sm">이렇게 이해했어요:</p>
          <div className="flex flex-wrap gap-2">
            {understood.country && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 font-medium text-primary text-xs">
                <Check className="h-3 w-3" />
                {understood.country}
              </span>
            )}
            {understood.industry && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 font-medium text-primary text-xs">
                <Check className="h-3 w-3" />
                {understood.industry}
              </span>
            )}
            {understood.employeeRange && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 font-medium text-primary text-xs">
                <Check className="h-3 w-3" />
                {understood.employeeRange}
              </span>
            )}
            {understood.keywords && understood.keywords.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 font-medium text-primary text-xs">
                <Check className="h-3 w-3" />
                키워드: {understood.keywords.join(", ")}
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((question, qIndex) => (
          <QuestionCard
            disabled={disabled || isSubmitting}
            index={qIndex}
            key={question.field}
            onSelect={(value) => handleSelect(question.field, value)}
            question={question}
            selectedValue={selectedAnswers[question.field]}
          />
        ))}
      </div>

      {/* Submit button */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.3, delay: 0.2 + questions.length * 0.05 }}
      >
        <button
          className={cn(
            "w-full rounded-xl px-4 py-3 font-medium text-sm transition-all",
            allRequiredAnswered && !disabled && !isSubmitting
              ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99]"
              : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
          disabled={!allRequiredAnswered || disabled || isSubmitting}
          onClick={handleSubmit}
          type="button"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              검색 중...
            </span>
          ) : (
            "검색하기"
          )}
        </button>
      </motion.div>
    </div>
  )
}

// Individual question card component
type QuestionCardProps = {
  question: ClarificationQuestion
  selectedValue?: string
  onSelect: (value: string) => void
  disabled?: boolean
  index: number
}

function QuestionCard({ question, selectedValue, onSelect, disabled, index }: QuestionCardProps) {
  const label = FIELD_LABELS[question.field] || question.label

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2, delay: 0.1 + index * 0.05 }}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground text-sm">{label}</span>
        {question.required && <span className="text-red-500 text-xs">*</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {question.options.map((option, oIndex) => {
            const isSelected = selectedValue === option

            return (
              <motion.button
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "group rounded-lg border px-3 py-2 text-sm transition-all",
                  !disabled && "hover:border-primary/50 hover:bg-muted/30 active:scale-[0.98]",
                  isSelected
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-border bg-card text-foreground",
                  disabled && !isSelected && "cursor-not-allowed opacity-50",
                )}
                disabled={disabled}
                exit={{ opacity: 0, scale: 0.9 }}
                initial={{ opacity: 0, scale: 0.9 }}
                key={option}
                onClick={() => onSelect(option)}
                transition={{ duration: 0.15, delay: oIndex * 0.02 }}
                type="button"
              >
                <span className="flex items-center gap-1.5">
                  {isSelected ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-colors group-hover:text-primary" />
                  )}
                  {option}
                </span>
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
