/**
 * Lead Discovery Service Worker
 * 오프라인 지원 및 백그라운드 세션 복구
 *
 * 주요 기능:
 * - IndexedDB 세션 상태 복구
 * - BroadcastChannel 탭 동기화
 * - 오프라인 시 캐시된 결과 제공
 *
 * 참고: SSE 연결은 Service Worker에서 직접 유지할 수 없음 (브라우저 제약)
 *       대신 세션 상태를 IndexedDB에 저장하고, 탭이 다시 열릴 때 복구
 */

const CACHE_NAME = "lead-discovery-v1"
const CHANNEL_NAME = "lead-discovery-sync"

// IndexedDB 설정
const DB_NAME = "lead-discovery-db"
const DB_VERSION = 1
const STORE_SESSIONS = "sessions"
const STORE_RESULTS = "results"

// BroadcastChannel (Service Worker에서도 사용 가능)
let broadcastChannel = null

/**
 * BroadcastChannel 초기화
 */
function initBroadcastChannel() {
  if (!broadcastChannel && typeof BroadcastChannel !== "undefined") {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME)
  }
  return broadcastChannel
}

/**
 * IndexedDB 열기
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(new Error("IndexedDB 열기 실패"))
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const sessionStore = db.createObjectStore(STORE_SESSIONS, { keyPath: "id" })
        sessionStore.createIndex("workspaceId", "workspaceId", { unique: false })
        sessionStore.createIndex("status", "status", { unique: false })
        sessionStore.createIndex("updatedAt", "updatedAt", { unique: false })
      }

      if (!db.objectStoreNames.contains(STORE_RESULTS)) {
        const resultStore = db.createObjectStore(STORE_RESULTS, { keyPath: "sessionId" })
        resultStore.createIndex("savedAt", "savedAt", { unique: false })
      }
    }
  })
}

/**
 * 세션 조회
 */
async function getSession(sessionId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SESSIONS, "readonly")
    const store = transaction.objectStore(STORE_SESSIONS)
    const request = store.get(sessionId)

    request.onerror = () => reject(new Error("세션 조회 실패"))
    request.onsuccess = () => resolve(request.result || null)
  })
}

/**
 * 활성 세션 조회
 */
async function getActiveSessions() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SESSIONS, "readonly")
    const store = transaction.objectStore(STORE_SESSIONS)
    const request = store.getAll()

    request.onerror = () => reject(new Error("활성 세션 조회 실패"))
    request.onsuccess = () => {
      const activeStatuses = ["connecting", "streaming", "waiting_selection", "waiting_clarification"]
      const activeSessions = (request.result || []).filter((session) =>
        activeStatuses.includes(session.status)
      )
      resolve(activeSessions)
    }
  })
}

/**
 * 검색 결과 조회
 */
async function getResults(sessionId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_RESULTS, "readonly")
    const store = transaction.objectStore(STORE_RESULTS)
    const request = store.get(sessionId)

    request.onerror = () => reject(new Error("결과 조회 실패"))
    request.onsuccess = () => resolve(request.result || null)
  })
}

/**
 * Service Worker 설치
 */
self.addEventListener("install", (event) => {
  console.log("[SW] Lead Discovery Service Worker 설치 중...")

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 오프라인 폴백 페이지 등 필수 리소스 캐시
      // 현재는 최소한만 캐시
      return cache.addAll([])
    })
  )

  // 즉시 활성화
  self.skipWaiting()
})

/**
 * Service Worker 활성화
 */
self.addEventListener("activate", (event) => {
  console.log("[SW] Lead Discovery Service Worker 활성화")

  event.waitUntil(
    Promise.all([
      // 이전 버전 캐시 삭제
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith("lead-discovery-") && name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      }),
      // 모든 클라이언트에 대해 즉시 제어
      self.clients.claim(),
    ])
  )
})

/**
 * 메시지 핸들러 (클라이언트 ↔ Service Worker 통신)
 */
