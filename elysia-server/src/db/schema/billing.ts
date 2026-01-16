/**
 * 빌링(결제) 관련 스키마
 *
 * 구독 기반 SaaS 결제 시스템을 위한 테이블 정의
 * - 결제 모듈 독립적 설계 (Stripe, Toss 등 어떤 결제 시스템이든 연동 가능)
 * - 워크스페이스 단위 구독 관리
 */

import { relations } from "drizzle-orm"
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import {
  planIntervalEnum,
  planTypeEnum,
  subscriptionStatusEnum,
  subscriptionTierEnum,
} from "./enums"
import { users } from "./users"
import { workspaces } from "./workspaces"

// Enum re-export for backward compatibility
export {
  planIntervalEnum,
  planTypeEnum,
  subscriptionStatusEnum,
  subscriptionTierEnum,
} from "./enums"

// ============================================================================
// Tables (테이블)
// ============================================================================

/**
 * 결제 고객 테이블 (billing_customers)
 *
 * 사용자와 외부 결제 시스템의 고객 정보를 매핑
 * 1 User : 1 BillingCustomer 관계
 *
 * @field id - 기본 식별자 (UUID)
 * @field userId - 사용자 연결 (1:1 관계, 필수, users.id 참조)
 * @field externalCustomerId - 외부 결제 시스템 고객 ID (Stripe: cus_xxx, Toss: customer_xxx 등)
 * @field email - 결제용 이메일 (사용자 이메일과 다를 수 있음)
 * @field name - 결제 고객명
 * @field metadata - 추가 메타데이터 (결제 시스템별 커스텀 데이터, JSONB)
 * @field createdAt - 생성 시간
 * @field updatedAt - 수정 시간
 *
 * @index billing_customers_user_id_idx - 사용자 ID로 빠른 조회
 * @index billing_customers_external_id_idx - 외부 고객 ID로 빠른 조회 (웹훅 처리 시 사용)
 */
export const billingCustomers = pgTable(
  "billing_customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    externalCustomerId: varchar("external_customer_id", { length: 255 }).notNull().unique(),
    email: varchar("email", { length: 255 }),
    name: varchar("name", { length: 255 }),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("billing_customers_user_id_idx").on(table.userId),
    externalIdIdx: index("billing_customers_external_id_idx").on(table.externalCustomerId),
  }),
)

/**
 * 상품 테이블 (billing_products)
 *
 * 판매하는 상품(요금제) 정의
 * 각 상품은 하나의 구독 등급(tier)에 매핑됨
 *
 * @field id - 기본 식별자 (UUID)
 * @field externalProductId - 외부 결제 시스템 상품 ID (nullable, 외부 시스템 연동 전에도 사용 가능)
 * @field name - 상품명 (예: "Basic Plan", "Pro Plan")
 * @field description - 상품 설명
 * @field tier - 구독 등급 매핑 (trial/basic/pro/enterprise, IAM 권한과 연동되는 핵심 필드)
 * @field features - 상품에 포함된 기능 목록 (JSONB 배열)
 * @field isActive - 활성화 여부 (false면 신규 구매 불가)
 * @field displayOrder - 표시 순서 (가격 페이지 정렬용)
 * @field metadata - 추가 메타데이터 (JSONB)
 * @field createdAt - 생성 시간
 * @field updatedAt - 수정 시간
 *
 * @index billing_products_tier_idx - 등급별 조회
 * @index billing_products_active_idx - 활성 상품만 조회
 */
export const billingProducts = pgTable(
  "billing_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalProductId: varchar("external_product_id", { length: 255 }).unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    tier: subscriptionTierEnum("tier").notNull(),
    features: jsonb("features").default([]),
    isActive: boolean("is_active").notNull().default(true),
    displayOrder: integer("display_order").default(0),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tierIdx: index("billing_products_tier_idx").on(table.tier),
    activeIdx: index("billing_products_active_idx").on(table.isActive),
  }),
)

