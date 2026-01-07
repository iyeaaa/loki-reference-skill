/**
 * Buyer Search Cache - Redis Caching Wrapper
 *
 * 24시간 TTL의 Redis 캐싱
 * - 회사 검색 결과 캐싱
 * - 담당자 정보 캐싱
 * - 중복 API 호출 방지
 */

import { config } from "../../config"
import { hashString, RedisCache } from "../redis-cache.service"

// ==================== CACHE CONFIGURATION ====================

/**
 * 캐시 설정
 */
export interface CacheConfig {
  enabled: boolean
  keyPrefix: string
  ttlSeconds: number
  timeoutMs: number
}

/**
 * 기본 캐시 설정 (24시간 TTL)
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  keyPrefix: "buyer_search:v1:",
  ttlSeconds: 24 * 60 * 60, // 24시간
  timeoutMs: 250,
}

// ==================== CACHE KEY GENERATORS ====================

/**
 * 회사 검색 캐시 키 생성
 */
export function generateCompanySearchCacheKey(
  provider: string,
  params: Record<string, unknown>,
): string {
  // 키 정렬 및 해시
  const sortedParams = Object.keys(params)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = params[key]
        return acc
      },
      {} as Record<string, unknown>,
    )

  const paramsString = JSON.stringify(sortedParams)
  const hash = hashString(paramsString)
  return `company_search:${provider}:${hash}`
}

/**
 * 담당자 정보 캐시 키 생성
 */
export function generateContactCacheKey(
  provider: string,
  domain: string,
  criteria?: Record<string, unknown>,
): string {
  const criteriaHash = criteria ? hashString(JSON.stringify(criteria)) : "default"
  return `contact:${provider}:${domain}:${criteriaHash}`
}

/**
 * 도메인 정보 캐시 키 생성
 */
export function generateDomainCacheKey(provider: string, domain: string): string {
  return `domain:${provider}:${domain}`
}

// ==================== CACHE INSTANCE ====================

// 공유 캐시 인스턴스
let buyerSearchCache: RedisCache | null = null

/**
 * Buyer Search 캐시 인스턴스 가져오기 (싱글톤)
 */
export function getBuyerSearchCache(): RedisCache {
  if (!buyerSearchCache) {
    buyerSearchCache = RedisCache.fromConfig({
      enabled: config.cache.leadDiscovery.enabled,
      keyPrefix: DEFAULT_CACHE_CONFIG.keyPrefix,
      ttlMs: DEFAULT_CACHE_CONFIG.ttlSeconds * 1000,
      timeoutMs: DEFAULT_CACHE_CONFIG.timeoutMs,
    })
  }
  return buyerSearchCache
}

// ==================== CACHE UTILITIES ====================

/**
 * 캐시에서 가져오거나 계산 후 저장
 *
 * @param cacheKey - 캐시 키
 * @param compute - 캐시 미스 시 실행할 함수
 * @param ttlSeconds - TTL (기본: 24시간)
 * @returns { data, fromCache }
 */
export async function getOrSet<T>(
  cacheKey: string,
  compute: () => Promise<T>,
  ttlSeconds?: number,
): Promise<{ data: T; fromCache: boolean }> {
  const cache = getBuyerSearchCache()

  // 캐시 조회
  const cached = await cache.get<T>(cacheKey)
  if (cached !== null) {
    return { data: cached, fromCache: true }
  }

  // 계산 및 저장
  const data = await compute()
  await cache.set(cacheKey, data, ttlSeconds)
  return { data, fromCache: false }
}

/**
 * 여러 키 일괄 캐시 조회
 *
 * @param keys - 캐시 키 목록
 * @returns 캐시 데이터 Map
 */
export async function mget<T>(keys: string[]): Promise<Map<string, T>> {
  const cache = getBuyerSearchCache()
  return cache.mget<T>(keys)
}

/**
 * 여러 키 일괄 캐시 저장
 *
 * @param entries - 저장할 데이터 목록
 */
export async function mset<T>(
  entries: Array<{ key: string; value: T; ttl?: number }>,
): Promise<void> {
  const cache = getBuyerSearchCache()
  await cache.mset(entries)
}

/**
 * 캐시 삭제
 *
 * @param cacheKey - 삭제할 캐시 키
 */
export async function del(cacheKey: string): Promise<void> {
  const cache = getBuyerSearchCache()
  await cache.del(cacheKey)
}

/**
 * 캐시 존재 여부 확인
 *
 * @param cacheKey - 확인할 캐시 키
 */
export async function exists(cacheKey: string): Promise<boolean> {
  const cache = getBuyerSearchCache()
  return cache.exists(cacheKey)
}
