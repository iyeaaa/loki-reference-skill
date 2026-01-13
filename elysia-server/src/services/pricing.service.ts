/**
 * Pricing Service
 *
 * 다중 통화 가격 관리 서비스
 * - 요금제별 다중 통화 가격 조회/설정
 * - DB에 저장된 가격 우선, 없으면 환율 계산
 */

import { and, eq } from "drizzle-orm"
import { db } from "../db"
import { billingPlans, billingProducts, planPrices } from "../db/schema/billing"
import logger from "../utils/logger"
import * as exchangeRateService from "./exchange-rate.service"

// ============================================================================
// Types
// ============================================================================

export interface PlanPriceInfo {
  currency: string
  amount: number // minor unit (원, 센트)
  displayAmount: string // "₩9,900", "$9.99"
  isCalculated: boolean // true = 환율 계산, false = DB 저장값
}

export interface PlanWithPrices {
  id: string
  productId: string
  name: string
  description: string | null
  billingInterval: string | null
  intervalCount: number | null
  isActive: boolean
  product?: {
    id: string
    name: string
    tier: string
    description: string | null
  }
  prices: PlanPriceInfo[]
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * 특정 요금제의 특정 통화 가격 조회
 *
 * 우선순위:
 * 1. plan_prices 테이블에 저장된 가격
 * 2. 기본 KRW 가격에서 환율 계산
 *
 * @param planId - 요금제 ID
 * @param currency - 통화 코드 (KRW, USD)
 */
export async function getPlanPrice(
  planId: string,
  currency: string,
): Promise<PlanPriceInfo | null> {
  const upperCurrency = currency.toUpperCase()

  // 1. plan_prices 테이블에서 저장된 가격 확인
  const savedPrice = await db
    .select()
    .from(planPrices)
    .where(and(eq(planPrices.planId, planId), eq(planPrices.currency, upperCurrency)))
    .limit(1)

  if (savedPrice[0]) {
    return {
      currency: upperCurrency,
      amount: savedPrice[0].amount,
      displayAmount:
        savedPrice[0].displayAmount || formatPrice(savedPrice[0].amount, upperCurrency),
      isCalculated: false,
    }
  }

  // 2. 기본 플랜 가격에서 환율 계산
  const plan = await db.select().from(billingPlans).where(eq(billingPlans.id, planId)).limit(1)

  if (!plan[0]) {
    logger.warn({ planId }, "[Pricing] Plan not found")
    return null
  }

  const baseCurrency = plan[0].currency.toUpperCase()
  const baseAmount = plan[0].amount

  // 같은 통화면 그대로 반환
  if (baseCurrency === upperCurrency) {
    return {
      currency: upperCurrency,
      amount: baseAmount,
      displayAmount: formatPrice(baseAmount, upperCurrency),
      isCalculated: false,
    }
  }

  // 환율 계산 (KRW → USD)
  if (baseCurrency === "KRW" && upperCurrency === "USD") {
    const usdAmount = await exchangeRateService.convertToUSD(baseAmount, "KRW")
    // USD는 센트 단위로 변환 (예: $7.41 → 741)
    const amountInCents = Math.round(usdAmount * 100)

    return {
      currency: "USD",
      amount: amountInCents,
      displayAmount: formatPrice(amountInCents, "USD"),
      isCalculated: true,
    }
  }

  // USD → KRW 환율 계산
  if (baseCurrency === "USD" && upperCurrency === "KRW") {
    // USD는 달러 단위로 저장되어 있다고 가정
    const krwAmount = await exchangeRateService.convertFromUSD(baseAmount, "KRW")

    return {
      currency: "KRW",
      amount: krwAmount,
      displayAmount: formatPrice(krwAmount, "KRW"),
      isCalculated: true,
    }
  }

  logger.warn(
    { planId, baseCurrency, targetCurrency: upperCurrency },
    "[Pricing] Unsupported currency conversion",
  )
  return null
}

/**
 * 요금제 목록 조회 (다중 통화 포함)
 *
 * @param currencies - 조회할 통화 목록 (기본: ['KRW', 'USD'])
 * @param activeOnly - 활성 요금제만 조회 (기본: true)
 */
export async function getPlansWithPrices(
  currencies: string[] = ["KRW", "USD"],
  activeOnly: boolean = true,
): Promise<PlanWithPrices[]> {
  // 1. 요금제 + 상품 정보 조회
  const plansQuery = db
    .select({
      plan: billingPlans,
      product: billingProducts,
    })
    .from(billingPlans)
    .leftJoin(billingProducts, eq(billingPlans.productId, billingProducts.id))

  if (activeOnly) {
    plansQuery.where(eq(billingPlans.isActive, true))
  }

  const plans = await plansQuery

  // 2. 각 요금제별 가격 조회
  const result: PlanWithPrices[] = []

  for (const { plan, product } of plans) {
    const prices: PlanPriceInfo[] = []

    for (const currency of currencies) {
      const price = await getPlanPrice(plan.id, currency)
      if (price) {
        prices.push(price)
      }
    }

    result.push({
      id: plan.id,
      productId: plan.productId,
      name: plan.name,
      description: plan.description,
      billingInterval: plan.billingInterval,
      intervalCount: plan.intervalCount,
      isActive: plan.isActive,
      product: product
        ? {
            id: product.id,
            name: product.name,
            tier: product.tier,
            description: product.description,
          }
        : undefined,
      prices,
    })
  }

  // 금액순 정렬 (KRW 기준)
  result.sort((a, b) => {
    const aKrw = a.prices.find((p) => p.currency === "KRW")?.amount || 0
    const bKrw = b.prices.find((p) => p.currency === "KRW")?.amount || 0
    return aKrw - bKrw
  })

  return result
}

/**
 * 요금제 가격 설정 (관리자용)
 *
 * @param planId - 요금제 ID
 * @param currency - 통화 코드
 * @param amount - 금액 (minor unit)
 * @param displayAmount - 표시용 문자열 (선택)
 * @param isPrimary - 기본 표시 통화 여부
 */
export async function setPlanPrice(
  planId: string,
  currency: string,
  amount: number,
  displayAmount?: string,
  isPrimary: boolean = false,
): Promise<void> {
  const upperCurrency = currency.toUpperCase()
  const display = displayAmount || formatPrice(amount, upperCurrency)

  // 기존 가격 확인
  const existing = await db
    .select()
    .from(planPrices)
    .where(and(eq(planPrices.planId, planId), eq(planPrices.currency, upperCurrency)))
    .limit(1)

  if (existing[0]) {
    // 업데이트
    await db
      .update(planPrices)
      .set({
        amount,
        displayAmount: display,
        isPrimary,
        updatedAt: new Date(),
      })
      .where(eq(planPrices.id, existing[0].id))
  } else {
    // 새로 생성
    await db.insert(planPrices).values({
      planId,
      currency: upperCurrency,
      amount,
      displayAmount: display,
      isPrimary,
    })
  }

  logger.info(
    { planId, currency: upperCurrency, amount, displayAmount: display },
    "[Pricing] Plan price set",
  )
}

/**
 * 요금제 가격 삭제 (환율 계산으로 전환)
 */
export async function deletePlanPrice(planId: string, currency: string): Promise<void> {
  await db
    .delete(planPrices)
    .where(and(eq(planPrices.planId, planId), eq(planPrices.currency, currency.toUpperCase())))

  logger.info({ planId, currency }, "[Pricing] Plan price deleted (will use calculated rate)")
}

/**
 * 모든 요금제에 대해 특정 통화 가격 일괄 설정
 * (환율 기준으로 자동 계산)
 */
export async function generatePricesForCurrency(
  currency: string,
  roundTo: number = 99, // 마케팅 가격 (예: $9.99, $19.99)
): Promise<void> {
  const upperCurrency = currency.toUpperCase()
  // roundTo 검증: 0-99 범위로 제한 (센트 단위)
  const validRoundTo = Math.min(Math.max(Math.abs(roundTo), 0), 99)
  const plans = await db.select().from(billingPlans).where(eq(billingPlans.isActive, true))

  for (const plan of plans) {
    // 이미 설정된 가격이 있으면 스킵
    const existing = await db
      .select()
      .from(planPrices)
      .where(and(eq(planPrices.planId, plan.id), eq(planPrices.currency, upperCurrency)))
      .limit(1)

    if (existing[0]) {
      continue
    }

    const priceInfo = await getPlanPrice(plan.id, upperCurrency)
    if (priceInfo?.isCalculated) {
      // 마케팅 가격으로 반올림 (예: 741 → 799, 1523 → 1599)
      let roundedAmount = priceInfo.amount
      if (validRoundTo > 0 && upperCurrency === "USD") {
        // $7.41 → $7.99 (센트 단위)
        const dollars = Math.floor(priceInfo.amount / 100)
        roundedAmount = dollars * 100 + validRoundTo
      }

      await setPlanPrice(plan.id, upperCurrency, roundedAmount)
    }
  }

  logger.info({ currency: upperCurrency }, "[Pricing] Prices generated for currency")
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 금액을 표시 문자열로 포맷팅
 */
function formatPrice(amount: number, currency: string): string {
  const upperCurrency = currency.toUpperCase()

  switch (upperCurrency) {
    case "KRW":
      return `₩${amount.toLocaleString()}`
    case "USD":
      // 센트 → 달러
      return `$${(amount / 100).toFixed(2)}`
    case "JPY":
      return `¥${amount.toLocaleString()}`
    case "EUR":
      return `€${(amount / 100).toFixed(2)}`
    default:
      return `${amount} ${upperCurrency}`
  }
}

/**
 * 특정 요금제의 모든 저장된 가격 조회
 */
export async function getSavedPrices(planId: string): Promise<
  Array<{
    currency: string
    amount: number
    displayAmount: string | null
    isPrimary: boolean | null
  }>
> {
  const prices = await db.select().from(planPrices).where(eq(planPrices.planId, planId))

  return prices.map((p) => ({
    currency: p.currency,
    amount: p.amount,
    displayAmount: p.displayAmount,
    isPrimary: p.isPrimary,
  }))
}
