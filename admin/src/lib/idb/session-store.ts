/**
 * IndexedDB Session Store for Lead Discovery
 * Service Worker 및 오프라인 지원을 위한 세션 영구 저장소
 *
 * 주요 기능:
 * - 검색 세션 상태 영구 저장 (탭/브라우저 재시작 후에도 유지)
 * - 검색 결과 캐싱
 * - 진행 중인 작업 복구
 */

// IndexedDB 데이터베이스 이름 및 버전
const DB_NAME = "lead-discovery-db"
const DB_VERSION = 2 // 고객 데이터 스토어 추가

// 스토어 이름
const STORE_SESSIONS = "sessions"
const STORE_RESULTS = "results"
const STORE_CUSTOMERS = "customers" // 고객 데이터 (대용량)

// 세션 상태 타입
export type SessionStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "waiting_selection"
  | "waiting_clarification"
  | "complete"
  | "error"
  | "disconnected"

// 세션 데이터 타입
export type StoredSession = {
  id: string
  backendSessionId?: string
  workspaceId: string
  query: string
  status: SessionStatus
  progress: number
  message: string
  createdAt: number
  updatedAt: number
  // 추가 메타데이터
  mode?: string
  recommendations?: unknown[]
  clarificationData?: unknown
  analysisSummary?: string
  analyzedPages?: unknown[]
  error?: string
}

// 검색 결과 데이터 타입
export type StoredResult = {
  sessionId: string
  results: unknown[]
  totalCount: number
  hasMore: boolean
  totalAvailable: number
  savedAt: number
}

// 데이터베이스 인스턴스
let dbInstance: IDBDatabase | null = null
let dbOpenPromise: Promise<IDBDatabase> | null = null

/**
 * IndexedDB 연결 열기
 */
async function openDB(): Promise<IDBDatabase> {
  // 이미 연결되어 있으면 반환
  if (dbInstance) {
    return dbInstance
  }

  // 열기 진행 중이면 대기
  if (dbOpenPromise) {
    return dbOpenPromise
  }

  dbOpenPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      dbOpenPromise = null
      reject(new Error("IndexedDB 열기 실패"))
    }

    request.onsuccess = () => {
      dbInstance = request.result

      // 연결 끊김 처리
      dbInstance.onclose = () => {
        dbInstance = null
        dbOpenPromise = null
      }

      dbInstance.onerror = (event) => {
        console.error("[IDB] 데이터베이스 오류:", event)
      }

      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // 세션 스토어 생성
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const sessionStore = db.createObjectStore(STORE_SESSIONS, { keyPath: "id" })
        sessionStore.createIndex("workspaceId", "workspaceId", { unique: false })
        sessionStore.createIndex("status", "status", { unique: false })
        sessionStore.createIndex("updatedAt", "updatedAt", { unique: false })
      }

      // 결과 스토어 생성
      if (!db.objectStoreNames.contains(STORE_RESULTS)) {
        const resultStore = db.createObjectStore(STORE_RESULTS, { keyPath: "sessionId" })
        resultStore.createIndex("savedAt", "savedAt", { unique: false })
      }

      // 고객 데이터 스토어 생성 (대용량 데이터용)
      if (!db.objectStoreNames.contains(STORE_CUSTOMERS)) {
        const customerStore = db.createObjectStore(STORE_CUSTOMERS, { keyPath: "sessionId" })
        customerStore.createIndex("savedAt", "savedAt", { unique: false })
      }
    }
  })

  return dbOpenPromise
}

/**
 * 세션 저장
 */
export async function saveSession(session: StoredSession): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SESSIONS, "readwrite")
    const store = transaction.objectStore(STORE_SESSIONS)

    const request = store.put({
      ...session,
      updatedAt: Date.now(),
    })

    request.onerror = () => reject(new Error("세션 저장 실패"))
    request.onsuccess = () => resolve()
  })
}

/**
 * 세션 조회
 */
export async function getSession(sessionId: string): Promise<StoredSession | null> {
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
 * 워크스페이스별 세션 목록 조회
 */
export async function getSessionsByWorkspace(workspaceId: string): Promise<StoredSession[]> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SESSIONS, "readonly")
    const store = transaction.objectStore(STORE_SESSIONS)
    const index = store.index("workspaceId")
    const request = index.getAll(workspaceId)

    request.onerror = () => reject(new Error("세션 목록 조회 실패"))
    request.onsuccess = () => resolve(request.result || [])
  })
}

/**
 * 활성 세션 조회 (streaming 또는 waiting 상태)
 */
export async function getActiveSessions(): Promise<StoredSession[]> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SESSIONS, "readonly")
    const store = transaction.objectStore(STORE_SESSIONS)
    const request = store.getAll()

    request.onerror = () => reject(new Error("활성 세션 조회 실패"))
    request.onsuccess = () => {
      const activeStatuses: SessionStatus[] = [
        "connecting",
        "streaming",
        "waiting_selection",
        "waiting_clarification",
      ]
      const activeSessions = (request.result || []).filter((session: StoredSession) =>
        activeStatuses.includes(session.status),
      )
      resolve(activeSessions)
    }
  })
}

/**
 * 세션 삭제
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SESSIONS, STORE_RESULTS], "readwrite")

    // 세션 삭제
    const sessionStore = transaction.objectStore(STORE_SESSIONS)
    sessionStore.delete(sessionId)

    // 연관된 결과도 삭제
    const resultStore = transaction.objectStore(STORE_RESULTS)
    resultStore.delete(sessionId)

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(new Error("세션 삭제 실패"))
  })
}

/**
 * 오래된 세션 정리 (기본 7일)
 */
