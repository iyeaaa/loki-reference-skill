'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Translation } from '@/lib/api/types/translation'

interface ListViewProps {
  translations: (Translation & { is_evaluating?: boolean })[]
  evaluatingProgress: Record<string, number>
  getQualityGrade: (score?: number | null) => { grade: string; color: string; label: string }
  getEngineVariant: () => "outline"
}

export function ListView({
  translations,
  evaluatingProgress,
  getQualityGrade,
  getEngineVariant,
}: ListViewProps) {
  return (
    <div className="space-y-4">
      {translations.map((translation) => {
        const { color, label } = getQualityGrade(translation.quality_confidence_score)
        const translationKey = `${translation.source_text}_${translation.target_language}`
        const progress = evaluatingProgress[translationKey]
        
        return (
          <Card key={translation.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">원문 (한국어)</p>
                  <p className="text-sm font-medium">{translation.source_text}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    번역 ({translation.target_language.toUpperCase()})
                  </p>
                  <p className="text-sm font-medium">{translation.translated_text}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={getEngineVariant()}>
                    {translation.translation_engine || 'unknown'}
                  </Badge>
                  <Badge variant="outline">
                    {translation.target_language.toUpperCase()}
                  </Badge>
                  {translation.review_status && (
                    <Badge 
                      variant={translation.review_status === 'approved' ? 'default' : 'secondary'}
                    >
                      {translation.review_status}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-4">
                  {translation.is_evaluating && progress !== undefined ? (
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-full", color)} />
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <span className="text-sm font-medium">
                          {translation.quality_confidence_score || 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground">
                    {new Date(translation.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}