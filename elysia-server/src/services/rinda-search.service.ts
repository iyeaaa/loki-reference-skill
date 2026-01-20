import pRetry from "p-retry"
import { config } from "../config"
import { createRindaSearchClient, type RindaSearchClient } from "../lib/rinda-search"
import logger from "../utils/logger"

/**
 * Extract error message from Rinda Search API errors
 */
function extractRindaSearchError(error: unknown): string {
  if (error && typeof error === "object") {
    const err = error as { message?: string; error?: string }
    return err.message || err.error || "Unknown Rinda Search error"
  }
  return String(error)
}

// Search filter types
export type CompanySearchFilters = {
  q?: string
  limit?: string
  industry?: string
  country?: string
  location?: string
  size?: string
  companyType?: string
  domain?: string
  website?: string
  linkedinUrl?: string
  facebookUrl?: string
  twitterUrl?: string
  foundedYear?: string
  locationContinent?: string
  locationPostalCode?: string
}

export type PersonSearchFilters = {
  q?: string
  limit?: string
  industry?: string
  country?: string
  location?: string
  jobTitle?: string
  company?: string
  domain?: string
  email?: string
  skills?: string
  minExperience?: string
  maxExperience?: string
  subRole?: string
  companySize?: string
  companyType?: string
}

class RindaSearchService {
  private client: RindaSearchClient

  constructor() {
    this.client = createRindaSearchClient({
      baseUrl: config.rindaSearch.baseUrl,
      apiKey: config.rindaSearch.apiKey,
    })
  }

  /**
   * Wrap API call with retry logic
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    return pRetry(fn, {
      retries: 3,
      minTimeout: 1000,
      maxTimeout: 5000,
      onFailedAttempt: (error) => {
        logger.warn(
          `Rinda Search API attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
        )
      },
    })
  }

  /**
   * Search for companies with fuzzy matching
   */
  async searchCompanies(filters: CompanySearchFilters) {
    return this.withRetry(async () => {
      const { data, error } = await this.client.GET("/search/companies/", {
        params: { query: filters },
      })

      if (error) {
        throw new Error(extractRindaSearchError(error))
      }

      return data
    })
  }

  /**
   * Search for people with fuzzy matching
   */
  async searchPeople(filters: PersonSearchFilters) {
    return this.withRetry(async () => {
      const { data, error } = await this.client.GET("/search/people/", {
        params: { query: filters },
      })

      if (error) {
        throw new Error(extractRindaSearchError(error))
      }

      return data
    })
  }

  /**
   * Start async company populate job
   */
  async populateCompanies(filters: CompanySearchFilters) {
    return this.withRetry(async () => {
      const { data, error } = await this.client.POST("/populate-db/companies", {
        body: filters as Record<string, unknown>,
      })

      if (error) {
        throw new Error(extractRindaSearchError(error))
      }

      return data
    })
  }

  /**
   * Start async people populate job
   */
  async populatePeople(filters: PersonSearchFilters) {
    return this.withRetry(async () => {
      const { data, error } = await this.client.POST("/populate-db/people", {
        body: filters as Record<string, unknown>,
      })

      if (error) {
        throw new Error(extractRindaSearchError(error))
      }

      return data
    })
  }

  /**
   * Get populate job status
   */
  async getJobStatus(jobId: string) {
    return this.withRetry(async () => {
      const { data, error } = await this.client.GET("/populate-db/{jobId}/status", {
        params: { path: { jobId } },
      })

      if (error) {
        throw new Error(extractRindaSearchError(error))
      }

      return data
    })
  }

  /**
   * List populate jobs
   */
  async listJobs(options?: {
    limit?: string
    offset?: string
    status?: "pending" | "running" | "completed" | "failed"
  }) {
    return this.withRetry(async () => {
      const { data, error } = await this.client.GET("/populate-db/list", {
        params: { query: options },
      })

      if (error) {
        throw new Error(extractRindaSearchError(error))
      }

      return data
    })
  }

  /**
   * Check API health
   */
  async healthCheck() {
    const { data, error } = await this.client.GET("/health")

    if (error) {
      throw new Error(extractRindaSearchError(error))
    }

    return data
  }
}

export const rindaSearchService = new RindaSearchService()
