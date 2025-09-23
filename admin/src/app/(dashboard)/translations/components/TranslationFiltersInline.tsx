'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-react'

interface TranslationFiltersInlineProps {
  selectedLanguages: string[]
  selectedEngines: string[]
  selectedScoreRanges: string[]
  selectedReviewStatus: string[]
  availableLanguages: string[]
  availableEngines: string[]
  onLanguageChange: (languages: string[]) => void
  onEngineChange: (engines: string[]) => void
  onScoreRangeChange: (ranges: string[]) => void
  onReviewStatusChange: (statuses: string[]) => void
  onResetFilters: () => void
}

const scoreRanges = [
  { value: '90-100', label: '90-100' },
  { value: '70-89', label: '70-89' },
  { value: '50-69', label: '50-69' },
  { value: '0-49', label: '0-49' },
  { value: 'no-score', label: '점수 없음' },
]

const reviewStatuses = [
  { value: 'pending', label: '대기중' },
  { value: 'approved', label: '승인됨' },
  { value: 'rejected', label: '거부됨' },
  { value: 'external_review', label: '외부 검수' },
  { value: 'internal_review', label: '내부 검수' },
  { value: 'revision_required', label: '수정 필요' },
]

export function TranslationFiltersInline({
  selectedLanguages,
  selectedEngines,
  selectedScoreRanges,
  selectedReviewStatus,
  availableLanguages,
  availableEngines,
  onLanguageChange,
  onEngineChange,
  onScoreRangeChange,
  onReviewStatusChange,
  onResetFilters,
}: TranslationFiltersInlineProps) {
  const hasActiveFilters = 
    selectedLanguages.length > 0 || 
    selectedEngines.length > 0 || 
    selectedScoreRanges.length > 0 ||
    selectedReviewStatus.length > 0

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Language Filter */}
      <Select
        value={selectedLanguages.join(',')}
        onValueChange={(value) => {
          if (value === 'all') {
            onLanguageChange([])
          } else {
            const current = selectedLanguages.includes(value)
              ? selectedLanguages.filter(l => l !== value)
              : [...selectedLanguages, value]
            onLanguageChange(current)
          }
        }}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="언어">
            {selectedLanguages.length > 0 
              ? `언어 (${selectedLanguages.length})`
              : '모든 언어'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">모든 언어</SelectItem>
          {availableLanguages.map(lang => (
            <SelectItem key={lang} value={lang}>
              <div className="flex items-center">
                {selectedLanguages.includes(lang) && '✓ '}
                {lang.toUpperCase()}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Engine Filter */}
      <Select
        value={selectedEngines.join(',')}
        onValueChange={(value) => {
          if (value === 'all') {
            onEngineChange([])
          } else {
            const current = selectedEngines.includes(value)
              ? selectedEngines.filter(e => e !== value)
              : [...selectedEngines, value]
            onEngineChange(current)
          }
        }}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="엔진">
            {selectedEngines.length > 0 
              ? `엔진 (${selectedEngines.length})`
              : '모든 엔진'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">모든 엔진</SelectItem>
          {availableEngines.map(engine => (
            <SelectItem key={engine} value={engine}>
              <div className="flex items-center">
                {selectedEngines.includes(engine) && '✓ '}
                {engine}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Score Range Filter */}
      <Select
        value={selectedScoreRanges.join(',')}
        onValueChange={(value) => {
          if (value === 'all') {
            onScoreRangeChange([])
          } else {
            const current = selectedScoreRanges.includes(value)
              ? selectedScoreRanges.filter(r => r !== value)
              : [...selectedScoreRanges, value]
            onScoreRangeChange(current)
          }
        }}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="품질 점수">
            {selectedScoreRanges.length > 0 
              ? `점수 (${selectedScoreRanges.length})`
              : '모든 점수'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">모든 점수</SelectItem>
          {scoreRanges.map(range => (
            <SelectItem key={range.value} value={range.value}>
              <div className="flex items-center">
                {selectedScoreRanges.includes(range.value) && '✓ '}
                {range.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Review Status Filter */}
      <Select
        value={selectedReviewStatus.join(',')}
        onValueChange={(value) => {
          if (value === 'all') {
            onReviewStatusChange([])
          } else {
            const current = selectedReviewStatus.includes(value)
              ? selectedReviewStatus.filter(s => s !== value)
              : [...selectedReviewStatus, value]
            onReviewStatusChange(current)
          }
        }}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="검수 상태">
            {selectedReviewStatus.length > 0 
              ? `상태 (${selectedReviewStatus.length})`
              : '모든 상태'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">모든 상태</SelectItem>
          {reviewStatuses.map(status => (
            <SelectItem key={status.value} value={status.value}>
              <div className="flex items-center">
                {selectedReviewStatus.includes(status.value) && '✓ '}
                {status.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <>
          <div className="flex-1" />
          <div className="flex flex-wrap gap-1">
            {selectedLanguages.map(lang => (
              <Badge key={lang} variant="secondary" className="text-xs">
                {lang.toUpperCase()}
                <button
                  onClick={() => onLanguageChange(selectedLanguages.filter(l => l !== lang))}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {selectedEngines.map(engine => (
              <Badge key={engine} variant="secondary" className="text-xs">
                {engine}
                <button
                  onClick={() => onEngineChange(selectedEngines.filter(e => e !== engine))}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {selectedScoreRanges.map(range => (
              <Badge key={range} variant="secondary" className="text-xs">
                점수: {range}
                <button
                  onClick={() => onScoreRangeChange(selectedScoreRanges.filter(r => r !== range))}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {selectedReviewStatus.map(status => (
              <Badge key={status} variant="secondary" className="text-xs">
                {reviewStatuses.find(s => s.value === status)?.label}
                <button
                  onClick={() => onReviewStatusChange(selectedReviewStatus.filter(s => s !== status))}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="h-6 px-2 text-xs"
            >
              <X className="w-3 h-3 mr-1" />
              모두 지우기
            </Button>
          </div>
        </>
      )}
    </div>
  )
}