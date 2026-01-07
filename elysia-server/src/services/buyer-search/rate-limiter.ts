/**
 * Rate Limiter - Semaphore + Dual Rate Limit Management
 *
 * Hunter.io API Rate Limits:
 * - Discover API: 5/sec, 50/min
 * - Domain Search API: 15/sec, 500/min
 *
 * 공격적 병렬화를 지원하면서 Rate Limit을 준수
 * - Semaphore: 동시 실행 수 제한
 * - Exponential Backoff: 재시도 시 지수적 대기
 */

import PQueue from "p-queue"
import pRetry, { AbortError } from "p-retry"

// ==================== RATE LIMIT CONFIGURATIONS ====================

/**
 * Rate Limit 설정
 */
export interface RateLimitConfig {
  /** 초당 최대 요청 수 */
  requestsPerSecond: number
  /** 분당 최대 요청 수 */
  requestsPerMinute: number
  /** 최대 동시 실행 수 */
  maxConcurrency: number
}

/**
 * Hunter.io Discover API Rate Limits
 */
export const HUNTER_DISCOVER_RATE_LIMIT: RateLimitConfig = {
  requestsPerSecond: 5,
  requestsPerMinute: 50,
  maxConcurrency: 10,
}

/**
 * Hunter.io Domain Search API Rate Limits
 */
export const HUNTER_DOMAIN_SEARCH_RATE_LIMIT: RateLimitConfig = {
  requestsPerSecond: 15,
  requestsPerMinute: 500,
  maxConcurrency: 30,
}

// ==================== DUAL RATE LIMITER ====================

/**
 * 2단계 Rate Limiter (초 + 분)
 *
 * 요청은 반드시 두 개의 큐를 모두 통과해야 함
 * - Tier 1: 분당 제한
 * - Tier 2: 초당 제한
 */
export class DualRateLimiter {
  private readonly minuteQueue: PQueue
  private readonly secondQueue: PQueue

  constructor(config: RateLimitConfig, _name: string) {
    // Tier 1: 분당 제한
    this.minuteQueue = new PQueue({
      intervalCap: config.requestsPerMinute,
      interval: 60000,
      carryoverConcurrencyCount: true,
    })

    // Tier 2: 초당 제한
    this.secondQueue = new PQueue({
      intervalCap: config.requestsPerSecond,
      interval: 1000,
      carryoverConcurrencyCount: true,
      concurrency: config.maxConcurrency,
    })
  }

  /**
   * Rate Limit을 적용하여 함수 실행
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.minuteQueue.add(() => this.secondQueue.add(fn)) as Promise<T>
  }

  /**
   * 현재 큐 상태 조회
   */
  getStatus(): {
    minuteQueue: { size: number; pending: number }
    secondQueue: { size: number; pending: number }
  } {
    return {
      minuteQueue: {
        size: this.minuteQueue.size,
        pending: this.minuteQueue.pending,
      },
      secondQueue: {
        size: this.secondQueue.size,
        pending: this.secondQueue.pending,
      },
    }
  }

  /**
   * 큐 비우기 (테스트용)
   */
  clear(): void {
    this.minuteQueue.clear()
    this.secondQueue.clear()
  }
}

// ==================== RETRY CONFIGURATION ====================

/**
 * 재시도 설정
 */
export interface RetryConfig {
  /** 최대 재시도 횟수 */
  maxRetries: number
  /** 초기 대기 시간 (ms) */
  minTimeout: number
  /** 최대 대기 시간 (ms) */
  maxTimeout: number
  /** 지수적 증가 배율 */
  factor: number
}

/**
 * 기본 재시도 설정 (Exponential Backoff)
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  minTimeout: 1000,
  maxTimeout: 10000,
  factor: 2,
}

/**
 * 공격적 재시도 설정 (빠른 재시도)
 */
export const AGGRESSIVE_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  minTimeout: 500,
  maxTimeout: 5000,
  factor: 1.5,
}

// ==================== RETRY WRAPPER ====================

