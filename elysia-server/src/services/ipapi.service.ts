/**
 * ipapi.is IP Intelligence API Service
 *
 * @see https://ipapi.is/developers.html
 */

import logger from "../utils/logger"

const IPAPI_BASE_URL = "https://api.ipapi.is"

export interface IpapiResponse {
  success: boolean
  statusCode: number
  data?: IpapiData
  error?: string
}

export interface IpapiData {
  ip: string
  rir: string
  is_bogon: boolean
  is_mobile: boolean
  is_satellite: boolean
  is_crawler: boolean
  is_datacenter: boolean
  is_tor: boolean
  is_proxy: boolean
  is_vpn: boolean
  is_abuser: boolean
  elapsed_ms: number
  company?: {
    name: string
    abuser_score: string
    domain: string
    type: string
    network: string
    whois: string
  }
  datacenter?: {
    datacenter: string
    domain: string
    network: string
  }
  asn?: {
    asn: number
    abuser_score: string
    route: string
    descr: string
    country: string
    active: boolean
    org: string
    domain: string
    abuse: string
    type: string
    created: string
    updated: string
    rir: string
    whois: string
  }
  location?: {
    is_eu_member: boolean
    calling_code: string
    currency_code: string
    continent: string
    country: string
    country_code: string
    state: string
    city: string
    latitude: number
    longitude: number
    zip: string
    timezone: string
    local_time: string
    local_time_unix: number
    is_dst: boolean
  }
  abuse?: {
    name: string
    address: string
    email: string
    phone: string
  }
  vpn?: {
    service: string
    url: string
    type: string
    last_seen: number
    exit_node_region: string
    country_code: string
    city_name: string
    latitude: number
    longitude: number
  }
}

/**
 * Lookup IP address using ipapi.is API
 *
 * @param ip - IP address to lookup
 * @param apiKey - ipapi.is API key (optional for free tier)
 * @returns IP intelligence data
 */
export async function lookupIp(ip: string, apiKey?: string): Promise<IpapiResponse> {
  try {
    const url = new URL(IPAPI_BASE_URL)
    url.searchParams.set("q", ip)
    if (apiKey) {
      url.searchParams.set("key", apiKey)
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    })

    const statusCode = response.status

    if (statusCode === 200) {
      const data = (await response.json()) as IpapiData

      // Check if response contains error field
      if ("error" in data) {
        logger.warn({ ip, error: data }, "[ipapi.is] API returned error")
        return {
          success: false,
          statusCode: 400,
          error: (data as unknown as { error: string }).error,
        }
      }

      logger.info({ ip, company: data.company?.name }, "[ipapi.is] IP lookup successful")
      return {
        success: true,
        statusCode,
        data,
      }
    }

    const errorText = await response.text()
    let errorMessage = errorText
    try {
      const errorJson = JSON.parse(errorText) as { error?: string; message?: string }
      if (errorJson.error) {
        errorMessage = errorJson.error
      } else if (errorJson.message) {
        errorMessage = errorJson.message
      }
    } catch {
      // Use raw text
    }

    logger.error({ ip, statusCode, error: errorMessage }, "[ipapi.is] Request failed")
    return {
      success: false,
      statusCode,
      error: errorMessage,
    }
  } catch (error) {
    logger.error({ ip, error }, "[ipapi.is] Request exception")
    return {
      success: false,
      statusCode: 500,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}
