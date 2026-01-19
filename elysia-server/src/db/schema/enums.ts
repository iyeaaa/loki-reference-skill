/**
 * 공통 Enum 정의
 *
 * 순환 참조 방지를 위해 여러 스키마에서 사용되는 enum을 별도 파일로 분리
 */

import { pgEnum } from "drizzle-orm/pg-core"

// ============================================================================
// Subscription Enums (구독 관련)
// ============================================================================

/**
 * 구독 등급
 * - trial: 무료 체험 (기능 제한)
 * - basic: 기본 요금제
 * - pro: 프로 요금제 (셀프 서빙)
 * - enterprise: 엔터프라이즈 (전체 기능)
 */
export const subscriptionTierEnum = pgEnum("subscription_tier_enum", [
  "trial",
  "basic",
  "pro",
  "enterprise",
])

/**
 * 구독 상태
 * - trialing: 체험 기간
 * - active: 활성 구독
 * - canceled: 취소됨 (기간 종료 후 만료)
 * - incomplete: 결제 미완료
 * - incomplete_expired: 결제 미완료 후 만료
 * - past_due: 결제 연체
 * - unpaid: 미결제
 * - paused: 일시 정지
 */
export const subscriptionStatusEnum = pgEnum("subscription_status_enum", [
  "trialing",
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "unpaid",
  "paused",
  "expired", // Trial expired without payment
])

/**
 * 요금제 타입
 * - one_time: 일회성 결제
 * - recurring: 정기 결제 (구독)
 */
export const planTypeEnum = pgEnum("plan_type_enum", ["one_time", "recurring"])

/**
 * 결제 주기
 * - day: 일간
 * - week: 주간
 * - month: 월간
 * - year: 연간
 */
export const planIntervalEnum = pgEnum("plan_interval_enum", ["day", "week", "month", "year"])

// ============================================================================
// IAM Enums (권한 관련)
// ============================================================================

/**
 * 정책 효과
 * - allow: 허용 (명시적 허용)
 * - deny: 거부 (명시적 거부, allow보다 우선)
 */
export const policyEffectEnum = pgEnum("policy_effect_enum", ["allow", "deny"])

// ============================================================================
// Type Exports (타입 내보내기)
// ============================================================================

export type SubscriptionTier = (typeof subscriptionTierEnum.enumValues)[number]
export type SubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number]
export type PlanType = (typeof planTypeEnum.enumValues)[number]
export type PlanInterval = (typeof planIntervalEnum.enumValues)[number]
export type PolicyEffect = (typeof policyEffectEnum.enumValues)[number]
