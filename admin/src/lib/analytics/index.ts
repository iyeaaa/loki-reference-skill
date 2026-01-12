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
    // 자동 페이지뷰 비활성화 (수동 trackPageView만 사용하여 Super Property 일관성 확보)
    track_pageview: false,
    // 크로스 서브도메인 추적을 위해 cookie persistence 사용 (localStorage는 크로스 서브도메인 불가)
    persistence: "cookie",
    // rinda.ai에서 app.rinda.ai로 유입 추적을 위해 cross_subdomain 활성화
    cross_subdomain_cookie: true,

    record_sessions_percent: 100,
  })

  // 플랫폼 구분을 위한 Super Property (모든 이벤트에 자동 첨부)
  mixpanel.register({
    platform: "app",
    app_domain: "app.rinda.ai",
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

  // gtag 초기화 (Google 표준 패턴)
  window.dataLayer = window.dataLayer || []
  window.gtag = function (..._args: unknown[]) {
    // biome-ignore lint/complexity/noArguments: GA4 requires arguments object, not rest params array
    window.dataLayer.push(arguments)
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
export function identifyUser(
  userId: string,
  traits?: {
    email?: string
    name?: string
    plan?: string
    planStartDate?: string
    [key: string]: unknown
  },
) {
  // Mixpanel
  if (mixpanelInitialized) {
    mixpanel.identify(userId)

    if (traits) {
      const { email, name, plan, planStartDate, ...rest } = traits
      mixpanel.people.set({
        ...(email && { $email: email }),
        ...(name && { $name: name }),
        ...(plan && { current_plan: plan }),
        ...(planStartDate && { plan_start_date: planStartDate }),
        ...rest,
      })
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

/**
 * 앱 세션 시작 (DAU 측정용)
 * - 앱 진입 시 호출
 */
export function trackAppSessionStart() {
  const hasVisited = typeof window !== "undefined" && !!localStorage.getItem("rinda_has_visited")

  trackEvent("App Session Start", {
    entry_page: window.location.pathname,
    referrer: document.referrer,
    is_returning_user: hasVisited,
  })

  if (typeof window !== "undefined") {
    localStorage.setItem("rinda_has_visited", "true")
  }
}

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

/**
 * 서베이 스텝 완료
 * @param step - 현재 스텝 번호
 * @param totalSteps - 전체 스텝 수
 * @param data - 추가 데이터
 */
export function trackSurveyStep(step: number, totalSteps: number, data?: Record<string, unknown>) {
  trackEvent("Survey Step Completed", {
    step,
    total_steps: totalSteps,
    is_final_step: step === totalSteps,
    ...data,
  })
}

/**
 * 서베이 전체 완료
 */
export function trackSurveyCompleted(data?: {
  totalSteps?: number
  completionTimeSeconds?: number
}) {
  trackEvent("Survey Completed", {
    total_steps: data?.totalSteps,
    completion_time_seconds: data?.completionTimeSeconds,
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

/**
 * 온보딩 전체 완료
 */
export function trackOnboardingComplete(data?: {
  completionTimeMinutes?: number
  country?: string
}) {
  trackEvent("Onboarding Completed", {
    completion_time_minutes: data?.completionTimeMinutes,
    country: data?.country,
  })

  // User Property 업데이트
  if (mixpanelInitialized) {
    mixpanel.people.set({
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    })
  }
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
    total_steps: 4,
    ...data,
  })

  // User Property에도 저장 (국가별/산업군별 분석용)
  if (mixpanelInitialized && data) {
    mixpanel.people.set({
      ...(data.companyName && { company_name: data.companyName }),
      ...(data.industry && { industry: data.industry }),
      ...(data.target && { target_market: data.target }),
      ...(data.country && { country: data.country }),
    })
  }
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
    total_steps: 4,
    ...data,
  })

  // User Property에도 저장
  if (mixpanelInitialized && data?.emailProvider) {
    mixpanel.people.set({
      email_provider: data.emailProvider,
    })
  }
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
    total_steps: 4,
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
    total_steps: 4,
    ...data,
  })
}

// =====================================
// 캠페인 추적을 위한 상태 (세션 기반)
// =====================================
let campaignCountInSession = 0

/**
 * 캠페인 실행
 * @param data.leadsCount - 리드 수
 * @param data.sequenceId - 시퀀스 ID
 * @param data.isFirstCampaign - 첫 캠페인 여부 (서버에서 전달받거나, 없으면 세션 기준)
 * @param data.campaignNumber - N번째 캠페인 (서버에서 전달받거나, 없으면 세션 기준)
 */
export function trackCampaignExecuted(data?: {
  leadsCount?: number
  sequenceId?: string
  isFirstCampaign?: boolean
  campaignNumber?: number
}) {
  campaignCountInSession++

  const isFirst = data?.isFirstCampaign ?? campaignCountInSession === 1
  const campaignNum = data?.campaignNumber ?? campaignCountInSession

  trackEvent("Campaign Executed", {
    leadsCount: data?.leadsCount,
    sequenceId: data?.sequenceId,
    is_first_campaign: isFirst,
    campaign_number: campaignNum,
  })

  // User Property 업데이트
  if (mixpanelInitialized) {
    mixpanel.people.increment("total_campaigns_executed", 1)
    if (isFirst) {
      mixpanel.people.set({
        first_campaign_at: new Date().toISOString(),
      })
    }
  }
}

// =====================================
// 요금제 관련 이벤트
// =====================================

/**
 * 요금제 변경
 */
export function trackPlanChanged(data: {
  previousPlan: string
  newPlan: string
  changeType: "upgrade" | "downgrade" | "cancel"
  previousPlanDurationDays?: number
}) {
  trackEvent("Plan Changed", {
    previous_plan: data.previousPlan,
    new_plan: data.newPlan,
    change_type: data.changeType,
    previous_plan_duration_days: data.previousPlanDurationDays,
  })

  // User Property 업데이트
  if (mixpanelInitialized) {
    mixpanel.people.set({
      current_plan: data.newPlan,
      plan_changed_at: new Date().toISOString(),
    })
  }
}

// =====================================
// 기능 사용 추적
// =====================================

/** 기능 사용 */
export function trackFeatureUse(featureName: string, properties?: Record<string, unknown>) {
  trackEvent("Feature Used", {
    feature: featureName,
    ...properties,
  })
}
