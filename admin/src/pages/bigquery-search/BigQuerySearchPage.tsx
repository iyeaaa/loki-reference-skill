import { AnimatePresence, motion } from "framer-motion"
import {
  Bot,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  Copy,
  Database,
  Download,
  ExternalLink,
  Info,
  Loader2,
  Mail,
  Plus,
  Search,
  Send,
  Sparkles,
  Table,
  Trash2,
  User,
  X,
} from "lucide-react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import toast from "react-hot-toast"
import * as XLSX from "xlsx"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Table as UITable,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// Enrichment 결과 타입
interface EnrichmentResult {
  domain: string
  emails: Array<{
    value: string
    type: string
    confidence?: number
  }>
  companyInfo: {
    name?: string
    description?: string
    industry?: string
    size?: string
    founded?: string
    location?: string
  }
  socialLinks: {
    linkedin?: string
    twitter?: string
    facebook?: string
  }
  rawContent?: string
}

// 데이터 사전 (BigQuery 테이블 메타데이터)
const DATA_DICTIONARY = {
  tableName: "gen-lang-client-0140658679.test_lead_01.lead_csv_data",
  columns: [
    "first_name",
    "middle_name",
    "last_name",
    "title",
    "company_name",
    "mailing_address",
    "primary_city",
    "primary_state",
    "zip_code",
    "country",
    "phone",
    "web_address",
    "email",
    "revenue",
    "employee",
    "industry",
    "sub_industry",
  ],
  industries: [
    "Business Services",
    "Real Estate & Construction",
    "Retail",
    "Manufacturing",
    "Media & Entertainment",
    "Software & Internet",
    "Healthcare",
    "Financial Services",
    "Non-Profit",
    "Computers & Electronics",
    "Travel, Recreation, and Leisure",
    "Education",
    "Telecommunications",
    "Other",
    "Consumer Services",
    "Transportation & Storage",
    "Wholesale & Distribution",
    "Energy & Utilities",
    "Government",
    "Agriculture & Mining",
    "Food & Beverage",
    "Retail & Wholesale",
    "Services (Miscellaneous)",
    "Travel & Accommodation",
    "Recreation & Leisure",
    "Conglomerates",
  ],
  countries: ["USA", "Canada"],
  employeeRanges: [
    "0 - 25",
    "25 - 100",
    "100 - 250",
    "250 - 1000",
    "1K - 10K",
    "10K - 50K",
    "50K - 100K",
    "> 100K",
  ],
  revenueRanges: [
    "$0 - $1M",
    "$1 - $10M",
    "$10 - $50M",
    "$50 - $100M",
    "$100 - $250M",
    "$250 - $500M",
    "$500M - $1B",
    "> $1B",
  ],
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  sql?: string
  results?: Record<string, unknown>[]
  totalCount?: number
  timestamp: Date
  isLoading?: boolean
}

interface LeadResult {
  first_name?: string
  last_name?: string
  company_name?: string
  email?: string
  phone?: string
  web_address?: string
  industry?: string
  sub_industry?: string
  country?: string
  primary_city?: string
  primary_state?: string
  revenue?: string
  employee?: string
  [key: string]: string | number | boolean | undefined
}

// localStorage 키
const STORAGE_KEY = "bigquery-search-messages"
const COLLAPSED_STORAGE_KEY = "bigquery-search-collapsed"

// localStorage에서 메시지 불러오기
const loadMessagesFromStorage = (): Message[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // timestamp를 Date 객체로 변환
      return parsed.map((msg: Message) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }))
    }
  } catch (error) {
    console.error("Failed to load messages from localStorage:", error)
  }
  return []
}

// localStorage에 메시지 저장
const saveMessagesToStorage = (messages: Message[]) => {
  try {
    // isLoading인 메시지는 저장하지 않음
    const messagesToSave = messages.filter((msg) => !msg.isLoading)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messagesToSave))
  } catch (error) {
    console.error("Failed to save messages to localStorage:", error)
  }
}

// localStorage에서 접힌 상태 불러오기
const loadCollapsedFromStorage = (): Set<string> => {
  try {
    const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY)
    if (stored) {
      return new Set(JSON.parse(stored))
    }
  } catch (error) {
    console.error("Failed to load collapsed state from localStorage:", error)
  }
  return new Set()
}

