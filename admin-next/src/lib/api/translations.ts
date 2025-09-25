import { BaseApiClient } from "./base"
import type {
  Translation,
  TranslationStats,
  CreateTranslationRequest,
  UpdateTranslationRequest,
  BulkUpdateTranslationsRequest,
  TranslationsApiResponse,
  TranslationsApiParams,
  TranslateRequest,
  TranslateResponse
} from "./types/translation"

export class TranslationsApi extends BaseApiClient {
  /**
   * Get translations list with filtering and pagination
   */
  async getTranslations(params?: TranslationsApiParams): Promise<TranslationsApiResponse> {
    const searchParams = new URLSearchParams()
    
    if (params?.page) searchParams.append("page", params.page.toString())
    if (params?.limit) searchParams.append("limit", params.limit.toString())
    if (params?.search) searchParams.append("search", params.search)
    if (params?.target_language) searchParams.append("target_language", params.target_language)
    if (params?.engine) searchParams.append("engine", params.engine)
    if (params?.translation_engine) searchParams.append("engine", params.translation_engine)
    if (params?.review_status) searchParams.append("review_status", params.review_status)
    if (params?.created_by) searchParams.append("created_by", params.created_by)
    if (params?.date_from) searchParams.append("date_from", params.date_from)
    if (params?.date_to) searchParams.append("date_to", params.date_to)

    const query = searchParams.toString()
    const url = `/api/v1/admin/translations${query ? `?${query}` : ""}`
    
    return this.request<TranslationsApiResponse>(url)
  }

  /**
   * Get a single translation by ID
   */
  async getTranslation(id: string): Promise<Translation> {
    return this.request<Translation>(`/api/v1/admin/translations/${id}`)
  }

  /**
   * Create a new translation
   */
  async createTranslation(data: CreateTranslationRequest): Promise<Translation> {
    return this.request<Translation>("/api/v1/admin/translations", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  /**
   * Update an existing translation
   */
  async updateTranslation(id: string, data: UpdateTranslationRequest): Promise<Translation> {
    return this.request<Translation>(`/api/v1/admin/translations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  /**
   * Delete a translation
   */
  async deleteTranslation(id: string): Promise<void> {
    await this.request(`/api/v1/admin/translations/${id}`, {
      method: "DELETE",
    })
  }

  /**
   * Bulk update translations
   */
  async bulkUpdateTranslations(data: BulkUpdateTranslationsRequest): Promise<{ message: string; updated: number }> {
    return this.request("/api/v1/admin/translations/bulk-update", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  /**
   * Get translation statistics
   */
  async getTranslationStats(): Promise<TranslationStats> {
    return this.request<TranslationStats>("/api/v1/admin/translations/stats")
  }

  /**
   * Translate text using the translation service
   */
  async translate(data: TranslateRequest): Promise<TranslateResponse> {
    return this.request<TranslateResponse>("/api/translate", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  /**
   * Export translations to Excel/CSV
   */
  async exportTranslations(params?: TranslationsApiParams): Promise<Blob> {
    const searchParams = new URLSearchParams()
    
    if (params?.search) searchParams.append("search", params.search)
    if (params?.target_language) searchParams.append("target_language", params.target_language)
    if (params?.translation_engine) searchParams.append("translation_engine", params.translation_engine)
    if (params?.review_status) searchParams.append("review_status", params.review_status)
    if (params?.created_by) searchParams.append("created_by", params.created_by)
    if (params?.date_from) searchParams.append("date_from", params.date_from)
    if (params?.date_to) searchParams.append("date_to", params.date_to)

    const query = searchParams.toString()
    const url = `/api/v1/admin/translations/export${query ? `?${query}` : ""}`
    
    const response = await fetch(`${this.baseURL}${url}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    })

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`)
    }

    return response.blob()
  }

  /**
   * Import translations from Excel/CSV
   */
  async importTranslations(file: File): Promise<{ message: string; imported: number; failed: number }> {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch(`${this.baseURL}/api/v1/admin/translations/import`, {
      method: "POST",
      body: formData,
      credentials: "include",
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Import failed")
    }

    return response.json()
  }

  /**
   * Update translation review status
   */
  async updateReviewStatus(id: string, status: string): Promise<Translation> {
    return this.request<Translation>(`/api/v1/admin/translations/${id}/review-status`, {
      method: "PUT",
      body: JSON.stringify({ review_status: status }),
    })
  }

  /**
   * Get translations by context (page, component, etc.)
   */
  async getTranslationsByContext(contextKey: string, contextValue: string): Promise<Translation[]> {
    return this.request<Translation[]>(`/api/v1/admin/translations/context/${contextKey}/${contextValue}`)
  }

  /**
   * Clear Redis cache
   */
  async clearRedisCache(): Promise<{ message: string }> {
    return this.request<{ message: string }>("/api/v1/admin/translations/redis-cache", {
      method: "DELETE",
    })
  }

  /**
   * Get translations in matrix view format with pagination
   */
  async getTranslationsMatrix(params?: TranslationsApiParams): Promise<{
    groups: Array<{
      source_text: string
      translations: Record<string, Translation>
    }>
    languages: string[]
    total_sources: number
    page: number
    limit: number
    total_pages: number
  }> {
    const searchParams = new URLSearchParams()
    
    if (params?.page) searchParams.append("page", params.page.toString())
    if (params?.limit) searchParams.append("limit", params.limit.toString())
    if (params?.search) searchParams.append("search", params.search)
    if (params?.target_language) searchParams.append("target_language", params.target_language)
    if (params?.engine) searchParams.append("engine", params.engine)
    if (params?.translation_engine) searchParams.append("engine", params.translation_engine)
    if (params?.review_status) searchParams.append("review_status", params.review_status)

    const query = searchParams.toString()
    const url = `/api/v1/admin/translations/matrix${query ? `?${query}` : ""}`
    
    return this.request(url)
  }
}

// Export a singleton instance
export const translationsApi = new TranslationsApi()