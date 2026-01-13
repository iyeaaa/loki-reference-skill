/**
 * Billing Routes
 *
 * 빌링 관련 API 엔드포인트
 */

import { Elysia, t } from "elysia"
import type { SubscriptionStatus } from "../db/schema/billing"
import * as billingService from "../services/billing.service"
import * as exchangeRateService from "../services/exchange-rate.service"
import * as pricingService from "../services/pricing.service"
import { errorResponse, ResponseCode } from "../types/response.types"

// Schema definitions
const subscriptionTierSchema = t.Union([
  t.Literal("trial"),
  t.Literal("basic"),
  t.Literal("pro"),
  t.Literal("enterprise"),
])

const subscriptionStatusSchema = t.Union([
  t.Literal("trialing"),
  t.Literal("active"),
  t.Literal("canceled"),
  t.Literal("incomplete"),
  t.Literal("incomplete_expired"),
  t.Literal("past_due"),
  t.Literal("unpaid"),
  t.Literal("paused"),
])

const planTypeSchema = t.Union([t.Literal("one_time"), t.Literal("recurring")])

const planIntervalSchema = t.Union([
  t.Literal("day"),
  t.Literal("week"),
  t.Literal("month"),
  t.Literal("year"),
])

// ============================================================================
// Products Routes
// ============================================================================

