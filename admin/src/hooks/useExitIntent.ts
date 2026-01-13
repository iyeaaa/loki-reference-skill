import { useCallback, useEffect, useRef, useState } from "react"

export type ExitTriggerType = "idle" | "popstate" | "mouseleave" | null

type UseExitIntentOptions = {
  enabled?: boolean
  idleTimeout?: number // 기본 30000ms (30초)
  mouseLeaveEnabled?: boolean // 화면 밖 이탈 감지 (데스크톱 전용)
}

type UseExitIntentReturn = {
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
 * 3. mouseleave: 마우스가 화면 상단으로 나갈 때 (데스크톱 전용)
 * 4. beforeunload: 페이지 닫기/새로고침 시 (브라우저 기본 확인창)
 */
export function useExitIntent({
  enabled = true,
  idleTimeout = 30_000,
  mouseLeaveEnabled = true,
}: UseExitIntentOptions = {}): UseExitIntentReturn {
  const [isTriggered, setIsTriggered] = useState(false)
  const [triggerType, setTriggerType] = useState<ExitTriggerType>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasShownRef = useRef(false) // 세션 내 중복 표시 방지
  const historyPushedRef = useRef(false) // history pushState 중복 방지
  const isTriggeredRef = useRef(false) // popstate 이벤트에서 사용할 ref

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
    isTriggeredRef.current = false
    hasShownRef.current = false
    // 🔧 FIX: reset 시에는 타이머만 리셋하고 history는 건드리지 않음
    // navigate와의 race condition 방지
    resetIdleTimer()
  }, [resetIdleTimer])

  // Idle detection
  useEffect(() => {
    if (!enabled) {
      return
    }

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

  // 🔧 FIX: isTriggered 상태 변경 시 ref도 동기화
  useEffect(() => {
    isTriggeredRef.current = isTriggered
  }, [isTriggered])

  // Popstate detection (뒤로가기)
  // 🔧 FIX: isTriggered를 의존성에서 제거 - ref로 체크하여 race condition 방지
  useEffect(() => {
    if (!enabled) {
      return
    }

    // 🔧 FIX: 중복 pushState 방지 - 마운트 시 한 번만 실행
    if (!historyPushedRef.current) {
      window.history.pushState({ exitIntentGuard: true }, "")
      historyPushedRef.current = true
    }

    const handlePopState = (_event: PopStateEvent) => {
      // 🔧 FIX: ref를 사용하여 실시간 상태 체크 (closure 문제 방지)
      if (isTriggeredRef.current || hasShownRef.current) {
        return
      }

      // 뒤로가기 감지 시 모달 표시
      setIsTriggered(true)
      isTriggeredRef.current = true
      setTriggerType("popstate")
      hasShownRef.current = true

      // 히스토리 복원 (사용자가 실제로 나가지 않도록)
      window.history.pushState({ exitIntentGuard: true }, "")
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [enabled]) // 🔧 FIX: isTriggered 제거됨 - navigate와의 race condition 해결

  // Beforeunload (페이지 닫기/새로고침)
  useEffect(() => {
    if (!enabled) {
      return
    }

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

  // 🆕 Mouseleave detection (화면 밖 이탈 감지 - 데스크톱 전용)
  // 마우스가 뷰포트 상단으로 나갈 때 감지 (브라우저 닫기/탭 전환 의도)
  useEffect(() => {
    if (!(enabled && mouseLeaveEnabled)) {
      return
    }

    // 모바일 기기 감지 - 터치 이벤트가 있으면 스킵
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0

    if (isTouchDevice) {
      return
    }

    const handleMouseLeave = (event: MouseEvent) => {
      // 이미 모달이 표시 중이거나, 이미 한 번 표시했으면 무시
      if (isTriggeredRef.current || hasShownRef.current) {
        return
      }

      // 마우스가 뷰포트 상단으로 나갈 때만 감지
      // event.clientY <= 0: 마우스가 화면 상단 경계를 넘어감
      // event.relatedTarget === null: 실제로 문서 밖으로 나감
      if (event.clientY <= 0 && event.relatedTarget === null) {
        setIsTriggered(true)
        isTriggeredRef.current = true
        setTriggerType("mouseleave")
        hasShownRef.current = true
      }
    }

    document.addEventListener("mouseleave", handleMouseLeave)

    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave)
    }
  }, [enabled, mouseLeaveEnabled])

  return { isTriggered, triggerType, dismiss, reset }
}
