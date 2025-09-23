'use client'

import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EditableCell } from './EditableCell'
import type { Translation } from '@/lib/api/types/translation'

interface MatrixViewProps {
  sourceTexts: string[]
  allLanguages: string[]
  getTranslationsForSource: (sourceText: string) => (Translation & { is_evaluating?: boolean })[]
  evaluatingProgress: Record<string, number>
  onUpdateTranslation: (sourceText: string, language: string, value: string) => Promise<void>
  onCreateTranslation: (sourceText: string, language: string, value: string) => Promise<void>
  onDeleteTranslation?: (translationId: string) => Promise<void>
  onStatusChange?: (translationId: string, status: Translation['review_status']) => Promise<void>
  getQualityGrade: (score?: number | null) => { grade: string; color: string; label: string }
  startIndex: number
  itemsPerPage: number
}

export function MatrixView({
  sourceTexts,
  allLanguages,
  getTranslationsForSource,
  evaluatingProgress,
  onUpdateTranslation,
  onCreateTranslation,
  onDeleteTranslation,
  onStatusChange,
  getQualityGrade,
  startIndex,
  itemsPerPage,
}: MatrixViewProps) {
  const [editingCellId, setEditingCellId] = useState<string | null>(null)
  const displayedLanguages = allLanguages.slice(0, 20)
  const paginatedSourceTexts = sourceTexts.slice(startIndex, startIndex + itemsPerPage)

  return (
    <div className="relative border rounded-lg bg-white">
      <div 
        className="overflow-x-scroll overflow-y-visible" 
        style={{ 
          scrollbarGutter: 'stable',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin'
        }}
      >
        <Table className="min-w-full">
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="min-w-[350px] max-w-[350px] sticky left-0 bg-gray-50 z-20 border-r-2 border-gray-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                원문
              </TableHead>
              {displayedLanguages.map((lang) => (
                <TableHead key={lang} className="w-[250px] min-w-[250px] max-w-[250px] text-center border-r border-gray-200">
                  {lang.toUpperCase()}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSourceTexts.map((sourceText, index) => {
              const sourceTranslations = getTranslationsForSource(sourceText)
              // Create a unique row key using absolute index
              const absoluteIndex = startIndex + index
              const rowKey = `row-${absoluteIndex}-${sourceText.substring(0, 20)}`
              
              return (
                <TableRow key={rowKey} className="hover:bg-gray-50/50">
                  <TableCell className="min-w-[350px] max-w-[350px] sticky left-0 bg-white z-10 border-r-2 border-gray-300 font-medium shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    <div className="text-sm text-gray-900 pr-4 break-words whitespace-pre-wrap">
                      {sourceText}
                    </div>
                  </TableCell>
                  {displayedLanguages.map((lang) => {
                    const translation = sourceTranslations.find(t => t.target_language === lang)
                    const translationKey = `${sourceText}_${lang}`
                    // Use translation ID if available, otherwise create unique cell ID
                    const cellId = translation?.id || `cell-${absoluteIndex}-${lang}`
                    
                    return (
                      <TableCell key={`${rowKey}-${lang}`} className="w-[250px] min-w-[250px] max-w-[250px] p-0 border-r border-gray-200 bg-white">
                        <EditableCell
                          cellId={cellId}
                          language={lang}
                          translation={translation}
                          sourceText={sourceText}
                          evaluatingProgress={evaluatingProgress[translationKey]}
                          isEditing={editingCellId === cellId}
                          onEditStart={() => setEditingCellId(cellId)}
                          onEditEnd={() => setEditingCellId(null)}
                          onUpdate={async (language, value) => {
                            await onUpdateTranslation(sourceText, language, value)
                          }}
                          onCreate={async (sourceText, language, value) => {
                            await onCreateTranslation(sourceText, language, value)
                          }}
                          onDelete={onDeleteTranslation}
                          onStatusChange={onStatusChange}
                          getQualityGrade={getQualityGrade}
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}