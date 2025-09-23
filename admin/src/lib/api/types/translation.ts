// Translation API Types

export interface Translation {
  id: string
  source_text: string
  target_language: string
  translated_text: string
  translation_engine: string | null
  redis_key: string | null
  element_context: Record<string, unknown> | null
  quality_confidence_score?: number | null
  created_by: string | null
  created_at: string
  updated_at: string
  review_status?: 'pending' | 'external_review' | 'internal_review' | 'approved' | 'rejected' | 'revision_required'
}

export interface TranslationWithUser extends Translation {
  created_by_username?: string
  created_by_email?: string
}

export interface TranslationsApiParams {
  page?: number
  limit?: number
  search?: string
  target_language?: string
  engine?: string
  translation_engine?: string // deprecated, use engine
  review_status?: string
  created_by?: string
  date_from?: string
  date_to?: string
}

export interface TranslationsApiResponse {
  translations: Translation[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface CreateTranslationRequest {
  source_text: string
  target_language: string
  translated_text: string
  translation_engine?: string
  element_context?: Record<string, unknown>
}

export interface UpdateTranslationRequest {
  translated_text: string
  translation_engine?: string
  element_context?: Record<string, unknown>
}

export interface BulkUpdateTranslationsRequest {
  translation_ids: string[]
  review_status?: string
  quality_score?: number
}

export interface TranslationStats {
  total: number
  by_language: Record<string, number>
  by_engine: Record<string, number>
  by_status: Record<string, number>
  pending_review: number
  approved: number
  rejected: number
}

export interface TranslateRequest {
  text: string
  targetLang: string
  target_lang?: string  // For backward compatibility
  element_context?: Record<string, unknown>
}

export interface TranslateResponse {
  message: string
  code: number
  data: {
    original_text: string
    translated_text: string
    source_lang: string
    target_lang: string
    element_context?: Record<string, unknown>
  }
}