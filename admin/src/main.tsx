// import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "./i18n/i18n"
import { initAnalytics } from "@/lib/analytics"
import App from "./App.tsx"

// 애널리틱스 초기화 (Mixpanel, GA4, Clarity)
initAnalytics()

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("Root element not found")
}

createRoot(rootElement).render(<App />)
