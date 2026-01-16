/**
 * Snitcher IP to Company API Service
 *
 * @see https://docs.snitcher.com/ip2company
 */

import logger from "../utils/logger"

const SNITCHER_API_BASE = "https://api.snitcher.com"

export interface SnitcherCompanyResponse {
  success: boolean
  statusCode: number
  data?: {
    ip: string
    company?: {
      name: string
      domain: string
      industry?: string
      foundedYear?: number
      employeeRange?: string
      revenue?: string
      location?: {
        city?: string
        region?: string
        country?: string
        countryCode?: string
      }
      social?: {
        linkedin?: string
        crunchbase?: string
        twitter?: string
      }
    }
  }
  error?: string
  message?: string
}

export interface SnitcherUsageResponse {
  success: boolean
  statusCode: number
  data?: {
    credits: {
      used: number
      remaining: number
      total: number
    }
    billingCycle: {
      start: string
      end: string
    }
  }
  error?: string
}

/**
 * Find company by IP address using Snitcher IP to Company API
 *
 * @param ip - IP address to lookup
 * @param apiKey - Snitcher API key (Bearer token)
 * @returns Company data or error
 *
 * Rate limit: 600 requests/minute
 */
export async function findCompanyByIp(
  ip: string,
  apiKey: string,
): Promise<SnitcherCompanyResponse> {
  try {
    const response = await fetch(`${SNITCHER_API_BASE}/company/find?ip=${encodeURIComponent(ip)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    })

    const statusCode = response.status
    const responseText = await response.text()

    logger.info({ ip, statusCode, responseText }, "[Snitcher] Raw API response")

    // Try to parse JSON
    let responseData: unknown
    try {
      responseData = JSON.parse(responseText)
    } catch {
      // Not JSON, use raw text
      logger.warn({ ip, statusCode, responseText }, "[Snitcher] Non-JSON response")
      return {
        success: false,
        statusCode,
        error: responseText || `Unexpected response (status: ${statusCode})`,
      }
    }

    // Handle different response codes
    switch (statusCode) {
      case 200: {
        // Check if response has error field (some APIs return 200 with error)
        const data = responseData as Record<string, unknown>
        if (data.error || data.message) {
          logger.warn({ ip, data }, "[Snitcher] 200 response with error/message")
          return {
            success: false,
            statusCode,
            error: (data.error as string) || (data.message as string),
          }
        }
        const company = responseData as NonNullable<SnitcherCompanyResponse["data"]>["company"]
        logger.info({ ip, company: company?.name }, "[Snitcher] Company found")
        return {
          success: true,
          statusCode,
          data: {
            ip,
            company,
          },
        }
      }

      case 202:
        logger.info({ ip }, "[Snitcher] Queued for enrichment")
        return {
          success: false,
          statusCode,
          message: "Queued for enrichment. Please retry in a few seconds.",
        }

      case 403:
        logger.warn({ ip }, "[Snitcher] Quota exceeded")
        return {
          success: false,
          statusCode,
          error: "Quota exceeded. Please upgrade your plan or wait for billing cycle reset.",
        }

      case 404:
        logger.info({ ip }, "[Snitcher] ISP IP - no company data")
        return {
          success: false,
          statusCode,
          message: "IP identified as ISP. No company data available.",
        }

      case 429:
        logger.warn({ ip }, "[Snitcher] Rate limit exceeded")
        return {
          success: false,
          statusCode,
          error: "Rate limit exceeded. Please slow down requests.",
        }

      case 401: {
        let errorMessage = "Authentication failed. Invalid API key."
        const data = responseData as { message?: string }
        if (data?.message) {
          errorMessage = data.message
        }
        logger.error({ ip, statusCode, error: errorMessage }, "[Snitcher] Authentication error")
        return {
          success: false,
          statusCode,
          error: errorMessage,
        }
      }

      default: {
        const data = responseData as { message?: string; error?: string }
        const errorMessage =
          data?.message || data?.error || responseText || `Unknown error (status: ${statusCode})`
        logger.error({ ip, statusCode, error: errorMessage }, "[Snitcher] Unexpected error")
        return {
          success: false,
          statusCode,
          error: errorMessage,
        }
      }
    }
  } catch (error) {
    logger.error({ ip, error }, "[Snitcher] Request failed")
    return {
      success: false,
      statusCode: 500,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

/**
 * Get API usage statistics
 *
 * @param apiKey - Snitcher API key (Bearer token)
 * @returns Usage data including credits and billing cycle
 */
export async function getUsage(apiKey: string): Promise<SnitcherUsageResponse> {
  try {
    const response = await fetch(`${SNITCHER_API_BASE}/company/usage`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    })

    const statusCode = response.status

    if (statusCode === 200) {
      const data = (await response.json()) as SnitcherUsageResponse["data"]
      logger.info({ usage: data }, "[Snitcher] Usage retrieved")
      return {
        success: true,
        statusCode,
        data,
      }
    }

    const errorText = await response.text()
    return {
      success: false,
      statusCode,
      error: errorText,
    }
  } catch (error) {
    logger.error({ error }, "[Snitcher] Usage request failed")
    return {
      success: false,
      statusCode: 500,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}