/**
 * 요금제(가격) 테이블 (billing_plans)
 *
 * 상품의 가격 정책 정의
 * 하나의 상품에 여러 요금제 가능 (월간/연간 등)
 *
 * @field id - 기본 식별자 (UUID)
 * @field productId - 상품 연결 (필수, billing_products.id 참조)
 * @field externalPlanId - 외부 결제 시스템 가격/플랜 ID (nullable)
 * @field name - 요금제명 (예: "월간 구독", "연간 구독 (20% 할인)")
 * @field description - 요금제 설명
 * @field isActive - 활성화 여부
 * @field isDefault - 기본 요금제 여부 (상품당 하나만 기본값 가능)
 * @field currency - 통화 코드 (ISO 4217, 기본값: KRW)
 * @field amount - 금액 (최소 단위, 예: 원, 센트)
 * @field planType - 요금제 타입 (one_time: 일회성, recurring: 정기)
 * @field billingInterval - 결제 주기 (day/week/month/year, 정기 결제 시)
 * @field intervalCount - 주기 횟수 (예: 3개월마다 = interval: month, count: 3)
 * @field trialDays - 체험 기간 (일 단위)
 * @field featuresOverride - 이 요금제만의 추가/제외 기능 (상품 features 오버라이드, JSONB)
 * @field metadata - 추가 메타데이터 (JSONB)
 * @field createdAt - 생성 시간
 * @field updatedAt - 수정 시간
 *
 * @index billing_plans_product_id_idx - 상품별 요금제 조회
 * @index billing_plans_active_idx - 활성 요금제만 조회
 */
export const billingPlans = pgTable(
  "billing_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => billingProducts.id, { onDelete: "cascade" }),
    externalPlanId: varchar("external_plan_id", { length: 255 }).unique(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").default(false),
    currency: varchar("currency", { length: 3 }).notNull().default("KRW"),
    amount: bigint("amount", { mode: "number" }).notNull(),
    planType: planTypeEnum("plan_type").notNull().default("recurring"),
    billingInterval: planIntervalEnum("billing_interval").default("month"),
    intervalCount: integer("interval_count").default(1),
    trialDays: integer("trial_days").default(0),
    featuresOverride: jsonb("features_override"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productIdIdx: index("billing_plans_product_id_idx").on(table.productId),
    activeIdx: index("billing_plans_active_idx").on(table.isActive),
  }),
)

