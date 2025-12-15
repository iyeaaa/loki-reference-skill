/**
 * Survey Data Store (Jotai + localStorage)
 *
 * 설문 데이터를 localStorage에 persist하여 관리
 * - 새로고침/탭 닫기에도 데이터 유지
 * - /company 진입 시 DB에 저장 후 클리어
 */

import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

// ====================================
// TYPES
// ====================================

export interface SurveyData {
  industry: string | null
  target: string | null
  country: string | null
  experience: string | null
  lang?: string
}

// ====================================
// ATOMS
// ====================================

const STORAGE_KEY = "rinda_survey_data"

/**
 * 설문 데이터 atom (localStorage persist)
 * - 설문 페이지에서 저장
 * - /company 진입 시 DB 저장 후 클리어
 */
export const surveyDataAtom = atomWithStorage<SurveyData | null>(STORAGE_KEY, null)

/**
 * 설문 완료 여부 (derived atom)
 */
export const isSurveyCompleteAtom = atom((get) => {
  const data = get(surveyDataAtom)
  return !!(data?.industry && data?.target && data?.country && data?.experience)
})

// ====================================
// HELPERS
// ====================================

/**
 * 설문 데이터 유효성 검사
 */
export function isValidSurveyData(data: SurveyData | null): data is SurveyData {
  return !!(data?.industry && data?.target && data?.country && data?.experience)
}

/**
 * 기존 sessionStorage 데이터 마이그레이션
 * - NewTrialPage에서 사용하던 sessionStorage 데이터를 Jotai로 이전
 */
export function migrateFromSessionStorage(): SurveyData | null {
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
