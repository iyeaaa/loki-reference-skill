/**
 * Exchange Rate Service
 *
 * 환율 조회 및 캐시 관리 서비스
 * - 네이버 환율 API (1순위) - 실시간 한국 은행 환율
 * - ExchangeRate-API (2순위 fallback)
 * - DB 캐시로 API 호출 최소화 (1시간 TTL)
 * - 실패 시 fallback 환율 제공
 */

import { and, eq } from "drizzle-orm"
import { db } from "../db"
import { exchangeRates } from "../db/schema/billing"
import logger from "../utils/logger"

// ============================================================================
// Constants
// ============================================================================

// 네이버 환율 API (실시간, 무제한)
const NAVER_EXCHANGE_API_URL = "https://m.search.naver.com/p/csearch/content/qapirender.nhn"

// 무료 환율 API (1,500 req/월) - fallback용
const EXCHANGE_API_URL = "https://api.exchangerate-api.com/v4/latest"

// 캐시 TTL: 1시간 (네이버 API는 실시간이므로 더 짧게)
const CACHE_TTL_HOURS = 1

// Fallback 환율 (API 실패 시)
const FALLBACK_RATES: Record<string, number> = {
  KRW: 1450,
  JPY: 155,
  EUR: 0.92,
  GBP: 0.79,
}

// ============================================================================
// Types
// ============================================================================

// 네이버 환율 API 응답 타입
interface NaverExchangeRateResponse {
  pkid: number
  count: number
  country: Array<{
    value: string // "1" or "1,472.70"
    subValue: string // "1 달러" or "1,472.70 원"
    currencyUnit: string // "달러" or "원"
  }>
  calculatorMessage: string
}

interface ExchangeRateApiResponse {
  base: string
  date: string
  time_last_updated: number
  rates: Record<string, number>
}

export interface ExchangeRateResult {
  rate: number
  source: "cache" | "naver" | "api" | "fallback"
  fetchedAt: Date
  expiresAt?: Date
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * 환율 조회 (캐시 우선)
 *
 * 우선순위:
 * 1. DB 캐시 (유효한 경우)
 * 2. API 조회 → DB 캐시 저장
 * 3. 만료된 캐시 (fallback)
 * 4. 고정 fallback 환율
 *
 * @param baseCurrency - 기준 통화 (기본: USD)
 * @param targetCurrency - 대상 통화 (KRW, JPY 등)
 */
export async function getExchangeRate(
  baseCurrency: string = "USD",
  targetCurrency: string = "KRW",
): Promise<ExchangeRateResult> {
  const now = new Date()

  // 1. DB 캐시 확인
  try {
    const cached = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.baseCurrency, baseCurrency.toUpperCase()),
          eq(exchangeRates.targetCurrency, targetCurrency.toUpperCase()),
        ),
      )
      .limit(1)

    if (cached[0]?.expiresAt && new Date(cached[0].expiresAt) > now) {
      logger.debug(
        { baseCurrency, targetCurrency, rate: cached[0].rate },
        "[ExchangeRate] Using cached rate",
      )
      return {
        rate: Number(cached[0].rate),
        source: "cache",
        fetchedAt: new Date(cached[0].fetchedAt),
        expiresAt: new Date(cached[0].expiresAt),
      }
    }

    // 2. 네이버 API에서 최신 환율 조회 (1순위)
    let apiRate: number | null = null
    let apiSource: "naver" | "api" = "naver"

    if (baseCurrency.toUpperCase() === "USD" && targetCurrency.toUpperCase() === "KRW") {
      apiRate = await fetchFromNaverApi()
      apiSource = "naver"
    }

    // 3. 네이버 API 실패 시 ExchangeRate-API 사용 (2순위)
    if (apiRate === null) {
      apiRate = await fetchFromExchangeRateApi(baseCurrency, targetCurrency)
      apiSource = "api"
    }

    if (apiRate !== null) {
      // DB에 캐시 저장
      const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000)
      const rateString = apiRate.toString()
      const sourceValue = apiSource === "naver" ? "naver-api" : "exchangerate-api"

      await db
        .insert(exchangeRates)
        .values({
          baseCurrency: baseCurrency.toUpperCase(),
          targetCurrency: targetCurrency.toUpperCase(),
          rate: rateString,
          source: sourceValue,
          fetchedAt: now,
          expiresAt,
        })
        .onConflictDoNothing()
        .catch(async () => {
          // Unique constraint violation - update instead
          await db
            .update(exchangeRates)
            .set({
              rate: rateString,
              source: sourceValue,
              fetchedAt: now,
              expiresAt,
            })
            .where(
              and(
                eq(exchangeRates.baseCurrency, baseCurrency.toUpperCase()),
                eq(exchangeRates.targetCurrency, targetCurrency.toUpperCase()),
              ),
            )
        })

      logger.info(
        { baseCurrency, targetCurrency, rate: apiRate, source: apiSource },
        "[ExchangeRate] Rate updated from API",
      )

      return {
        rate: apiRate,
        source: apiSource,
        fetchedAt: now,
        expiresAt,
      }
    }

    // 3. API 실패 시 만료된 캐시 사용
    if (cached[0]) {
      logger.warn(
        { baseCurrency, targetCurrency },
        "[ExchangeRate] API failed, using expired cache",
      )
      return {
        rate: Number(cached[0].rate),
        source: "fallback",
        fetchedAt: new Date(cached[0].fetchedAt),
      }
    }
  } catch (error) {
    logger.error({ error, baseCurrency, targetCurrency }, "[ExchangeRate] Database error")
  }

  // 4. 최후의 fallback
  const fallbackRate = FALLBACK_RATES[targetCurrency.toUpperCase()] || 1
  logger.warn({ baseCurrency, targetCurrency, fallbackRate }, "[ExchangeRate] Using fallback rate")

  return {
    rate: fallbackRate,
    source: "fallback",
    fetchedAt: now,
  }
}

