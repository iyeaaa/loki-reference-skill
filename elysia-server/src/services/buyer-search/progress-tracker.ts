/**
 * Progress Tracker - 검색 진행 상황 추적
 *
 * Phase별 진행 상황을 추적하고 콜백을 통해 알림
 * - Discovery: 회사 검색 (0-40%)
 * - Enrichment: 담당자 정보 수집 (40-80%)
 * - Fill: 부족분 채우기 (80-95%)
 * - Complete: 완료 (100%)
 */

import type { ProgressCallback, ProgressEvent, SearchPhase } from "./types"

// ==================== PHASE CONFIGURATION ====================

/**
 * Phase별 진행률 범위
 */
const PHASE_RANGES: Record<SearchPhase, { start: number; end: number }> = {
  init: { start: 0, end: 5 },
  discovery: { start: 5, end: 40 },
  enrichment: { start: 40, end: 80 },
  fill: { start: 80, end: 95 },
  complete: { start: 100, end: 100 },
  error: { start: 0, end: 0 },
}

/**
 * Phase별 기본 메시지 (한국어)
 */
const PHASE_MESSAGES_KO: Record<SearchPhase, string> = {
  init: "검색 준비 중...",
  discovery: "바이어 회사 검색 중...",
  enrichment: "담당자 정보 수집 중...",
  fill: "추가 바이어 검색 중...",
  complete: "검색 완료!",
  error: "오류가 발생했습니다.",
}

/**
 * Phase별 기본 메시지 (영어)
 */
const PHASE_MESSAGES_EN: Record<SearchPhase, string> = {
  init: "Preparing search...",
  discovery: "Finding buyer companies...",
  enrichment: "Gathering contact information...",
  fill: "Finding additional buyers...",
  complete: "Search complete!",
  error: "An error occurred.",
}

// ==================== PROGRESS TRACKER CLASS ====================

/**
 * Progress Tracker 옵션
 */
export interface ProgressTrackerOptions {
  /** 목표 결과 수 */
  targetCount: number
  /** 언어 (ko/en) */
  locale?: "ko" | "en"
  /** 진행 상황 콜백 */
  onProgress?: ProgressCallback
}

/**
 * Progress Tracker
 *
 * 검색 진행 상황을 추적하고 콜백으로 알림
 */
export class ProgressTracker {
  private phase: SearchPhase = "init"
  private phaseProgress = 0
  private resultsFound = 0
  private readonly targetCount: number
  private readonly locale: "ko" | "en"
  private readonly onProgress?: ProgressCallback
  private details: {
    discovery?: { found: number; target: number }
    enrichment?: { completed: number; total: number }
    fill?: { attempts: number; maxAttempts: number }
  } = {}
  private currentCompany?: string

  constructor(options: ProgressTrackerOptions) {
    this.targetCount = options.targetCount
    this.locale = options.locale || "ko"
    this.onProgress = options.onProgress
  }

  /**
   * 현재 Phase 설정
   */
  setPhase(phase: SearchPhase, message?: string): void {
    this.phase = phase
    this.phaseProgress = 0
    this.emit(message)
  }

  /**
   * Phase 내 진행률 업데이트
   */
  updatePhaseProgress(progress: number, message?: string): void {
    this.phaseProgress = Math.min(100, Math.max(0, progress))
    this.emit(message)
  }

  /**
   * 결과 수 업데이트
   */
  updateResultsFound(count: number): void {
    this.resultsFound = count
  }

  /**
   * 현재 처리 중인 회사 설정
   */
  setCurrentCompany(companyName?: string): void {
    this.currentCompany = companyName
  }

  /**
   * Discovery Phase 세부 정보 업데이트
   */
  updateDiscoveryDetails(found: number, target: number): void {
    this.details.discovery = { found, target }
    const progress = target > 0 ? (found / target) * 100 : 0
    this.updatePhaseProgress(progress)
  }

  /**
   * Enrichment Phase 세부 정보 업데이트
   */
  updateEnrichmentDetails(completed: number, total: number): void {
    this.details.enrichment = { completed, total }
    const progress = total > 0 ? (completed / total) * 100 : 0
    this.updatePhaseProgress(progress)
  }

  /**
   * Fill Phase 세부 정보 업데이트
   */
  updateFillDetails(attempts: number, maxAttempts: number): void {
    this.details.fill = { attempts, maxAttempts }
    const progress = maxAttempts > 0 ? (attempts / maxAttempts) * 100 : 0
    this.updatePhaseProgress(progress)
  }

  /**
   * 에러 발생
   */
  setError(message?: string): void {
    this.phase = "error"
    this.emit(message)
  }

  /**
   * 완료
   */
  setComplete(): void {
    this.phase = "complete"
    this.phaseProgress = 100
    this.emit()
  }

  /**
   * 현재 상태 가져오기
   */
  getState(): ProgressEvent {
    return this.buildEvent()
  }

  /**
   * 전체 진행률 계산
   */
  private calculateOverallProgress(): number {
    const range = PHASE_RANGES[this.phase]
    const phaseWidth = range.end - range.start
    return range.start + (phaseWidth * this.phaseProgress) / 100
  }

  /**
   * 기본 메시지 가져오기
   */
  private getDefaultMessage(): string {
    const messages = this.locale === "ko" ? PHASE_MESSAGES_KO : PHASE_MESSAGES_EN
    return messages[this.phase]
  }

  /**
   * ProgressEvent 빌드
   */
  private buildEvent(customMessage?: string): ProgressEvent {
    return {
      phase: this.phase,
      progress: this.calculateOverallProgress(),
      phaseProgress: this.phaseProgress,
      message: customMessage || this.getDefaultMessage(),
      resultsFound: this.resultsFound,
      targetCount: this.targetCount,
      currentCompany: this.currentCompany,
      details: Object.keys(this.details).length > 0 ? { ...this.details } : undefined,
    }
  }

  /**
   * 콜백 호출
   */
  private emit(customMessage?: string): void {
    if (this.onProgress) {
      this.onProgress(this.buildEvent(customMessage))
    }
  }
}

// ==================== FACTORY FUNCTION ====================

/**
 * ProgressTracker 인스턴스 생성
 */
export function createProgressTracker(options: ProgressTrackerOptions): ProgressTracker {
  return new ProgressTracker(options)
}
