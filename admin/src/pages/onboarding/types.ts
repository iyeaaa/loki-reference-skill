/**
 * Industry types for onboarding survey
 * 소비재 카테고리만 포함 (제조/부품, IT/소프트웨어, 헬스케어 제외)
 * 비소비재 기업은 산업군 버튼 아래 안내 섹션에서 상담으로 유도
 */
export type Industry = "beauty" | "food" | "fashion" | "electronics"

/**
 * Target customer types
 * Maps to Spec: B2B, B2C, BOTH
 */
export type TargetCustomer = "b2b" | "b2c" | "both"

/**
 * Target country types
 * 중국(cn) 제외
 */
export type TargetCountry = "jp" | "us" | "sea" | "eu" | "ae"

/**
 * Export experience types
 * Maps to Spec: INITIAL (none), JUNIOR (some), SENIOR (experienced)
 */
export type ExportExperience = "none" | "some" | "experienced"

export type OnboardingData = {
  industry: Industry | null
  target: TargetCustomer | null
  country: TargetCountry | null
  experience: ExportExperience | null
}

export const TOTAL_STEPS = 2

export const INDUSTRIES: Industry[] = ["beauty", "food", "fashion", "electronics"]
export const TARGET_CUSTOMERS: TargetCustomer[] = ["b2b", "b2c", "both"]
export const TARGET_COUNTRIES: TargetCountry[] = ["jp", "us", "sea", "eu", "ae"]
export const EXPORT_EXPERIENCES: ExportExperience[] = ["none", "some", "experienced"]
