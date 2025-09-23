import type { Translation } from '@/lib/api/types/translation'

export type TranslationData = Translation & {
  is_evaluating?: boolean
}

export type EditingCell = {
  row: number
  col: string
}

export type ViewMode = 'list' | 'matrix'