/**
 * 구독 테이블 (subscriptions)
 *
 * 워크스페이스의 구독 정보 관리
 * 1 Workspace : N Subscriptions 가능 (메인 구독 + 애드온)
 * isPrimary로 메인 구독 구분
 *
 * @field id - 기본 식별자 (UUID)
 * @field workspaceId - 워크스페이스 연결 (필수, workspaces.id 참조)
 * @field customerId - 결제 고객 연결 (필수, billing_customers.id 참조)
 * @field planId - 요금제 연결 (필수, billing_plans.id 참조)
 * @field externalSubscriptionId - 외부 결제 시스템 구독 ID (nullable)
 * @field status - 구독 상태 (trialing/active/canceled/incomplete/past_due/unpaid/paused)
 * @field isPrimary - 메인 구독 여부 (워크스페이스당 하나의 메인 구독)
 * @field quantity - 수량 (좌석 기반 과금 시 사용)
 * @field cancelAtPeriodEnd - 기간 종료 시 취소 예정 여부
 * @field currentPeriodStart - 현재 결제 기간 시작
 * @field currentPeriodEnd - 현재 결제 기간 종료
 * @field trialStart - 체험 기간 시작
 * @field trialEnd - 체험 기간 종료
 * @field canceledAt - 취소 시간
 * @field cancelReason - 취소 사유
 * @field endedAt - 완전 종료 시간
 * @field metadata - 추가 메타데이터 (JSONB)
 * @field createdAt - 생성 시간
 * @field updatedAt - 수정 시간
 *
 * @index subscriptions_workspace_id_idx - 워크스페이스별 구독 조회
 * @index subscriptions_customer_id_idx - 고객별 구독 조회
 * @index subscriptions_status_idx - 상태별 조회
 * @index subscriptions_period_end_idx - 기간 종료일 기준 조회 (갱신 처리용)
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => billingCustomers.id),
    planId: uuid("plan_id")
      .notNull()
      .references(() => billingPlans.id),
    externalSubscriptionId: varchar("external_subscription_id", {
      length: 255,
    }).unique(),
    status: subscriptionStatusEnum("status").notNull().default("trialing"),
    isPrimary: boolean("is_primary").notNull().default(true),
    quantity: integer("quantity").notNull().default(1),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    trialStart: timestamp("trial_start", { withTimezone: true }),
    trialEnd: timestamp("trial_end", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdIdx: index("subscriptions_workspace_id_idx").on(table.workspaceId),
    customerIdIdx: index("subscriptions_customer_id_idx").on(table.customerId),
    statusIdx: index("subscriptions_status_idx").on(table.status),
    periodEndIdx: index("subscriptions_period_end_idx").on(table.currentPeriodEnd),
  }),
)

/**
 * 구독 이력 테이블 (subscription_history)
 *
 * 구독 변경 이력 추적 (업그레이드, 다운그레이드, 취소 등)
 *
 * @field id - 기본 식별자 (UUID)
 * @field subscriptionId - 구독 연결 (필수, subscriptions.id 참조)
 * @field previousPlanId - 이전 요금제 (billing_plans.id 참조)
 * @field newPlanId - 새 요금제 (billing_plans.id 참조)
 * @field previousStatus - 이전 상태
 * @field newStatus - 새 상태
 * @field changeType - 변경 유형 (created/upgraded/downgraded/canceled/renewed/reactivated)
 * @field changeReason - 변경 사유
 * @field changedBy - 변경한 사용자 (시스템 자동 변경 시 null, users.id 참조)
 * @field createdAt - 생성 시간
 *
 * @index subscription_history_subscription_id_idx - 구독별 이력 조회
 * @index subscription_history_change_type_idx - 변경 유형별 조회
 * @index subscription_history_created_at_idx - 시간순 조회
 */
export const subscriptionHistory = pgTable(
  "subscription_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    previousPlanId: uuid("previous_plan_id").references(() => billingPlans.id),
    newPlanId: uuid("new_plan_id").references(() => billingPlans.id),
    previousStatus: subscriptionStatusEnum("previous_status"),
    newStatus: subscriptionStatusEnum("new_status"),
    changeType: varchar("change_type", { length: 50 }).notNull(),
    changeReason: text("change_reason"),
    changedBy: uuid("changed_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    subscriptionIdIdx: index("subscription_history_subscription_id_idx").on(table.subscriptionId),
    changeTypeIdx: index("subscription_history_change_type_idx").on(table.changeType),
    createdAtIdx: index("subscription_history_created_at_idx").on(table.createdAt),
  }),
)

// ============================================================================
// Relations (관계 정의)
// ============================================================================

export const billingCustomersRelations = relations(billingCustomers, ({ one, many }) => ({
  user: one(users, {
    fields: [billingCustomers.userId],
    references: [users.id],
  }),
  subscriptions: many(subscriptions),
}))

export const billingProductsRelations = relations(billingProducts, ({ many }) => ({
  plans: many(billingPlans),
}))

export const billingPlansRelations = relations(billingPlans, ({ one, many }) => ({
  product: one(billingProducts, {
    fields: [billingPlans.productId],
    references: [billingProducts.id],
  }),
  subscriptions: many(subscriptions),
  prices: many(planPrices),
}))

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [subscriptions.workspaceId],
    references: [workspaces.id],
  }),
  customer: one(billingCustomers, {
    fields: [subscriptions.customerId],
    references: [billingCustomers.id],
  }),
  plan: one(billingPlans, {
    fields: [subscriptions.planId],
    references: [billingPlans.id],
  }),
  history: many(subscriptionHistory),
}))

