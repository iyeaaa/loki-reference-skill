'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox'
import { Switch } from '@/components/ui/switch'
import { 
  Search, 
  Edit, 
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  X,
  Grid3x3,
  List,
  RefreshCw,
  Plus
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatRelativeTime } from '@/lib/date-utils'
import { translationsApi } from '@/lib/api/translations'
import { usersApi } from '@/lib/api/users'
import type { Translation } from '@/lib/api/types/translation'
import type { Language } from '@/lib/api/types/user'

// Components
import { TranslationFilters } from './components/TranslationFilters'
import { CsvActions } from './components/CsvActions'
import { MatrixView } from './components/MatrixView'

// Utils
import { getQualityGrade, truncateText, generateCsvContent } from './utils'

export default function TranslationsPage() {
  // State
  const [translations, setTranslations] = useState<Translation[]>([])
  const [languages, setLanguages] = useState<Language[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [selectedEngines, setSelectedEngines] = useState<string[]>([])
  const [selectedScoreRanges, setSelectedScoreRanges] = useState<string[]>([])
  const [selectedReviewStatus, setSelectedReviewStatus] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedTranslations, setSelectedTranslations] = useState<string[]>([])
  const [limit, setLimit] = useState(50)
  const [viewMode, setViewMode] = useState<'matrix' | 'list'>('matrix')
  const [matrixData, setMatrixData] = useState<{
    groups: Array<{
      source_text: string
      translations: Record<string, Translation>
    }>
    languages: string[]
  }>({ groups: [], languages: [] })
  
  // Edit modal state
  const [editingTranslation, setEditingTranslation] = useState<Translation | null>(null)
  const [editForm, setEditForm] = useState({
    translated_text: '',
    translation_engine: '',
    review_status: ''
  })
  
  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    source_text: '',
    target_languages: [] as string[],
    translated_text: '',
    translation_engine: 'manual' as string,
    use_auto_translate: false
  })
  
  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 500)
    
    return () => clearTimeout(timer)
  }, [search])

  // Load translations
  const loadTranslations = useCallback(async () => {
    try {
      setLoading(true)
      
      if (viewMode === 'matrix') {
        // Use matrix-specific API for matrix view
        const params = {
          page: currentPage,
          limit: 10, // Matrix view uses 10 items per page
          search: debouncedSearch || undefined,
          target_language: selectedLanguages.length > 0 ? selectedLanguages.join(',') : undefined,
          engine: selectedEngines.length > 0 ? selectedEngines.join(',') : undefined,
          review_status: selectedReviewStatus.length > 0 ? selectedReviewStatus.join(',') : undefined,
        }
        
        const response = await translationsApi.getTranslationsMatrix(params)
        
        setMatrixData({
          groups: response.groups || [],
          languages: response.languages || []
        })
        setTotalPages(response.total_pages || 1)
        setTotal(response.total_sources || 0)
        
        // Also convert to flat translations array for compatibility
        const flatTranslations: Translation[] = []
        response.groups?.forEach(group => {
          Object.values(group.translations).forEach(t => {
            flatTranslations.push(t)
          })
        })
        setTranslations(flatTranslations)
      } else {
        // Use standard API for list view
        const params = {
          page: currentPage,
          limit: limit,
          search: debouncedSearch || undefined,
          target_language: selectedLanguages.length > 0 ? selectedLanguages.join(',') : undefined,
          engine: selectedEngines.length > 0 ? selectedEngines.join(',') : undefined,
          review_status: selectedReviewStatus.length > 0 ? selectedReviewStatus.join(',') : undefined,
        }
        
        const response = await translationsApi.getTranslations(params)
        
        setTranslations(response.translations || [])
        setTotalPages(response.total_pages || 1)
        setTotal(response.total || 0)
      }
    } catch (error) {
      console.error('Failed to load translations:', error)
      toast.error('번역 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [currentPage, limit, viewMode, debouncedSearch, selectedLanguages, selectedEngines, selectedReviewStatus])

  // Load languages
  const loadLanguages = async () => {
    try {
      const response = await usersApi.getLanguages()
      setLanguages(response.languages || [])
    } catch (error) {
      console.error('Failed to load languages:', error)
    }
  }

  // Initial load
  useEffect(() => {
    Promise.all([loadTranslations(), loadLanguages()])
  }, [loadTranslations])

  // Reload when filters change
  useEffect(() => {
    if (!loading) {
      setCurrentPage(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, selectedLanguages, selectedEngines, selectedScoreRanges, selectedReviewStatus])
  
  // Reload when page changes
  useEffect(() => {
    loadTranslations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage])
  
  // Reset and reload when view mode changes
  useEffect(() => {
    setCurrentPage(1)
    loadTranslations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode])

  // Handlers
  const handleSelectAll = () => {
    if (selectedTranslations.length === translations.length) {
      setSelectedTranslations([])
    } else {
      setSelectedTranslations(translations.map(t => t.id))
    }
  }

  const handleSelectTranslation = (id: string) => {
    setSelectedTranslations(prev =>
      prev.includes(id)
        ? prev.filter(tid => tid !== id)
        : [...prev, id]
    )
  }

  const handleBulkDelete = async () => {
    if (selectedTranslations.length === 0) return
    
    if (!confirm(`선택한 ${selectedTranslations.length}개의 번역을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`)) return
    
    try {
      await Promise.all(
        selectedTranslations.map(id => translationsApi.deleteTranslation(id))
      )
      toast.success(`${selectedTranslations.length}개의 번역이 삭제되었습니다.`)
      setSelectedTranslations([])
      await loadTranslations()
    } catch (error) {
      console.error('Failed to delete translations:', error)
      toast.error('번역 삭제에 실패했습니다.')
    }
  }

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedTranslations.length === 0) return
    
    const statusLabels: Record<string, string> = {
      pending: '대기중',
      external_review: '외부 검수',
      internal_review: '내부 검수',
      approved: '승인됨',
      rejected: '거부됨',
      revision_required: '수정 필요',
    }
    
    const statusLabel = statusLabels[status] || status
    
    if (!confirm(`선택한 ${selectedTranslations.length}개의 번역을 "${statusLabel}" 상태로 변경하시겠습니까?`)) return
    
    try {
      await Promise.all(
        selectedTranslations.map(id => 
          translationsApi.updateReviewStatus(id, status)
        )
      )
      toast.success(`${selectedTranslations.length}개의 번역이 "${statusLabel}" 상태로 변경되었습니다.`)
      setSelectedTranslations([])
      await loadTranslations()
    } catch (error) {
      console.error('Failed to update translations status:', error)
      toast.error('번역 상태 변경에 실패했습니다.')
    }
  }

  const handleCsvDownload = useCallback(() => {
    const getUniqueSourceTexts = () => {
      if (viewMode === 'matrix') {
        return matrixData.groups.map(g => g.source_text)
      } else {
        const sourceTexts = new Set<string>()
        translations.forEach(t => sourceTexts.add(t.source_text))
        return Array.from(sourceTexts)
      }
    }
    
    const getTranslationsForSource = (sourceText: string) => {
      if (viewMode === 'matrix') {
        const group = matrixData.groups.find(g => g.source_text === sourceText)
        return group ? Object.values(group.translations) : []
      } else {
        return translations.filter(t => t.source_text === sourceText)
      }
    }
    
    const csv = generateCsvContent(getUniqueSourceTexts, getTranslationsForSource)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', 'translations_data.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [translations, matrixData, viewMode])

  const handleCsvUpload = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      // CSV parsing and upload logic
      toast.success('CSV 파일이 업로드되었습니다.')
    }
    reader.readAsText(file)
  }, [])

  const handleClearRedisCache = async () => {
    if (!confirm('Redis 캐시의 모든 키를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.')) return
    
    try {
      const result = await translationsApi.clearRedisCache()
      toast.success(result.message || 'Redis 캐시가 초기화되었습니다.')
    } catch (error) {
      console.error('Failed to clear Redis cache:', error)
      toast.error('Redis 캐시 초기화에 실패했습니다.')
    }
  }

  const resetFilters = () => {
    setSelectedLanguages([])
    setSelectedEngines([])
    setSelectedScoreRanges([])
    setSelectedReviewStatus([])
    setSearch('')
    setDebouncedSearch('')
  }

  // Open edit modal
  const openEditModal = (translation: Translation) => {
    setEditingTranslation(translation)
    setEditForm({
      translated_text: translation.translated_text,
      translation_engine: 'manual', // 수정 시 기본값을 manual로 설정
      review_status: translation.review_status || 'pending'
    })
  }

  // Handle edit form change
  const handleEditFormChange = (field: string, value: string) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editingTranslation) return

    try {
      await translationsApi.updateTranslation(editingTranslation.id, {
        translated_text: editForm.translated_text,
        translation_engine: editForm.translation_engine || undefined,
      })
      
      // Update review status if changed
      if (editForm.review_status !== editingTranslation.review_status) {
        await translationsApi.updateReviewStatus(editingTranslation.id, editForm.review_status)
      }
      
      toast.success('번역이 수정되었습니다.')
      setEditingTranslation(null)
      await loadTranslations()
    } catch (error) {
      console.error('Failed to update translation:', error)
      toast.error('번역 수정에 실패했습니다.')
    }
  }

  // Handle create translation
  const handleCreateTranslation = async () => {
    if (!createForm.source_text.trim()) {
      toast.error('원문을 입력해주세요.')
      return
    }
    
    if (createForm.target_languages.length === 0) {
      toast.error('대상 언어를 선택해주세요.')
      return
    }
    
    if (!createForm.use_auto_translate && !createForm.translated_text.trim()) {
      toast.error('번역문을 입력하거나 자동 번역을 선택해주세요.')
      return
    }

    try {
      // Create translations for each selected language
      const promises = createForm.target_languages.map(async (lang) => {
        const translationData = {
          source_text: createForm.source_text,
          target_language: lang,
          translated_text: createForm.use_auto_translate 
            ? `⏳ 자동 번역 대기중` 
            : createForm.translated_text,
          translation_engine: createForm.translation_engine,
        }
        
        return translationsApi.createTranslation(translationData)
      })
      
      await Promise.all(promises)
      
      // If auto-translate is enabled, call translate API
      if (createForm.use_auto_translate) {
        const translatePromises = createForm.target_languages.map(async (lang) => {
          try {
            await translationsApi.translate({
              text: createForm.source_text,
              targetLang: lang,
            })
          } catch (error) {
            console.error(`Failed to auto-translate for ${lang}:`, error)
          }
        })
        
        await Promise.all(translatePromises)
      }
      
      toast.success(`${createForm.target_languages.length}개 언어에 대한 번역이 추가되었습니다.`)
      setIsCreateModalOpen(false)
      setCreateForm({
        source_text: '',
        target_languages: [],
        translated_text: '',
        translation_engine: 'manual',
        use_auto_translate: false
      })
      await loadTranslations()
    } catch (error) {
      console.error('Failed to create translation:', error)
      toast.error('번역 추가에 실패했습니다.')
    }
  }

  // Available options
  const availableLanguages = languages.length > 0 
    ? languages.filter(l => l.is_active).map(l => l.code)
    : viewMode === 'matrix' && matrixData.languages.length > 0
      ? matrixData.languages
      : Array.from(new Set(translations.map(t => t.target_language))).sort()
  const availableEngines = ['google', 'manual', 'qwen3']


  // Review status badge
  const getReviewStatusBadge = (status?: string) => {
    const statusConfig = {
      pending: { label: '대기중' },
      approved: { label: '승인됨' },
      rejected: { label: '거부됨' },
      external_review: { label: '외부 검수' },
      internal_review: { label: '내부 검수' },
      revision_required: { label: '수정 필요' },
    }
    
    const config = status ? statusConfig[status as keyof typeof statusConfig] : null
    if (!config) return null
    
    return <Badge variant="outline" className="text-xs">{config.label}</Badge>
  }

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Filters */}
      <TranslationFilters
        selectedLanguages={selectedLanguages}
        selectedEngines={selectedEngines}
        selectedScoreRanges={selectedScoreRanges}
        selectedReviewStatus={selectedReviewStatus}
        availableLanguages={availableLanguages}
        availableEngines={availableEngines}
        onLanguageChange={setSelectedLanguages}
        onEngineChange={setSelectedEngines}
        onScoreRangeChange={setSelectedScoreRanges}
        onReviewStatusChange={setSelectedReviewStatus}
        onClearFilters={resetFilters}
      />

      {/* Main Content Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">번역 관리</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="원문 또는 번역 검색..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10 w-full"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setCurrentPage(1)
                  }}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* View Mode Toggle and Create Button */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <Button
                size="sm"
                variant={viewMode === 'matrix' ? 'default' : 'ghost'}
                onClick={() => setViewMode('matrix')}
                className="gap-2"
              >
                <Grid3x3 className="w-4 h-4" />
                매트릭스
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                onClick={() => setViewMode('list')}
                className="gap-2"
              >
                <List className="w-4 h-4" />
                리스트
              </Button>
            </div>
            
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="gap-2"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              새 번역 추가
            </Button>
          </div>

          {/* Bulk Actions and Count */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              {/* Selected count text */}
              <div className="text-sm text-muted-foreground">
                {selectedTranslations.length > 0 ? (
                  <span className="font-medium">{selectedTranslations.length}개 선택됨</span>
                ) : (
                  <span>총 {total}개의 번역</span>
                )}
              </div>

              {/* Bulk Actions */}
              {selectedTranslations.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusUpdate('pending')}
                  >
                    <Clock className="w-4 h-4 mr-1" />
                    대기중
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusUpdate('external_review')}
                  >
                    외부 검수
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusUpdate('internal_review')}
                  >
                    내부 검수
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusUpdate('approved')}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    승인
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusUpdate('rejected')}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    거부
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusUpdate('revision_required')}
                  >
                    수정 필요
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDelete}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    선택 삭제
                  </Button>
                </div>
              )}
            </div>
        
            <div className="flex gap-2">
              <CsvActions
                onDownload={handleCsvDownload}
                onUpload={handleCsvUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearRedisCache}
                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                title="Redis 캐시 초기화"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Redis 초기화
              </Button>
            </div>
          </div>

          {/* Content View */}
          {viewMode === 'matrix' ? (
            // Matrix View
            <MatrixView
              sourceTexts={matrixData.groups.map(g => g.source_text)}
              allLanguages={matrixData.languages.length > 0 ? matrixData.languages : availableLanguages}
              getTranslationsForSource={(sourceText) => {
                const group = matrixData.groups.find(g => g.source_text === sourceText)
                return group ? Object.values(group.translations) : []
              }}
              evaluatingProgress={{}}
              onUpdateTranslation={async (sourceText, language, value) => {
                const group = matrixData.groups.find(g => g.source_text === sourceText)
                const translation = group?.translations[language]
                
                if (translation) {
                  try {
                    // Update translation text and engine
                    await translationsApi.updateTranslation(translation.id, {
                      translated_text: value,
                      translation_engine: 'manual'
                    })
                    // Update review status to pending
                    await translationsApi.updateReviewStatus(translation.id, 'pending')
                    
                    // Show success message
                    toast.success('번역이 수정되었습니다.')
                    
                    // Reload translations to show updated data
                    await loadTranslations()
                  } catch (error) {
                    console.error('Failed to update translation:', error)
                    toast.error('번역 수정에 실패했습니다.')
                  }
                }
              }}
              onCreateTranslation={async (sourceText, language, value) => {
                try {
                  // Create new translation
                  await translationsApi.createTranslation({
                    source_text: sourceText,
                    target_language: language,
                    translated_text: value,
                    translation_engine: 'manual'
                  })
                  
                  // Show success message
                  toast.success('새 번역이 추가되었습니다.')
                  
                  // Reload translations to show new data
                  await loadTranslations()
                } catch (error) {
                  console.error('Failed to create translation:', error)
                  toast.error('번역 추가에 실패했습니다.')
                }
              }}
              onDeleteTranslation={async (translationId) => {
                try {
                  await translationsApi.deleteTranslation(translationId)
                  toast.success('번역이 삭제되었습니다.')
                  await loadTranslations()
                } catch (error) {
                  console.error('Failed to delete translation:', error)
                  toast.error('번역 삭제에 실패했습니다.')
                }
              }}
              onStatusChange={async (translationId, status) => {
                try {
                  if (status) {
                    await translationsApi.updateReviewStatus(translationId, status)
                  }
                  toast.success('상태가 변경되었습니다.')
                  await loadTranslations()
                } catch (error) {
                  console.error('Failed to update status:', error)
                  toast.error('상태 변경에 실패했습니다.')
                }
              }}
              getQualityGrade={getQualityGrade}
              startIndex={0}
              itemsPerPage={matrixData.groups.length}
            />
          ) : (
            // List View - Original Table View
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <div 
                className="overflow-x-auto overflow-y-visible" 
                style={{ 
                  scrollbarGutter: 'stable',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                <table className="w-full min-w-[1400px]">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="sticky left-0 z-10 p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">
                        <Checkbox
                          checked={selectedTranslations.length === translations.length && translations.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">원문</th>
                      <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">언어</th>
                      <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">번역</th>
                      <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">엔진</th>
                      {/* <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">품질</th> */}
                      <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">상태</th>
                      <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">생성일</th>
                      <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">수정일</th>
                      <th className="sticky right-0 z-10 p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">편집</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="text-center py-8">
                          <div className="text-muted-foreground">로딩 중...</div>
                        </td>
                      </tr>
                    ) : translations.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-8">
                          <div className="text-muted-foreground">번역이 없습니다</div>
                        </td>
                      </tr>
                    ) : (
                      translations.map((translation) => {
                        // const { color } = getQualityGrade(translation.quality_confidence_score) // Commented out - score evaluation
                        return (
                          <tr key={translation.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <td className="sticky left-0 z-10 p-2 whitespace-nowrap text-sm bg-white dark:bg-gray-800">
                              <Checkbox
                                checked={selectedTranslations.includes(translation.id)}
                                onCheckedChange={() => handleSelectTranslation(translation.id)}
                              />
                            </td>
                            <td className="p-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 truncate max-w-[15rem]" title={translation.source_text}>
                              {truncateText(translation.source_text, 50)}
                            </td>
                            <td className="p-2 whitespace-nowrap text-sm">
                              <Badge variant="outline" className="text-xs">
                                {translation.target_language.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="p-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 truncate max-w-[15rem]" title={translation.translated_text}>
                              {truncateText(translation.translated_text, 50)}
                            </td>
                            <td className="p-2 whitespace-nowrap text-sm">
                              <Badge variant="outline" className="text-xs">
                                {translation.translation_engine || 'unknown'}
                              </Badge>
                            </td>
                            {/* Score column - Commented out
                            <td className="p-2 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${color}`} />
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  {translation.quality_confidence_score || '-'}
                                </span>
                              </div>
                            </td>
                            */}
                            <td className="p-2 whitespace-nowrap text-sm">
                              {getReviewStatusBadge(translation.review_status)}
                            </td>
                            <td className="p-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                              {formatRelativeTime(translation.created_at)}
                            </td>
                            <td className="p-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                              {formatRelativeTime(translation.updated_at)}
                            </td>
                            <td className="sticky right-0 z-10 p-2 whitespace-nowrap text-sm bg-white dark:bg-gray-800">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditModal(translation)}
                                className="text-xs h-8 px-3"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination - Always visible */}
          <div className="mt-6 space-y-4">
            {/* Pagination Info */}
            <div className="flex items-center justify-center">
              <div className="text-sm text-muted-foreground">
                {total > 0 ? (
                  <>
                    {viewMode === 'matrix' ? (
                      <>
                        {((currentPage - 1) * 10) + 1}-
                        {Math.min(currentPage * 10, total)} / {total.toLocaleString()}개 원문 표시
                      </>
                    ) : (
                      <>
                        {((currentPage - 1) * limit) + 1}-
                        {Math.min(currentPage * limit, total)} / {total.toLocaleString()}개 표시
                      </>
                    )}
                  </>
                ) : (
                  '0개 표시'
                )}
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-center gap-1">
              {/* First Page */}
              <Button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1 || loading}
                variant="outline"
                size="sm"
                className="px-3"
              >
                처음
              </Button>

              {/* Previous Page */}
              <Button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || loading}
                variant="outline"
                size="sm"
                className="px-3"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
                  const pageNum = startPage + i
                  
                  if (pageNum > totalPages) return null
                  
                  return (
                    <Button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      disabled={loading}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size="sm"
                      className="w-10"
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>

              {/* Next Page */}
              <Button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || loading}
                variant="outline"
                size="sm"
                className="px-3"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              {/* Last Page */}
              <Button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || loading}
                variant="outline"
                size="sm"
                className="px-3"
              >
                마지막
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Edit Translation Dialog */}
      <Dialog open={!!editingTranslation} onOpenChange={() => setEditingTranslation(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>번역 수정</DialogTitle>
          </DialogHeader>
          {editingTranslation && (
            <div className="space-y-4">
              {/* Source Text (Read-only) */}
              <div className="space-y-2">
                <Label>원문</Label>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm">
                  {editingTranslation.source_text}
                </div>
              </div>

              {/* Target Language (Read-only) */}
              <div className="space-y-2">
                <Label>타겟 언어</Label>
                <Badge variant="outline" className="text-xs">
                  {editingTranslation.target_language.toUpperCase()}
                </Badge>
              </div>

              {/* Translated Text */}
              <div className="space-y-2">
                <Label htmlFor="translated_text">번역문</Label>
                <Textarea
                  id="translated_text"
                  value={editForm.translated_text}
                  onChange={(e) => handleEditFormChange('translated_text', e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Translation Engine */}
              <div className="space-y-2">
                <Label htmlFor="translation_engine">번역 엔진</Label>
                <select
                  id="translation_engine"
                  value={editForm.translation_engine}
                  onChange={(e) => handleEditFormChange('translation_engine', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="manual">Manual (수동 수정)</option>
                  <option value="google">Google</option>
                  <option value="qwen3">Qwen3</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  * 기본값은 &apos;Manual&apos;이며, 필요 시 다른 엔진으로 변경 가능합니다.
                </p>
              </div>

              {/* Review Status */}
              <div className="space-y-2">
                <Label htmlFor="review_status">검수 상태</Label>
                <select
                  id="review_status"
                  value={editForm.review_status}
                  onChange={(e) => handleEditFormChange('review_status', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="pending">대기중</option>
                  <option value="external_review">외부 검수</option>
                  <option value="internal_review">내부 검수</option>
                  <option value="approved">승인됨</option>
                  <option value="rejected">거부됨</option>
                  <option value="revision_required">수정 필요</option>
                </select>
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
                <div>
                  <span className="font-medium">생성일:</span> {formatRelativeTime(editingTranslation.created_at)}
                </div>
                <div>
                  <span className="font-medium">수정일:</span> {formatRelativeTime(editingTranslation.updated_at)}
                </div>
                {/* Score display - Commented out
                {editingTranslation.quality_confidence_score && (
                  <div>
                    <span className="font-medium">품질 점수:</span> {editingTranslation.quality_confidence_score}
                  </div>
                )}
                */}
                <div>
                  <span className="font-medium">기존 엔진:</span> {editingTranslation.translation_engine || 'unknown'}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setEditingTranslation(null)}
                >
                  취소
                </Button>
                <Button
                  onClick={handleSaveEdit}
                >
                  저장
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Translation Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>새 번역 추가</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Source Text */}
            <div className="space-y-2">
              <Label htmlFor="create-source">원문 (한국어)</Label>
              <Textarea
                id="create-source"
                value={createForm.source_text}
                onChange={(e) => setCreateForm(prev => ({ ...prev, source_text: e.target.value }))}
                placeholder="번역할 원문을 입력하세요..."
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Target Languages */}
            <div className="space-y-2">
              <Label htmlFor="create-languages">대상 언어 (다중 선택 가능)</Label>
              <MultiSelectCombobox
                options={availableLanguages.filter(lang => lang !== 'ko').map(lang => ({
                  value: lang,
                  label: lang.toUpperCase()
                }))}
                value={createForm.target_languages}
                onValueChange={(values) => setCreateForm(prev => ({ ...prev, target_languages: values }))}
                placeholder="언어를 선택하세요..."
                searchPlaceholder="언어 코드로 검색..."
                emptyText="검색 결과가 없습니다."
              />
            </div>

            {/* Auto Translate Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-translate"
                checked={createForm.use_auto_translate}
                onCheckedChange={(checked) => setCreateForm(prev => ({ ...prev, use_auto_translate: checked }))}
              />
              <Label htmlFor="auto-translate">자동 번역 사용 (Google/Qwen)</Label>
            </div>

            {/* Manual Translation (if auto translate is off) */}
            {!createForm.use_auto_translate && (
              <div className="space-y-2">
                <Label htmlFor="create-translation">번역문</Label>
                <Textarea
                  id="create-translation"
                  value={createForm.translated_text}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, translated_text: e.target.value }))}
                  placeholder="번역문을 입력하세요..."
                  rows={3}
                  className="resize-none"
                />
                <p className="text-sm text-muted-foreground">
                  모든 선택한 언어에 동일한 번역문이 적용됩니다. 언어별로 다른 번역이 필요한 경우 개별적으로 추가해주세요.
                </p>
              </div>
            )}

            {/* Translation Engine */}
            <div className="space-y-2">
              <Label htmlFor="create-engine">번역 엔진</Label>
              <Select
                value={createForm.translation_engine}
                onValueChange={(value) => setCreateForm(prev => ({ ...prev, translation_engine: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="엔진 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="qwen">Qwen</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selected Languages Summary */}
            {createForm.target_languages.length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                  선택된 언어 ({createForm.target_languages.length}개)
                </p>
                <div className="flex flex-wrap gap-2">
                  {createForm.target_languages.map(lang => (
                    <Badge key={lang} variant="secondary">
                      {lang.toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false)
                  setCreateForm({
                    source_text: '',
                    target_languages: [],
                    translated_text: '',
                    translation_engine: 'manual',
                    use_auto_translate: false
                  })
                }}
              >
                취소
              </Button>
              <Button
                onClick={handleCreateTranslation}
                disabled={!createForm.source_text || createForm.target_languages.length === 0}
              >
                추가
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}