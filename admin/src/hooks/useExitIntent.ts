import { useCallback, useEffect, useRef, useState } from "react"

export type ExitTriggerType = "idle" | "popstate" | null

interface UseExitIntentOptions {
  enabled?: boolean
  idleTimeout?: number // 기본 30000ms (30초)
}

interface UseExitIntentReturn {
  isTriggered: boolean
  triggerType: ExitTriggerType
  dismiss: () => void
  reset: () => void
}

/**
 * 이탈 감지 훅 - 온보딩 전환율 최적화
 *
 * 트리거 조건:
 * 1. idle: 30초 이상 무활동 시
 * 2. popstate: 뒤로가기 버튼 클릭 시
 * 3. beforeunload: 페이지 닫기/새로고침 시 (브라우저 기본 확인창)
 */
export function useExitIntent({
  enabled = true,
  idleTimeout = 30000,
}: UseExitIntentOptions = {}): UseExitIntentReturn {
  const [isTriggered, setIsTriggered] = useState(false)
  const [triggerType, setTriggerType] = useState<ExitTriggerType>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasShownRef = useRef(false) // 세션 내 중복 표시 방지

  // 타이머 리셋 함수
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
    }
    if (enabled && !hasShownRef.current) {
      idleTimerRef.current = setTimeout(() => {
        setIsTriggered(true)
        setTriggerType("idle")
        hasShownRef.current = true
      }, idleTimeout)
    }
  }, [enabled, idleTimeout])

  // 모달 dismiss
  const dismiss = useCallback(() => {
    setIsTriggered(false)
    setTriggerType(null)
  }, [])

  // 완전 리셋 (다음 스텝으로 이동 시)
  const reset = useCallback(() => {
    setIsTriggered(false)
    setTriggerType(null)
    hasShownRef.current = false
    resetIdleTimer()
  }, [resetIdleTimer])

  // Idle detection
  useEffect(() => {
    if (!enabled) return

    const activityEvents = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"]

    const handleActivity = () => {
      resetIdleTimer()
    }

    // 초기 타이머 시작
    resetIdleTimer()

    // 활동 이벤트 리스너 등록
    for (const event of activityEvents) {
      document.addEventListener(event, handleActivity, { passive: true })
    }

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
      for (const event of activityEvents) {
        document.removeEventListener(event, handleActivity)
      }
    }
  }, [enabled, resetIdleTimer])

  // Popstate detection (뒤로가기)
  useEffect(() => {
    if (!enabled) return

    // 히스토리에 더미 상태 추가 (뒤로가기 감지용)
    window.history.pushState({ exitIntentGuard: true }, "")

    const handlePopState = (event: PopStateEvent) => {
      // 이미 모달이 표시 중이거나, 이 세션에서 이미 표시했으면 무시
      if (isTriggered || hasShownRef.current) {
        return
      }

      // 뒤로가기 감지 시 모달 표시
      setIsTriggered(true)
      setTriggerType("popstate")
      hasShownRef.current = true

      // 히스토리 복원 (사용자가 실제로 나가지 않도록)
      window.history.pushState({ exitIntentGuard: true }, "")
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [enabled, isTriggered])

  // Beforeunload (페이지 닫기/새로고침)
  useEffect(() => {
    if (!enabled) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // 브라우저 기본 확인창 표시
      event.preventDefault()
      // 일부 브라우저에서 필요
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [enabled])

  return { isTriggered, triggerType, dismiss, reset }
}
