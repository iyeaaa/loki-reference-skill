export function getQualityGrade(score?: number | null) {
  if (!score || score === null) return { grade: 'N/A', color: 'bg-orange-500', label: '점수 없음' }
  if (score >= 90) return { grade: 'A', color: 'bg-green-500', label: '검수 없이 즉시 사용 가능' }
  if (score >= 70) return { grade: 'B', color: 'bg-blue-500', label: '간단한 검수 후 사용' }
  if (score >= 50) return { grade: 'C', color: 'bg-yellow-500', label: '전문가 검수 필수' }
  return { grade: 'D', color: 'bg-red-500', label: '재번역 요청' }
}

export function truncateText(text: string, maxLength: number = 50) {
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

export function getEngineVariant() {
  return 'outline' as const
}

import type { Translation } from '@/lib/api/types/translation'

export function generateCsvContent(
  getUniqueSourceTexts: () => string[],
  getTranslationsForSource: (sourceText: string) => Translation[]
): string {
  const sourceTexts = getUniqueSourceTexts()
  const allLanguages = new Set<string>()
  
  sourceTexts.forEach(sourceText => {
    const translations = getTranslationsForSource(sourceText)
    translations.forEach(t => allLanguages.add(t.target_language))
  })
  
  const languagesArray = Array.from(allLanguages).sort()
  
  // CSV 헤더
  let csv = 'Source Text,' + languagesArray.map(lang => `${lang.toUpperCase()}`).join(',') + '\n'
  
  // CSV 데이터
  sourceTexts.forEach(sourceText => {
    const translations = getTranslationsForSource(sourceText)
    const row = [
      '"' + sourceText.replace(/"/g, '""') + '"',
      ...languagesArray.map(lang => {
        const translation = translations.find(t => t.target_language === lang)
        return translation ? '"' + translation.translated_text.replace(/"/g, '""') + '"' : '""'
      })
    ]
    csv += row.join(',') + '\n'
  })
  
  return csv
}