'use client'

import { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Sparkles, Loader2, Trash2, CheckCircle, XCircle, Edit3, Users, Building2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Translation } from '@/lib/api/types/translation'

interface EditableCellProps {
  cellId: string
  language: string
  translation?: Translation & { is_evaluating?: boolean }
  sourceText: string
  evaluatingProgress?: number
  isEditing: boolean
  onEditStart: () => void
  onEditEnd: () => void
  onUpdate: (language: string, value: string) => Promise<void>
  onCreate: (sourceText: string, language: string, value: string) => Promise<void>
  onDelete?: (translationId: string) => Promise<void>
  onStatusChange?: (translationId: string, status: Translation['review_status']) => Promise<void>
  getQualityGrade: (score?: number | null) => { grade: string; color: string; label: string }
}

export function EditableCell({
  cellId,
  language,
  translation,
  sourceText,
  evaluatingProgress,
  isEditing,
  onEditStart,
  onEditEnd,
  onUpdate,
  onCreate,
  onDelete,
  onStatusChange,
  getQualityGrade,
}: EditableCellProps) {
  const [value, setValue] = useState(translation?.translated_text || '')
  const [originalValue, setOriginalValue] = useState(translation?.translated_text || '')
  const [isSaving, setIsSaving] = useState(false)
  const [hasSaved, setHasSaved] = useState(false)
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previousIsEditing = useRef(isEditing)

  useEffect(() => {
    setValue(translation?.translated_text || '')
    setOriginalValue(translation?.translated_text || '')
  }, [translation?.translated_text])

  useEffect(() => {
    // When starting to edit
    if (!previousIsEditing.current && isEditing) {
      // Reset save flag when starting new edit
      setHasSaved(false)
      // Start editing
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.select()
      }
    }
    previousIsEditing.current = isEditing
  }, [isEditing])

  const handleSave = async () => {
    // Prevent duplicate saves
    if (hasSaved || isSaving) {
      return
    }
    
    if (value.trim() !== originalValue) {
      setIsSaving(true)
      setHasSaved(true)
      try {
        if (translation) {
          // Update existing translation
          await onUpdate(language, value.trim())
        } else if (value.trim() !== '') {
          // Create new translation if value is not empty
          await onCreate(sourceText, language, value.trim())
        }
        setOriginalValue(value.trim())
      } catch (error) {
        // If creation/update fails, revert to original value
        setValue(originalValue)
        // Don't re-throw the error since it's already handled by parent
        console.error('Failed to save translation:', error)
      } finally {
        setIsSaving(false)
      }
    }
    onEditEnd()
  }

  const handleCancel = () => {
    setValue(originalValue)
    onEditEnd()
  }

  const handleCellClick = (e: React.MouseEvent) => {
    // Only trigger edit on left click, not on right click
    if (e.button === 0 && !isEditing && !contextMenuOpen) {
      onEditStart()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault() // Prevent new line
      handleSave()
    }
  }

  const handleDelete = async () => {
    if (translation?.id && onDelete) {
      setIsSaving(true)
      try {
        await onDelete(translation.id)
      } catch (error) {
        console.error('Failed to delete translation:', error)
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleStatusChange = async (status: Translation['review_status']) => {
    if (translation?.id && onStatusChange) {
      setIsSaving(true)
      try {
        await onStatusChange(translation.id, status)
      } catch (error) {
        console.error('Failed to change status:', error)
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Close any other open context menus by dispatching a custom event
    const closeEvent = new CustomEvent('closeAllContextMenus', { detail: { exceptId: cellId } })
    document.dispatchEvent(closeEvent)
    
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
    setContextMenuOpen(true)
  }

  // Close context menu when clicking outside or when another menu opens
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenuOpen) {
        setContextMenuOpen(false)
      }
    }

    const handleCloseAllMenus = (e: CustomEvent) => {
      // Close this menu if it's not the one that just opened
      if (e.detail.exceptId !== cellId && contextMenuOpen) {
        setContextMenuOpen(false)
      }
    }

    if (contextMenuOpen) {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('closeAllContextMenus', handleCloseAllMenus as EventListener)
      return () => {
        document.removeEventListener('click', handleClickOutside)
        document.removeEventListener('closeAllContextMenus', handleCloseAllMenus as EventListener)
      }
    }
  }, [contextMenuOpen, cellId])

  // Helper function to get review status badge config
  const getReviewStatusBadge = (status?: string) => {
    const statusConfig = {
      pending: { label: '대기' },
      approved: { label: '승인' },
      rejected: { label: '반려' },
      external_review: { label: '외부' },
      internal_review: { label: '내부' },
      revision_required: { label: '수정' },
    }
    
    return status ? statusConfig[status as keyof typeof statusConfig] : null
  }

  if (isEditing) {
    return (
      <div className="p-2 relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Only save if not already saved (prevents duplicate calls)
            if (!hasSaved && !isSaving) {
              handleSave()
            }
          }}
          className="min-h-[60px] text-sm resize-none"
          placeholder={`${language.toUpperCase()} 번역을 입력하세요...`}
          disabled={isSaving}
        />
      </div>
    )
  }

  return (
    <>
      {contextMenuOpen && translation && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div 
          className="fixed z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          style={{ 
            left: `${contextMenuPosition.x}px`, 
            top: `${contextMenuPosition.y}px` 
          }}
        >
          {onStatusChange && (
            <>
              <div className="px-2 py-1.5 text-sm font-semibold">상태 변경</div>
              <button
                onClick={() => { handleStatusChange('pending'); setContextMenuOpen(false); }}
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full"
              >
                <AlertCircle className="mr-2 h-4 w-4" />
                검수 대기
              </button>
              <button
                onClick={() => { handleStatusChange('external_review'); setContextMenuOpen(false); }}
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full"
              >
                <Users className="mr-2 h-4 w-4" />
                1차 외부 검수
              </button>
              <button
                onClick={() => { handleStatusChange('internal_review'); setContextMenuOpen(false); }}
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full"
              >
                <Building2 className="mr-2 h-4 w-4" />
                2차 내부 검수
              </button>
              <button
                onClick={() => { handleStatusChange('approved'); setContextMenuOpen(false); }}
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground text-green-700 w-full"
              >
                <CheckCircle className="mr-2 h-4 w-4 text-green-700" />
                승인
              </button>
              <button
                onClick={() => { handleStatusChange('rejected'); setContextMenuOpen(false); }}
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full"
              >
                <XCircle className="mr-2 h-4 w-4" />
                반려
              </button>
              <button
                onClick={() => { handleStatusChange('revision_required'); setContextMenuOpen(false); }}
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full"
              >
                <AlertCircle className="mr-2 h-4 w-4" />
                수정 요청
              </button>
              <div className="h-px bg-border my-1" />
            </>
          )}
          <div className="px-2 py-1.5 text-sm font-semibold">번역 작업</div>
          <button
            onClick={() => { onEditStart(); setContextMenuOpen(false); }}
            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full"
          >
            <Edit3 className="mr-2 h-4 w-4" />
            편집
          </button>
          {onDelete && (
            <button
              onClick={() => { handleDelete(); setContextMenuOpen(false); }}
              className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground text-red-600 w-full"
            >
              <Trash2 className="mr-2 h-4 w-4 text-red-600" />
              삭제
            </button>
          )}
        </div>,
        document.body
      )}
      <div
        className={cn(
          "group p-2 min-h-[80px] w-[250px] cursor-pointer hover:bg-gray-50 relative overflow-hidden block",
          !translation?.translated_text && "bg-gray-50/50",
          isSaving && "pointer-events-none opacity-70"
        )}
        onClick={handleCellClick}
        onContextMenu={handleContextMenu}
      >
          {isSaving ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
              <span className="ml-2 text-sm text-gray-500">저장 중...</span>
            </div>
          ) : translation?.is_evaluating && evaluatingProgress !== undefined ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1 flex-wrap">
                <Sparkles className="w-3 h-3 text-purple-500 animate-pulse" />
                <span className="text-sm text-gray-500">{Math.round(evaluatingProgress)}%</span>
              </div>
              <div className="text-sm text-gray-600 mt-2">
                {translation.translated_text}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* First row: Score, Engine Badge, Status Badge */}
              <div className="flex items-center gap-1 flex-wrap">
                {translation?.translated_text && (
                  <>
                    {/* Score - Commented out
                    <div className="flex items-center gap-1">
                      <div className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        getQualityGrade(translation.quality_confidence_score).color
                      )} />
                      <span className="text-xs text-gray-600 font-medium">
                        {translation.quality_confidence_score && translation.quality_confidence_score > 0 
                          ? translation.quality_confidence_score 
                          : '-'}
                      </span>
                    </div>
                    */}
                    
                    {/* Engine Badge */}
                    <Badge variant="outline" className="text-xs h-5 px-1.5">
                      {translation.translation_engine || 'unknown'}
                    </Badge>
                    
                    {/* Status Badge */}
                    {translation.review_status && getReviewStatusBadge(translation.review_status) && (
                      <Badge 
                        variant="outline"
                        className="text-xs h-5 px-1.5"
                      >
                        {getReviewStatusBadge(translation.review_status)?.label}
                      </Badge>
                    )}
                  </>
                )}
              </div>
              
              {/* Second row: Translation text */}
              <div 
                className="text-sm text-gray-700 group-hover:text-gray-900 break-words whitespace-pre-wrap"
              >
                {translation?.translated_text || (
                  <span className="text-gray-400 italic">번역 없음</span>
                )}
              </div>
            </div>
          )}
        </div>
    </>
  )
}