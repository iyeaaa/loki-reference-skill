'use client'

import { X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox'

interface TranslationFiltersProps {
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
  onClearFilters: () => void
}

export function TranslationFilters({
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
  onClearFilters
}: TranslationFiltersProps) {
  const engines = availableEngines.map(engine => ({
    value: engine,
    label: engine === 'google' ? 'Google' : 
           engine === 'manual' ? 'Manual' :
           engine === 'qwen3' ? 'Qwen3' : engine
  }))

  const scoreRanges = [
    { value: '90-100', label: '90-100 (우수)' },
    { value: '70-89', label: '70-89 (양호)' },
    { value: '50-69', label: '50-69 (보통)' },
    { value: '0-49', label: '0-49 (미흡)' },
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

  const toggleEngine = (engine: string) => {
    if (selectedEngines.includes(engine)) {
      onEngineChange(selectedEngines.filter(e => e !== engine))
    } else {
      onEngineChange([...selectedEngines, engine])
    }
  }

  const toggleScoreRange = (range: string) => {
    if (selectedScoreRanges.includes(range)) {
      onScoreRangeChange(selectedScoreRanges.filter(r => r !== range))
    } else {
      onScoreRangeChange([...selectedScoreRanges, range])
    }
  }

  const toggleReviewStatus = (status: string) => {
    if (selectedReviewStatus.includes(status)) {
      onReviewStatusChange(selectedReviewStatus.filter(s => s !== status))
    } else {
      onReviewStatusChange([...selectedReviewStatus, status])
    }
  }

  const hasActiveFilters = 
    selectedLanguages.length > 0 || 
    selectedEngines.length > 0 || 
    // selectedScoreRanges.length > 0 || // Commented out - score filter
    selectedReviewStatus.length > 0

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Engine Filter */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">엔진</span>
            <div className="flex flex-wrap gap-3">
              {engines.map(engine => (
                <label key={engine.value} className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    id={`engine-${engine.value}`}
                    checked={selectedEngines.includes(engine.value)}
                    onCheckedChange={() => toggleEngine(engine.value)}
                  />
                  <span className="text-sm select-none">{engine.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Review Status Filter */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">검수 상태</span>
            <div className="flex flex-wrap gap-3">
              {reviewStatuses.map(status => (
                <label key={status.value} className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    id={`status-${status.value}`}
                    checked={selectedReviewStatus.includes(status.value)}
                    onCheckedChange={() => toggleReviewStatus(status.value)}
                  />
                  <span className="text-sm select-none">{status.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Score Range Filter - Commented out
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">품질 점수</span>
            <div className="flex flex-wrap gap-3">
              {scoreRanges.map(range => (
                <label key={range.value} className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    id={`score-${range.value}`}
                    checked={selectedScoreRanges.includes(range.value)}
                    onCheckedChange={() => toggleScoreRange(range.value)}
                  />
                  <span className="text-sm select-none">{range.label}</span>
                </label>
              ))}
            </div>
          </div>
          */}

          {/* Language Filter */}
          <div className="flex items-start gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20 pt-2">언어</span>
            <div className="flex-1 max-w-md">
              <MultiSelectCombobox
                options={availableLanguages.map(lang => ({
                  value: lang,
                  label: lang.toUpperCase()
                }))}
                value={selectedLanguages}
                onValueChange={onLanguageChange}
                placeholder="언어를 선택하세요..."
                searchPlaceholder="언어 코드로 검색..."
                emptyText="검색 결과가 없습니다."
              />
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {selectedEngines.map(engine => {
                const engineLabel = engines.find(e => e.value === engine)?.label || engine
                return (
                  <span
                    key={engine}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full"
                  >
                    엔진: {engineLabel}
                    <button
                      type="button"
                      onClick={() => toggleEngine(engine)}
                      className="ml-1 hover:text-blue-600 dark:hover:text-blue-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
              {selectedReviewStatus.map(status => {
                const statusLabel = reviewStatuses.find(s => s.value === status)?.label || status
                return (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full"
                  >
                    상태: {statusLabel}
                    <button
                      type="button"
                      onClick={() => toggleReviewStatus(status)}
                      className="ml-1 hover:text-green-600 dark:hover:text-green-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
              {/* Score ranges display - Commented out
              {selectedScoreRanges.map(range => {
                const rangeLabel = scoreRanges.find(r => r.value === range)?.label || range
                return (
                  <span
                    key={range}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs rounded-full"
                  >
                    점수: {rangeLabel}
                    <button
                      type="button"
                      onClick={() => toggleScoreRange(range)}
                      className="ml-1 hover:text-yellow-600 dark:hover:text-yellow-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
              */}
              {selectedLanguages.map(lang => {
                return (
                  <span
                    key={lang}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded-full"
                  >
                    언어: {lang.toUpperCase()}
                    <button
                      type="button"
                      onClick={() => onLanguageChange(selectedLanguages.filter(l => l !== lang))}
                      className="ml-1 hover:text-purple-600 dark:hover:text-purple-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Clear Filters Button at Bottom */}
        {hasActiveFilters && (
          <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-xs"
            >
              <X className="w-3 h-3 mr-1" />
              필터 초기화
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}