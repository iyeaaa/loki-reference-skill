/**
 * Survey Data Store (Jotai + localStorage)
 *
 * 설문 데이터를 localStorage에 persist하여 관리
 * - 새로고침/탭 닫기에도 데이터 유지
 * - /company 진입 시 DB에 저장 후 클리어
 *
 * 2025년 최적화:
 * - Hydration 안전한 동기적 localStorage 접근
 * - 부분 업데이트 지원으로 데이터 손실 방지
 */

import { atom } from "jotai"
import { atomWithStorage, createJSONStorage } from "jotai/utils"

// ====================================
// TYPES
// ====================================

export type SurveyData = {
  industry: string | null
  target: string | null
  country: string | null
  experience: string | null
  lang?: string
}

/** 유효성 검증을 통과한 설문 데이터 (industry, country만 필수) */
export type ValidSurveyData = {
  industry: string
  target: string | null
  country: string
  experience: string | null
  lang?: string
}

// ====================================
// CONSTANTS
// ====================================

export const SURVEY_STORAGE_KEY = "rinda_survey_data"

const EMPTY_SURVEY: SurveyData = {
  industry: null,
  target: null,
  country: null,
  experience: null,
}

// ====================================
// STORAGE UTILITIES (Hydration-safe)
// ====================================

/**
 * localStorage에서 직접 survey 데이터 읽기 (동기적, hydration-safe)
 * Jotai atom이 hydration되기 전에도 안전하게 사용 가능
 */
export function getSurveyFromStorage(): SurveyData | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const stored = localStorage.getItem(SURVEY_STORAGE_KEY)
    if (!stored) {
      return null
    }
    return JSON.parse(stored) as SurveyData
  } catch {
    return null
  }
}

/**
 * localStorage에 survey 데이터 저장 (동기적)
 */
export function saveSurveyToStorage(data: SurveyData | null): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    if (data === null) {
      localStorage.removeItem(SURVEY_STORAGE_KEY)
    } else {
      localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(data))
    }
  } catch (e) {
    console.error("[Survey] Failed to save to localStorage:", e)
  }
}

/**
 * 기존 데이터를 유지하면서 부분 업데이트 (핵심 기능)
 * - 새로고침 후에도 이전 스텝 데이터 보존
 * - null 값만 업데이트하고 기존 값은 유지
 */
export function updateSurveyField<K extends keyof SurveyData>(
  field: K,
  value: SurveyData[K],
): SurveyData {
  const existing = getSurveyFromStorage() ?? EMPTY_SURVEY
  const updated = { ...existing, [field]: value }
  saveSurveyToStorage(updated)
  return updated
}

/**
 * 여러 필드를 한 번에 업데이트 (기존 데이터 유지)
 */
export function mergeSurveyData(partial: Partial<SurveyData>): SurveyData {
  const existing = getSurveyFromStorage() ?? EMPTY_SURVEY
  const updated = { ...existing, ...partial }
  saveSurveyToStorage(updated)
  return updated
}

/**
 * Survey 데이터 클리어
 */
export function clearSurveyStorage(): void {
  saveSurveyToStorage(null)
}

// ====================================
// JOTAI ATOMS
// ====================================

/**
 * 동기적 JSON Storage 생성 (hydration 문제 해결)
 */
const syncStorage = createJSONStorage<SurveyData | null>(() => localStorage)

/**
 * 설문 데이터 atom (localStorage persist)
 * - getOnInit: true로 초기 렌더링 시 localStorage 값 동기적 로드
 */
export const surveyDataAtom = atomWithStorage<SurveyData | null>(
  SURVEY_STORAGE_KEY,
  null,
  syncStorage,
  { getOnInit: true },
)

/**
 * 설문 완료 여부 (derived atom)
 */
export const isSurveyCompleteAtom = atom((get) => {
  const data = get(surveyDataAtom)
  return isValidSurveyData(data)
})

// ====================================
// VALIDATION HELPERS
// ====================================

/**
 * 설문 데이터 유효성 검사 (industry, country 필수)
 * Type guard: 검증 통과 시 ValidSurveyData로 타입 좁힘
 */
export function isValidSurveyData(data: SurveyData | null): data is ValidSurveyData {
  return !!(data?.industry && data?.country)
}

/**
 * 특정 스텝까지 완료되었는지 검사 (2단계 플로우)
 * Step 1: 산업군 선택
 * Step 2: 국가 선택
 */
export function isSurveyStepComplete(data: SurveyData | null, step: number): boolean {
  if (!data) {
    return false
  }

  switch (step) {
    case 1:
      return !!data.industry
    case 2:
      return !!(data.industry && data.country)
    default:
      return false
  }
}

/**
 * 완료된 마지막 스텝 번호 반환 (2단계 플로우)
 */
export function getLastCompletedStep(data: SurveyData | null): number {
  if (!data) {
    return 0
  }
  if (data.country) {
    return 2
  }
  if (data.industry) {
    return 1
  }
  return 0
}

/**
 * 기존 sessionStorage 데이터 마이그레이션 (backward compatibility)
 * - NewTrialPage에서 사용하던 sessionStorage 데이터를 Jotai로 이전
 */
export function migrateFromSessionStorage(): SurveyData | null {
  if (typeof window === "undefined") {
    return null
  }

  const OLD_KEY = "onboarding_params"
  const stored = sessionStorage.getItem(OLD_KEY)

  if (stored) {
    try {
      const data = JSON.parse(stored) as SurveyData
      sessionStorage.removeItem(OLD_KEY) // 마이그레이션 후 삭제
      return data
    } catch {
      sessionStorage.removeItem(OLD_KEY)
    }
  }

  return null
}
