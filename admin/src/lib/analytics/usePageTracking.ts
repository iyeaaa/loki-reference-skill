import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { trackPageView } from "@/lib/analytics"

/**
 * 페이지 변경 시 자동으로 페이지뷰를 추적하는 훅
 * RootLayout에서 사용하여 모든 페이지 변경을 추적합니다.
 */
export function usePageTracking() {
  const location = useLocation()

  useEffect(() => {
    // 페이지 변경 시 추적
    trackPageView(location.pathname + location.search)
  }, [location])
}
