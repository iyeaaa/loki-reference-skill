/**
 * Fake Progress Store (Jotai)
 *
 * UX 개선을 위한 Fake Progress 상태 공유
 * - StepBuyerLoading와 NotificationBell 컴포넌트 간 동기화
 * - Popover 닫았다 열어도 상태 유지
 *
 * Algorithm: Ease-out Cubic with optimized timing
 * - 시작: 5% (즉시 진행 중임을 보여줌)
 * - 0-5초: 5% → 12% (빠른 시작, 체감 속도 ↑)
 * - 5-15초: 12% → 14.5% (점진적 감속)
 * - 15-30초: 14.5% → 15% (거의 멈춤, 실제 데이터 대기)
 */

import { atom, useAtom, useAtomValue } from "jotai"
import { useEffect, useRef } from "react"

// ============================================================================
// Types
// ============================================================================

type FakeProgressState = {
  // 각 workspaceId별 시작 시간 (컴포넌트 간 공유)
  startTimes: Record<string, number>
  // 각 workspaceId별 계산된 fake progress
  progressValues: Record<string, number>
}

// ============================================================================
// Atoms
// ============================================================================

const DEFAULT_STATE: FakeProgressState = {
  startTimes: {},
  progressValues: {},
}

/**
 * Fake Progress 상태 atom (메모리 only, localStorage 불필요)
 */
export const fakeProgressStateAtom = atom<FakeProgressState>(DEFAULT_STATE)

// ============================================================================
// Hook
// ============================================================================

type UseFakeProgressOptions = {
  maxFakeProgress?: number
  minFakeProgress?: number
  duration?: number // ms
}

/**
 * 공유 Fake Progress Hook
 *
 * @param workspaceId - 진행 상황을 추적할 workspace ID
 * @param realProgress - 실제 진행률 (0-100)
 * @param isActive - 진행 중 여부
 * @param options - 설정 옵션
 * @returns displayProgress - 표시할 진행률
 */
export function useSharedFakeProgress(
  workspaceId: string,
  realProgress: number,
  isActive: boolean,
  options: UseFakeProgressOptions = {},
): number {
  const { maxFakeProgress = 15, minFakeProgress = 5, duration = 30_000 } = options

  const [state, setState] = useAtom(fakeProgressStateAtom)
  const animationFrameRef = useRef<number | null>(null)

  // 시작 시간 설정 (isActive가 true가 되면)
  useEffect(() => {
    if (!workspaceId) {
      return
    }

    if (isActive && !state.startTimes[workspaceId]) {
      setState((prev) => ({
        ...prev,
        startTimes: {
          ...prev.startTimes,
          [workspaceId]: Date.now(),
        },
      }))
    }

    if (!isActive && state.startTimes[workspaceId]) {
      // isActive가 false가 되면 정리
      setState((prev) => {
        const { [workspaceId]: _, ...remainingStartTimes } = prev.startTimes
        const { [workspaceId]: __, ...remainingProgress } = prev.progressValues
        return {
          startTimes: remainingStartTimes,
          progressValues: remainingProgress,
        }
      })
    }
  }, [workspaceId, isActive, state.startTimes, setState])

  // Animation loop
  useEffect(() => {
    if (!(workspaceId && isActive)) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }

    const startTime = state.startTimes[workspaceId]
    if (!startTime) {
      return
    }

    const animate = () => {
      const elapsed = Date.now() - startTime
      const t = Math.min(elapsed / duration, 1)

      // Ease-out Cubic: fast start, slow finish
      const easeOutCubic = 1 - (1 - t) ** 3
      const progressRange = maxFakeProgress - minFakeProgress
      const easedProgress = minFakeProgress + easeOutCubic * progressRange

      setState((prev) => ({
        ...prev,
        progressValues: {
          ...prev.progressValues,
          [workspaceId]: easedProgress,
        },
      }))

      if (t < 1 && isActive) {
        animationFrameRef.current = requestAnimationFrame(animate)
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [
    workspaceId,
    isActive,
    state.startTimes,
    duration,
    maxFakeProgress,
    minFakeProgress,
    setState,
  ])

  // 최종 진행률 계산
  const fakeProgress = state.progressValues[workspaceId] || 0
  const effectiveProgress = isActive ? Math.max(fakeProgress, minFakeProgress) : 0

  return Math.max(realProgress, effectiveProgress)
}

/**
 * Fake Progress 값만 읽는 Hook (animation 없이)
 *
 * NotificationItem처럼 자주 리마운트되는 컴포넌트에서 사용
 * 실제 animation은 다른 컴포넌트에서 구동
 */
export function useSharedFakeProgressReadOnly(
  workspaceId: string,
  realProgress: number,
  isActive: boolean,
  minFakeProgress = 5,
): number {
  const state = useAtomValue(fakeProgressStateAtom)

  const fakeProgress = state.progressValues[workspaceId] || 0
  const effectiveProgress = isActive ? Math.max(fakeProgress, minFakeProgress) : 0

  return Math.max(realProgress, effectiveProgress)
}
