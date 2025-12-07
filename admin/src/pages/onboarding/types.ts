export type Industry =
  | "manufacturing"
  | "it_saas"
  | "beauty"
  | "food"
  | "fashion"
  | "electronics"
  | "healthcare"
  | "guitar"
export type TargetCustomer = "b2b" | "b2c" | "both"
export type TargetCountry = "jp" | "us" | "sea" | "eu" | "cn" | "ae"
export type ExportExperience = "none" | "some" | "experienced"

export interface OnboardingData {
  industry: Industry | null
  target: TargetCustomer | null
  country: TargetCountry | null
  experience: ExportExperience | null
}

export const TOTAL_STEPS = 4

export const INDUSTRIES: Industry[] = [
  "manufacturing",
  "it_saas",
  "beauty",
  "food",
  "fashion",
  "electronics",
  "healthcare",
  "guitar",
]
export const TARGET_CUSTOMERS: TargetCustomer[] = ["b2b", "b2c", "both"]
export const TARGET_COUNTRIES: TargetCountry[] = ["jp", "us", "sea", "eu", "cn", "ae"]
export const EXPORT_EXPERIENCES: ExportExperience[] = ["none", "some", "experienced"]
