/**
 * Analytics Service
 *
 * 통합 애널리틱스 서비스 - Mixpanel, Google Analytics 4, Microsoft Clarity
 *
 * Usage:
 *   import { initAnalytics, trackEvent, identifyUser } from '@/lib/analytics'
 */

import mixpanel from "mixpanel-browser"
import { env, isProduction } from "@/lib/env"

// =====================================
// Clarity Project ID (하드코딩 - 공개되어도 무방)
// =====================================
// const CLARITY_PROJECT_ID = "uwzk9cbqa7"

// =====================================
// 초기화 상태 추적
// =====================================
let mixpanelInitialized = false
let gaInitialized = false
// const clarityInitialized = false

// =====================================
// Mixpanel 설정
// =====================================
function initMixpanel() {
  if (mixpanelInitialized || !env.VITE_MIXPANEL_TOKEN) {
    return
  }

  mixpanel.init(env.VITE_MIXPANEL_TOKEN, {
    debug: !isProduction,
    // SPA에서는 'full-url'로 설정하여 URL 변경 시 자동 페이지뷰 추적
    track_pageview: "full-url",
    // 크로스 서브도메인 추적을 위해 cookie persistence 사용 (localStorage는 크로스 서브도메인 불가)
    persistence: "cookie",
    // rinda.ai에서 app.rinda.ai로 유입 추적을 위해 cross_subdomain 활성화
    cross_subdomain_cookie: true,
  })

  mixpanelInitialized = true
  console.log("[Analytics] Mixpanel initialized")
}

// =====================================
// Google Analytics 설정
// =====================================
declare global {
  // biome-ignore lint/style/useConsistentTypeDefinitions: interface required for Window augmentation (declaration merging)
  interface Window {
    gtag: (...args: unknown[]) => void
    dataLayer: unknown[]
  }
}

function initGoogleAnalytics() {
  const measurementId = env.VITE_GA_MEASUREMENT_ID
  if (gaInitialized || !measurementId) {
    return
  }

  // gtag.js 스크립트 로드
  const script = document.createElement("script")
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.appendChild(script)

  // gtag 초기화
  window.dataLayer = window.dataLayer || []
  window.gtag = (...args: unknown[]) => {
    window.dataLayer.push(args)
  }
  window.gtag("js", new Date())
  window.gtag("config", measurementId, {
    // SPA에서 페이지뷰 자동 추적 비활성화 (수동으로 처리)
    send_page_view: false,
  })

  gaInitialized = true
  console.log("[Analytics] Google Analytics initialized")
}

// =====================================
// 통합 초기화
// =====================================
// Note: Clarity는 index.html에서 공식 스크립트로 초기화됨
export function initAnalytics() {
  initMixpanel()
  initGoogleAnalytics()
}

// =====================================
// 이벤트 추적 함수들
// =====================================

/**
 * 페이지뷰 추적
 */
export function trackPageView(path: string, title?: string) {
  if (!isProduction) {
    console.log("[Analytics] trackPageView", path, title)
  }

  // Mixpanel - track_pageview: "full-url" 설정으로 자동 추적되지만, 수동으로도 추적
  if (mixpanelInitialized) {
    mixpanel.track("Page View", {
      path,
      title: title || document.title,
      url: window.location.href,
    })
  }

  // Google Analytics - SPA에서는 수동으로 page_view 이벤트 전송
  if (gaInitialized && env.VITE_GA_MEASUREMENT_ID && window.gtag) {
    window.gtag("event", "page_view", {
      page_title: title || document.title,
      page_location: window.location.origin + path,
    })
  }
}

/**
 * 커스텀 이벤트 추적
 */
export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (!isProduction) {
    console.log("[Analytics] trackEvent", eventName, properties)
  }

  // Mixpanel
  if (mixpanelInitialized) {
    mixpanel.track(eventName, properties)
  }

  // Google Analytics
  if (gaInitialized && env.VITE_GA_MEASUREMENT_ID && window.gtag) {
    window.gtag("event", eventName, properties)
  }
}

/**
 * 사용자 식별 (로그인 시)
 */
export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  // Mixpanel
  if (mixpanelInitialized) {
    mixpanel.identify(userId)
    if (traits) {
      mixpanel.people.set(traits)
    }
  }

  // Google Analytics
  if (gaInitialized && env.VITE_GA_MEASUREMENT_ID && window.gtag) {
    window.gtag("config", env.VITE_GA_MEASUREMENT_ID, {
      user_id: userId,
    })
  }
}

/**
 * 로그아웃 시 리셋
 */
export function resetAnalytics() {
  if (mixpanelInitialized) {
    mixpanel.reset()
  }
}

// =====================================
// 사전 정의된 이벤트들
// =====================================

/** Trial 페이지 진입 */
export function trackTrialPageVisit(source?: string) {
  const searchParams = new URLSearchParams(window.location.search)

  trackEvent("Trial Page Visit", {
    source: source || "direct",
    referrer: document.referrer,
    utm_source: searchParams.get("utm_source"),
    utm_medium: searchParams.get("utm_medium"),
    utm_campaign: searchParams.get("utm_campaign"),
    utm_content: searchParams.get("utm_content"),
    utm_term: searchParams.get("utm_term"),
  })
}

/** 서베이 스텝 완료 */
export function trackSurveyStep(step: number, data?: Record<string, unknown>) {
  trackEvent("Survey Step Completed", {
    step,
    ...data,
  })
}

/** 회원가입 완료 */
export function trackSignup(method: string) {
  trackEvent("Signup Completed", { method })
}

/** 로그인 완료 */
export function trackLogin(method: string) {
  trackEvent("Login Completed", { method })
}

/** 온보딩 완료 */
export function trackOnboardingComplete() {
  trackEvent("Onboarding Completed")
}

// =====================================
// /company 온보딩 스텝 이벤트
// =====================================

/**
 * 온보딩 Step 1 완료 - 회사 정보 입력
 */
export function trackOnboardingStep1Complete(data?: {
  companyName?: string
  industry?: string
  target?: string
  country?: string
}) {
  trackEvent("Onboarding Step 1 Completed", {
    step: 1,
    stepName: "Company Info",
    ...data,
  })
}

/**
 * 온보딩 Step 2 완료 - 이메일 연동
 */
export function trackOnboardingStep2Complete(data?: {
  emailProvider?: string
  hasEmailConnected?: boolean
}) {
  trackEvent("Onboarding Step 2 Completed", {
    step: 2,
    stepName: "Email Link",
    ...data,
  })
}

/**
 * 온보딩 Step 3 완료 - 바이어 찾기 및 이메일 생성 완료
 */
export function trackOnboardingStep3Complete(data?: {
  leadsFound?: number
  emailsGenerated?: number
}) {
  trackEvent("Onboarding Step 3 Completed", {
    step: 3,
    stepName: "Buyer Loading",
    ...data,
  })
}

/**
 * 온보딩 Step 4 완료 - 캠페인 실행
 */
export function trackOnboardingStep4Complete(data?: {
  leadsCount?: number
  emailsScheduled?: number
}) {
  trackEvent("Onboarding Step 4 Completed", {
    step: 4,
    stepName: "Campaign Execution",
    ...data,
  })
}

/**
 * 캠페인 실행 (온보딩 최종 단계)
 */
export function trackCampaignExecuted(data?: { leadsCount?: number; sequenceId?: string }) {
  trackEvent("Campaign Executed", data)
}

/** 기능 사용 */
export function trackFeatureUse(featureName: string, properties?: Record<string, unknown>) {
  trackEvent("Feature Used", {
    feature: featureName,
    ...properties,
  })
}