// localStorage에 접힌 상태 저장
const saveCollapsedToStorage = (collapsed: Set<string>) => {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...collapsed]))
  } catch (error) {
    console.error("Failed to save collapsed state to localStorage:", error)
  }
}

export default function BigQuerySearchPage() {
  const welcomeMessage: Message = {
    id: "welcome",
    role: "assistant",
    content: `안녕하세요! 👋 BigQuery 리드 데이터베이스 검색 도우미입니다.

자연어로 질문하시면 SQL 쿼리로 변환해서 결과를 보여드릴게요.

**예시 질문:**
- "헬스케어 산업의 미국 회사 100개 보여줘"
- "직원 수 1000명 이상인 소프트웨어 회사 찾아줘"
- "캐나다에 있는 금융 서비스 회사"
- "매출 10억 달러 이상인 제조업체"

무엇을 찾아드릴까요?`,
    timestamp: new Date(),
  }

  const [messages, setMessages] = useState<Message[]>(() => {
    const storedMessages = loadMessagesFromStorage()
    return storedMessages.length > 0 ? storedMessages : [welcomeMessage]
  })
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set())
  const [customerGroups, setCustomerGroups] = useState<Array<{ id: string; name: string }>>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>("")
  const [isAddingToCampaign, setIsAddingToCampaign] = useState(false)
  const [expandedSql, setExpandedSql] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [collapsedResults, setCollapsedResults] = useState<Set<string>>(() =>
    loadCollapsedFromStorage(),
  )

  // Enrichment 상태
  const [enrichmentModalOpen, setEnrichmentModalOpen] = useState(false)
  const [enrichmentData, setEnrichmentData] = useState<EnrichmentResult | null>(null)
  const [isEnriching, setIsEnriching] = useState(false)
  const [selectedLeadForEnrichment, setSelectedLeadForEnrichment] = useState<LeadResult | null>(
    null,
  )

  // 페이지네이션 상태 (메시지 ID별로 관리)
  const [paginationState, setPaginationState] = useState<
    Record<string, { page: number; pageSize: number }>
  >({})

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputId = useId()

  const workspaceId = localStorage.getItem("selectedWorkspace") || ""
  const API_BASE_URL = import.meta.env.VITE_API_URL || ""

  // 스크롤 자동 이동
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [scrollToBottom])

  // messages 변경 시 localStorage에 저장
  useEffect(() => {
    saveMessagesToStorage(messages)
  }, [messages])

  // collapsedResults 변경 시 localStorage에 저장
  useEffect(() => {
    saveCollapsedToStorage(collapsedResults)
  }, [collapsedResults])

  // 고객 그룹 목록 가져오기
  const fetchCustomerGroups = useCallback(async () => {
    if (!workspaceId || workspaceId === "all") return

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/customer-groups/workspace/${workspaceId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        },
      )

      if (!response.ok) throw new Error("Failed to fetch customer groups")

      const result = await response.json()

      if (Array.isArray(result)) {
        setCustomerGroups(result)
      } else if (result.data && Array.isArray(result.data)) {
        setCustomerGroups(result.data)
      } else {
        setCustomerGroups([])
      }
    } catch (error) {
      console.error("Failed to fetch customer groups:", error)
      setCustomerGroups([])
    }
  }, [workspaceId])

  useEffect(() => {
    fetchCustomerGroups()
  }, [fetchCustomerGroups])

  // 메시지 전송
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    }

    const loadingMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true,
    }

    setMessages((prev) => [...prev, userMessage, loadingMessage])
    setInputValue("")
    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/bigquery/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({
          query: userMessage.content,
          dataDictionary: DATA_DICTIONARY,
        }),
      })

      if (!response.ok) {
        throw new Error("검색 요청 실패")
      }

      const result = await response.json()

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: result.explanation || "검색 결과입니다.",
                sql: result.sql,
                results: result.results,
                totalCount: result.totalCount,
                isLoading: false,
              }
            : msg,
        ),
      )
    } catch (error) {
      console.error("Search error:", error)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: "죄송합니다. 검색 중 오류가 발생했습니다. 다시 시도해주세요.",
                isLoading: false,
              }
            : msg,
        ),
      )
      toast.error("검색 중 오류가 발생했습니다")
    } finally {
      setIsLoading(false)
    }
  }

  // Enter 키 처리
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // SQL 복사
  const handleCopySql = async (sql: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(sql)
      setCopiedId(messageId)
      toast.success("SQL이 클립보드에 복사되었습니다")
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error("복사 실패")
    }
  }

  // SQL 토글
  const toggleSqlExpand = (messageId: string) => {
    setExpandedSql((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  // 결과 선택
  const toggleResultSelect = (index: number) => {
    setSelectedResults((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  // 전체 선택
  const toggleSelectAll = (results: LeadResult[]) => {
    if (selectedResults.size === results.length) {
      setSelectedResults(new Set())
    } else {
      setSelectedResults(new Set(results.map((_, i) => i)))
    }
  }

  // 결과 테이블 접기/펼치기
  const toggleResultsCollapse = (messageId: string) => {
    setCollapsedResults((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  // 엑셀 다운로드
  const handleDownloadExcel = (results: LeadResult[], messageId: string) => {
    const dataToExport =
      selectedResults.size > 0 ? results.filter((_, i) => selectedResults.has(i)) : results

    const ws = XLSX.utils.json_to_sheet(dataToExport)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Results")
    XLSX.writeFile(wb, `bigquery_results_${messageId}.xlsx`)
    toast.success(`${dataToExport.length}개 결과 다운로드 완료`)
  }

  // 리드 정보 조회 (Enrichment)
  const handleEnrichLead = async (lead: LeadResult) => {
    if (!lead.web_address) {
      toast.error("웹사이트 주소가 없어 정보를 조회할 수 없습니다")
      return
    }

    setSelectedLeadForEnrichment(lead)
    setEnrichmentModalOpen(true)
    setIsEnriching(true)
    setEnrichmentData(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/lead-enrichment/enrich`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({
          webAddress: lead.web_address,
          companyName: lead.company_name || "",
        }),
      })

      const result = await response.json()

      if (result.success && result.data) {
        setEnrichmentData(result.data)
      } else {
        toast.error(result.error || "정보 조회에 실패했습니다")
      }
    } catch (error) {
      console.error("Enrichment error:", error)
      toast.error("정보 조회 중 오류가 발생했습니다")
    } finally {
      setIsEnriching(false)
    }
  }

  // 캠페인에 추가
  const handleAddToCampaign = async (results: LeadResult[]) => {
    if (!selectedGroupId) {
      toast.error("고객 그룹을 선택해주세요")
      return
    }

    const leadsToAdd =
      selectedResults.size > 0 ? results.filter((_, i) => selectedResults.has(i)) : results

    if (leadsToAdd.length === 0) {
      toast.error("추가할 리드를 선택해주세요")
      return
    }

    setIsAddingToCampaign(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/customer-groups/${selectedGroupId}/members/bulk`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: JSON.stringify({
            leads: leadsToAdd.map((lead) => ({
              email: lead.email,
              firstName: lead.first_name,
              lastName: lead.last_name,
              companyName: lead.company_name,
              phone: lead.phone,
              country: lead.country,
              city: lead.primary_city,
              industry: lead.industry,
            })),
          }),
        },
      )

      if (!response.ok) throw new Error("Failed to add leads to campaign")

      toast.success(`${leadsToAdd.length}개 리드가 캠페인에 추가되었습니다`)
      setSelectedResults(new Set())
    } catch (error) {
      console.error("Error adding to campaign:", error)
      toast.error("캠페인 추가 실패")
    } finally {
      setIsAddingToCampaign(false)
    }
  }

  // 마지막 결과 가져오기
  const getLastResults = (): LeadResult[] => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const results = messages[i].results
      if (results && results.length > 0) {
        return results as LeadResult[]
      }
    }
    return []
  }

  const lastResults = getLastResults()

  // 페이지네이션 함수들
  const getPageState = (messageId: string) => {
    return paginationState[messageId] || { page: 1, pageSize: 25 }
  }

  const setPage = (messageId: string, page: number) => {
    setPaginationState((prev) => ({
      ...prev,
      [messageId]: { ...getPageState(messageId), page },
    }))
  }

  const setPageSize = (messageId: string, pageSize: number) => {
    setPaginationState((prev) => ({
      ...prev,
      [messageId]: { page: 1, pageSize },
    }))
  }

  const getPaginatedResults = (results: LeadResult[], messageId: string) => {
    const { page, pageSize } = getPageState(messageId)
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    return results.slice(startIndex, endIndex)
  }

  const getTotalPages = (results: LeadResult[], messageId: string) => {
    const { pageSize } = getPageState(messageId)
    return Math.ceil(results.length / pageSize)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* 헤더 */}
      <div className="flex-none border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">BigQuery 리드 검색</h1>
              <p className="text-sm text-muted-foreground">
                자연어로 100만+ 리드 데이터베이스 검색
              </p>
            </div>
          </div>

          {/* 캠페인 추가 버튼 */}
          {lastResults.length > 0 && (
            <div className="flex items-center gap-3">
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="고객 그룹 선택" />
                </SelectTrigger>
                <SelectContent>
                  {customerGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => handleAddToCampaign(lastResults)}
                disabled={isAddingToCampaign || !selectedGroupId}
                className="gap-2"
              >
                {isAddingToCampaign ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                캠페인에 추가 {selectedResults.size > 0 && `(${selectedResults.size})`}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  handleDownloadExcel(lastResults, messages[messages.length - 1]?.id || "results")
                }
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Excel
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  localStorage.removeItem(STORAGE_KEY)
                  localStorage.removeItem(COLLAPSED_STORAGE_KEY)
                  setMessages([welcomeMessage])
                  setSelectedResults(new Set())
                  setCollapsedResults(new Set())
                  toast.success("검색 기록이 삭제되었습니다")
                }}
                className="text-muted-foreground hover:text-destructive"
                title="검색 기록 삭제"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 메시지 영역 */}
      <ScrollArea className="flex-1 px-6 py-4">
        <div className="max-w-5xl mx-auto space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "flex gap-4",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {message.role === "assistant" && (
                  <div className="flex-none">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                      <Bot className="h-4 w-4" />
                    </div>
                  </div>
                )}

                <div
                  className={cn(
                    "flex flex-col gap-2 max-w-[85%]",
                    message.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3",
                      message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    {message.isLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>검색 중...</span>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                    )}
                  </div>

                  {/* SQL 쿼리 표시 */}
                  {message.sql && (
                    <div className="w-full">
                      <button
                        type="button"
                        onClick={() => toggleSqlExpand(message.id)}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {expandedSql.has(message.id) ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                        SQL 쿼리 보기
                      </button>

                      <AnimatePresence>
                        {expandedSql.has(message.id) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2 relative group">
                              <pre className="bg-zinc-950 text-zinc-100 rounded-lg p-4 text-xs overflow-x-auto">
                                <code>{message.sql}</code>
                              </pre>
                              <button
                                type="button"
                                onClick={() => handleCopySql(message.sql ?? "", message.id)}
                                className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                {copiedId === message.id ? (
                                  <Check className="h-3.5 w-3.5 text-green-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5 text-zinc-400" />
                                )}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* 결과 없음 메시지 */}
                  {message.results && message.results.length === 0 && message.sql && (
                    <Card className="w-full mt-2 border-0 shadow-lg">
                      <CardContent className="py-8">
                        <div className="flex flex-col items-center justify-center text-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                            <Search className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">검색 결과가 없습니다</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              해당 조건에 맞는 데이터를 찾지 못했습니다.
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              다른 검색어나 조건으로 다시 시도해보세요.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 결과 테이블 */}
                  {message.results &&
                    message.results.length > 0 &&
                    (() => {
                      const results = message.results as LeadResult[]
                      const paginatedResults = getPaginatedResults(results, message.id)
                      const totalPages = getTotalPages(results, message.id)
                      const { page, pageSize } = getPageState(message.id)
                      const startIndex = (page - 1) * pageSize

                      return (
                        <Card className="w-full mt-2 overflow-hidden border-0 shadow-lg">
                          <CardHeader
                            className="py-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 cursor-pointer select-none"
                            onClick={() => toggleResultsCollapse(message.id)}
                          >
                            <div className="flex items-center justify-between flex-wrap gap-3">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 shadow-md">
                                  <Table className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                  <CardTitle className="text-sm font-semibold">검색 결과</CardTitle>
                                  <CardDescription className="text-xs">
                                    총 {message.totalCount?.toLocaleString() || results.length}개 중{" "}
                                    {results.length}개 로드됨
                                  </CardDescription>
                                </div>
                                <button
                                  type="button"
                                  className="ml-2 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleResultsCollapse(message.id)
                                  }}
                                >
                                  {collapsedResults.has(message.id) ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </button>
                              </div>

                              {/* 페이지 크기 선택 */}
                              {!collapsedResults.has(message.id) && (
                                /* biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation only */
                                <div
                                  className="flex items-center gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="text-xs text-muted-foreground">표시 개수:</span>
                                  <Select
                                    value={pageSize.toString()}
                                    onValueChange={(v) => setPageSize(message.id, Number(v))}
                                  >
                                    <SelectTrigger className="w-[80px] h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {[10, 25, 50, 100].map((size) => (
                                        <SelectItem key={size} value={size.toString()}>
                                          {size}개
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          </CardHeader>
                          <AnimatePresence>
                            {!collapsedResults.has(message.id) && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <CardContent className="p-0">
                                  <div className="overflow-x-auto">
                                    <UITable>
                                      <TableHeader>
                                        <TableRow className="bg-slate-50/50 dark:bg-slate-900/50">
                                          <TableHead className="w-[50px]">
                                            <Checkbox
                                              checked={
                                                selectedResults.size === results.length &&
                                                results.length > 0
                                              }
                                              onCheckedChange={() => toggleSelectAll(results)}
                                            />
                                          </TableHead>
                                          <TableHead className="font-semibold">#</TableHead>
                                          <TableHead className="font-semibold">회사명</TableHead>
                                          <TableHead className="font-semibold">웹사이트</TableHead>
                                          <TableHead className="font-semibold">이름</TableHead>
                                          <TableHead className="font-semibold">이메일</TableHead>
                                          <TableHead className="font-semibold">산업</TableHead>
                                          <TableHead className="font-semibold">국가/도시</TableHead>
                                          <TableHead className="font-semibold">직원수</TableHead>
                                          <TableHead className="font-semibold text-center">
                                            정보
                                          </TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {paginatedResults.map((result, index) => {
                                          const globalIndex = startIndex + index
                                          return (
                                            <TableRow
                                              key={globalIndex}
                                              className={cn(
                                                "transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/50",
                                                selectedResults.has(globalIndex) &&
                                                  "bg-blue-50/50 dark:bg-blue-950/30",
                                              )}
                                            >
                                              <TableCell>
                                                <Checkbox
                                                  checked={selectedResults.has(globalIndex)}
                                                  onCheckedChange={() =>
                                                    toggleResultSelect(globalIndex)
                                                  }
                                                />
                                              </TableCell>
                                              <TableCell className="text-xs text-muted-foreground font-mono">
                                                {globalIndex + 1}
                                              </TableCell>
                                              <TableCell className="font-medium max-w-[200px] truncate">
                                                {result.company_name || "-"}
                                              </TableCell>
                                              <TableCell className="max-w-[180px]">
                                                {result.web_address ? (
                                                  <a
                                                    href={
                                                      result.web_address.startsWith("http")
                                                        ? result.web_address
                                                        : `https://${result.web_address}`
                                                    }
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                                    title={result.web_address}
                                                  >
                                                    <span className="truncate max-w-[140px]">
                                                      {result.web_address.replace(
                                                        /^https?:\/\//,
                                                        "",
                                                      )}
                                                    </span>
                                                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                                  </a>
                                                ) : (
                                                  <span className="text-xs text-muted-foreground">
                                                    -
                                                  </span>
                                                )}
                                              </TableCell>
                                              <TableCell>
                                                {[result.first_name, result.last_name]
                                                  .filter(Boolean)
                                                  .join(" ") || "-"}
                                              </TableCell>
                                              <TableCell className="max-w-[200px] truncate font-mono text-xs">
                                                {result.email || "-"}
                                              </TableCell>
                                              <TableCell>
                                                <div className="flex flex-col">
                                                  <span className="text-xs">
                                                    {result.industry || "-"}
                                                  </span>
                                                  {result.sub_industry && (
                                                    <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                                                      {result.sub_industry}
                                                    </span>
                                                  )}
                                                </div>
                                              </TableCell>
                                              <TableCell>
                                                <div className="flex flex-col text-xs">
                                                  <span>{result.country || "-"}</span>
                                                  <span className="text-muted-foreground">
                                                    {result.primary_city}
                                                    {result.primary_state &&
                                                      `, ${result.primary_state}`}
                                                  </span>
                                                </div>
                                              </TableCell>
                                              <TableCell>
                                                <Badge
                                                  variant="outline"
                                                  className="text-xs font-normal"
                                                >
                                                  {result.employee || "-"}
                                                </Badge>
                                              </TableCell>
                                              <TableCell className="text-center">
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-7 w-7 p-0"
                                                  onClick={() => handleEnrichLead(result)}
                                                  disabled={!result.web_address}
                                                  title={
                                                    result.web_address
                                                      ? "회사 정보 조회"
                                                      : "웹사이트 주소 없음"
                                                  }
                                                >
                                                  <Info className="h-4 w-4" />
                                                </Button>
                                              </TableCell>
                                            </TableRow>
                                          )
                                        })}
                                      </TableBody>
                                    </UITable>
                                  </div>

                                  {/* 페이지네이션 UI */}
                                  {totalPages > 1 && (
                                    <div className="flex items-center justify-between px-4 py-3 border-t bg-gradient-to-r from-slate-50/50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/50">
                                      <div className="text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground">
                                          {startIndex + 1}-
                                          {Math.min(startIndex + pageSize, results.length)}
                                        </span>{" "}
                                        / {results.length}개 항목
                                      </div>

                                      <div className="flex items-center gap-1">
                                        {/* 처음으로 */}
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => setPage(message.id, 1)}
                                          disabled={page === 1}
                                        >
                                          <ChevronsLeft className="h-4 w-4" />
                                        </Button>

                                        {/* 이전 */}
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => setPage(message.id, page - 1)}
                                          disabled={page === 1}
                                        >
                                          <ChevronLeft className="h-4 w-4" />
                                        </Button>

                                        {/* 페이지 번호들 */}
                                        <div className="flex items-center gap-1 mx-1">
                                          {(() => {
                                            const pages: (number | string)[] = []
                                            const showPages = 5
                                            let start = Math.max(
                                              1,
                                              page - Math.floor(showPages / 2),
                                            )
                                            const end = Math.min(totalPages, start + showPages - 1)

                                            if (end - start + 1 < showPages) {
                                              start = Math.max(1, end - showPages + 1)
                                            }

                                            if (start > 1) {
                                              pages.push(1)
                                              if (start > 2) pages.push("...")
                                            }

                                            for (let i = start; i <= end; i++) {
                                              pages.push(i)
                                            }

                                            if (end < totalPages) {
                                              if (end < totalPages - 1) pages.push("...")
                                              pages.push(totalPages)
                                            }

                                            return pages.map((p, idx) => {
                                              if (p === "...") {
                                                return (
                                                  <span
                                                    key={`ellipsis-${idx < 3 ? "start" : "end"}`}
                                                    className="px-2 text-muted-foreground"
                                                  >
                                                    ⋯
                                                  </span>
                                                )
                                              }
                                              return (
                                                <Button
                                                  key={p}
                                                  variant={page === p ? "default" : "ghost"}
                                                  size="icon"
                                                  className={cn(
                                                    "h-8 w-8 text-xs font-medium transition-all",
                                                    page === p
                                                      ? "bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md hover:from-blue-600 hover:to-cyan-600"
                                                      : "hover:bg-slate-100 dark:hover:bg-slate-800",
                                                  )}
                                                  onClick={() => setPage(message.id, p as number)}
                                                >
                                                  {p}
                                                </Button>
                                              )
                                            })
                                          })()}
                                        </div>

                                        {/* 다음 */}
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => setPage(message.id, page + 1)}
                                          disabled={page === totalPages}
                                        >
                                          <ChevronRight className="h-4 w-4" />
                                        </Button>

                                        {/* 마지막으로 */}
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => setPage(message.id, totalPages)}
                                          disabled={page === totalPages}
                                        >
                                          <ChevronsRight className="h-4 w-4" />
                                        </Button>
                                      </div>

                                      <div className="text-xs text-muted-foreground">
                                        페이지{" "}
                                        <span className="font-medium text-foreground">{page}</span>{" "}
                                        / {totalPages}
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Card>
                      )
                    })()}
                </div>

                {message.role === "user" && (
                  <div className="flex-none">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-500 text-white">
                      <User className="h-4 w-4" />
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* 입력 영역 */}
      <div className="flex-none border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              id={inputId}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="예: 헬스케어 산업의 미국 회사 100개 보여줘..."
              className="min-h-[60px] max-h-[200px] pr-14 resize-none rounded-2xl bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary/20"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-2 bottom-2 h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-lg"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-center gap-4 mt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              <span>자연어를 SQL로 변환하여 검색합니다</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Database className="h-3 w-3" />
              <span>1,048,575개 리드 데이터</span>
            </div>
          </div>
        </form>
      </div>

      {/* 회사 정보 조회 모달 */}
      <Dialog open={enrichmentModalOpen} onOpenChange={setEnrichmentModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              {selectedLeadForEnrichment?.company_name || "회사 정보"}
            </DialogTitle>
            <DialogDescription>
              {selectedLeadForEnrichment?.web_address && (
                <a
                  href={
                    selectedLeadForEnrichment.web_address.startsWith("http")
                      ? selectedLeadForEnrichment.web_address
                      : `https://${selectedLeadForEnrichment.web_address}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-500 hover:underline"
                >
                  {selectedLeadForEnrichment.web_address}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
            {isEnriching ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <div className="text-center">
                  <p className="font-medium">정보를 조회하고 있습니다...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    웹사이트 분석 및 이메일 검색 중
                  </p>
                </div>
              </div>
            ) : enrichmentData ? (
              <div className="space-y-6 py-4">
                {/* 회사 설명 */}
                {enrichmentData.companyInfo?.description && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-500" />
                      회사 소개
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                      {enrichmentData.companyInfo.description}
                    </p>
                    {enrichmentData.companyInfo?.industry && (
                      <Badge variant="secondary" className="text-xs">
                        {enrichmentData.companyInfo.industry}
                      </Badge>
                    )}
                  </div>
                )}

                {/* 이메일 목록 */}
                {enrichmentData.emails && enrichmentData.emails.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Mail className="h-4 w-4 text-blue-500" />
                      발견된 이메일 ({enrichmentData.emails.length}개)
                    </h4>
                    <div className="space-y-2">
                      {enrichmentData.emails.map((email, idx) => (
                        <div
                          key={email.value}
                          className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-lg p-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground font-mono">
                              {idx + 1}
                            </span>
                            <a
                              href={`mailto:${email.value}`}
                              className="font-mono text-sm text-blue-600 hover:underline"
                            >
                              {email.value}
                            </a>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={email.type === "generic" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {email.type === "generic" ? "공용" : email.type}
                            </Badge>
                            {email.confidence !== undefined && email.confidence > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {Math.round(email.confidence)}%
                              </span>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                navigator.clipboard.writeText(email.value)
                                toast.success("이메일 복사됨")
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 이메일 없음 */}
                {(!enrichmentData.emails || enrichmentData.emails.length === 0) && (
                  <div className="text-center py-6 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                    <Mail className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      공개된 이메일을 찾지 못했습니다
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Hunter.io API 키를 설정하면 더 많은 이메일을 찾을 수 있습니다
                    </p>
                  </div>
                )}

                {/* 기존 리드 정보 */}
                {selectedLeadForEnrichment && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-500" />
                      기존 리드 정보
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {selectedLeadForEnrichment.email && (
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                          <span className="text-xs text-muted-foreground">이메일</span>
                          <p className="font-mono truncate">{selectedLeadForEnrichment.email}</p>
                        </div>
                      )}
                      {selectedLeadForEnrichment.phone && (
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                          <span className="text-xs text-muted-foreground">전화번호</span>
                          <p>{selectedLeadForEnrichment.phone}</p>
                        </div>
                      )}
                      {selectedLeadForEnrichment.industry && (
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                          <span className="text-xs text-muted-foreground">산업</span>
                          <p>{selectedLeadForEnrichment.industry}</p>
                        </div>
                      )}
                      {selectedLeadForEnrichment.employee && (
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                          <span className="text-xs text-muted-foreground">직원수</span>
                          <p>{selectedLeadForEnrichment.employee}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <X className="h-8 w-8 text-red-500" />
                <p className="text-sm text-muted-foreground">정보를 불러오지 못했습니다</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