/**
 * Exponential Backoff으로 함수 실행
 *
 * @param fn - 실행할 함수
 * @param config - 재시도 설정
 * @param onRetry - 재시도 시 콜백
 * @returns 함수 실행 결과
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: unknown) => void,
): Promise<T> {
  return pRetry(fn, {
    retries: config.maxRetries,
    minTimeout: config.minTimeout,
    maxTimeout: config.maxTimeout,
    factor: config.factor,
    onFailedAttempt: (error) => {
      if (onRetry) {
        onRetry(error.attemptNumber, error instanceof Error ? error : new Error(String(error)))
      }
    },
  })
}

/**
 * 재시도 불가능한 에러로 중단
 */
export function abortRetry(message: string): never {
  throw new AbortError(message)
}

// ==================== RATE LIMIT WITH RETRY ====================

/**
 * Rate Limit + Retry 조합 실행기
 *
 * Rate Limit을 준수하면서 실패 시 자동 재시도
 */
export class RateLimitedExecutor {
  private readonly rateLimiter: DualRateLimiter
  private readonly retryConfig: RetryConfig
  private readonly name: string

  constructor(
    rateLimitConfig: RateLimitConfig,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
    name: string = "executor",
  ) {
    this.rateLimiter = new DualRateLimiter(rateLimitConfig, name)
    this.retryConfig = retryConfig
    this.name = name
  }

  /**
   * Rate Limit + Retry로 함수 실행
   *
   * @param fn - 실행할 함수
   * @param onRetry - 재시도 시 콜백
   * @returns 함수 실행 결과
   */
  async execute<T>(
    fn: () => Promise<T>,
    onRetry?: (attempt: number, error: Error) => void,
  ): Promise<T> {
    return this.rateLimiter.execute(() =>
      withRetry(fn, this.retryConfig, (attempt, err) => {
        const error = err instanceof Error ? err : new Error(String(err))
        console.log(
          `[${this.name}] Retry attempt ${attempt}/${this.retryConfig.maxRetries}: ${error.message}`,
        )
        if (onRetry) {
          onRetry(attempt, error)
        }
      }),
    )
  }

  /**
   * 여러 작업 병렬 실행 (Rate Limit 준수)
   *
   * @param tasks - 실행할 작업 목록
   * @param onProgress - 진행 상황 콜백
   * @returns 작업 결과 목록
   */
  async executeBatch<T, R>(
    tasks: T[],
    executor: (task: T) => Promise<R>,
    onProgress?: (completed: number, total: number) => void,
  ): Promise<R[]> {
    let completed = 0
    const total = tasks.length

    const results = await Promise.all(
      tasks.map((task) =>
        this.execute(async () => {
          const result = await executor(task)
          completed++
          if (onProgress) {
            onProgress(completed, total)
          }
          return result
        }),
      ),
    )

    return results
  }

  /**
   * 현재 상태 조회
   */
  getStatus() {
    return this.rateLimiter.getStatus()
  }
}

// ==================== SINGLETON EXECUTORS ====================

// Hunter Discover Executor (공유)
let discoverExecutor: RateLimitedExecutor | null = null

/**
 * Hunter Discover API 실행기 가져오기 (싱글톤)
 */
export function getDiscoverExecutor(): RateLimitedExecutor {
  if (!discoverExecutor) {
    discoverExecutor = new RateLimitedExecutor(
      HUNTER_DISCOVER_RATE_LIMIT,
      AGGRESSIVE_RETRY_CONFIG,
      "HunterDiscover",
    )
  }
  return discoverExecutor
}

// Hunter Domain Search Executor (공유)
let domainSearchExecutor: RateLimitedExecutor | null = null

/**
 * Hunter Domain Search API 실행기 가져오기 (싱글톤)
 */
export function getDomainSearchExecutor(): RateLimitedExecutor {
  if (!domainSearchExecutor) {
    domainSearchExecutor = new RateLimitedExecutor(
      HUNTER_DOMAIN_SEARCH_RATE_LIMIT,
      AGGRESSIVE_RETRY_CONFIG,
      "HunterDomainSearch",
    )
  }
  return domainSearchExecutor
}
