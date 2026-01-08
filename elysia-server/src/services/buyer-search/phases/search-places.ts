/**
 * Phase 2D: Google Places API
 * 로컬 비즈니스/소매점 검색 (B2C 또는 both일 때만 활성화)
 */

import { config } from "../../../config"
import logger from "../../../utils/logger"
import { COUNTRY_TO_PLACES, INDUSTRY_TO_PLACE_TYPE } from "../constants"
import type { BuyerIntelligence, Country, Industry, RawCompany, TargetCustomer } from "../types"

/**
 * Google Places Nearby Search API 응답 타입
 */
interface PlacesResponse {
  results?: Array<{
    name?: string
    vicinity?: string
    place_id?: string
    types?: string[]
    business_status?: string
  }>
  status?: string
  error_message?: string
}

/**
 * Google Places Details API 응답 타입
 */
interface PlaceDetailsResponse {
  result?: {
    name?: string
    website?: string
    formatted_phone_number?: string
    formatted_address?: string
    types?: string[]
  }
  status?: string
}

/**
 * Google Places API 호출 (Nearby Search)
 */
async function callPlacesNearbySearch(
  lat: number,
  lng: number,
  radius: number,
  type: string,
): Promise<PlacesResponse> {
  const apiKey = config.googlePlaces.apiKey

  if (!apiKey) {
    logger.warn("[Places] API 키가 설정되지 않음")
    return { results: [] }
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json")
    url.searchParams.set("location", `${lat},${lng}`)
    url.searchParams.set("radius", radius.toString())
    url.searchParams.set("type", type)
    url.searchParams.set("key", apiKey)

    const response = await fetch(url.toString())

    if (!response.ok) {
      const errorText = await response.text()
      logger.error({ status: response.status, error: errorText }, "[Places] API 호출 실패")
      return { results: [] }
    }

    const data = (await response.json()) as PlacesResponse

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      logger.error({ status: data.status, message: data.error_message }, "[Places] API 오류")
      return { results: [] }
    }

    return data
  } catch (error) {
    logger.error({ error }, "[Places] API 호출 중 오류")
    return { results: [] }
  }
}

/**
 * Google Places Details API 호출
 */
async function callPlaceDetails(placeId: string): Promise<PlaceDetailsResponse> {
  const apiKey = config.googlePlaces.apiKey

  if (!apiKey) {
    return { result: undefined }
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json")
    url.searchParams.set("place_id", placeId)
    url.searchParams.set("fields", "name,website,formatted_phone_number,formatted_address,types")
    url.searchParams.set("key", apiKey)

    const response = await fetch(url.toString())

    if (!response.ok) {
      return { result: undefined }
    }

    const data = (await response.json()) as PlaceDetailsResponse
    return data
  } catch {
    return { result: undefined }
  }
}

/**
 * Google Places 사용 여부 판단
 */
export function shouldUseGooglePlaces(target: TargetCustomer, industry: Industry): boolean {
  // B2B only면 스킵
  if (target === "b2b") return false

  // 로컬 리테일이 의미 있는 산업만
  const retailRelevant: Industry[] = [
    "beauty_cosmetics",
    "food_supplements",
    "fashion_apparel",
    "electronics",
    "healthcare",
  ]

  return retailRelevant.includes(industry)
}

/**
 * Google Places로 바이어 검색
 */
export async function searchWithGooglePlaces(
  _intelligence: BuyerIntelligence,
  countries: Country[],
  industry: Industry,
): Promise<RawCompany[]> {
  const startTime = Date.now()
  logger.info(`[Places] 검색 시작: ${countries.length}개 국가`)

  // API 키 체크
  if (!config.googlePlaces.apiKey) {
    logger.warn("[Places] API 키 없음, 스킵")
    return []
  }

  const placeType = INDUSTRY_TO_PLACE_TYPE[industry] || "store"
  const allResults: RawCompany[] = []
  const seenNames = new Set<string>()

  // 국가별 주요 도시에서 검색
  for (const country of countries) {
    const locations = COUNTRY_TO_PLACES[country]

    if (!locations) continue

    for (const location of locations) {
      try {
        logger.info(`[Places] ${location.city} 검색 중...`)

        // Nearby Search (첫 번째 타입만 사용)
        const firstType = placeType.split("|")[0] || "store"
        const result = await callPlacesNearbySearch(
          location.lat,
          location.lng,
          location.radius,
          firstType,
        )

        if (!result.results || result.results.length === 0) {
          continue
        }

        // 상위 5개만 세부 정보 조회 (API quota 절약)
        const topPlaces = result.results.slice(0, 5)

        for (const place of topPlaces) {
          if (!place.place_id || !place.name) continue

          // 중복 체크
          const nameKey = place.name.toLowerCase()
          if (seenNames.has(nameKey)) continue
          seenNames.add(nameKey)

          // Details API로 웹사이트 정보 가져오기
          const details = await callPlaceDetails(place.place_id)

          if (!details.result?.website) {
            // 웹사이트 없으면 스킵
            continue
          }

          allResults.push({
            companyName: place.name,
            website: details.result.website,
            domain: undefined, // extractDomain은 dedup 단계에서
            industry: placeType,
            country: location.city,
            description: details.result.formatted_address,
            contacts: [
              {
                phone: details.result.formatted_phone_number,
              },
            ],
            source: "places",
          })
        }

        // Rate limit 방지
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error) {
        logger.error({ error, city: location.city }, "[Places] 검색 중 오류")
        // 실패해도 계속 진행
      }
    }
  }

  const duration = Date.now() - startTime
  logger.info(`[Places] 검색 완료 (${duration}ms): ${allResults.length}개 발견`)

  return allResults
}
