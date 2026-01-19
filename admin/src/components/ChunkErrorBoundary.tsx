/**
 * ChunkErrorBoundary
 *
 * 배포 후 청크 로드 실패 시 자동으로 새로고침하는 에러 바운더리
 * - 새 배포로 인해 구버전 청크가 404되는 경우 처리
 * - ChunkLoadError 감지 시 페이지 자동 새로고침
 */

import { Component, type ReactNode } from "react"

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  isReloading: boolean
}

// 청크 로드 에러인지 확인
function isChunkLoadError(error: Error): boolean {
  return (
    error.name === "ChunkLoadError" ||
    error.message.includes("Loading chunk") ||
    error.message.includes("Failed to fetch dynamically imported module") ||
    error.message.includes("Importing a module script failed") ||
    error.message.includes("error loading dynamically imported module")
  )
}

// 무한 새로고침 방지를 위한 키
const RELOAD_KEY = "chunk_error_reload"
const RELOAD_TIMEOUT = 10_000 // 10초 내 재발생 시 무한루프 방지

export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, isReloading: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true, isReloading: false }
  }

  componentDidCatch(error: Error) {
    if (isChunkLoadError(error)) {
      // 무한 새로고침 방지 체크
      const lastReload = sessionStorage.getItem(RELOAD_KEY)
      const now = Date.now()

      if (lastReload && now - Number.parseInt(lastReload, 10) < RELOAD_TIMEOUT) {
        // 최근에 이미 새로고침했으면 에러 상태 유지
        console.error("[ChunkErrorBoundary] 최근 새로고침했으나 여전히 에러 발생")
        return
      }

      // 새로고침 타임스탬프 저장
      sessionStorage.setItem(RELOAD_KEY, now.toString())

      // 자동 새로고침
      console.log("[ChunkErrorBoundary] 청크 로드 실패, 페이지 새로고침...")
      this.setState({ isReloading: true })

      // 약간의 딜레이 후 새로고침 (사용자에게 피드백 제공)
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } else {
      // 청크 에러가 아닌 경우 로깅만
      console.error("[ChunkErrorBoundary] 일반 에러:", error)
    }
  }

  render() {
    if (this.state.isReloading) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">새 버전을 불러오는 중...</p>
        </div>
      )
    }

    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">페이지 로드 중 문제가 발생했습니다.</p>
          <button
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            onClick={() => window.location.reload()}
            type="button"
          >
            새로고침
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
