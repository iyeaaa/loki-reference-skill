export interface ExtractionResult {
  website_url: string
  final_url?: string | null
  http_status?: number | null
  found_company_name?: string | null
  description?: string | null
  address?: string | null
  country?: string | null
  city?: string | null
  state?: string | null
  founded_year?: string | null
  phone_number?: string | null
  email?: string | null
  facebook_url?: string | null
  instagram_url?: string | null
  twitter_url?: string | null
  linkedin_url?: string | null
  employee_count?: string | null
  products?: string | null
  business_sectors?: string | null
  product_categories?: string | null
  industry_types?: string | null
  crawl_time_seconds?: number | null
  gpt_time_seconds?: number | null
  collected_at?: string | null
  error_message?: string | null
}

export interface ExtractionProgress {
  status: "processing" | "completed" | "error"
  total: number
  processed: number
  success: number
  errors: number
  emailFound: number
  phoneFound: number
  addressFound: number
  socialFound: number
  gptRequests: number
  percentage: number
  currentCompany?: string
  elapsedTime: number
  estimatedTimeRemaining: number
  itemsPerSecond: number
  message?: string
  errorDetails?: string
  type?: "init" | "progress" | "complete" | "error"
  jobId?: string
  latestResult?: ExtractionResult // 최신 처리된 결과
  estimatedCost?: number // 예상 GPT API 비용 (USD)
}

export interface WebExtractionUploadRequest {
  file: File
  workspaceId: string
}

export interface WebExtractionProgressCallback {
  onProgress: (progress: ExtractionProgress) => void
  onComplete: (jobId: string, progress: ExtractionProgress) => void
  onError: (error: Error) => void
}