/**
 * USD를 다른 통화로 변환
 *
 * @param amountUSD - USD 금액 (달러 단위, 예: 9.99)
 * @param targetCurrency - 대상 통화
 * @returns 변환된 금액 (정수, 원 단위)
 */
export async function convertFromUSD(amountUSD: number, targetCurrency: string): Promise<number> {
  if (targetCurrency.toUpperCase() === "USD") return amountUSD

  const { rate } = await getExchangeRate("USD", targetCurrency)
  return Math.round(amountUSD * rate)
}

/**
 * 다른 통화를 USD로 변환
 *
 * @param amount - 원본 금액 (원/엔 등)
 * @param fromCurrency - 원본 통화
 * @returns USD 금액 (달러 단위, 소수점 2자리)
 */
export async function convertToUSD(amount: number, fromCurrency: string): Promise<number> {
  if (fromCurrency.toUpperCase() === "USD") return amount

  const { rate } = await getExchangeRate("USD", fromCurrency)
  return Math.round((amount / rate) * 100) / 100
}

/**
 * 현재 캐시된 모든 환율 조회
 */
export async function getAllCachedRates(): Promise<
  Array<{
    baseCurrency: string
    targetCurrency: string
    rate: number
    source: string | null
    fetchedAt: Date
    expiresAt: Date | null
    isExpired: boolean
  }>
> {
  const rates = await db.select().from(exchangeRates)
  const now = new Date()

  return rates.map((r) => ({
    baseCurrency: r.baseCurrency,
    targetCurrency: r.targetCurrency,
    rate: Number(r.rate),
    source: r.source,
    fetchedAt: new Date(r.fetchedAt),
    expiresAt: r.expiresAt ? new Date(r.expiresAt) : null,
    isExpired: r.expiresAt ? new Date(r.expiresAt) < now : true,
  }))
}

/**
 * 환율 수동 설정 (관리자용)
 */