export const subscriptionHistoryRelations = relations(subscriptionHistory, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [subscriptionHistory.subscriptionId],
    references: [subscriptions.id],
  }),
  previousPlan: one(billingPlans, {
    fields: [subscriptionHistory.previousPlanId],
    references: [billingPlans.id],
  }),
  newPlan: one(billingPlans, {
    fields: [subscriptionHistory.newPlanId],
    references: [billingPlans.id],
  }),
  changedByUser: one(users, {
    fields: [subscriptionHistory.changedBy],
    references: [users.id],
  }),
}))

// ============================================================================
// Type Exports (타입 내보내기)
// ============================================================================

export type BillingCustomer = typeof billingCustomers.$inferSelect
export type NewBillingCustomer = typeof billingCustomers.$inferInsert
export type BillingProduct = typeof billingProducts.$inferSelect
export type NewBillingProduct = typeof billingProducts.$inferInsert
export type BillingPlan = typeof billingPlans.$inferSelect
export type NewBillingPlan = typeof billingPlans.$inferInsert
export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
export type SubscriptionHistory = typeof subscriptionHistory.$inferSelect
export type NewSubscriptionHistory = typeof subscriptionHistory.$inferInsert

export type {
  PlanInterval,
  PlanType,
  SubscriptionStatus,
  SubscriptionTier,
} from "./enums"

// ============================================================================
// Billing Keys Table (빌링키 저장)
// ============================================================================

/**
 * 빌링키 테이블 (billing_keys)
 *
 * 토스페이먼츠 빌링키(자동결제용)를 저장
 * - 빌링키는 발급 시 한 번만 조회 가능하므로 반드시 저장 필요
 * - customerKey와 1:1 매핑
 *
 * @field id - 기본 식별자 (UUID)
 * @field customerId - 결제 고객 연결 (nullable, billing_customers.id 참조)
 * @field customerKey - 토스페이먼츠 고객 키 (프론트엔드에서 생성한 UUID)
 * @field billingKey - 토스페이먼츠 빌링키 (암호화된 결제 정보)
 * @field cardCompany - 카드사 (예: "삼성", "현대", "신한")
 * @field cardNumber - 마스킹된 카드번호 (예: "53275002****335*")
 * @field cardType - 카드 타입 (신용/체크/기프트/미확인)
 * @field ownerType - 소유자 타입 (개인/법인/미확인)
 * @field authenticatedAt - 카드 인증 시간
 * @field isActive - 활성화 여부 (삭제 시 false)
 * @field metadata - 추가 메타데이터 (JSONB)
 * @field createdAt - 생성 시간
 * @field updatedAt - 수정 시간
 *
 * @index billing_keys_customer_key_idx - customerKey로 빠른 조회
 * @index billing_keys_billing_key_idx - billingKey로 빠른 조회
 */
export const billingKeys = pgTable(
  "billing_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id").references(() => billingCustomers.id),
    customerKey: varchar("customer_key", { length: 255 }).notNull().unique(),
    billingKey: varchar("billing_key", { length: 255 }).notNull().unique(),
    cardCompany: varchar("card_company", { length: 50 }),
    cardNumber: varchar("card_number", { length: 50 }),
    cardType: varchar("card_type", { length: 20 }),
    ownerType: varchar("owner_type", { length: 20 }),
    authenticatedAt: timestamp("authenticated_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    customerKeyIdx: index("billing_keys_customer_key_idx").on(table.customerKey),
    billingKeyIdx: index("billing_keys_billing_key_idx").on(table.billingKey),
    customerIdIdx: index("billing_keys_customer_id_idx").on(table.customerId),
    activeIdx: index("billing_keys_active_idx").on(table.isActive),
  }),
)

