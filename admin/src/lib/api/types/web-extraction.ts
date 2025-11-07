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