self.addEventListener("message", async (event) => {
  const { type, payload } = event.data

  switch (type) {
    case "GET_SESSION": {
      try {
        const session = await getSession(payload.sessionId)
        event.ports[0]?.postMessage({ success: true, data: session })
      } catch (error) {
        event.ports[0]?.postMessage({ success: false, error: error.message })
      }
      break
    }

    case "GET_ACTIVE_SESSIONS": {
      try {
        const sessions = await getActiveSessions()
        event.ports[0]?.postMessage({ success: true, data: sessions })
      } catch (error) {
        event.ports[0]?.postMessage({ success: false, error: error.message })
      }
      break
    }

    case "GET_RESULTS": {
      try {
        const results = await getResults(payload.sessionId)
        event.ports[0]?.postMessage({ success: true, data: results })
      } catch (error) {
        event.ports[0]?.postMessage({ success: false, error: error.message })
      }
      break
    }

    case "BROADCAST_SESSION_UPDATE": {
      // BroadcastChannel을 통해 모든 탭에 알림
      const channel = initBroadcastChannel()
      if (channel) {
        channel.postMessage({
          type: "session_update",
          tabId: "service-worker",
          timestamp: Date.now(),
          payload: { session: payload.session },
        })
      }
      event.ports[0]?.postMessage({ success: true })
      break
    }

    case "SKIP_WAITING": {
      self.skipWaiting()
      break
    }

    case "PING": {
      event.ports[0]?.postMessage({ success: true, message: "pong" })
      break
    }
  }
})

/**
 * Fetch 이벤트 핸들러 (API 요청 캐싱)
 */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Lead Discovery API 요청인 경우
  if (url.pathname.includes("/api/v1/lead-discovery/")) {
    // SSE 스트림은 캐싱하지 않음
    if (event.request.headers.get("Accept")?.includes("text/event-stream")) {
      return
    }

    // 세션 상태 조회 API는 네트워크 우선, 실패 시 IndexedDB 폴백
    if (url.pathname.includes("/session/") && url.pathname.includes("/status")) {
      event.respondWith(
        fetch(event.request)
          .catch(async () => {
            // 네트워크 실패 시 IndexedDB에서 세션 상태 조회
            const sessionId = url.pathname.split("/session/")[1]?.split("/")[0]
            if (sessionId) {
              try {
                const session = await getSession(sessionId)
                if (session) {
                  return new Response(
                    JSON.stringify({
                      status: session.status,
                      progress: session.progress,
                      hasResults: false,
                      offline: true,
                    }),
                    {
                      headers: { "Content-Type": "application/json" },
                    }
                  )
                }
              } catch {
                // IndexedDB 조회 실패
              }
            }

            // 오프라인 응답
            return new Response(
              JSON.stringify({ error: "offline", message: "네트워크 연결 없음" }),
              {
                status: 503,
                headers: { "Content-Type": "application/json" },
              }
            )
          })
      )
      return
    }
  }

  // 기타 요청은 기본 네트워크 우선 전략
  // (필요시 추가 캐싱 전략 구현)
})

/**
 * 백그라운드 동기화 (Background Sync API)
 * 오프라인에서 시도한 작업을 온라인 복구 시 재시도
 */
self.addEventListener("sync", (event) => {
  if (event.tag === "lead-discovery-sync") {
    event.waitUntil(
      (async () => {
        console.log("[SW] 백그라운드 동기화 시작")

        // 활성 세션 확인 및 복구 시도
        try {
          const sessions = await getActiveSessions()
          if (sessions.length > 0) {
            // BroadcastChannel로 클라이언트에 알림
            const channel = initBroadcastChannel()
            if (channel) {
              channel.postMessage({
                type: "sync_recovery",
                tabId: "service-worker",
                timestamp: Date.now(),
                payload: { sessions },
              })
            }
          }
        } catch (error) {
          console.error("[SW] 동기화 복구 실패:", error)
        }
      })()
    )
  }
})

/**
 * Push 알림 (향후 확장)
 */
self.addEventListener("push", (event) => {
  if (!event.data) return

  try {
    const data = event.data.json()

    if (data.type === "lead-discovery-complete") {
      event.waitUntil(
        self.registration.showNotification("리드 탐색 완료", {
          body: `${data.resultCount || 0}개의 리드를 찾았습니다`,
          icon: "/android-chrome-192x192.png",
          badge: "/favicon-32x32.png",
          tag: `lead-discovery-${data.sessionId}`,
          data: { sessionId: data.sessionId },
        })
      )
    }
  } catch {
    // JSON 파싱 실패
  }
})

/**
 * 알림 클릭 처리
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const sessionId = event.notification.data?.sessionId
  const url = sessionId ? `/lead-discovery?session=${sessionId}` : "/lead-discovery"

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      // 이미 열린 탭이 있으면 포커스
      for (const client of clients) {
        if (client.url.includes("/lead-discovery") && "focus" in client) {
          return client.focus()
        }
      }
      // 없으면 새 탭 열기
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})

console.log("[SW] Lead Discovery Service Worker 로드됨")