// ============================================================================
// Multi-Currency Support Tables (다중 통화 지원)
// ============================================================================

/**
 * 요금제 가격 테이블 (plan_prices)
 *
 * 하나의 요금제에 여러 통화 가격을 설정할 수 있음
 * - KRW: 원화 (한국 고객)
 * - USD: 달러 (해외 고객)
 *
 * @field id - 기본 식별자 (UUID)
 * @field planId - 요금제 연결 (billing_plans.id 참조)
 * @field currency - 통화 코드 (ISO 4217: KRW, USD, JPY 등)
 * @field amount - 금액 (minor unit: 원, 센트)
 * @field isPrimary - 기본 표시 통화 여부
 * @field displayAmount - 표시용 문자열 ("₩9,900", "$9.99")
 * @field createdAt - 생성 시간
 * @field updatedAt - 수정 시간
 *
 * @unique (planId, currency) - 요금제당 통화는 유일
 */
export const planPrices = pgTable(
  "plan_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => billingPlans.id, { onDelete: "cascade" }),
    currency: varchar("currency", { length: 3 }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    isPrimary: boolean("is_primary").default(false),
    displayAmount: varchar("display_amount", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    planIdIdx: index("plan_prices_plan_id_idx").on(table.planId),
    currencyIdx: index("plan_prices_currency_idx").on(table.currency),
    uniquePlanCurrency: index("plan_prices_unique_idx").on(table.planId, table.currency),
  }),
)

/**
 * 환율 캐시 테이블 (exchange_rates)
 *
 * 외부 API에서 조회한 환율을 캐시하여 API 호출 최소화
 * 기본 6시간 캐시, 만료 시 재조회
 *
 * @field id - 기본 식별자 (UUID)
 * @field baseCurrency - 기준 통화 (기본: USD)
 * @field targetCurrency - 대상 통화 (KRW, JPY 등)
 * @field rate - 환율 (1 USD = ? KRW)
 * @field source - 데이터 출처 ('exchangerate-api', 'manual')
 * @field fetchedAt - 조회 시간
 * @field expiresAt - 만료 시간
 *
 * @unique (baseCurrency, targetCurrency) - 통화 쌍은 유일
 */
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    baseCurrency: varchar("base_currency", { length: 3 }).notNull().default("USD"),
    targetCurrency: varchar("target_currency", { length: 3 }).notNull(),
    rate: varchar("rate", { length: 30 }).notNull(), // decimal stored as string
    source: varchar("source", { length: 50 }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => ({
    currenciesIdx: index("exchange_rates_currencies_idx").on(
      table.baseCurrency,
      table.targetCurrency,
    ),
    uniqueCurrencyPair: index("exchange_rates_unique_idx").on(
      table.baseCurrency,
      table.targetCurrency,
    ),
  }),
)

// ============================================================================
// Multi-Currency Relations
// ============================================================================

export const planPricesRelations = relations(planPrices, ({ one }) => ({
  plan: one(billingPlans, {
    fields: [planPrices.planId],
    references: [billingPlans.id],
  }),
}))

export const billingKeysRelations = relations(billingKeys, ({ one }) => ({
  customer: one(billingCustomers, {
    fields: [billingKeys.customerId],
    references: [billingCustomers.id],
  }),
}))

// ============================================================================
// Multi-Currency Type Exports
// ============================================================================

export type PlanPrice = typeof planPrices.$inferSelect
export type NewPlanPrice = typeof planPrices.$inferInsert
export type ExchangeRate = typeof exchangeRates.$inferSelect
export type NewExchangeRate = typeof exchangeRates.$inferInsert
export type BillingKey = typeof billingKeys.$inferSelect
export type NewBillingKey = typeof billingKeys.$inferInsert