export async function cleanupOldSessions(
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000,
): Promise<number> {
  const db = await openDB()
  const cutoffTime = Date.now() - maxAgeMs

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SESSIONS, STORE_RESULTS], "readwrite")
    const sessionStore = transaction.objectStore(STORE_SESSIONS)
    const resultStore = transaction.objectStore(STORE_RESULTS)

    const index = sessionStore.index("updatedAt")
    const range = IDBKeyRange.upperBound(cutoffTime)
    const request = index.openCursor(range)

    let deletedCount = 0

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null
      if (cursor) {
        const session = cursor.value as StoredSession
        // 완료되거나 오류 상태인 세션만 삭제 (진행 중인 건 유지)
        if (
          session.status === "complete" ||
          session.status === "error" ||
          session.status === "idle"
        ) {
          sessionStore.delete(session.id)
          resultStore.delete(session.id)
          deletedCount++
        }
        cursor.continue()
      }
    }

    transaction.oncomplete = () => resolve(deletedCount)
    transaction.onerror = () => reject(new Error("세션 정리 실패"))
  })
}

/**
 * 검색 결과 저장
 */
export async function saveResults(result: StoredResult): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_RESULTS, "readwrite")
    const store = transaction.objectStore(STORE_RESULTS)

    const request = store.put({
      ...result,
      savedAt: Date.now(),
    })

    request.onerror = () => reject(new Error("결과 저장 실패"))
    request.onsuccess = () => resolve()
  })
}

/**
 * 검색 결과 조회
 */
export async function getResults(sessionId: string): Promise<StoredResult | null> {
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
 * 모든 결과 정리 (기본 3일)
 */
export async function cleanupOldResults(
  maxAgeMs: number = 3 * 24 * 60 * 60 * 1000,
): Promise<number> {
  const db = await openDB()
  const cutoffTime = Date.now() - maxAgeMs

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_RESULTS, "readwrite")
    const store = transaction.objectStore(STORE_RESULTS)
    const index = store.index("savedAt")
    const range = IDBKeyRange.upperBound(cutoffTime)
    const request = index.openCursor(range)

    let deletedCount = 0

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null
      if (cursor) {
        store.delete(cursor.primaryKey)
        deletedCount++
        cursor.continue()
      }
    }

    transaction.oncomplete = () => resolve(deletedCount)
    transaction.onerror = () => reject(new Error("결과 정리 실패"))
  })
}

// ============================================
// 고객 데이터 저장 (대용량)
// ============================================

// 고객 데이터 타입 (세션별)
export type StoredCustomers = {
  sessionId: string
  customers: unknown[] // Customer[] 타입이지만 순환 참조 방지
  savedAt: number
}

/**
 * 고객 데이터 저장 (세션별)
 */
export async function saveCustomers(sessionId: string, customers: unknown[]): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_CUSTOMERS, "readwrite")
    const store = transaction.objectStore(STORE_CUSTOMERS)

    const data: StoredCustomers = {
      sessionId,
      customers,
      savedAt: Date.now(),
    }

    const request = store.put(data)

    request.onerror = () => reject(new Error("고객 데이터 저장 실패"))
    request.onsuccess = () => resolve()
  })
}

/**
 * 고객 데이터 조회 (세션별)
 */
export async function getCustomers(sessionId: string): Promise<unknown[] | null> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_CUSTOMERS, "readonly")
    const store = transaction.objectStore(STORE_CUSTOMERS)
    const request = store.get(sessionId)

    request.onerror = () => reject(new Error("고객 데이터 조회 실패"))
    request.onsuccess = () => {
      const result = request.result as StoredCustomers | undefined
      resolve(result?.customers || null)
    }
  })
}

/**
 * 고객 데이터 삭제 (세션별)
 */
export async function deleteCustomers(sessionId: string): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_CUSTOMERS, "readwrite")
    const store = transaction.objectStore(STORE_CUSTOMERS)
    const request = store.delete(sessionId)

    request.onerror = () => reject(new Error("고객 데이터 삭제 실패"))
    request.onsuccess = () => resolve()
  })
}

/**
 * 오래된 고객 데이터 정리 (기본 7일)
 */
export async function cleanupOldCustomers(
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000,
): Promise<number> {
  const db = await openDB()
  const cutoffTime = Date.now() - maxAgeMs

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_CUSTOMERS, "readwrite")
    const store = transaction.objectStore(STORE_CUSTOMERS)
    const index = store.index("savedAt")
    const range = IDBKeyRange.upperBound(cutoffTime)
    const request = index.openCursor(range)

    let deletedCount = 0

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null
      if (cursor) {
        store.delete(cursor.primaryKey)
        deletedCount++
        cursor.continue()
      }
    }

    transaction.oncomplete = () => resolve(deletedCount)
    transaction.onerror = () => reject(new Error("고객 데이터 정리 실패"))
  })
}

/**
 * IndexedDB 지원 여부 확인
 */
export function isIndexedDBSupported(): boolean {
  return typeof indexedDB !== "undefined"
}

/**
 * 데이터베이스 연결 상태 확인
 */
export function isDBConnected(): boolean {
  return dbInstance !== null
}