export const billingProductsRoutes = new Elysia({ prefix: "/api/v1/billing/products" })
  // List products
  .get(
    "/",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const filters = {
        tier: query.tier as "trial" | "basic" | "pro" | "enterprise" | undefined,
        isActive: query.isActive ? query.isActive === "true" : undefined,
        search: query.search,
      }

      const data = await billingService.listProducts(limit, offset, filters)
      const total = await billingService.countProducts(filters)

      return { data, total, limit, offset }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        tier: t.Optional(t.String()),
        isActive: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    },
  )

  // Get product by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const product = await billingService.getProduct(id)
      if (!product) {
        set.status = 404
        return errorResponse("상품을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return product
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Create product
  .post(
    "/",
    async ({ body }) => {
      const product = await billingService.createProduct({
        name: body.name,
        description: body.description,
        tier: body.tier,
        features: body.features || [],
        isActive: body.isActive ?? true,
        displayOrder: body.displayOrder || 0,
        externalProductId: body.externalProductId,
      })
      return product
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 255 }),
        description: t.Optional(t.String()),
        tier: subscriptionTierSchema,
        features: t.Optional(t.Array(t.String())),
        isActive: t.Optional(t.Boolean()),
        displayOrder: t.Optional(t.Number()),
        externalProductId: t.Optional(t.String()),
      }),
    },
  )

  // Update product
  .put(
    "/:id",
    async ({ params: { id }, body, set }) => {
      const product = await billingService.updateProduct(id, {
        name: body.name,
        description: body.description,
        tier: body.tier,
        features: body.features,
        isActive: body.isActive,
        displayOrder: body.displayOrder,
        externalProductId: body.externalProductId,
      })
      if (!product) {
        set.status = 404
        return errorResponse("상품을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return product
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        description: t.Optional(t.String()),
        tier: t.Optional(subscriptionTierSchema),
        features: t.Optional(t.Array(t.String())),
        isActive: t.Optional(t.Boolean()),
        displayOrder: t.Optional(t.Number()),
        externalProductId: t.Optional(t.String()),
      }),
    },
  )

  // Delete product
  .delete(
    "/:id",
    async ({ params: { id } }) => {
      await billingService.deleteProduct(id)
      return { success: true, message: "상품이 삭제되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

// ============================================================================
// Plans Routes
// ============================================================================

export const billingPlansRoutes = new Elysia({ prefix: "/api/v1/billing/plans" })
  // List plans
  .get(
    "/",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const filters = {
        productId: query.productId,
        planType: query.planType as "one_time" | "recurring" | undefined,
        isActive: query.isActive ? query.isActive === "true" : undefined,
        search: query.search,
      }

      const data = await billingService.listPlans(limit, offset, filters)
      const total = await billingService.countPlans(filters)

      return { data, total, limit, offset }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        productId: t.Optional(t.String()),
        planType: t.Optional(t.String()),
        isActive: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    },
  )

  // Get plan by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const plan = await billingService.getPlan(id)
      if (!plan) {
        set.status = 404
        return errorResponse("요금제를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return plan
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Create plan
  .post(
    "/",
    async ({ body }) => {
      const plan = await billingService.createPlan({
        productId: body.productId,
        name: body.name,
        description: body.description,
        currency: body.currency || "KRW",
        amount: body.amount,
        planType: body.planType,
        billingInterval: body.billingInterval,
        intervalCount: body.intervalCount || 1,
        trialDays: body.trialDays || 0,
        isActive: body.isActive ?? true,
        isDefault: body.isDefault ?? false,
        featuresOverride: body.featuresOverride,
        externalPlanId: body.externalPlanId,
      })
      return plan
    },
    {
      body: t.Object({
        productId: t.String({ format: "uuid" }),
        name: t.String({ minLength: 1, maxLength: 100 }),
        description: t.Optional(t.String()),
        currency: t.Optional(t.String({ maxLength: 3 })),
        amount: t.Number({ minimum: 0 }),
        planType: planTypeSchema,
        billingInterval: t.Optional(planIntervalSchema),
        intervalCount: t.Optional(t.Number({ minimum: 1 })),
        trialDays: t.Optional(t.Number({ minimum: 0 })),
        isActive: t.Optional(t.Boolean()),
        isDefault: t.Optional(t.Boolean()),
        featuresOverride: t.Optional(t.Array(t.String())),
        externalPlanId: t.Optional(t.String()),
      }),
    },
  )

  // Update plan
  .put(
    "/:id",
    async ({ params: { id }, body, set }) => {
      const plan = await billingService.updatePlan(id, {
        name: body.name,
        description: body.description,
        currency: body.currency,
        amount: body.amount,
        planType: body.planType,
        billingInterval: body.billingInterval,
        intervalCount: body.intervalCount,
        trialDays: body.trialDays,
        isActive: body.isActive,
        isDefault: body.isDefault,
        featuresOverride: body.featuresOverride,
        externalPlanId: body.externalPlanId,
      })
      if (!plan) {
        set.status = 404
        return errorResponse("요금제를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return plan
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        description: t.Optional(t.String()),
        currency: t.Optional(t.String({ maxLength: 3 })),
        amount: t.Optional(t.Number({ minimum: 0 })),
        planType: t.Optional(planTypeSchema),
        billingInterval: t.Optional(planIntervalSchema),
        intervalCount: t.Optional(t.Number({ minimum: 1 })),
        trialDays: t.Optional(t.Number({ minimum: 0 })),
        isActive: t.Optional(t.Boolean()),
        isDefault: t.Optional(t.Boolean()),
        featuresOverride: t.Optional(t.Array(t.String())),
        externalPlanId: t.Optional(t.String()),
      }),
    },
  )

  // Delete plan
  .delete(
    "/:id",
    async ({ params: { id } }) => {
      await billingService.deletePlan(id)
      return { success: true, message: "요금제가 삭제되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get plan price for specific currency
  .get(
    "/:id/price",
    async ({ params: { id }, query, set }) => {
      const currency = query.currency?.toUpperCase() || "KRW"
      const price = await pricingService.getPlanPrice(id, currency)
      if (!price) {
        set.status = 404
        return errorResponse("가격 정보를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return price
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        currency: t.Optional(t.String({ maxLength: 3 })),
      }),
    },
  )

  // Get all prices for a plan
  .get(
    "/:id/prices",
    async ({ params: { id }, query }) => {
      const currencies = query.currencies?.split(",").map((c) => c.trim().toUpperCase()) || [
        "KRW",
        "USD",
      ]
      const prices = await Promise.all(
        currencies.map((currency) => pricingService.getPlanPrice(id, currency)),
      )
      return prices.filter((p) => p !== null)
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        currencies: t.Optional(t.String()),
      }),
    },
  )

  // Set plan price for specific currency (admin)
  .post(
    "/:id/prices",
    async ({ params: { id }, body }) => {
      await pricingService.setPlanPrice(
        id,
        body.currency,
        body.amount,
        body.displayAmount,
        body.isPrimary,
      )
      return { success: true, message: "가격이 설정되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        currency: t.String({ minLength: 3, maxLength: 3 }),
        amount: t.Number({ minimum: 0 }),
        displayAmount: t.Optional(t.String()),
        isPrimary: t.Optional(t.Boolean()),
      }),
    },
  )

  // Delete plan price (revert to calculated rate)
  .delete(
    "/:id/prices/:currency",
    async ({ params: { id, currency } }) => {
      await pricingService.deletePlanPrice(id, currency)
      return { success: true, message: "가격이 삭제되었습니다. 환율 계산으로 전환됩니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        currency: t.String({ minLength: 3, maxLength: 3 }),
      }),
    },
  )

// ============================================================================
// Subscriptions Routes
// ============================================================================

export const subscriptionsRoutes = new Elysia({ prefix: "/api/v1/billing/subscriptions" })
  // List subscriptions
  .get(
    "/",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const filters = {
        workspaceId: query.workspaceId,
        status: query.status as
          | "trialing"
          | "active"
          | "canceled"
          | "incomplete"
          | "incomplete_expired"
          | "past_due"
          | "unpaid"
          | "paused"
          | undefined,
        statuses: query.statuses ? (query.statuses.split(",") as SubscriptionStatus[]) : undefined,
        tier: query.tier as "trial" | "basic" | "pro" | "enterprise" | undefined,
        isPrimary: query.isPrimary ? query.isPrimary === "true" : undefined,
        search: query.search,
      }

      const data = await billingService.listSubscriptions(limit, offset, filters)
      const total = await billingService.countSubscriptions(filters)

      return { data, total, limit, offset }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        workspaceId: t.Optional(t.String()),
        status: t.Optional(t.String()),
        statuses: t.Optional(t.String()),
        tier: t.Optional(t.String()),
        isPrimary: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    },
  )

  // Get subscription by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const subscription = await billingService.getSubscription(id)
      if (!subscription) {
        set.status = 404
        return errorResponse("구독을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return subscription
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Create subscription
  .post(
    "/",
    async ({ body }) => {
      const subscription = await billingService.createSubscription({
        workspaceId: body.workspaceId,
        customerId: body.customerId,
        planId: body.planId,
        isPrimary: body.isPrimary ?? true,
        quantity: body.quantity || 1,
        status: "trialing",
        trialStart: new Date(),
        trialEnd: body.trialDays
          ? new Date(Date.now() + body.trialDays * 24 * 60 * 60 * 1000)
          : undefined,
      })
      return subscription
    },
    {
      body: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        customerId: t.String({ format: "uuid" }),
        planId: t.String({ format: "uuid" }),
        isPrimary: t.Optional(t.Boolean()),
        quantity: t.Optional(t.Number({ minimum: 1 })),
        trialDays: t.Optional(t.Number({ minimum: 0 })),
      }),
    },
  )

  // Update subscription
  .put(
    "/:id",
    async ({ params: { id }, body, set }) => {
      const subscription = await billingService.updateSubscription(id, {
        planId: body.planId,
        status: body.status,
        cancelAtPeriodEnd: body.cancelAtPeriodEnd,
        quantity: body.quantity,
        cancelReason: body.cancelReason,
      })
      if (!subscription) {
        set.status = 404
        return errorResponse("구독을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return subscription
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        planId: t.Optional(t.String({ format: "uuid" })),
        status: t.Optional(subscriptionStatusSchema),
        cancelAtPeriodEnd: t.Optional(t.Boolean()),
        quantity: t.Optional(t.Number({ minimum: 1 })),
        cancelReason: t.Optional(t.String()),
      }),
    },
  )

  // Cancel subscription
  .post(
    "/:id/cancel",
    async ({ params: { id }, body, set }) => {
      const subscription = await billingService.cancelSubscription(id, body.reason)
      if (!subscription) {
        set.status = 404
        return errorResponse("구독을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return subscription
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        reason: t.Optional(t.String()),
      }),
    },
  )

  // Get subscription history
  .get(
    "/:id/history",
    async ({ params: { id } }) => {
      const history = await billingService.getSubscriptionHistory(id)
      return history
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

// ============================================================================
// Customers Routes
// ============================================================================

export const billingCustomersRoutes = new Elysia({ prefix: "/api/v1/billing/customers" })
  // List customers
  .get(
    "/",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const filters = {
        search: query.search,
      }

      const data = await billingService.listCustomers(limit, offset, filters)
      const total = await billingService.countCustomers(filters)

      return { data, total, limit, offset }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    },
  )

  // Get customer by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const customer = await billingService.getCustomer(id)
      if (!customer) {
        set.status = 404
        return errorResponse("고객을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return customer
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

// ============================================================================
// Exchange Rates Routes
// ============================================================================

export const exchangeRatesRoutes = new Elysia({ prefix: "/api/v1/billing/exchange-rates" })
  // Get current exchange rate
  .get(
    "/",
    async ({ query }) => {
      const baseCurrency = query.base?.toUpperCase() || "USD"
      const targetCurrency = query.target?.toUpperCase() || "KRW"
      const rate = await exchangeRateService.getExchangeRate(baseCurrency, targetCurrency)
      return rate
    },
    {
      query: t.Object({
        base: t.Optional(t.String({ maxLength: 3 })),
        target: t.Optional(t.String({ maxLength: 3 })),
      }),
    },
  )

  // Get all cached exchange rates
  .get("/cached", async () => {
    const rates = await exchangeRateService.getAllCachedRates()
    return { rates }
  })

  // Convert amount between currencies
  .get(
    "/convert",
    async ({ query }) => {
      const amount = parseFloat(query.amount)
      const fromCurrency = query.from?.toUpperCase() || "USD"
      const toCurrency = query.to?.toUpperCase() || "KRW"

      let convertedAmount: number
      if (fromCurrency === "USD") {
        convertedAmount = await exchangeRateService.convertFromUSD(amount, toCurrency)
      } else if (toCurrency === "USD") {
        convertedAmount = await exchangeRateService.convertToUSD(amount, fromCurrency)
      } else {
        // Convert via USD as intermediate
        const usdAmount = await exchangeRateService.convertToUSD(amount, fromCurrency)
        convertedAmount = await exchangeRateService.convertFromUSD(usdAmount, toCurrency)
      }

      return {
        from: { currency: fromCurrency, amount },
        to: { currency: toCurrency, amount: convertedAmount },
      }
    },
    {
      query: t.Object({
        amount: t.String(),
        from: t.Optional(t.String({ maxLength: 3 })),
        to: t.Optional(t.String({ maxLength: 3 })),
      }),
    },
  )

  // Set manual exchange rate (admin)
  .post(
    "/",
    async ({ body }) => {
      await exchangeRateService.setManualRate(
        body.baseCurrency,
        body.targetCurrency,
        body.rate,
        body.ttlHours,
      )
      return { success: true, message: "환율이 설정되었습니다." }
    },
    {
      body: t.Object({
        baseCurrency: t.String({ minLength: 3, maxLength: 3 }),
        targetCurrency: t.String({ minLength: 3, maxLength: 3 }),
        rate: t.Number({ minimum: 0 }),
        ttlHours: t.Optional(t.Number({ minimum: 1 })),
      }),
    },
  )

// ============================================================================
// Pricing Routes (Plans with Multi-Currency)
// ============================================================================

export const pricingRoutes = new Elysia({ prefix: "/api/v1/billing/pricing" })
  // Get all plans with multi-currency prices
  .get(
    "/plans",
    async ({ query }) => {
      const currencies = query.currencies?.split(",").map((c) => c.trim().toUpperCase()) || [
        "KRW",
        "USD",
      ]
      const activeOnly = query.activeOnly !== "false"
      // excludeTiers: 쉼표로 구분된 티어 목록 (예: "enterprise,trial")
      const excludeTiers = query.excludeTiers
        ? query.excludeTiers.split(",").map((t) => t.trim().toLowerCase())
        : ["enterprise"] // 기본적으로 enterprise 제외 (public 결제 페이지용)
      const plans = await pricingService.getPlansWithPrices(currencies, activeOnly, excludeTiers)
      return { plans }
    },
    {
      query: t.Object({
        currencies: t.Optional(t.String()),
        activeOnly: t.Optional(t.String()),
        excludeTiers: t.Optional(t.String()),
      }),
    },
  )

  // Generate prices for all plans in a currency
  .post(
    "/generate",
    async ({ body }) => {
      await pricingService.generatePricesForCurrency(body.currency, body.roundTo)
      return { success: true, message: `${body.currency} 가격이 생성되었습니다.` }
    },
    {
      body: t.Object({
        currency: t.String({ minLength: 3, maxLength: 3 }),
        roundTo: t.Optional(t.Number({ minimum: 0 })),
      }),
    },
  )