export async function setManualRate(
  baseCurrency: string,
  targetCurrency: string,
  rate: number,
  ttlHours: number = 24 * 30, // 기본 30일
): Promise<void> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000)

  await db
    .insert(exchangeRates)
    .values({
      baseCurrency: baseCurrency.toUpperCase(),
      targetCurrency: targetCurrency.toUpperCase(),
      rate: rate.toString(),
      source: "manual",
      fetchedAt: now,
      expiresAt,
    })
    .onConflictDoNothing()
    .catch(async () => {
      await db
        .update(exchangeRates)
        .set({
          rate: rate.toString(),
          source: "manual",
          fetchedAt: now,
          expiresAt,
        })
        .where(
          and(
            eq(exchangeRates.baseCurrency, baseCurrency.toUpperCase()),
            eq(exchangeRates.targetCurrency, targetCurrency.toUpperCase()),
          ),
        )
    })

  logger.info({ baseCurrency, targetCurrency, rate, expiresAt }, "[ExchangeRate] Manual rate set")
}

// ============================================================================
// Internal Functions
// ============================================================================

/**
 * 네이버 환율 API에서 USD/KRW 환율 조회
 *
 * 네이버 모바일 검색 API 사용 (실시간 은행 환율)
 * 예: 1 USD = 1,472.70 KRW
 */
async function fetchFromNaverApi(): Promise<number | null> {
  try {
    const params = new URLSearchParams({
      key: "calculator",
      pkid: "141",
      q: "환율",
      where: "m",
      u1: "keb",
      u6: "standardUnit",
      u7: "0",
      u3: "USD",
      u4: "KRW",
      u8: "down",
      u2: "1",
    })

    const response = await fetch(`${NAVER_EXCHANGE_API_URL}?${params.toString()}`, {
      signal: AbortSignal.timeout(5000), // 5초 타임아웃
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      logger.warn({ status: response.status }, "[ExchangeRate] Naver API request failed")
      return null
    }

    const data = (await response.json()) as NaverExchangeRateResponse

    if (!data.country || data.country.length < 2) {
      logger.warn({ data }, "[ExchangeRate] Naver API invalid response")
      return null
    }

    // country[1]이 KRW 값 (예: "1,472.70")
    const krwEntry = data.country.find((c) => c.currencyUnit === "원")
    if (!krwEntry) {
      logger.warn({ data }, "[ExchangeRate] Naver API KRW not found")
      return null
    }

    // "1,472.70" → 1472.70
    const rate = Number.parseFloat(krwEntry.value.replace(/,/g, ""))

    if (Number.isNaN(rate) || rate <= 0) {
      logger.warn({ value: krwEntry.value }, "[ExchangeRate] Naver API invalid rate")
      return null
    }

    logger.info({ rate, source: "naver" }, "[ExchangeRate] Fetched from Naver API")
    return rate
  } catch (error) {
    logger.error({ error }, "[ExchangeRate] Naver API fetch error")
    return null
  }
}

/**
 * ExchangeRate-API에서 환율 조회 (fallback)
 */
async function fetchFromExchangeRateApi(
  baseCurrency: string,
  targetCurrency: string,
): Promise<number | null> {
  try {
    const response = await fetch(`${EXCHANGE_API_URL}/${baseCurrency.toUpperCase()}`, {
      signal: AbortSignal.timeout(5000), // 5초 타임아웃
    })

    if (!response.ok) {
      logger.warn(
        { status: response.status, baseCurrency },
        "[ExchangeRate] ExchangeRate-API request failed",
      )
      return null
    }

    const data = (await response.json()) as ExchangeRateApiResponse
    const rate = data.rates[targetCurrency.toUpperCase()]

    if (rate === undefined) {
      logger.warn({ targetCurrency }, "[ExchangeRate] Currency not found in API response")
      return null
    }

    logger.info(
      { rate, source: "exchangerate-api" },
      "[ExchangeRate] Fetched from ExchangeRate-API",
    )
    return rate
  } catch (error) {
    logger.error({ error, baseCurrency, targetCurrency }, "[ExchangeRate] ExchangeRate-API error")
    return null
  }
}
