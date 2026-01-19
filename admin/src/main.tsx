// import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "./i18n/i18n"
import { initAnalytics } from "@/lib/analytics"
import App from "./App.tsx"

// 애널리틱스 초기화 (Mixpanel, GA4, Clarity)
initAnalytics()

// Vite 청크 로드 에러 핸들러 (배포 후 구버전 청크 404 시 자동 새로고침)
// ChunkErrorBoundary와 함께 사용하여 이중 보호
window.addEventListener("vite:preloadError", (event) => {
  console.log("[Vite] 청크 프리로드 실패, 페이지 새로고침...", event)
  window.location.reload()
})

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("Root element not found")
}

createRoot(rootElement).render(<App />)
