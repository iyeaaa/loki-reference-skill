import { atom } from "jotai"

// BigQuery LeadResult 구조와 일치하는 Customer 인터페이스
export interface Customer {
  id: string
  first_name?: string
  middle_name?: string
  last_name?: string
  title?: string
  company_name?: string
  mailing_address?: string
  primary_city?: string
  primary_state?: string
  zip_code?: string
  country?: string
  phone?: string
  web_address?: string
  email?: string
  revenue?: string
  employee?: string
  industry?: string
  sub_industry?: string
  source: string
  createdAt: Date
}

// 액션 버튼 설정 (대화형 메시지용)
export interface ChatMessageAction {
  id: string
  label: string
  variant?: "default" | "outline" | "ghost" | "destructive"
  onClick: () => void | Promise<void>
  disabled?: boolean
  loading?: boolean
}

// 채팅 메시지 인터페이스
export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  customersAdded?: Customer[]
  actions?: ChatMessageAction[] // 대화형 버튼
  metadata?: {
    type?: "strategy" | "result" | "confirmation"
    websiteUrl?: string
    pendingCustomers?: Customer[]
  }
}

// 채팅 메시지 목록
export const chatMessagesAtom = atom<ChatMessage[]>([])

// 발견된 고객 목록
export const customersAtom = atom<Customer[]>([])

// 로딩 상태
export const isLoadingAtom = atom(false)

// 제출 중 상태 (버튼 즉시 반응용, 컴포넌트 unmount/mount 시에도 유지)
export const isSubmittingAtom = atom(false)

// 고객 추가 액션
export const addCustomerAtom = atom(null, (get, set, customer: Customer) => {
  const customers = get(customersAtom)
  set(customersAtom, [...customers, customer])
})

// 다수 고객 추가 액션
export const addCustomersAtom = atom(null, (get, set, newCustomers: Customer[]) => {
  const customers = get(customersAtom)
  set(customersAtom, [...customers, ...newCustomers])
})

// 채팅 메시지 추가 액션
export const addChatMessageAtom = atom(null, (get, set, message: ChatMessage) => {
  const messages = get(chatMessagesAtom)
  set(chatMessagesAtom, [...messages, message])
})

// 채팅 메시지 업데이트 액션
export const updateChatMessageAtom = atom(
  null,
  (get, set, messageId: string, updates: Partial<ChatMessage>) => {
    const messages = get(chatMessagesAtom)
    const updatedMessages = messages.map((m) => (m.id === messageId ? { ...m, ...updates } : m))
    console.log(
      "[store] updateChatMessageAtom:",
      messageId,
      "Found:",
      messages.some((m) => m.id === messageId),
      "Updates:",
      updates,
    )
    set(chatMessagesAtom, updatedMessages)
  },
)

// 고객 삭제 액션
export const removeCustomerAtom = atom(null, (get, set, customerId: string) => {
  const customers = get(customersAtom)
  set(
    customersAtom,
    customers.filter((c) => c.id !== customerId),
  )
})

// 고객 업데이트 액션
export const updateCustomerAtom = atom(
  null,
  (get, set, customerId: string, updates: Partial<Customer>) => {
    const customers = get(customersAtom)
    set(
      customersAtom,
      customers.map((c) => (c.id === customerId ? { ...c, ...updates } : c)),
    )
  },
)

// 전체 초기화 액션
export const resetAllAtom = atom(null, (_get, set) => {
  set(chatMessagesAtom, [])
  set(customersAtom, [])
})
